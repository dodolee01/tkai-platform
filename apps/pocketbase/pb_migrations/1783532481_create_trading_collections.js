/// <reference path="../pb_data/types.d.ts" />

// Personal single-user trading system (no auth) — collections are open.
// API keys are NEVER stored in plaintext here: only AES-256 ciphertext
// produced server-side by Express is persisted in bot_config.
migrate(
  (app) => {
    // ---- trades log ----
    let trades;
    try {
      trades = app.findCollectionByNameOrId("trades");
    } catch (_) {
      trades = new Collection({
        type: "base",
        name: "trades",
        listRule: "",
        viewRule: "",
        createRule: "",
        updateRule: "",
        deleteRule: "",
        fields: [
          { name: "tradeId", type: "text", required: true, max: 60 },
          { name: "symbol", type: "text", required: true, max: 20 },
          { name: "pairName", type: "text", max: 40 },
          { name: "side", type: "select", maxSelect: 1, values: ["LONG", "SHORT"] },
          { name: "entry", type: "number" },
          { name: "tp", type: "number" },
          { name: "sl", type: "number" },
          { name: "qty", type: "number" },
          { name: "exit", type: "number" },
          { name: "pnl", type: "number" },
          { name: "rr", type: "text", max: 20 },
          { name: "confidence", type: "number" },
          { name: "riskScore", type: "number" },
          { name: "status", type: "select", maxSelect: 1, values: ["open", "closed"] },
          { name: "result", type: "select", maxSelect: 1, values: ["TP", "SL", "MANUAL"] },
          { name: "win", type: "bool" },
          { name: "mode", type: "select", maxSelect: 1, values: ["testnet", "live", "sim"] },
          { name: "binanceOrderId", type: "text", max: 60 },
          { name: "openedAt", type: "number" },
          { name: "closedAt", type: "number" },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_trades_tradeId ON trades (tradeId)",
          "CREATE INDEX idx_trades_status ON trades (status)",
        ],
      });
      app.save(trades);
    }

    // ---- bot config (encrypted keys + settings) ----
    try {
      app.findCollectionByNameOrId("bot_config");
    } catch (_) {
      const cfg = new Collection({
        type: "base",
        name: "bot_config",
        listRule: "",
        viewRule: "",
        createRule: "",
        updateRule: "",
        deleteRule: "",
        fields: [
          { name: "key", type: "text", required: true, max: 40 },
          { name: "apiKeyMasked", type: "text", max: 80 },
          { name: "apiKeyEnc", type: "text", max: 2000 },
          { name: "secretEnc", type: "text", max: 2000 },
          { name: "mode", type: "select", maxSelect: 1, values: ["testnet", "live"] },
          { name: "connected", type: "bool" },
          { name: "settings", type: "json", maxSize: 200000 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: ["CREATE UNIQUE INDEX idx_bot_config_key ON bot_config (key)"],
      });
      app.save(cfg);
    }
  },
  (app) => {
    for (const name of ["trades", "bot_config"]) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch (_) { /* already gone */ }
    }
  },
);
