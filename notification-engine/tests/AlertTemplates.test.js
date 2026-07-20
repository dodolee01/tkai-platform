import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AlertTemplates } from '../src/AlertTemplates.js';

test('every documented example template renders without throwing', () => {
  const templates = new AlertTemplates();
  const cases = [
    ['tradeOpen', { symbol: 'BTCUSDT', side: 'LONG', entryPrice: 65000, quantity: 0.01, leverage: 5 }],
    ['tradeClose', { symbol: 'BTCUSDT', exitPrice: 66000, pnl: 100, pnlPercent: 1.5 }],
    ['takeProfit', { symbol: 'BTCUSDT', targetPrice: 67000, pnl: 200 }],
    ['riskWarning', { message: 'Exposure too high', symbol: 'BTCUSDT' }],
    ['portfolioUpdate', { equity: 10000, unrealizedPnl: 50, exposurePct: 30 }],
    ['performanceReport', { period: 'weekly', netProfit: 500, winRate: 0.6, profitFactor: 2.1 }],
  ];
  for (const [type, data] of cases) {
    const rendered = templates.render(type, data);
    assert.equal(typeof rendered.title, 'string');
    assert.equal(typeof rendered.body, 'string');
    assert.ok(rendered.title.length > 0);
  }
});

test('an unregistered type falls back to a generic rendering instead of throwing', () => {
  const templates = new AlertTemplates();
  const rendered = templates.render('neverRegistered', { x: 1 });
  assert.equal(rendered.title, 'neverRegistered');
  assert.ok(rendered.body.includes('"x":1'));
});

test('register() adds a new custom template', () => {
  const templates = new AlertTemplates();
  templates.register('myCustomType', { title: (d) => `Hi ${d.name}`, body: () => 'body text' });
  assert.equal(templates.render('myCustomType', { name: 'Trader' }).title, 'Hi Trader');
});

test('register() can override a built-in template', () => {
  const templates = new AlertTemplates();
  templates.register('tradeOpen', { title: () => 'Custom Title', body: () => 'Custom Body' });
  assert.equal(templates.render('tradeOpen', {}).title, 'Custom Title');
});

test('register() rejects a template missing title or body functions', () => {
  const templates = new AlertTemplates();
  assert.throws(() => templates.register('bad', { title: () => 'x' }));
  assert.throws(() => templates.register('bad2', { body: () => 'x' }));
});

test('has() correctly reports whether a type is registered', () => {
  const templates = new AlertTemplates();
  assert.equal(templates.has('tradeOpen'), true);
  assert.equal(templates.has('doesNotExist'), false);
});

test('getRegisteredTypes lists every built-in type from the module spec', () => {
  const templates = new AlertTemplates();
  const required = ['tradeOpen', 'tradeClose', 'partialClose', 'stopLoss', 'takeProfit', 'trailingStop', 'breakEven', 'riskWarning', 'marginWarning', 'liquidationWarning'];
  const types = templates.getRegisteredTypes();
  for (const t of required) assert.ok(types.includes(t), `missing template: ${t}`);
});
