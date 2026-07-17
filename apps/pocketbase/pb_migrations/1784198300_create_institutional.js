/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const publicRules = { listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '' };

    // Advanced order types (iceberg, twap, vwap, trailing, bracket, oco, if-touched, conditional)
    let orders;
    try { orders = app.findCollectionByNameOrId('advanced_orders'); } catch (_) {
      orders = new Collection({
        type: 'base', name: 'advanced_orders', ...publicRules,
        fields: [
          { name: 'orderId', type: 'text', required: true, max: 60 },
          { name: 'symbol', type: 'text', max: 20 },
          { name: 'type', type: 'select', maxSelect: 1, values: ['iceberg', 'twap', 'vwap', 'trailing', 'bracket', 'oco', 'if_touched', 'conditional'] },
          { name: 'side', type: 'select', maxSelect: 1, values: ['BUY', 'SELL'] },
          { name: 'quantity', type: 'number' },
          { name: 'price', type: 'number' },
          { name: 'status', type: 'select', maxSelect: 1, values: ['active', 'filled', 'cancelled'] },
          { name: 'accountId', type: 'text', max: 60 },
          { name: 'params', type: 'json', maxSize: 200000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_advanced_orders_orderId ON advanced_orders (orderId)'],
      });
      app.save(orders);
    }

    // Sub-accounts for multi-account management
    let accounts;
    try { accounts = app.findCollectionByNameOrId('sub_accounts'); } catch (_) {
      accounts = new Collection({
        type: 'base', name: 'sub_accounts', ...publicRules,
        fields: [
          { name: 'accountId', type: 'text', required: true, max: 60 },
          { name: 'name', type: 'text', required: true, max: 80 },
          { name: 'allocationUsd', type: 'number' },
          { name: 'maxLeverage', type: 'number' },
          { name: 'maxDrawdown', type: 'number' },
          { name: 'dailyLossLimit', type: 'number' },
          { name: 'maxPositionSize', type: 'number' },
          { name: 'active', type: 'bool' },
          { name: 'pnl', type: 'number' },
          { name: 'meta', type: 'json', maxSize: 100000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_sub_accounts_accountId ON sub_accounts (accountId)'],
      });
      app.save(accounts);
    }

    // Audit / compliance log
    let audit;
    try { audit = app.findCollectionByNameOrId('audit_log'); } catch (_) {
      audit = new Collection({
        type: 'base', name: 'audit_log', ...publicRules,
        fields: [
          { name: 'action', type: 'text', required: true, max: 80 },
          { name: 'category', type: 'select', maxSelect: 1, values: ['trade', 'risk', 'order', 'account', 'compliance', 'system'] },
          { name: 'detail', type: 'text', max: 1000 },
          { name: 'accountId', type: 'text', max: 60 },
          { name: 'meta', type: 'json', maxSize: 200000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
        indexes: [],
      });
      app.save(audit);
    }
  },
  (app) => {
    for (const n of ['advanced_orders', 'sub_accounts', 'audit_log']) {
      try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) { /* ignore */ }
    }
  },
);
