/// <reference path="../pb_data/types.d.ts" />

// Phase 5 — Market Intelligence + Multi-Exchange.
// Single-user personal app: open rules matching bot_config / trades / etc.
migrate(
  (app) => {
    const mk = (name, fields, indexes = []) => {
      try {
        return app.findCollectionByNameOrId(name);
      } catch (_) {
        const c = new Collection({
          type: "base",
          name,
          listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: "",
          fields: [
            ...fields,
            { name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
          ],
          indexes,
        });
        app.save(c);
        return c;
      }
    };

    mk("market_alerts", [
      { name: "kind", type: "select", maxSelect: 1, values: ["indicator", "whale", "sentiment", "news", "economic", "custom"] },
      { name: "symbol", type: "text", max: 20 },
      { name: "title", type: "text", required: true, max: 200 },
      { name: "detail", type: "text", max: 1000 },
      { name: "severity", type: "select", maxSelect: 1, values: ["info", "warning", "critical"] },
      { name: "condition", type: "json", maxSize: 100000 },
      { name: "active", type: "bool" },
      { name: "triggered", type: "bool" },
    ]);

    mk("exchange_connections", [
      { name: "exchangeId", type: "text", required: true, max: 30 },
      { name: "name", type: "text", max: 40 },
      { name: "apiKeyMasked", type: "text", max: 80 },
      { name: "apiKeyEnc", type: "text", max: 2000 },
      { name: "secretEnc", type: "text", max: 2000 },
      { name: "passphraseEnc", type: "text", max: 2000 },
      { name: "mode", type: "select", maxSelect: 1, values: ["testnet", "live"] },
      { name: "connected", type: "bool" },
      { name: "primary", type: "bool" },
      { name: "settings", type: "json", maxSize: 100000 },
    ], [
      "CREATE UNIQUE INDEX idx_exchange_connections_exchangeId ON exchange_connections (exchangeId)",
    ]);

    mk("market_intelligence", [
      { name: "symbol", type: "text", max: 20 },
      { name: "snapshot", type: "json", maxSize: 2000000 },
    ]);
  },
  (app) => {
    for (const name of ["market_alerts", "exchange_connections", "market_intelligence"]) {
      try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) { /* skip */ }
    }
  },
);
