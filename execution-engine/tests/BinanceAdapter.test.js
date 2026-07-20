import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { BinanceAdapter } from '../src/BinanceAdapter.js';
import { ExchangeAdapter } from '../src/ExchangeAdapter.js';

const apiKey = 'test-key';
const apiSecret = 'test-secret';

function fakeHttpClient(responseMap) {
  const captured = [];
  const client = async (url, options) => {
    captured.push({ url, options });
    const urlObj = new URL(url);
    const key = `${options.method} ${urlObj.pathname}`;
    const responder = responseMap[key];
    if (!responder) throw new Error(`No fake response for ${key}`);
    return responder(urlObj);
  };
  client.captured = captured;
  return client;
}

test('ExchangeAdapter cannot be instantiated directly', () => {
  assert.throws(() => new ExchangeAdapter('x'));
});

test('ExchangeAdapter base methods reject with a not-implemented error', async () => {
  class Dummy extends ExchangeAdapter { constructor() { super('dummy'); } }
  const d = new Dummy();
  await assert.rejects(() => d.placeOrder({}), /does not implement/);
});

test('constructor requires apiKey, apiSecret, and an httpClient', () => {
  assert.throws(() => new BinanceAdapter({ apiKey: '', apiSecret: 'x', httpClient: async () => {} }));
  assert.throws(() => new BinanceAdapter({ apiKey: 'x', apiSecret: 'x', httpClient: undefined }));
});

test('buildSignedQueryString produces a verifiable HMAC-SHA256 signature', () => {
  const adapter = new BinanceAdapter({ apiKey, apiSecret, httpClient: async () => {} });
  const query = adapter.buildSignedQueryString({ symbol: 'BTCUSDT', side: 'BUY' });
  const [unsigned, signature] = [query.slice(0, query.lastIndexOf('&signature=')), query.slice(query.lastIndexOf('signature=') + 10)];
  const expected = createHmac('sha256', apiSecret).update(unsigned).digest('hex');
  assert.equal(signature, expected);
});

test('placeOrder sends the correct params and API key header, and parses the response', async () => {
  const httpClient = fakeHttpClient({
    'POST /fapi/v1/order': () => ({ ok: true, status: 200, json: async () => ({ orderId: 1, clientOrderId: 'c1', status: 'NEW', avgPrice: '0', origQty: '0.01' }) }),
  });
  const adapter = new BinanceAdapter({ apiKey, apiSecret, httpClient });
  const result = await adapter.placeOrder({ symbol: 'BTCUSDT', side: 'BUY', type: 'MARKET', quantity: 0.01, clientOrderId: 'c1' });

  assert.equal(result.orderId, '1');
  assert.equal(result.status, 'NEW');
  const req = httpClient.captured[0];
  assert.equal(req.options.headers['X-MBX-APIKEY'], apiKey);
  const url = new URL(req.url);
  assert.equal(url.searchParams.get('symbol'), 'BTCUSDT');
  assert.equal(url.searchParams.get('type'), 'MARKET');
});

test('getPosition returns null when positionAmt is zero', async () => {
  const httpClient = fakeHttpClient({
    'GET /fapi/v2/positionRisk': () => ({ ok: true, status: 200, json: async () => ([{ symbol: 'BTCUSDT', positionAmt: '0', entryPrice: '0', leverage: '5', unRealizedProfit: '0' }]) }),
  });
  const adapter = new BinanceAdapter({ apiKey, apiSecret, httpClient });
  assert.equal(await adapter.getPosition('BTCUSDT'), null);
});

test('getPosition correctly infers SHORT side from a negative positionAmt', async () => {
  const httpClient = fakeHttpClient({
    'GET /fapi/v2/positionRisk': () => ({ ok: true, status: 200, json: async () => ([{ symbol: 'BTCUSDT', positionAmt: '-0.5', entryPrice: '65000', leverage: '5', unRealizedProfit: '-10' }]) }),
  });
  const adapter = new BinanceAdapter({ apiKey, apiSecret, httpClient });
  const position = await adapter.getPosition('BTCUSDT');
  assert.equal(position.side, 'SHORT');
  assert.equal(position.quantity, 0.5);
});

test('getSymbolInfo parses PRICE_FILTER, LOT_SIZE, and MIN_NOTIONAL filters', async () => {
  const httpClient = fakeHttpClient({
    'GET /fapi/v1/exchangeInfo': () => ({
      ok: true, status: 200,
      json: async () => ({
        symbols: [{
          symbol: 'BTCUSDT', pricePrecision: 2, quantityPrecision: 3, status: 'TRADING',
          filters: [
            { filterType: 'PRICE_FILTER', tickSize: '0.10' },
            { filterType: 'LOT_SIZE', stepSize: '0.001', minQty: '0.001', maxQty: '1000' },
            { filterType: 'MIN_NOTIONAL', notional: '5' },
          ],
        }],
      }),
    }),
  });
  const adapter = new BinanceAdapter({ apiKey, apiSecret, httpClient });
  const info = await adapter.getSymbolInfo('BTCUSDT');
  assert.equal(info.tickSize, 0.1);
  assert.equal(info.minNotional, 5);
});

test('getServerTime does not sign the request (public endpoint)', async () => {
  const httpClient = fakeHttpClient({ 'GET /fapi/v1/time': () => ({ ok: true, status: 200, json: async () => ({ serverTime: 123 }) }) });
  const adapter = new BinanceAdapter({ apiKey, apiSecret, httpClient });
  await adapter.getServerTime();
  const req = httpClient.captured[0];
  assert.equal(req.url.includes('signature='), false);
  assert.deepEqual(req.options.headers, {});
});

test('a non-ok response with a Binance error body is thrown as-is for ErrorHandler to classify', async () => {
  const httpClient = fakeHttpClient({
    'POST /fapi/v1/order': () => ({ ok: false, status: 400, json: async () => ({ code: -2019, msg: 'Margin is insufficient.' }) }),
  });
  const adapter = new BinanceAdapter({ apiKey, apiSecret, httpClient });
  await assert.rejects(
    () => adapter.placeOrder({ symbol: 'BTCUSDT', side: 'BUY', type: 'MARKET', quantity: 1, clientOrderId: 'c' }),
    (err) => err.code === -2019
  );
});
