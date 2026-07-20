import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streamType, parseTicker, parseMarkPrice, parseLiquidation, parseKline, createStreamRouter } from '../../../src/scanner/websocket/StreamHandlers.js';
import { CoinCache } from '../../../src/scanner/cache/CoinCache.js';
import { OrderBookEngine } from '../../../src/scanner/orderbook/OrderBookEngine.js';
import { EventBus, ScannerEvents } from '../../../src/scanner/core/EventBus.js';

test('streamType classifies combined-stream names correctly', () => {
  assert.equal(streamType('btcusdt@ticker'), 'ticker');
  assert.equal(streamType('btcusdt@markPrice@1s'), 'markPrice');
  assert.equal(streamType('btcusdt@kline_1m'), 'kline');
  assert.equal(streamType('!forceOrder@arr'), 'forceOrder');
  assert.equal(streamType('btcusdt@bookTicker'), 'bookTicker');
});

test('parseTicker converts all numeric string fields', () => {
  const t = parseTicker({ s: 'BTCUSDT', p: '100', P: '1.5', w: '65000', c: '65500', o: '65000', h: '66000', l: '64000', v: '1000', q: '65000000' });
  assert.equal(t.symbol, 'BTCUSDT');
  assert.equal(t.lastPrice, 65500);
  assert.equal(typeof t.volume, 'number');
});

test('parseMarkPrice extracts funding rate and next funding time', () => {
  const m = parseMarkPrice({ s: 'BTCUSDT', p: '65510', i: '65490', P: '65520', r: '0.0001', T: 123 });
  assert.equal(m.fundingRate, 0.0001);
  assert.equal(m.nextFundingTime, 123);
});

test('parseLiquidation reads from the nested "o" field', () => {
  const l = parseLiquidation({ o: { s: 'BTCUSDT', S: 'SELL', q: '2', p: '65000', ap: '64990', X: 'FILLED', T: 111 } });
  assert.equal(l.symbol, 'BTCUSDT');
  assert.equal(l.side, 'SELL');
  assert.equal(l.quantity, 2);
});

test('parseKline reads from the nested "k" field', () => {
  const k = parseKline({ s: 'BTCUSDT', k: { t: 1, T: 2, i: '1m', o: '100', h: '105', l: '99', c: '104', v: '10', x: true, q: '1000', n: 5 } });
  assert.equal(k.interval, '1m');
  assert.equal(k.isClosed, true);
  assert.equal(k.close, 104);
});

test('createStreamRouter routes ticker events into the cache and emits both TICKER_UPDATE and PRICE_UPDATE', () => {
  const cache = new CoinCache();
  const bus = new EventBus();
  const events = [];
  bus.on(ScannerEvents.TICKER_UPDATE, () => events.push('ticker'));
  bus.on(ScannerEvents.PRICE_UPDATE, () => events.push('price'));
  const router = createStreamRouter({ cache, orderBooks: new Map(), eventBus: bus, logger: null });

  router({ stream: 'btcusdt@ticker', data: { s: 'BTCUSDT', p: '1', P: '1', w: '1', c: '65000', o: '1', h: '1', l: '1', v: '1', q: '1' } });

  assert.equal(cache.get('BTCUSDT').price, 65000);
  assert.deepEqual(events, ['ticker', 'price']);
});

test('createStreamRouter routes depth diffs into the matching OrderBookEngine', () => {
  const cache = new CoinCache();
  const orderBooks = new Map();
  const engine = new OrderBookEngine('BTCUSDT', { depthLevels: 5 });
  engine.applySnapshot({ lastUpdateId: 1, bids: [['100', '1']], asks: [['101', '1']] });
  orderBooks.set('BTCUSDT', engine);
  const bus = new EventBus();
  const router = createStreamRouter({ cache, orderBooks, eventBus: bus, logger: null });

  router({ stream: 'btcusdt@depth', data: { s: 'BTCUSDT', b: [['100', '5']], a: [], U: 2, u: 3 } });

  assert.equal(cache.get('BTCUSDT').orderBook.bidPressure, 5);
});

test('createStreamRouter ignores subscribe-ack style envelopes without throwing', () => {
  const cache = new CoinCache();
  const router = createStreamRouter({ cache, orderBooks: new Map(), eventBus: new EventBus(), logger: null });
  assert.doesNotThrow(() => router({ result: null, id: 1 }));
});

test('createStreamRouter logs and continues if a depth update references an unregistered symbol', () => {
  let warned = false;
  const cache = new CoinCache();
  const router = createStreamRouter({ cache, orderBooks: new Map(), eventBus: new EventBus(), logger: { warn: () => { warned = true; }, error(){}, debug(){} } });
  router({ stream: 'unknownusdt@depth', data: { s: 'UNKNOWNUSDT', b: [], a: [], U: 1, u: 2 } });
  assert.equal(warned, true);
});
