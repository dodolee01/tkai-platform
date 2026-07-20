import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AlertRules } from '../src/AlertRules.js';
import { Priority } from '../src/NotificationPriority.js';

test('every documented notification type resolves to some valid priority', () => {
  const rules = new AlertRules();
  const types = [
    'tradeOpen', 'tradeClose', 'partialClose', 'stopLoss', 'takeProfit', 'trailingStop', 'breakEven',
    'riskWarning', 'marginWarning', 'liquidationWarning', 'apiFailure', 'webSocketFailure', 'exchangeFailure',
    'strategyActivated', 'strategyDisabled', 'portfolioUpdate', 'learningUpdate', 'performanceReport',
    'healthReport', 'systemError', 'criticalAlert',
  ];
  for (const type of types) {
    const priority = rules.resolvePriority({ type, data: {} });
    assert.ok(Object.values(Priority).includes(priority), `${type} resolved to invalid priority ${priority}`);
  }
});

test('liquidationWarning and criticalAlert default to CRITICAL', () => {
  const rules = new AlertRules();
  assert.equal(rules.resolvePriority({ type: 'liquidationWarning', data: {} }), Priority.CRITICAL);
  assert.equal(rules.resolvePriority({ type: 'criticalAlert', data: {} }), Priority.CRITICAL);
});

test('an explicit request.priority always wins over rules', () => {
  const rules = new AlertRules();
  assert.equal(rules.resolvePriority({ type: 'liquidationWarning', priority: Priority.LOW, data: {} }), Priority.LOW);
});

test('setTypePriority overrides the built-in default for a type', () => {
  const rules = new AlertRules();
  rules.setTypePriority('portfolioUpdate', Priority.HIGH);
  assert.equal(rules.resolvePriority({ type: 'portfolioUpdate', data: {} }), Priority.HIGH);
});

test('an escalation rule only applies when its predicate returns true', () => {
  const rules = new AlertRules();
  rules.addEscalationRule('marginWarning', (d) => d.marginRatio >= 0.9, Priority.CRITICAL);
  assert.equal(rules.resolvePriority({ type: 'marginWarning', data: { marginRatio: 0.95 } }), Priority.CRITICAL);
  assert.equal(rules.resolvePriority({ type: 'marginWarning', data: { marginRatio: 0.3 } }), Priority.HIGH);
});

test('a throwing escalation predicate is safely skipped, falling through to the default', () => {
  const rules = new AlertRules();
  rules.addEscalationRule('tradeOpen', () => { throw new Error('bug in predicate'); }, Priority.CRITICAL);
  assert.doesNotThrow(() => rules.resolvePriority({ type: 'tradeOpen', data: {} }));
});

test('an unknown notification type defaults to MEDIUM', () => {
  const rules = new AlertRules();
  assert.equal(rules.resolvePriority({ type: 'totallyUnknownType', data: {} }), Priority.MEDIUM);
});
