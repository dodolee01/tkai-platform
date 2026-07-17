// Public versioned REST API (/hcgi/api/v1/*).
// Read-only endpoints backed by the existing PocketBase collections plus a
// couple of live market proxies. Uses the server-side PB escape-hatch client
// lazily so this module has no import-time side effects beyond that client.
import { Router } from 'express';

const FNG = 'https://api.alternative.me/fng';
const FAPI = 'https://fapi.binance.com';

// Lazy PB import — only pulled in when an endpoint actually needs the DB.
async function pb() {
  const mod = await import('../utils/pocketbaseClient.js');
  return mod.default;
}

// Parse standard list query params: page, perPage, sort, filter, q(search field).
function listParams(req, searchFields = []) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const perPage = Math.min(200, Math.max(1, parseInt(req.query.perPage, 10) || 30));
  const sort = typeof req.query.sort === 'string' && req.query.sort ? req.query.sort : '-created';
  const filters = [];
  if (req.query.filter && typeof req.query.filter === 'string') filters.push(req.query.filter);
  if (req.query.q && searchFields.length) {
    const q = String(req.query.q).replace(/["\\]/g, '');
    filters.push('(' + searchFields.map((f) => `${f} ~ "${q}"`).join(' || ') + ')');
  }
  return { page, perPage, sort, filter: filters.join(' && ') };
}

async function paginate(collection, req, searchFields = []) {
  const { page, perPage, sort, filter } = listParams(req, searchFields);
  const client = await pb();
  const result = await client.collection(collection).getList(page, perPage, {
    sort,
    ...(filter ? { filter } : {}),
  });
  return {
    data: result.items,
    pagination: {
      page: result.page,
      perPage: result.perPage,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
    },
  };
}

const router = Router();

// --- meta ---
router.get('/status', (req, res) => {
  res.json({
    name: 'TK AI FINANCE REST API',
    version: 'v1',
    status: 'operational',
    time: new Date().toISOString(),
  });
});

// --- portfolio ---
router.get('/portfolio', async (req, res) => {
  const client = await pb();
  const open = await client.collection('trades').getFullList({ filter: 'status = "open"', requestKey: 'v1-p-open' });
  const closed = await client.collection('trades').getFullList({ filter: 'status = "closed"', requestKey: 'v1-p-closed' });
  const openPnl = open.reduce((a, t) => a + (t.pnl || 0), 0);
  const realizedPnl = closed.reduce((a, t) => a + (t.pnl || 0), 0);
  const wins = closed.filter((t) => t.win).length;
  res.json({
    openPositions: open.length,
    closedTrades: closed.length,
    openPnl,
    realizedPnl,
    winRate: closed.length ? Math.round((wins / closed.length) * 100) : 0,
    totalTrades: open.length + closed.length,
  });
});

router.get('/portfolio/positions', async (req, res) => {
  const client = await pb();
  const open = await client.collection('trades').getFullList({ filter: 'status = "open"', sort: '-created' });
  res.json({ data: open });
});

// --- trades ---
router.get('/trades', async (req, res) => {
  res.json(await paginate('trades', req, ['symbol', 'pairName', 'tradeId']));
});

router.get('/trades/:id', async (req, res) => {
  const client = await pb();
  const rec = await client.collection('trades').getFirstListItem(`tradeId = "${String(req.params.id).replace(/["\\]/g, '')}"`)
    .catch(() => null) || await client.collection('trades').getOne(req.params.id).catch(() => null);
  if (!rec) return res.status(404).json({ error: 'Trade not found' });
  res.json(rec);
});

// --- strategies ---
router.get('/strategies', async (req, res) => {
  res.json(await paginate('strategy_profiles', req, ['name', 'key', 'description']));
});

router.get('/strategies/:id', async (req, res) => {
  const client = await pb();
  const rec = await client.collection('strategy_profiles').getOne(req.params.id).catch(() => null)
    || await client.collection('strategy_profiles').getFirstListItem(`key = "${String(req.params.id).replace(/["\\]/g, '')}"`).catch(() => null);
  if (!rec) return res.status(404).json({ error: 'Strategy not found' });
  res.json(rec);
});

// --- backtests ---
router.get('/backtests', async (req, res) => {
  res.json(await paginate('backtest_results', req, ['label', 'symbol', 'profileKey']));
});

router.get('/backtests/:id', async (req, res) => {
  const client = await pb();
  const rec = await client.collection('backtest_results').getOne(req.params.id).catch(() => null);
  if (!rec) return res.status(404).json({ error: 'Backtest not found' });
  res.json(rec);
});

// --- exchanges / web3 / defi ---
router.get('/exchanges', async (req, res) => {
  const client = await pb();
  const list = await client.collection('exchange_connections').getFullList({ sort: '-created' });
  // Never leak encrypted secrets over the public API.
  res.json({ data: list.map(({ apiKeyEnc, secretEnc, passphraseEnc, ...safe }) => safe) });
});

router.get('/web3/wallets', async (req, res) => {
  const client = await pb();
  res.json({ data: await client.collection('web3_wallets').getFullList({ sort: '-created' }) });
});

router.get('/defi/positions', async (req, res) => {
  res.json(await paginate('defi_positions', req, ['protocol', 'pair', 'walletAddress']));
});

// --- market ---
router.get('/market/fear-greed', async (req, res) => {
  const upstream = await fetch(`${FNG}/?limit=${Math.min(90, parseInt(req.query.limit, 10) || 30)}`);
  if (!upstream.ok) throw new Error(`fear-greed upstream failed: ${upstream.status} ${upstream.statusText}`);
  res.json(await upstream.json());
});

router.get('/market/indicators', async (req, res) => {
  const symbol = String(req.query.symbol || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const upstream = await fetch(`${FAPI}/fapi/v1/ticker/24hr?symbol=${symbol}`);
  if (!upstream.ok) throw new Error(`indicators upstream failed: ${upstream.status} ${upstream.statusText}`);
  const t = await upstream.json();
  res.json({
    symbol,
    lastPrice: parseFloat(t.lastPrice),
    priceChangePercent: parseFloat(t.priceChangePercent),
    high: parseFloat(t.highPrice),
    low: parseFloat(t.lowPrice),
    volume: parseFloat(t.volume),
    quoteVolume: parseFloat(t.quoteVolume),
    weightedAvgPrice: parseFloat(t.weightedAvgPrice),
  });
});

export default router;
