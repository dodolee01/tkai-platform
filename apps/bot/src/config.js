// Merkezi yapılandırma — tüm ortam değişkenleri tek yerden okunur.

function num(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export const config = {
  pbUrl: process.env.PB_URL || 'http://localhost:8090',
  pbEmail: process.env.PB_SUPERUSER_EMAIL || '',
  pbPassword: process.env.PB_SUPERUSER_PASSWORD || '',
  encKey: process.env.TRADING_ENC_KEY || '',
  mode: (process.env.BOT_MODE || 'testnet').toLowerCase() === 'live' ? 'live' : 'testnet',
  tickMs: num('BOT_TICK_MS', 15000),
  portfolioTickMs: num('PORTFOLIO_TICK_MS', 30000),
  maxOpenTrades: num('MAX_OPEN_TRADES', 20),
  riskPerTrade: num('RISK_PER_TRADE', 0.5),
  logLevel: (process.env.LOG_LEVEL || 'info').toLowerCase(),
};

export default config;
