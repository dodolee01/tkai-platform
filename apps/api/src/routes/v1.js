// =============================================================
// TK AI FİNANCE — Public REST API v1
// Versioned trading API backed by PocketBase collections and
// Binance public market data. Mounted under /v1 in routes/index.js
// (browser prefix: /hcgi/api/v1).
//
// Auth: obtain a token via POST /v1/auth/login (PocketBase users),
// then pass it as `Authorization: Bearer <token>` OR `X-API-Key: <token>`.
// A lightweight in-memory rate limiter guards every endpoint.
// =============================================================
import { Router } from 'express';
import logger from '../utils/logger.js';

const router = Router();

const SPOT = 'https://api.binance.com';
const FAPI = 'https://fapi.binance.com';

// ---- lazy PocketBase (superuser) client -----------------------------------
let pbPromise = null;
async function pb() {
    if (!pbPromise) {
        pbPromise = import('../utils/pocketbaseClient.js').then((m) => m.default);
    }
    return pbPromise;
}

// ---- helpers ---------------------------------------------------------------
function ok(res, data, meta) {
    return res.json({ success: true, data, ...(meta ? { meta } : {}) });
}

function parsePage(req) {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(req.query.perPage, 10) || 30));
    return { page, perPage };
}

async function binance(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`binance upstream failed: ${r.status} ${r.statusText} (${url})`);
    return r.json();
}

// ---- rate limiting (per token / IP) ----------------------------------------
const WINDOW_MS = 60_000;
const MAX_REQ = 120;
const buckets = new Map();

router.use((req, res, next) => {
    const key = req.headers['x-api-key'] || req.headers.authorization || req.ip || 'anon';
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now > b.reset) {
        b = { count: 0, reset: now + WINDOW_MS };
        buckets.set(key, b);
    }
    b.count += 1;
    res.setHeader('X-RateLimit-Limit', MAX_REQ);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQ - b.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(b.reset / 1000));
    if (b.count > MAX_REQ) {
        return res.status(429).json({ success: false, error: 'rate limit exceeded', retryAfter: Math.ceil((b.reset - now) / 1000) });
    }
    next();
});

// ---- auth guard for protected routes ---------------------------------------
async function requireAuth(req, res, next) {
    const raw = req.headers['x-api-key'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!raw) return res.status(401).json({ success: false, error: 'missing token — send Authorization: Bearer <token> or X-API-Key' });
    try {
        const Pocketbase = (await import('pocketbase')).default;
        const client = new Pocketbase('http://localhost:8090');
        client.authStore.save(raw, null);
        await client.collection('users').authRefresh();
        req.authUser = client.authStore.record;
        req.userToken = raw;
        next();
    } catch {
        return res.status(401).json({ success: false, error: 'invalid or expired token' });
    }
}

// ============================================================
// AUTH
// ============================================================
router.post('/auth/register', async (req, res) => {
    const { email, password, name } = req.body ?? {};
    if (!email || !password) return res.status(422).json({ success: false, error: 'email and password required' });
    const client = await pb();
    const user = await client.collection('users').create({ email, password, passwordConfirm: password, name: name || '' });
    return res.status(201).json({ success: true, data: { id: user.id, email: user.email, name: user.name } });
});

router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) return res.status(422).json({ success: false, error: 'email and password required' });
    const Pocketbase = (await import('pocketbase')).default;
    const client = new Pocketbase('http://localhost:8090');
    let auth;
    try {
        auth = await client.collection('users').authWithPassword(email, password);
    } catch {
        return res.status(401).json({ success: false, error: 'invalid credentials' });
    }
    return ok(res, { token: auth.token, user: { id: auth.record.id, email: auth.record.email, name: auth.record.name } });
});

router.post('/auth/logout', (req, res) => ok(res, { message: 'client should discard its token' }));

// ============================================================
// USER
// ============================================================
router.get('/user/profile', requireAuth, (req, res) => {
    const u = req.authUser;
    return ok(res, { id: u.id, email: u.email, name: u.name, created: u.created });
});

