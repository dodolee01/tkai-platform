// =============================================================
// PM2 process yöneticisi — Docker KULLANMADAN çalıştırma
// Kullanım (proje kök dizininde):
//   pm2 start deploy/pm2/ecosystem.config.cjs
//   pm2 save
//   pm2 startup            # sistem açılışında otomatik başlatma
// Logları izleme:
//   pm2 logs   /   pm2 monit
// =============================================================
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

module.exports = {
  apps: [
    {
      name: 'tkai-pocketbase',
      cwd: path.join(ROOT, 'apps/pocketbase'),
      script: './pocketbase',
      args: 'serve --http=0.0.0.0:8090 --encryptionEnv=PB_ENCRYPTION_KEY --hooksWatch=false',
      env: {
        // openssl rand -hex 16 ile üretin
        PB_ENCRYPTION_KEY: process.env.PB_ENCRYPTION_KEY || '',
      },
      out_file: path.join(ROOT, 'logs/pocketbase.out.log'),
      error_file: path.join(ROOT, 'logs/pocketbase.err.log'),
      restart_delay: 3000,
    },
    {
      name: 'tkai-api',
      cwd: path.join(ROOT, 'apps/api'),
      // --env-file=.env: apps/api/.env dosyasını okur
      script: 'node',
      args: '--env-file=.env src/main.js',
      env: {
        NODE_ENV: 'production',
      },
      out_file: path.join(ROOT, 'logs/api.out.log'),
      error_file: path.join(ROOT, 'logs/api.err.log'),
      restart_delay: 3000,
    },
    {
      name: 'tkai-web',
      cwd: path.join(ROOT, 'apps/web'),
      // Üretim derlemesini servis eder (npm run build sonrası)
      script: 'npm',
      args: 'run start',
      env: {
        NODE_ENV: 'production',
      },
      out_file: path.join(ROOT, 'logs/web.out.log'),
      error_file: path.join(ROOT, 'logs/web.err.log'),
      restart_delay: 3000,
    },
  ],
};
