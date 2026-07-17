/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const open = { listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: "" };

    const defs = [
      {
        name: "backtest_results",
        fields: [
          { name: "label", type: "text", required: true, max: 120 },
          { name: "profileKey", type: "text", max: 60 },
          { name: "symbol", type: "text", max: 20 },
          { name: "timeframe", type: "text", max: 10 },
          { name: "startDate", type: "text", max: 30 },
          { name: "endDate", type: "text", max: 30 },
          { name: "config", type: "json", maxSize: 200000 },
          { name: "stats", type: "json", maxSize: 500000 },
          { name: "equity", type: "json", maxSize: 2000000 },
          { name: "trades", type: "json", maxSize: 5000000 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      },
      {
        name: "learning_insights",
        fields: [
          { name: "period", type: "text", max: 20 },
          { name: "data", type: "json", maxSize: 2000000 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      },
      {
        name: "ai_recommendations",
        fields: [
          { name: "title", type: "text", required: true, max: 200 },
          { name: "category", type: "text", max: 40 },
          { name: "detail", type: "text", max: 1000 },
          { name: "severity", type: "select", maxSelect: 1, values: ["info", "warning", "critical"] },
          { name: "followed", type: "bool" },
          { name: "meta", type: "json", maxSize: 200000 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      },
    ];

    for (const d of defs) {
      try {
        app.findCollectionByNameOrId(d.name);
      } catch (_) {
        app.save(new Collection({ type: "base", name: d.name, ...open, fields: d.fields }));
      }
    }
  },
  (app) => {
    for (const name of ["backtest_results", "learning_insights", "ai_recommendations"]) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch (e) {
        if (!String(e.message).includes("no rows in result set")) throw e;
      }
    }
  },
);
