import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportToCSV, exportToJSON, exportToExcel, exportToPDFReadyHTML } from '../src/ExportManager.js';

test('exportToCSV produces a correct header and escapes embedded commas/quotes', () => {
  const rows = [{ symbol: 'BTCUSDT', pnl: 100 }, { symbol: 'ETH,USDT', pnl: -50 }];
  const csv = exportToCSV(rows);
  assert.equal(csv.split('\n')[0], 'symbol,pnl');
  assert.ok(csv.includes('"ETH,USDT"'));
});

test('exportToCSV returns an empty string for an empty input', () => {
  assert.equal(exportToCSV([]), '');
});

test('exportToJSON round-trips arbitrary JSON-serializable data', () => {
  const json = exportToJSON({ a: 1, b: [1, 2, 3] });
  const parsed = JSON.parse(json);
  assert.equal(parsed.a, 1);
  assert.equal(parsed.b.length, 3);
});

test('exportToExcel produces well-formed SpreadsheetML with correct sheet name and cell types', () => {
  const xml = exportToExcel([{ symbol: 'BTCUSDT', pnl: 100 }], 'Trades');
  assert.ok(xml.startsWith('<?xml version="1.0"?>'));
  assert.ok(xml.includes('ss:Name="Trades"'));
  assert.ok(xml.includes('ss:Type="Number">100'));
  assert.ok(xml.includes('ss:Type="String">BTCUSDT'));
});

test('exportToExcel escapes special XML characters', () => {
  const xml = exportToExcel([{ note: '<script>&"test"' }]);
  assert.ok(xml.includes('&lt;script&gt;&amp;&quot;test&quot;'));
});

test('exportToPDFReadyHTML produces a complete, valid HTML document', () => {
  const html = exportToPDFReadyHTML('Monthly Report', { Summary: { netProfit: 500 } });
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.trim().endsWith('</html>'));
});

test('exportToPDFReadyHTML renders object sections as key/value tables and array sections as data tables', () => {
  const html = exportToPDFReadyHTML('Report', { Summary: { netProfit: 500 }, Trades: [{ symbol: 'BTCUSDT', pnl: 10 }] });
  assert.ok(html.includes('<th>netProfit</th><td>500</td>'));
  assert.ok(html.includes('<th>symbol</th>'));
  assert.ok(html.includes('<td>BTCUSDT</td>'));
});

test('exportToPDFReadyHTML escapes user-supplied content to prevent injection', () => {
  const html = exportToPDFReadyHTML('<b>title</b>', {});
  assert.ok(html.includes('&lt;b&gt;title&lt;/b&gt;'));
  assert.ok(!html.includes('<b>title</b>'));
});
