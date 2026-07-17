/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const open = { listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: "" };

    const wallets = new Collection({
      type: "base",
      name: "web3_wallets",
      ...open,
      fields: [
        { name: "address", type: "text", required: true, max: 120 },
        { name: "label", type: "text", max: 80 },
        { name: "walletType", type: "text", max: 40 },
        { name: "chainId", type: "text", max: 40 },
        { name: "chainKey", type: "text", max: 40 },
        { name: "connected", type: "bool" },
        { name: "primary", type: "bool" },
        { name: "balances", type: "json", maxSize: 500000 },
        { name: "tokens", type: "json", maxSize: 2000000 },
        { name: "nfts", type: "json", maxSize: 2000000 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_web3_wallets_addr ON web3_wallets (address)"],
    });
    app.save(wallets);

    const txs = new Collection({
      type: "base",
      name: "defi_transactions",
      ...open,
      fields: [
        { name: "txId", type: "text", required: true, max: 120 },
        { name: "walletAddress", type: "text", max: 120 },
        { name: "chainKey", type: "text", max: 40 },
        { name: "protocol", type: "text", max: 40 },
        { name: "kind", type: "select", maxSelect: 1, values: ["swap", "addLiquidity", "removeLiquidity", "stake", "unstake", "claim", "deposit", "borrow", "repay", "send", "receive"] },
        { name: "fromToken", type: "text", max: 40 },
        { name: "toToken", type: "text", max: 40 },
        { name: "fromAmount", type: "number" },
        { name: "toAmount", type: "number" },
        { name: "valueUsd", type: "number" },
        { name: "gasUsd", type: "number" },
        { name: "status", type: "select", maxSelect: 1, values: ["pending", "confirmed", "failed"] },
        { name: "meta", type: "json", maxSize: 200000 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_defi_transactions_txId ON defi_transactions (txId)"],
    });
    app.save(txs);

    const positions = new Collection({
      type: "base",
      name: "defi_positions",
      ...open,
      fields: [
        { name: "positionId", type: "text", required: true, max: 120 },
        { name: "walletAddress", type: "text", max: 120 },
        { name: "chainKey", type: "text", max: 40 },
        { name: "protocol", type: "text", max: 40 },
        { name: "kind", type: "select", maxSelect: 1, values: ["liquidity", "farm", "lending", "borrow"] },
        { name: "pair", type: "text", max: 60 },
        { name: "amountUsd", type: "number" },
        { name: "apy", type: "number" },
        { name: "rewardsUsd", type: "number" },
        { name: "healthFactor", type: "number" },
        { name: "active", type: "bool" },
        { name: "meta", type: "json", maxSize: 200000 },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_defi_positions_positionId ON defi_positions (positionId)"],
    });
    app.save(positions);
  },
  (app) => {
    for (const n of ["web3_wallets", "defi_transactions", "defi_positions"]) {
      try {
        app.delete(app.findCollectionByNameOrId(n));
      } catch (_) { /* ignore */ }
    }
  },
);
