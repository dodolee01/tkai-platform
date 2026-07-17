/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    let collection;
    try {
      collection = app.findCollectionByNameOrId("user_api_keys");
    } catch (_) {
      const users = app.findCollectionByNameOrId("users");
      collection = new Collection({
        type: "base",
        name: "user_api_keys",
        // Owner-scoped: a user can only see/manage their own exchange keys.
        listRule: "@request.auth.id != '' && @request.auth.id = owner",
        viewRule: "@request.auth.id != '' && @request.auth.id = owner",
        createRule: "@request.auth.id != '' && @request.auth.id = @request.body.owner",
        updateRule: "@request.auth.id != '' && @request.auth.id = owner",
        deleteRule: "@request.auth.id != '' && @request.auth.id = owner",
        fields: [
          {
            name: "owner",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: true,
          },
          {
            name: "exchange",
            type: "select",
            required: true,
            maxSelect: 1,
            values: ["binance", "kraken", "bybit", "okx", "coinbase", "bitget", "kucoin", "gateio", "mexc"],
          },
          { name: "label", type: "text", max: 80 },
          { name: "apiKey", type: "text", required: true, max: 512 },
          { name: "apiSecret", type: "text", required: true, max: 512 },
          { name: "passphrase", type: "text", max: 512 },
          {
            name: "mode",
            type: "select",
            maxSelect: 1,
            values: ["testnet", "live"],
          },
          { name: "connected", type: "bool" },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: [
          "CREATE INDEX idx_user_api_keys_owner ON user_api_keys (owner)",
        ],
      });
      app.save(collection);
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("user_api_keys");
      app.delete(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) return;
      throw e;
    }
  },
);