router.put('/user/profile', requireAuth, async (req, res) => {
    const Pocketbase = (await import('pocketbase')).default;
    const client = new Pocketbase('http://localhost:8090');
    client.authStore.save(req.userToken, req.authUser);
    const updated = await client.collection('users').update(req.authUser.id, { name: req.body?.name });
    return ok(res, { id: updated.id, email: updated.email, name: updated.name });
});

// ============================================================
// PORTFOLIO  (aggregated from trades collection)
// ============================================================
async function loadTrades() {
    const client = await pb();
    return client.collection('trades').getFullList({ sort: '-created' });
}

router.get('/portfolio', async (req, res) => {
    const trades = await loadTrades();
    const closed = trades.filter((t) => t.status === 'closed');
    const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
    const wins = closed.filter((t) => t.win).length;
    return ok(res, {
        totalPnl,
        totalTrades: trades.length,
        openTrades: trades.filter((t) => t.status === 'open').length,
        closedTrades: closed.length,
        winRate: closed.length ? +((wins / closed.length) * 100).toFixed(2) : 0,
    });
});

router.get('/portfolio/balance', requireAuth, async (req, res) => {
    const client = await pb();
    const cfg = await client.collection('bot_config').getFullList({ filter: 'key = "binance"' }).catch(() => []);
    return ok(res, { connected: !!(cfg[0] && cfg[0].connected), mode: cfg[0]?.mode || null });
});

router.get('/portfolio/positions', async (req, res) => {
    const trades = await loadTrades();
    return ok(res, trades.filter((t) => t.status === 'open'));
});

// ============================================================
// TRADES
// ============================================================
router.get('/trades', async (req, res) => {
    const { page, perPage } = parsePage(req);
    const client = await pb();
    const filters = [];
    if (req.query.status) filters.push(`status = "${String(req.query.status).replace(/"/g, '')}"`);
    if (req.query.symbol) filters.push(`symbol = "${String(req.query.symbol).replace(/"/g, '')}"`);
    const list = await client.collection('trades').getList(page, perPage, {
        sort: req.query.sort || '-created',
        filter: filters.join(' && '),
    });
    return ok(res, list.items, { page: list.page, perPage: list.perPage, totalItems: list.totalItems, totalPages: list.totalPages });
});

router.get('/trades/:id', async (req, res) => {
    const client = await pb();
    try {
        const rec = await client.collection('trades').getOne(req.params.id);
        return ok(res, rec);
    } catch {
        return res.status(404).json({ success: false, error: 'trade not found' });
    }
});

// ============================================================
// ORDERS  (spot / futures create + list from trades)
// ============================================================
router.post('/spot/order', requireAuth, async (req, res) => {
    const { symbol, side, qty } = req.body ?? {};
    if (!symbol || !side || !qty) return res.status(422).json({ success: false, error: 'symbol, side, qty required' });
    return res.status(202).json({ success: true, data: { accepted: true, market: 'spot', symbol, side, qty, note: 'route via /spot/order execution engine' } });
});

router.post('/futures/order', requireAuth, async (req, res) => {
    const { symbol, side, qty } = req.body ?? {};
    if (!symbol || !side || !qty) return res.status(422).json({ success: false, error: 'symbol, side, qty required' });
    return res.status(202).json({ success: true, data: { accepted: true, market: 'futures', symbol, side, qty, note: 'route via /futures/order execution engine' } });
});

router.get('/orders', async (req, res) => {
    const trades = await loadTrades();
    return ok(res, trades.map((t) => ({ id: t.id, orderId: t.binanceOrderId, symbol: t.symbol, side: t.side, status: t.status, qty: t.qty })));
});

router.get('/orders/:id', async (req, res) => {
    const client = await pb();
    try {
        const t = await client.collection('trades').getOne(req.params.id);
        return ok(res, { id: t.id, orderId: t.binanceOrderId, symbol: t.symbol, side: t.side, status: t.status, qty: t.qty });
    } catch {
        return res.status(404).json({ success: false, error: 'order not found' });
    }
});

