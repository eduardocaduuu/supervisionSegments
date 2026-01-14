const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const fs = require('fs');

const { loadCSV, getAggregatedData, compareSnapshots } = require('./lib/csvLoader');
const { calculateSegmentation, getSegmentationInfo, SEGMENTS } = require('./lib/calc');
const { createToken, verifyToken, ADMIN_USER, ADMIN_PASS } = require('./lib/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Data directory
const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default config
const defaultConfig = {
  cicloAtual: '01/2026',
  snapshotAtivo: 'tarde',
  representatividade: {
    '01/2026': 8,
    '02/2026': 11,
    '03/2026': 11,
    '04/2026': 12,
    '05/2026': 11,
    '06/2026': 15,
    '07/2026': 10,
    '08/2026': 11,
    '09/2026': 10
  },
  riscoPercentual: 30
};

// Load or create config
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return { ...defaultConfig, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Erro ao carregar config:', err);
  }
  return defaultConfig;
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

// Initialize config
let config = loadConfig();
saveConfig(config);

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Rate limiter for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' }
});

// Auth middleware
function requireAuth(req, res, next) {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  req.user = decoded;
  next();
}

// Multer config for CSV upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DATA_DIR);
  },
  filename: (req, file, cb) => {
    const slot = req.query.slot;
    if (slot !== 'manha' && slot !== 'tarde') {
      return cb(new Error('Slot inválido. Use manha ou tarde.'));
    }
    cb(null, `snapshot_${slot}.csv`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos CSV são permitidos.'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  }
});

// ============= API ROUTES =============

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'supervision-games',
    timestamp: new Date().toISOString()
  });
});

// Admin login
app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = createToken({ username, role: 'admin' });
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    res.json({ success: true, message: 'Login realizado com sucesso' });
  } else {
    res.status(401).json({ error: 'Credenciais inválidas' });
  }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true, message: 'Logout realizado' });
});

// Check auth status
app.get('/api/admin/check', requireAuth, (req, res) => {
  res.json({ authenticated: true, user: req.user });
});

// Get config
app.get('/api/admin/config', requireAuth, (req, res) => {
  config = loadConfig();

  // Get file info
  const manhaPath = path.join(DATA_DIR, 'snapshot_manha.csv');
  const tardePath = path.join(DATA_DIR, 'snapshot_tarde.csv');

  let manhaInfo = null;
  let tardeInfo = null;

  if (fs.existsSync(manhaPath)) {
    const stats = fs.statSync(manhaPath);
    manhaInfo = {
      exists: true,
      size: stats.size,
      modified: stats.mtime.toISOString()
    };
  }

  if (fs.existsSync(tardePath)) {
    const stats = fs.statSync(tardePath);
    tardeInfo = {
      exists: true,
      size: stats.size,
      modified: stats.mtime.toISOString()
    };
  }

  res.json({
    ...config,
    snapshots: {
      manha: manhaInfo,
      tarde: tardeInfo
    }
  });
});

// Update config
app.put('/api/admin/config', requireAuth, (req, res) => {
  const { cicloAtual, snapshotAtivo, representatividade, riscoPercentual } = req.body;

  if (cicloAtual) config.cicloAtual = cicloAtual;
  if (snapshotAtivo) config.snapshotAtivo = snapshotAtivo;
  if (representatividade) config.representatividade = representatividade;
  if (riscoPercentual !== undefined) config.riscoPercentual = riscoPercentual;

  saveConfig(config);
  res.json({ success: true, config });
});

// Upload CSV
app.post('/api/admin/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }

  const slot = req.query.slot;
  res.json({
    success: true,
    message: `Arquivo ${slot} carregado com sucesso`,
    filename: req.file.filename,
    size: req.file.size
  });
});

// Dashboard data
app.get('/api/dashboard', async (req, res) => {
  try {
    const { setorId } = req.query;

    if (!setorId) {
      return res.status(400).json({ error: 'setorId é obrigatório' });
    }

    config = loadConfig();
    const snapshotAtivo = config.snapshotAtivo;
    const csvPath = path.join(DATA_DIR, `snapshot_${snapshotAtivo}.csv`);

    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({
        error: 'Nenhum dado disponível',
        message: 'O snapshot ainda não foi carregado. Aguarde o administrador fazer o upload.'
      });
    }

    // Load active snapshot
    const data = await loadCSV(csvPath);
    const aggregated = getAggregatedData(data, setorId);

    if (!aggregated || aggregated.revendedores.length === 0) {
      return res.status(404).json({
        error: 'Setor não encontrado',
        message: `Nenhum dado encontrado para o setor ${setorId}`
      });
    }

    // Calculate segmentation for each revendedor
    const revendedoresComSegmentacao = aggregated.revendedores.map(rev => {
      const segInfo = getSegmentationInfo(rev.totalGeral, config.representatividade, config.cicloAtual);
      return {
        ...rev,
        segmentacao: segInfo
      };
    });

    // Try to load comparison data (manha vs tarde)
    let comparativo = null;
    const manhaPath = path.join(DATA_DIR, 'snapshot_manha.csv');
    const tardePath = path.join(DATA_DIR, 'snapshot_tarde.csv');

    if (fs.existsSync(manhaPath) && fs.existsSync(tardePath)) {
      try {
        const manhaData = await loadCSV(manhaPath);
        const tardeData = await loadCSV(tardePath);
        comparativo = compareSnapshots(manhaData, tardeData, setorId);
      } catch (err) {
        console.error('Erro ao comparar snapshots:', err);
      }
    }

    // Calculate KPIs
    const totalSetor = revendedoresComSegmentacao.reduce((sum, r) => sum + r.totalGeral, 0);
    const qtdRevendedores = revendedoresComSegmentacao.length;
    const pertoDeSurbir = revendedoresComSegmentacao.filter(r =>
      r.segmentacao.progressoSubir >= 80
    ).length;
    const emRisco = revendedoresComSegmentacao.filter(r =>
      r.segmentacao.progressoManter < config.riscoPercentual
    ).length;

    res.json({
      snapshotAtivo,
      cicloAtual: config.cicloAtual,
      representatividade: config.representatividade,
      riscoPercentual: config.riscoPercentual,
      kpis: {
        totalSetor,
        qtdRevendedores,
        pertoDeSurbir,
        emRisco
      },
      revendedores: revendedoresComSegmentacao,
      comparativo,
      setorNome: aggregated.setorNome
    });

  } catch (err) {
    console.error('Erro no dashboard:', err);
    res.status(500).json({ error: 'Erro interno', message: err.message });
  }
});

