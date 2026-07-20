/**
 * @file Binance Futures testnet configuration.
 * @module scanner/config/testnet
 */

export default {
  environment: 'testnet',
  binance: {
    restBaseUrl: 'https://testnet.binancefuture.com',
    wsBaseUrl: 'wss://stream.binancefuture.com',
    exchangeInfoPath: '/fapi/v1/exchangeInfo',
  },
  registry: {
    refreshIntervalMs: 60 * 60 * 1000,
    requestTimeoutMs: 10000,
  },
  websocket: {
    heartbeatIntervalMs: 15000,
    heartbeatTimeoutMs: 10000,
    reconnect: {
      initialDelayMs: 500,
      maxDelayMs: 30000,
      multiplier: 2,
      jitterRatio: 0.2,
      maxConsecutiveFailuresBeforeAlert: 5,
    },
    maxStreamsPerConnection: 200,
    streamBatchSize: 50,
  },
  cache: {
    orderBookDepthLevels: 20,
    liquidationWindowMs: 5 * 60 * 1000,
  },
  workers: {
    poolSize: 2,
    symbolsPerWorker: 50,
    workerHeartbeatIntervalMs: 5000,
    workerFrozenThresholdMs: 20000,
  },
  metrics: {
    sampleIntervalMs: 5000,
  },
  health: {
    checkIntervalMs: 10000,
    memoryWarnMb: 512,
    memoryCriticalMb: 1024,
    cpuWarnPct: 70,
    cpuCriticalPct: 90,
    reconnectLoopThreshold: 5,
    reconnectLoopWindowMs: 60000,
  },
  logging: {
    level: 'debug',
    dir: './logs',
    maxFileSizeBytes: 10 * 1024 * 1024,
    maxFiles: 10,
  },
};
