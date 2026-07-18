// Bot servisi giriş noktası.
//  - PocketBase sağlık kontrolü + kimlik doğrulama
//  - Botu başlat
//  - Yakalanmamış hatalarda çökmeden loglama (PM2 ile 24/7 çalışır)
//  - SIGINT/SIGTERM ile zarif kapanma
import { logger } from './logger.js';
import { config } from './config.js';
import { waitForHealth, authenticate } from './pocketbase.js';
import { startBot } from './bot.js';

let handle = null;

process.on('uncaughtException', (err) => {
  logger.error('Yakalanmamış istisna:', err?.stack || err?.message || err);
});
process.on('unhandledRejection', (reason) => {
  logger.error('İşlenmemiş promise reddi:', reason?.message || reason);
});

async function shutdown(signal) {
  logger.info(`${signal} alındı, kapatılıyor...`);
  try { handle?.stop(); } catch { /* yoksay */ }
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function main() {
  logger.info('TK AI FINANCE bot servisi başlatılıyor...');
  if (!config.pbEmail || !config.pbPassword) {
    logger.error('PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD tanımlı değil — apps/bot/.env dosyasını doldurun.');
  }
  await waitForHealth();
  await authenticate();
  handle = await startBot();
  logger.info('Bot çalışıyor ✅');
}

main().catch((err) => {
  logger.error('Bot başlatılamadı:', err?.stack || err?.message || err);
  // PM2 servis olarak yeniden başlatabilsin diye hata koduyla çık.
  process.exit(1);
});
