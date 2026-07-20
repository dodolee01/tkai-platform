/**
 * @file Development environment configuration.
 * @module scanner/config/development
 */

export default {
  environment: 'development',
  binance: {
    restBaseUrl: 'https://fapi.binance.com',
    wsBaseUrl: 'wss://fstream.binance.com',
    exchangeInfoPath: '/fapi/v1/exchangeInfo',
  },
  registry: {
    refreshIntervalMs: 60 * 60 * 1000, // 1 hour
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
    poolSize: 4,
    symbolsPerWorker: 75,
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