// Revendedor detail
app.get('/api/revendedor', async (req, res) => {
  try {
    const { setorId, codigoRevendedor } = req.query;

    if (!setorId || !codigoRevendedor) {
      return res.status(400).json({ error: 'setorId e codigoRevendedor são obrigatórios' });
    }

    config = loadConfig();
    const snapshotAtivo = config.snapshotAtivo;
    const csvPath = path.join(DATA_DIR, `snapshot_${snapshotAtivo}.csv`);

    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ error: 'Snapshot não encontrado' });
    }

    const data = await loadCSV(csvPath);
    const aggregated = getAggregatedData(data, setorId);

    if (!aggregated) {
      return res.status(404).json({ error: 'Setor não encontrado' });
    }

    const revendedor = aggregated.revendedores.find(
      r => r.codigoRevendedor === codigoRevendedor
    );

    if (!revendedor) {
      return res.status(404).json({ error: 'Revendedor não encontrado' });
    }

    const segInfo = getSegmentationInfo(revendedor.totalGeral, config.representatividade, config.cicloAtual);

    res.json({
      ...revendedor,
      segmentacao: segInfo,
      cicloAtual: config.cicloAtual,
      representatividade: config.representatividade
    });

  } catch (err) {
    console.error('Erro ao buscar revendedor:', err);
    res.status(500).json({ error: 'Erro interno', message: err.message });
  }
});

// Lista de setores disponíveis
app.get('/api/setores', (req, res) => {
  const setores = [
    { id: '1260', nome: 'PRATA / Palmeira / Igaci /' },
    { id: '4005', nome: 'PLATINA & OURO / Palmeira / Igaci /Major / Cacimbinhas / Estrela / Min' },
    { id: '8238', nome: 'PRATA 2 / Major / Cacimbinhas / Estrela / Quebrangulo / Minador /' },
    { id: '8239', nome: 'SUPERVISORA DE RELACIONAMENTO PALMEIRA DOS INDIOS' },
    { id: '14210', nome: 'FVC - 13706 - A - ALCINA MARIA 1' },
    { id: '16283', nome: 'FVC - 13706- BER - ALCINA MARIA' },
    { id: '16289', nome: 'FVC - 13706 - A - ALCINA MARIA 2' },
    { id: '16471', nome: 'Setor Multimarcas - PALMEIRA DOS INDIOS - CP ALCINA MARIA' },
    { id: '17539', nome: 'PLATINA / Palmeira /' },
    { id: '18787', nome: 'FVC - 13706 - ALCINA MARIA REINÍCIOS' },
    { id: '19699', nome: '13706 - ALCINA MARIA - SETOR DEVOLUÇÃO' },
    { id: '23032', nome: 'BRONZE / Todas as cidades 13706' },
    { id: '23336', nome: 'SETOR PADRÃO' },
    { id: '15775', nome: 'INICIOS CENTRAL 13706' },
    { id: '1414', nome: 'SUPERVISORA DE RELACIONAMENTO' },
    { id: '1415', nome: 'PRATA 2 / Coruripe / Piaçabuçu / F. Deserto / São Sebastião /' },
    { id: '3124', nome: 'BRONZE / Todas as cidades 13707' },
    { id: '8317', nome: 'BRONZE 2 / Todas as cidades 13707' },
    { id: '9540', nome: 'PLATINA / Penedo /' },
    { id: '14211', nome: 'FVC - 13707 - A - ALCINA MARIA 1' },
    { id: '14244', nome: 'PRATA 3 / I.Nova / Junqueiro / Olho D\' Agua / Porto Real / São Brás /' },
    { id: '14245', nome: 'PRATA 1 / Penedo /' },
    { id: '14246', nome: 'OURO / Penedo /' },
    { id: '15242', nome: 'FVC - 13707 - A - ALCINA MARIA 2' },
    { id: '15774', nome: 'INICIOS CENTRAL 13707' },
    { id: '16284', nome: 'FVC - 13707- BER - ALCINA MARIA' },
    { id: '16472', nome: 'Setor Multimarcas - PENEDO - CP ALCINA MARIA' },
    { id: '16635', nome: 'FVC - 13707 - A - ALCINA MARIA 3' },
    { id: '18788', nome: 'FVC - 13707 - ALCINA MARIA REINÍCIOS' },
    { id: '19698', nome: '13707 - ALCINA MARIA - SETOR DEVOLUÇÃO' },
    { id: '23557', nome: 'SETOR PADRÃO' }
  ];
  res.json(setores);
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor', message: err.message });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
