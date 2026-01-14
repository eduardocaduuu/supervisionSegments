const fs = require('fs');
const Papa = require('papaparse');

// Cache para evitar recarregar CSV a cada requisição
const cache = {
  manha: { data: null, lastModified: null },
  tarde: { data: null, lastModified: null }
};

// Mapeamento de nome do setor para codigo
// Baseado na lista fornecida no requisito
const SETOR_MAP = {
  'PRATA / Palmeira / Igaci': '1260',
  'PLATINA & OURO / Palmeira / Igaci': '4005',
  'PRATA 2 / Major / Cacimbinhas / Estrela / Quebrangulo / Minador': '8238',
  'SUPERVISORA DE RELACIONAMENTO PALMEIRA DOS INDIOS': '8239',
  'FVC - 13706 - A - ALCINA MARIA 1': '14210',
  'FVC - 13706- BER - ALCINA MARIA': '16283',
  'FVC - 13706 - A - ALCINA MARIA 2': '16289',
  'Setor Multimarcas - PALMEIRA DOS INDIOS - CP ALCINA MARIA': '16471',
  'PLATINA / Palmeira': '17539',
  'FVC - 13706 - ALCINA MARIA REINÍCIOS': '18787',
  'FVC - 13706 - ALCINA MARIA REINICIOS': '18787',
  '13706 - ALCINA MARIA - SETOR DEVOLUÇÃO': '19699',
  '13706 - ALCINA MARIA - SETOR DEVOLUCAO': '19699',
  'BRONZE / Todas as cidades 13706': '23032',
  'SETOR PADRÃO': '23336',
  'SETOR PADRAO': '23336',
  'INICIOS CENTRAL 13706': '15775',
  'SUPERVISORA DE RELACIONAMENTO': '1414',
  'PRATA 2 / Coruripe / Piaçabuçu / F. Deserto / São Sebastião': '1415',
  'PRATA 2 / Coruripe / Piacabucu / F. Deserto / Sao Sebastiao': '1415',
  'BRONZE / Todas as cidades 13707': '3124',
  'BRONZE 2 / Todas as cidades 13707': '8317',
  'PLATINA / Penedo': '9540',
  'FVC - 13707 - A - ALCINA MARIA 1': '14211',
  'PRATA 3 / I.Nova / Junqueiro / Olho D\' Agua / Porto Real / São Brás': '14244',
  'PRATA 3 / I.Nova / Junqueiro / Olho D Agua / Porto Real / Sao Bras': '14244',
  'PRATA 1 / Penedo': '14245',
  'OURO / Penedo': '14246',
  'FVC - 13707 - A - ALCINA MARIA 2': '15242',
  'INICIOS CENTRAL 13707': '15774',
  'FVC - 13707- BER - ALCINA MARIA': '16284',
  'Setor Multimarcas - PENEDO - CP ALCINA MARIA': '16472',
  'FVC - 13707 - A - ALCINA MARIA 3': '16635',
  'FVC - 13707 - ALCINA MARIA REINÍCIOS': '18788',
  'FVC - 13707 - ALCINA MARIA REINICIOS': '18788',
  '13707 - ALCINA MARIA - SETOR DEVOLUÇÃO': '19698',
  '13707 - ALCINA MARIA - SETOR DEVOLUCAO': '19698'
};

// Funcao para encontrar o codigo do setor pelo nome (busca parcial)
function findSetorCode(setorName) {
  if (!setorName) return null;
  const normalized = setorName.toString().trim();

  // Primeiro tenta match exato
  if (SETOR_MAP[normalized]) return SETOR_MAP[normalized];

  // Depois tenta match parcial (o nome do CSV pode ser parte da chave ou vice-versa)
  for (const [key, code] of Object.entries(SETOR_MAP)) {
    // Remove espacos extras e compara
    const keyClean = key.replace(/\s+/g, ' ').trim().toLowerCase();
    const nameClean = normalized.replace(/\s+/g, ' ').trim().toLowerCase();

    if (keyClean.includes(nameClean) || nameClean.includes(keyClean)) {
      return code;
    }
  }

  return null;
}

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
 * Primeiro tenta usar o mapeamento de nomes para codigos
 * Suporta formatos:
 * - "14210 FVC - 13706 - A - ALCINA MARIA 1" -> "14210"
 * - "FVC - 13707 - A - ALCINA MARIA 1" -> "14211" (via mapeamento)
 */
function extractSetorId(setorText) {
  if (!setorText) return null;
  const text = setorText.toString().trim();

  // Primeiro tenta pegar numero no inicio (formato antigo)
  const matchStart = text.match(/^(\d+)/);
  if (matchStart) return matchStart[1];

  // Depois tenta usar o mapeamento de nomes
  const mappedCode = findSetorCode(text);
  if (mappedCode) return mappedCode;

  // Fallback: retorna null se nao encontrar
  return null;
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

    // Detecta delimitador (suporta |, ; e ,)
    const firstLine = fileContent.split('\n')[0];
    const pipeCount = (firstLine.match(/\|/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;

    let delimiter = ',';
    if (pipeCount > semicolonCount && pipeCount > commaCount) {
      delimiter = '|';
    } else if (semicolonCount > commaCount) {
      delimiter = ';';
    }

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
          const codigoRevendedor = row.CodigoRevendedor || row.CodigoRevendedora || row.codigoRevendedor || row.codigoRevendedora || row.CODIGOREVENDEDOR || row.CODIGOREVENDEDORA || row['Código Revendedor'] || row['Código Revendedora'] || '';
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
 * setorId pode ser: codigo numerico (14210, 14211), parte do nome, ou nome completo
 */
function getAggregatedData(data, setorId) {
  const searchTerm = setorId.toString().trim();
  const searchTermLower = searchTerm.toLowerCase();

  // Filtra pelo setor - busca flexivel
  const setorData = data.filter(row => {
    // Match por setorId extraido (codigo mapeado)
    if (row.setorId && row.setorId === searchTerm) return true;

    // Match por texto do setor (case insensitive, parcial)
    const setorLower = (row.setor || '').toLowerCase();
    if (setorLower.includes(searchTermLower)) return true;

    // Se o usuario digitou um codigo, verifica se o setor mapeia para esse codigo
    if (/^\d+$/.test(searchTerm)) {
      const mappedCode = findSetorCode(row.setor);
      if (mappedCode === searchTerm) return true;
    }

    return false;
  });

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
