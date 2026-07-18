// Kullanıcı borsa anahtarlarının çözülmesi (AES-256-GCM).
// apps/api/src/utils/crypto.js ile BİREBİR aynı format — aynı TRADING_ENC_KEY
// ile şifrelenmiş kayıtlar burada çözülebilir.
import crypto from 'crypto';
import { config } from './config.js';

function masterKey() {
  const raw = config.encKey;
  if (!raw) {
    throw new Error('TRADING_ENC_KEY bot .env dosyasında tanımlı değil');
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

export function decryptSecret(payload) {
  const [ivHex, tagHex, dataHex] = String(payload).split(':');
  if (!ivHex || !tagHex || !dataHex) {
    // Şifresiz düz metin olarak saklanmış olabilir — olduğu gibi döndür.
    return String(payload);
  }
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return String(payload);
  }
}

export default { decryptSecret };
