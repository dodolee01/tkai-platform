// PocketBase istemcisi — bot database'e superuser (admin) olarak bağlanır.
// Sağlık kontrolü + otomatik yeniden kimlik doğrulama içerir.
import PocketBase from 'pocketbase';
import { config } from './config.js';
import { logger } from './logger.js';

const pb = new PocketBase(config.pbUrl);
pb.autoCancellation(false);

export async function waitForHealth({ retries = 30, delayMs = 2000 } = {}) {
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(`${config.pbUrl}/api/health`, { method: 'HEAD' });
      if (res.ok) return;
    } catch {
      // henüz hazır değil
    }
    logger.warn(`PocketBase hazır değil, tekrar denenecek (${i}/${retries})...`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`PocketBase sağlık kontrolü ${retries} denemeden sonra başarısız`);
}

export async function authenticate() {
  if (!config.pbEmail || !config.pbPassword) {
    throw new Error('PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD tanımlı değil');
  }
  await pb.collection('_superusers').authWithPassword(config.pbEmail, config.pbPassword);
  logger.info('PocketBase superuser kimlik doğrulaması başarılı');
}

// Kimlik geçersizse yeniden doğrula (uzun süreli çalışmada token süresi dolabilir).
export async function ensureAuth() {
  if (!pb.authStore.isValid) {
    await authenticate();
  }
}

export { pb };
export default pb;
