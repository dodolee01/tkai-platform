/// <reference path="../pb_data/types.d.ts" />

// Phase 9 database optimization: add composite / hot-path indexes for the
// most frequently queried collections. Idempotent — only adds indexes that
// are not already present.
migrate(
  (app) => {
    const ensureIndexes = (name, indexes) => {
      const collection = app.findCollectionByNameOrId(name);
      let changed = false;
      for (const sql of indexes) {
        if (!collection.indexes.some((existing) => existing === sql)) {
          collection.indexes.push(sql);
          changed = true;
        }
      }
      if (changed) app.save(collection);
    };

    ensureIndexes('trades', [
      'CREATE INDEX idx_trades_symbol ON trades (symbol)',
      'CREATE INDEX idx_trades_mode ON trades (mode)',
      'CREATE INDEX idx_trades_status_created ON trades (status, created)',
    ]);

    ensureIndexes('notifications', [
      'CREATE INDEX idx_notifications_type ON notifications (type)',
      'CREATE INDEX idx_notifications_read_created ON notifications (isRead, created)',
    ]);

    ensureIndexes('defi_transactions', [
      'CREATE INDEX idx_defi_tx_wallet ON defi_transactions (walletAddress)',
      'CREATE INDEX idx_defi_tx_status ON defi_transactions (status)',
    ]);

    ensureIndexes('market_alerts', [
      'CREATE INDEX idx_market_alerts_active ON market_alerts (active)',
    ]);
  },
  (app) => {
    const dropIndexes = (name, indexNames) => {
      const collection = app.findCollectionByNameOrId(name);
      collection.indexes = collection.indexes.filter(
        (sql) => !indexNames.some((idx) => sql.includes(idx)),
      );
      app.save(collection);
    };

    dropIndexes('trades', ['idx_trades_symbol', 'idx_trades_mode', 'idx_trades_status_created']);
    dropIndexes('notifications', ['idx_notifications_type', 'idx_notifications_read_created']);
    dropIndexes('defi_transactions', ['idx_defi_tx_wallet', 'idx_defi_tx_status']);
    dropIndexes('market_alerts', ['idx_market_alerts_active']);
  },
);
