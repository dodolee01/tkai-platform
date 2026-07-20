import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CapitalManager } from '../src/CapitalManager.js';
import { createConfig } from '../src/Config.js';

test('fixedReserve model computes reserved capital as a flat percentage', () => {
  const cm = new CapitalManager(createConfig({ capital: { model: 'fixedReserve', reservePct: 0.25 } }).capital);
  assert.equal(cm.computeReservedCapital(10000), 2500);
});

test('tiered model applies the correct tier for the given equity', () => {
  const cm = new CapitalManager(createConfig({
    capital: { model: 'tiered', tiers: [{ equityFloor: 0, reservePct: 0.3 }, { equityFloor: 10000, reservePct: 0.1 }] },
  }).capital);
  assert.equal(cm.computeReservedCapital(5000), 1500); // lower tier
  assert.equal(cm.computeReservedCapital(20000), 2000); // higher tier
});

test('computeCapitalReport derives available/deployable/risk capital consistently', () => {
  const cm = new CapitalManager(createConfig({ capital: { model: 'fixedReserve', reservePct: 0.2, riskCapitalPct: 0.4 } }).capital);
  const report = cm.computeCapitalReport(10000, 1000);
  assert.equal(report.reservedCapital, 2000);
  assert.equal(report.maxDeployableCapital, 8000);
  assert.equal(report.availableCapital, 7000);
  assert.equal(report.riskCapital, 3200);
});

test('availableCapital never goes negative when used margin exceeds deployable capital', () => {
  const cm = new CapitalManager(createConfig({ capital: { reservePct: 0.2 } }).capital);
  const report = cm.computeCapitalReport(10000, 9000);
  assert.equal(report.availableCapital, 0);
});

test('zero or negative equity returns a fully zeroed report', () => {
  const cm = new CapitalManager(createConfig().capital);
  const report = cm.computeCapitalReport(0, 0);
  assert.deepEqual(report, { availableCapital: 0, reservedCapital: 0, riskCapital: 0, maxDeployableCapital: 0 });
});
