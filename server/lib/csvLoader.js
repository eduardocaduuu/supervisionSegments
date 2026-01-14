const fs = require('fs');
const Papa = require('papaparse');

// Cache para evitar recarregar CSV a cada requisição
const cache = {
  manha: { data: null, lastModified: null },
  tarde: { data: null, lastModified: null }
};

/**
 * Converte valor monetário brasileiro para número
 * Ex: "1.234,56" -> 1234.56
 */
function parseMonetaryValue(value) {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'string') return 0;

  // Remove espaços
  let cleaned = value.trim();

  // Detecta formato brasileiro (1.234,56) vs americano (1,234.56)
  const hasCommaSeparator = cleaned.includes(',');
  const hasDotSeparator = cleaned.includes('.');

  if (hasCommaSeparator && hasDotSeparator) {
    // Formato brasileiro: 1.234,56
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
    // Formato americano: 1,234.56
    else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasCommaSeparator) {
    // Apenas vírgula: 1234,56 (brasileiro)
    cleaned = cleaned.replace(',', '.');
  }
  // Se só tem ponto, já está no formato correto

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Extrai o código do setor do texto completo
 * Ex: "14210 FVC - 13706 - A - ALCINA MARIA 1" -> "14210"
 */
function extractSetorId(setorText) {
  if (!setorText) return null;
  const match = setorText.toString().match(/^(\d+)/);
  return match ? match[1] : null;
}

/**
 * Carrega e parseia um arquivo CSV
 */
async function loadCSV(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`Arquivo não encontrado: ${filePath}`));
    }

    // Check cache
    const slot = filePath.includes('manha') ? 'manha' : 'tarde';
    const stats = fs.statSync(filePath);
    const currentModified = stats.mtime.getTime();

    if (cache[slot].data && cache[slot].lastModified === currentModified) {
      return resolve(cache[slot].data);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // Detecta delimitador
    const firstLine = fileContent.split('\n')[0];
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    Papa.parse(fileContent, {
      header: true,
      delimiter,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn('Avisos no parse CSV:', results.errors.slice(0, 5));
        }

        // Normaliza dados
        const normalizedData = results.data.map(row => {
          // Tenta encontrar as colunas com diferentes grafias
          const setor = row.Setor || row.setor || row.SETOR || '';
          const codigoRevendedor = row.CodigoRevendedor || row.codigoRevendedor || row.CODIGOREVENDEDOR || row['Código Revendedor'] || '';
          const nomeRevendedora = row.NomeRevendedora || row.nomeRevendedora || row.NOMEREVENDEDORA || row['Nome Revendedora'] || '';
          const cicloFaturamento = row.CicloFaturamento || row.cicloFaturamento || row.CICLOFATURAMENTO || row['Ciclo Faturamento'] || '';
          const codigoProduto = row.CodigoProduto || row.codigoProduto || row.CODIGOPRODUTO || row['Código Produto'] || '';
          const nomeProduto = row.NomeProduto || row.nomeProduto || row.NOMEPRODUTO || row['Nome Produto'] || '';
          const quantidadeItens = row.QuantidadeItens || row.quantidadeItens || row.QUANTIDADEITENS || row['Quantidade Itens'] || 0;
          const valorPraticado = row.ValorPraticado || row.valorPraticado || row.VALORPRATICADO || row['Valor Praticado'] || '0';
          const tipo = row.Tipo || row.tipo || row.TIPO || '';

          return {
            setor: setor.toString().trim(),
            setorId: extractSetorId(setor),
            codigoRevendedor: codigoRevendedor.toString().trim(),
            nomeRevendedora: nomeRevendedora.toString().trim(),
            cicloFaturamento: cicloFaturamento.toString().trim(),
            codigoProduto: codigoProduto.toString().trim(),
            nomeProduto: nomeProduto.toString().trim(),
            quantidadeItens: parseInt(quantidadeItens) || 1,
            valorPraticado: parseMonetaryValue(valorPraticado),
            tipo: tipo.toString().trim().toLowerCase()
          };
        }).filter(row => row.setorId && row.codigoRevendedor);

        // Update cache
        cache[slot].data = normalizedData;
        cache[slot].lastModified = currentModified;

        resolve(normalizedData);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

/**
 * Agrega dados por revendedor para um setor específico
 */
function getAggregatedData(data, setorId) {
  // Filtra pelo setor
  const setorData = data.filter(row => row.setorId === setorId);

  if (setorData.length === 0) {
    return null;
  }

  // Pega o nome do setor
  const setorNome = setorData[0].setor;

  // Agrupa por revendedor
  const revendedoresMap = new Map();

  setorData.forEach(row => {
    // Só considera vendas
    if (row.tipo !== 'venda') return;

    const key = row.codigoRevendedor;

    if (!revendedoresMap.has(key)) {
      revendedoresMap.set(key, {
        codigoRevendedor: row.codigoRevendedor,
        nomeRevendedora: row.nomeRevendedora,
        totalGeral: 0,
        totalPorCiclo: {},
        quantidadeItens: 0,
        quantidadeProdutos: 0
      });
    }

    const rev = revendedoresMap.get(key);
    rev.totalGeral += row.valorPraticado;
    rev.quantidadeItens += row.quantidadeItens;
    rev.quantidadeProdutos += 1;

    // Agrupa por ciclo
    if (row.cicloFaturamento) {
      if (!rev.totalPorCiclo[row.cicloFaturamento]) {
        rev.totalPorCiclo[row.cicloFaturamento] = 0;
      }
      rev.totalPorCiclo[row.cicloFaturamento] += row.valorPraticado;
    }
  });

  const revendedores = Array.from(revendedoresMap.values()).map(rev => ({
    ...rev,
    totalGeral: Math.round(rev.totalGeral * 100) / 100
  }));

  return {
    setorId,
    setorNome,
    revendedores,
    totalSetor: revendedores.reduce((sum, r) => sum + r.totalGeral, 0)
  };
}

/**
 * Compara snapshots manhã vs tarde para um setor
 */
function compareSnapshots(manhaData, tardeData, setorId) {
  const manhaAgg = getAggregatedData(manhaData, setorId);
  const tardeAgg = getAggregatedData(tardeData, setorId);

  if (!manhaAgg || !tardeAgg) {
    return null;
  }

  const comparativo = [];

  // Cria mapa de manhã para lookup
  const manhaMap = new Map();
  manhaAgg.revendedores.forEach(r => {
    manhaMap.set(r.codigoRevendedor, r.totalGeral);
  });

  // Compara com tarde
  tardeAgg.revendedores.forEach(r => {
    const totalManha = manhaMap.get(r.codigoRevendedor) || 0;
    const delta = r.totalGeral - totalManha;

    comparativo.push({
      codigoRevendedor: r.codigoRevendedor,
      nomeRevendedora: r.nomeRevendedora,
      totalManha,
      totalTarde: r.totalGeral,
      delta,
      cresceuHoje: delta > 0
    });
  });

  // Ordena por delta (quem mais cresceu primeiro)
  comparativo.sort((a, b) => b.delta - a.delta);

  return {
    totalManhaSetor: manhaAgg.totalSetor,
    totalTardeSetor: tardeAgg.totalSetor,
    deltaSetor: tardeAgg.totalSetor - manhaAgg.totalSetor,
    revendedores: comparativo
  };
}

module.exports = {
  loadCSV,
  getAggregatedData,
  compareSnapshots,
  parseMonetaryValue,
  extractSetorId
};
