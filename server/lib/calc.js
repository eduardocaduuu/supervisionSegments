/**
 * Módulo de cálculo de segmentação e metas
 */

// Definição dos segmentos com seus limites
const SEGMENTS = {
  INICIANTE: {
    nome: 'Iniciante',
    minimo: 0,
    maximo: 2999.98,
    proximo: 'BRONZE',
    cor: '#9CA3AF' // gray
  },
  BRONZE: {
    nome: 'Bronze',
    minimo: 2999.99,
    maximo: 2999.99,
    proximo: 'PRATA',
    cor: '#CD7F32' // bronze
  },
  PRATA: {
    nome: 'Prata',
    minimo: 3000.00,
    maximo: 8999.99,
    proximo: 'OURO',
    cor: '#C0C0C0' // silver
  },
  OURO: {
    nome: 'Ouro',
    minimo: 9000.00,
    maximo: 19999.99,
    proximo: 'PLATINA',
    cor: '#FFD700' // gold
  },
  PLATINA: {
    nome: 'Platina',
    minimo: 20000.00,
    maximo: 49999.99,
    proximo: 'RUBI',
    cor: '#E5E4E2' // platinum
  },
  RUBI: {
    nome: 'Rubi',
    minimo: 50000.00,
    maximo: 79999.99,
    proximo: 'ESMERALDA',
    cor: '#E0115F' // ruby
  },
  ESMERALDA: {
    nome: 'Esmeralda',
    minimo: 80000.00,
    maximo: 129999.99,
    proximo: 'DIAMANTE',
    cor: '#50C878' // emerald
  },
  DIAMANTE: {
    nome: 'Diamante',
    minimo: 130000.00,
    maximo: Infinity,
    proximo: null,
    cor: '#B9F2FF' // diamond
  }
};

// Ordem dos segmentos para navegação
const SEGMENT_ORDER = ['INICIANTE', 'BRONZE', 'PRATA', 'OURO', 'PLATINA', 'RUBI', 'ESMERALDA', 'DIAMANTE'];

/**
 * Determina o segmento atual baseado no valor total
 */
function calculateSegmentation(totalComprado) {
  if (totalComprado >= 130000.00) return 'DIAMANTE';
  if (totalComprado >= 80000.00) return 'ESMERALDA';
  if (totalComprado >= 50000.00) return 'RUBI';
  if (totalComprado >= 20000.00) return 'PLATINA';
  if (totalComprado >= 9000.00) return 'OURO';
  if (totalComprado >= 3000.00) return 'PRATA';
  if (totalComprado >= 2999.99) return 'BRONZE';
  return 'INICIANTE';
}

/**
 * Obtém limite mínimo de um segmento para manter
 */
function getMinimumToMaintain(segmentKey) {
  return SEGMENTS[segmentKey]?.minimo || 0;
}

/**
 * Obtém limite mínimo para subir para o próximo segmento
 */
function getMinimumToUpgrade(segmentKey) {
  const segment = SEGMENTS[segmentKey];
  if (!segment || !segment.proximo) return null;
  return SEGMENTS[segment.proximo].minimo;
}

/**
 * Calcula informações completas de segmentação para um revendedor
 */