router.delete('/orders/:id', requireAuth, async (req, res) => {
    const client = await pb();
    try {
        await client.collection('trades').update(req.params.id, { status: 'closed', result: 'MANUAL' });
        return ok(res, { cancelled: true, id: req.params.id });
    } catch {
        return res.status(404).json({ success: false, error: 'order not found' });
    }
});

// ============================================================
// MARKET DATA  (Binance public)
// ============================================================
router.get('/market/ticker', async (req, res) => {
    const symbol = (req.query.symbol || 'BTCUSDT').toUpperCase();
    const data = await binance(`${SPOT}/api/v3/ticker/24hr?symbol=${symbol}`);
    return ok(res, data);
});

router.get('/market/klines', async (req, res) => {
    const symbol = (req.query.symbol || 'BTCUSDT').toUpperCase();
    const interval = req.query.interval || '1h';
    const limit = Math.min(1000, parseInt(req.query.limit, 10) || 200);
    const raw = await binance(`${SPOT}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    const data = raw.map((k) => ({ openTime: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5], closeTime: k[6] }));
    return ok(res, data, { symbol, interval, count: data.length });
});

// ============================================================
// STRATEGIES  (strategy_profiles collection)
// ============================================================
router.get('/strategies', async (req, res) => {
    const client = await pb();
    const items = await client.collection('strategy_profiles').getFullList({ sort: '-created' });
    return ok(res, items);
});

router.get('/strategies/:id', async (req, res) => {
    const client = await pb();
    try {
        return ok(res, await client.collection('strategy_profiles').getOne(req.params.id));
    } catch {
        return res.status(404).json({ success: false, error: 'strategy not found' });
    }
});

router.post('/strategies', requireAuth, async (req, res) => {
    const { key, name } = req.body ?? {};
    if (!key || !name) return res.status(422).json({ success: false, error: 'key and name required' });
    const client = await pb();
    const rec = await client.collection('strategy_profiles').create({
        key, name,
        description: req.body.description || '',
        riskLevel: req.body.riskLevel || 5,
        builtin: false,
        active: !!req.body.active,
        config: req.body.config || {},
    });
    return res.status(201).json({ success: true, data: rec });
});

router.put('/strategies/:id', requireAuth, async (req, res) => {
    const client = await pb();
    try {
        const rec = await client.collection('strategy_profiles').update(req.params.id, req.body || {});
        return ok(res, rec);
    } catch {
        return res.status(404).json({ success: false, error: 'strategy not found' });
    }
});

router.delete('/strategies/:id', requireAuth, async (req, res) => {
    const client = await pb();
    try {
        await client.collection('strategy_profiles').delete(req.params.id);
        return ok(res, { deleted: true, id: req.params.id });
    } catch {
        return res.status(404).json({ success: false, error: 'strategy not found' });
    }
});

// ============================================================
// BACKTEST  (backtest_results collection)
// ============================================================
router.get('/backtest', async (req, res) => {
    const { page, perPage } = parsePage(req);
    const client = await pb();
    const list = await client.collection('backtest_results').getList(page, perPage, { sort: '-created' });
    return ok(res, list.items, { page: list.page, perPage: list.perPage, totalItems: list.totalItems, totalPages: list.totalPages });
});

router.post('/backtest', requireAuth, async (req, res) => {
    const { label } = req.body ?? {};
    if (!label) return res.status(422).json({ success: false, error: 'label required' });
    const client = await pb();
    const rec = await client.collection('backtest_results').create({
        label,
        profileKey: req.body.profileKey || '',
        symbol: req.body.symbol || '',
        timeframe: req.body.timeframe || '1h',
        startDate: req.body.startDate || '',
        endDate: req.body.endDate || '',
        config: req.body.config || {},
        stats: req.body.stats || {},
        equity: req.body.equity || [],
        trades: req.body.trades || [],
    });
    return res.status(201).json({ success: true, data: rec });
});

// ============================================================
// ANALYTICS & RISK
// ============================================================
router.get('/analytics', async (req, res) => {
    const trades = await loadTrades();
    const closed = trades.filter((t) => t.status === 'closed');
    const pnls = closed.map((t) => t.pnl || 0);
    const wins = closed.filter((t) => t.win);
    const losses = closed.filter((t) => !t.win && t.status === 'closed');
    const grossWin = wins.reduce((s, t) => s + (t.pnl || 0), 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0));
    return ok(res, {
        totalPnl: pnls.reduce((s, p) => s + p, 0),
        avgPnl: pnls.length ? +(pnls.reduce((s, p) => s + p, 0) / pnls.length).toFixed(4) : 0,
        bestTrade: pnls.length ? Math.max(...pnls) : 0,
        worstTrade: pnls.length ? Math.min(...pnls) : 0,
        winRate: closed.length ? +((wins.length / closed.length) * 100).toFixed(2) : 0,
        profitFactor: grossLoss ? +(grossWin / grossLoss).toFixed(2) : null,
    });
});

router.get('/risk', async (req, res) => {
    const trades = await loadTrades();
    const open = trades.filter((t) => t.status === 'open');
    const closed = trades.filter((t) => t.status === 'closed');
    let peak = 0, equity = 0, maxDd = 0;
    for (const t of [...closed].reverse()) {
        equity += t.pnl || 0;
        peak = Math.max(peak, equity);
        maxDd = Math.min(maxDd, equity - peak);
    }
    return ok(res, {
        openPositions: open.length,
        exposureQty: +open.reduce((s, t) => s + (t.qty || 0), 0).toFixed(6),
        maxDrawdown: +maxDd.toFixed(2),
        avgRiskScore: open.length ? +(open.reduce((s, t) => s + (t.riskScore || 0), 0) / open.length).toFixed(2) : 0,
    });
});

// ============================================================
// ALERTS  (market_alerts collection)
// ============================================================
router.get('/alerts', async (req, res) => {
    const client = await pb();
    const items = await client.collection('market_alerts').getFullList({ sort: '-created' });
    return ok(res, items);
});

router.post('/alerts', requireAuth, async (req, res) => {
    const { title } = req.body ?? {};
    if (!title) return res.status(422).json({ success: false, error: 'title required' });
    const client = await pb();
    const rec = await client.collection('market_alerts').create({
        title,
        kind: req.body.kind || 'custom',
        symbol: req.body.symbol || '',
        detail: req.body.detail || '',
        severity: req.body.severity || 'info',
        condition: req.body.condition || {},
        active: req.body.active !== false,
        triggered: false,
    });
    return res.status(201).json({ success: true, data: rec });
});

router.delete('/alerts/:id', requireAuth, async (req, res) => {
    const client = await pb();
    try {
        await client.collection('market_alerts').delete(req.params.id);
        return ok(res, { deleted: true, id: req.params.id });
    } catch {
        return res.status(404).json({ success: false, error: 'alert not found' });
    }
});

// ============================================================
// Incoming webhook (TradingView / custom signals)
// ============================================================
router.post('/webhook/signal', async (req, res) => {
    const { symbol, action } = req.body ?? {};
    if (!symbol || !action) return res.status(422).json({ success: false, error: 'symbol and action required' });
    const client = await pb();
    try {
        await client.collection('market_alerts').create({
            title: `Signal: ${action.toUpperCase()} ${symbol}`,
            kind: 'custom',
            symbol: String(symbol).toUpperCase(),
            detail: JSON.stringify(req.body).slice(0, 900),
            severity: 'info',
            active: true,
            triggered: true,
        });
    } catch (err) {
        logger.error('webhook signal persist failed', String(err));
    }
    return res.status(202).json({ success: true, data: { received: true, symbol, action } });
});

export default router;
