/// <reference path="../pb_data/types.d.ts" />

// Single-user personal dashboard: existing collections use open ("") rules,
// so we follow the same convention for consistency with the rest of the app.
migrate(
  (app) => {
    let collection;
    try {
      collection = app.findCollectionByNameOrId("notifications");
    } catch (_) {
      collection = new Collection({
        type: "base",
        name: "notifications",
        listRule: "",
        viewRule: "",
        createRule: "",
        updateRule: "",
        deleteRule: "",
        fields: [
          {
            name: "type",
            type: "select",
            maxSelect: 1,
            values: [
              "trade",
              "order",
              "portfolio",
              "price",
              "indicator",
              "risk",
              "performance",
              "system",
            ],
          },
          { name: "title", type: "text", required: true, max: 200 },
          { name: "message", type: "text", max: 1000 },
          {
            name: "severity",
            type: "select",
            maxSelect: 1,
            values: ["info", "success", "warning", "critical"],
          },
          {
            name: "channel",
            type: "select",
            maxSelect: 1,
            values: ["in_app", "email", "webhook"],
          },
          { name: "isRead", type: "bool" },
          { name: "meta", type: "json", maxSize: 200000 },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: [
          "CREATE INDEX idx_notifications_isRead ON notifications (isRead)",
        ],
      });
      app.save(collection);
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("notifications");
      app.delete(collection);
    } catch (e) {
      if (String(e.message).includes("no rows in result set")) return;
      throw e;
    }
  },
);
