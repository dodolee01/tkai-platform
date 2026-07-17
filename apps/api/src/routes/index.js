import { Router } from 'express';
import healthCheck from './health-check.js';
import binanceSnapshot from './binance-snapshot.js';
import binanceHistory from './binance-history.js';
import binanceConnect from './binance-connect.js';
import binanceDisconnect from './binance-disconnect.js';
import binanceOrder from './binance-order.js';
import binanceBalance from './binance-balance.js';
import binanceFuturesMarket from './binance-futures-market.js';
import integratedAiRouter from './integrated-ai.js';
import marketIntel from './market-intel.js';
import publicApiV1 from './public-api.js';
import exchangeTicker from './exchange-ticker.js';
import v1Router from './v1.js';
import emailSend from './email-send.js';
import claudeChat from './claude.js';
import { makeMarketHandlers } from '../utils/binance-market.js';
import { sensitiveRateLimit } from '../middleware/global-rate-limit.js';
import rateLimit from 'express-rate-limit';

// Email endpoint: max 10 requests per minute per IP.
const emailRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Çok fazla istek. Lütfen bir dakika sonra tekrar deneyin.' },
});

const spot = makeMarketHandlers('spot');
const futures = makeMarketHandlers('futures');

const router = Router();

export default () => {
    router.get('/health', healthCheck);
    router.post('/email/send', emailRateLimit, emailSend);
    router.post('/claude/chat', sensitiveRateLimit, claudeChat);
    router.get('/binance/snapshot', binanceSnapshot);
    router.get('/binance/history', binanceHistory);
    router.post('/binance/connect', sensitiveRateLimit, binanceConnect);
    router.post('/binance/disconnect', sensitiveRateLimit, binanceDisconnect);
    router.post('/binance/order', sensitiveRateLimit, binanceOrder);
    router.get('/binance/balance', binanceBalance);
    router.get('/binance/futures-market', binanceFuturesMarket);
    router.use('/integrated-ai', integratedAiRouter);
    router.get('/market/intel', marketIntel);
    router.get('/exchange/ticker', exchangeTicker);
    // Primary documented v1 API (auth + rate-limit middleware) takes priority.
    router.use('/v1', v1Router);
    // Fallback for v1 endpoints unique to the public API (status, web3, defi, fear-greed).
    router.use('/v1', publicApiV1);

    // Isolated Spot trading system
    router.post('/spot/connect', sensitiveRateLimit, spot.connect);
    router.post('/spot/disconnect', sensitiveRateLimit, spot.disconnect);
    router.get('/spot/balance', spot.balance);
    router.post('/spot/order', sensitiveRateLimit, spot.order);
    router.post('/spot/close', sensitiveRateLimit, spot.close);

    // Isolated Futures trading system
    router.post('/futures/connect', sensitiveRateLimit, futures.connect);
    router.post('/futures/disconnect', sensitiveRateLimit, futures.disconnect);
    router.get('/futures/balance', futures.balance);
    router.post('/futures/order', sensitiveRateLimit, futures.order);
    router.post('/futures/close', sensitiveRateLimit, futures.close);

    return router;
};

