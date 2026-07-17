import crypto from 'crypto';

// AES-256-GCM encryption for Binance API credentials at rest.
// The master key lives only in apps/api/.env (TRADING_ENC_KEY), never shipped
// to the browser and never stored in the database.
const RAW = process.env.TRADING_ENC_KEY || '';

function masterKey() {
  if (!RAW) {
    throw new Error('TRADING_ENC_KEY is not set in apps/api/.env');
  }
  // Accept hex (64 chars) or any string; normalize to 32 bytes.
  if (/^[0-9a-fA-F]{64}$/.test(RAW)) {
    return Buffer.from(RAW, 'hex');
  }
  return crypto.createHash('sha256').update(RAW).digest();
}

export function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join(':');
}

export function decryptSecret(payload) {
  const [ivHex, tagHex, dataHex] = String(payload).split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('invalid encrypted payload');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return dec.toString('utf8');
}
