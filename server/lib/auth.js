const crypto = require('crypto');

// Credenciais do admin (em produção, use variáveis de ambiente)
const ADMIN_USER = process.env.ADMIN_USER || 'acqua';
const ADMIN_PASS = process.env.ADMIN_PASS || '13707';

// Chave secreta para tokens (em produção, use variável de ambiente)
const SECRET_KEY = process.env.SECRET_KEY || 'supervision-games-secret-key-2024';

/**
 * Cria um token simples baseado em HMAC
 * Formato: payload_base64.timestamp.signature
 */
function createToken(payload) {
  const timestamp = Date.now();
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64');
  const data = `${payloadStr}.${timestamp}`;
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(data)
    .digest('hex');

  return `${data}.${signature}`;
}

/**
 * Verifica e decodifica um token
 * Retorna null se inválido ou expirado
 */
function verifyToken(token) {
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [payloadStr, timestamp, signature] = parts;

    // Verifica assinatura
    const data = `${payloadStr}.${timestamp}`;
    const expectedSignature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(data)
      .digest('hex');

    if (signature !== expectedSignature) {
      return null;
    }

    // Verifica expiração (24 horas)
    const tokenTime = parseInt(timestamp);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas

    if (now - tokenTime > maxAge) {
      return null;
    }

    // Decodifica payload
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64').toString());
    return payload;

  } catch (err) {
    console.error('Erro ao verificar token:', err);
    return null;
  }
}

module.exports = {
  ADMIN_USER,
  ADMIN_PASS,
  createToken,
  verifyToken
};