function getSegmentationInfo(totalComprado, representatividade, cicloAtual) {
  const segmentoAtualKey = calculateSegmentation(totalComprado);
  const segmentoAtual = SEGMENTS[segmentoAtualKey];

  // Metas totais (9 ciclos)
  const metaManterTotal = segmentoAtual.minimo;
  const metaSubirTotal = segmentoAtual.proximo ? SEGMENTS[segmentoAtual.proximo].minimo : null;

  // Metas do ciclo atual (ponderadas pela representatividade)
  const reprCicloAtual = (representatividade[cicloAtual] || 0) / 100;
  const metaManterCiclo = metaManterTotal * reprCicloAtual;
  const metaSubirCiclo = metaSubirTotal ? metaSubirTotal * reprCicloAtual : null;

  // Cálculo do progresso para manter (em relação ao total dos 9 ciclos)
  let progressoManter = 0;
  let faltaManter = 0;
  if (metaManterTotal > 0) {
    progressoManter = Math.min(100, (totalComprado / metaManterTotal) * 100);
    faltaManter = Math.max(0, metaManterTotal - totalComprado);
  }

  // Cálculo do progresso para subir
  let progressoSubir = 0;
  let faltaSubir = null;
  if (metaSubirTotal) {
    progressoSubir = Math.min(100, (totalComprado / metaSubirTotal) * 100);
    faltaSubir = Math.max(0, metaSubirTotal - totalComprado);
  }

  // Mensagem de impulso (motivação)
  let impulso = '';
  let impulsoTipo = 'neutro';

  if (progressoSubir >= 95) {
    impulso = 'Quase lá! Reta final para subir!';
    impulsoTipo = 'sucesso';
  } else if (progressoSubir >= 80) {
    impulso = 'Excelente ritmo! Promoção à vista!';
    impulsoTipo = 'sucesso';
  } else if (progressoSubir >= 60) {
    impulso = 'Bom progresso! Continue assim!';
    impulsoTipo = 'positivo';
  } else if (progressoManter >= 100) {
    impulso = 'Segmento garantido! Vamos subir?';
    impulsoTipo = 'positivo';
  } else if (progressoManter >= 80) {
    impulso = 'Quase mantendo! Foco no objetivo!';
    impulsoTipo = 'atencao';
  } else if (progressoManter >= 50) {
    impulso = 'Ritmo bom, vamos acelerar!';
    impulsoTipo = 'atencao';
  } else if (progressoManter >= 30) {
    impulso = 'Hora de intensificar! Bora!';
    impulsoTipo = 'alerta';
  } else {
    impulso = 'Precisamos focar! Vamos juntas!';
    impulsoTipo = 'urgente';
  }

  // Determina se está em risco de cair
  const emRisco = progressoManter < 80 && segmentoAtualKey !== 'INICIANTE';

  // Calcula para qual segmento cairia se não bater a meta
  let segmentoQueda = null;
  if (emRisco && totalComprado < metaManterTotal) {
    segmentoQueda = calculateSegmentation(totalComprado);
  }

  return {
    segmentoAtual: segmentoAtual.nome,
    segmentoAtualKey,
    cor: segmentoAtual.cor,
    proximoSegmento: segmentoAtual.proximo ? SEGMENTS[segmentoAtual.proximo].nome : null,
    proximoSegmentoKey: segmentoAtual.proximo,

    // Totais (9 ciclos)
    metaManterTotal: Math.round(metaManterTotal * 100) / 100,
    metaSubirTotal: metaSubirTotal ? Math.round(metaSubirTotal * 100) / 100 : null,

    // Ciclo atual
    metaManterCiclo: Math.round(metaManterCiclo * 100) / 100,
    metaSubirCiclo: metaSubirCiclo ? Math.round(metaSubirCiclo * 100) / 100 : null,

    // Progresso
    progressoManter: Math.round(progressoManter * 100) / 100,
    progressoSubir: Math.round(progressoSubir * 100) / 100,

    // Quanto falta
    faltaManter: Math.round(faltaManter * 100) / 100,
    faltaSubir: faltaSubir !== null ? Math.round(faltaSubir * 100) / 100 : null,

    // Status
    emRisco,
    segmentoQueda: segmentoQueda ? SEGMENTS[segmentoQueda].nome : null,

    // Impulso
    impulso,
    impulsoTipo,

    // Info adicional
    totalComprado: Math.round(totalComprado * 100) / 100
  };
}

/**
 * Calcula totais acumulados considerando representatividade até o ciclo atual
 */
function calcularRepresentatividadeAcumulada(representatividade, cicloAtual) {
  const ciclos = Object.keys(representatividade).sort();
  let acumulado = 0;

  for (const ciclo of ciclos) {
    acumulado += representatividade[ciclo];
    if (ciclo === cicloAtual) break;
  }

  return acumulado;
}

/**
 * Formata valor monetário para exibição
 */
function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

module.exports = {
  SEGMENTS,
  SEGMENT_ORDER,
  calculateSegmentation,
  getMinimumToMaintain,
  getMinimumToUpgrade,
  getSegmentationInfo,
  calcularRepresentatividadeAcumulada,
  formatarMoeda
};
