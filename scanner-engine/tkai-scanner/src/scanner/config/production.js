/**
 * @file Production environment configuration.
 * @module scanner/config/production
 */

export default {
  environment: 'production',
  binance: {
    restBaseUrl: 'https://fapi.binance.com',
    wsBaseUrl: 'wss://fstream.binance.com',
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
      initialDelayMs: 1000,
      maxDelayMs: 60000,
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
    poolSize: 8,
    symbolsPerWorker: 40,
    workerHeartbeatIntervalMs: 5000,
    workerFrozenThresholdMs: 20000,
  },
  metrics: {
    sampleIntervalMs: 5000,
  },
  health: {
    checkIntervalMs: 10000,
    memoryWarnMb: 1024,
    memoryCriticalMb: 2048,
    cpuWarnPct: 75,
    cpuCriticalPct: 92,
    reconnectLoopThreshold: 5,
    reconnectLoopWindowMs: 60000,
  },
  logging: {
    level: 'info',
    dir: './logs',
    maxFileSizeBytes: 25 * 1024 * 1024,
    maxFiles: 20,
  },
};
