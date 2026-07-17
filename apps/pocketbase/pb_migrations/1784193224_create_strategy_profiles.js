/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    let collection;
    try {
      collection = app.findCollectionByNameOrId("strategy_profiles");
    } catch (_) {
      collection = new Collection({
        type: "base",
        name: "strategy_profiles",
        // Single-user personal app — matches the open rules used by the
        // existing bot_config / trades collections.
        listRule: "",
        viewRule: "",
        createRule: "",
        updateRule: "",
        deleteRule: "",
        fields: [
          { name: "key", type: "text", required: true, max: 60 },
          { name: "name", type: "text", required: true, max: 80 },
          { name: "description", type: "text", max: 400 },
          { name: "builtin", type: "bool" },
          { name: "active", type: "bool" },
          { name: "riskLevel", type: "number", min: 1, max: 10 },
          { name: "config", type: "json", maxSize: 200000 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_strategy_profiles_key ON strategy_profiles (key)",
        ],
      });
      app.save(collection);
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("strategy_profiles");
      app.delete(collection);
    } catch (e) {
      if (String(e.message).includes("no rows in result set")) return;
      throw e;
    }
  },
);
