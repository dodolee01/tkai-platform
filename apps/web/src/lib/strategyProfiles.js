// Built-in strategy profile definitions for TK AI FİNANCE.
// Each profile carries a full config used by the risk/bot engine.

export const COIN_FILTERS = [
  { value: 'top50', label: 'İlk 50 Coin' },
  { value: 'top100', label: 'İlk 100 Coin' },
  { value: 'all', label: 'Tüm Coinler' },
];

export const TIME_FILTERS = [
  { value: '24h', label: '24 Saat' },
  { value: '4h', label: '4 Saat' },
  { value: '1h', label: '1 Saat' },
  { value: '15m', label: '15 Dakika' },
];

export const VOLATILITY_FILTERS = [
  { value: 'low', label: 'Düşük' },
  { value: 'medium', label: 'Orta' },
  { value: 'high', label: 'Yüksek' },
];

export const TREND_FILTERS = [
  { value: 'uptrend', label: 'Yükseliş' },
  { value: 'downtrend', label: 'Düşüş' },
  { value: 'both', label: 'Her İkisi' },
];

export const INDICATORS = ['RSI', 'MACD', 'Bollinger', 'EMA', 'Stochastic', 'ADX', 'Volume'];

// Numeric config fields shown in the editor.
export const CONFIG_NUMERIC_FIELDS = [
  { key: 'maxOpenTrades', label: 'Maks. Açık İşlem', min: 1, max: 20, step: 1, unit: '' },
  { key: 'maxLeverage', label: 'Kaldıraç', min: 1, max: 5, step: 1, unit: 'x' },
  { key: 'riskPerTrade', label: 'İşlem Başına Risk', min: 0.1, max: 5, step: 0.1, unit: '%' },
  { key: 'maxDailyLoss', label: 'Günlük Zarar Limiti', min: 1, max: 20, step: 0.5, unit: '%' },
  { key: 'profitTarget', label: 'Günlük Kâr Hedefi', min: 1, max: 50, step: 1, unit: '%' },
  { key: 'takeProfit', label: 'Take Profit', min: 0.5, max: 30, step: 0.5, unit: '%' },
  { key: 'stopLoss', label: 'Stop Loss', min: 0.5, max: 20, step: 0.5, unit: '%' },
  { key: 'trailingStop', label: 'İz Süren Stop', min: 0, max: 10, step: 0.5, unit: '%' },
  { key: 'trailingProfit', label: 'İz Süren Kâr', min: 0, max: 10, step: 0.5, unit: '%' },
  { key: 'breakEven', label: 'Başabaş Noktası', min: 0, max: 10, step: 0.5, unit: '%' },
  { key: 'minConfidence', label: 'Güven Eşiği', min: 60, max: 99, step: 1, unit: '%' },
];

function cfg(o) {
  return {
    coinFilter: 'top50',
    timeFilter: '1h',
    volatilityFilter: 'medium',
    trendFilter: 'both',
    indicators: ['RSI', 'MACD', 'EMA'],
    newsFilter: true,
    aiFilter: true,
    trailingStop: 0,
    trailingProfit: 0,
    breakEven: 0,
    ...o,
  };
}

export const BUILTIN_PROFILES = [
  {
    key: 'beginner', name: 'Başlangıç', builtin: true, riskLevel: 1,
    description: 'Düşük risk, temkinli. Yeni başlayanlar için güvenli ayarlar.',
    config: cfg({ maxOpenTrades: 2, maxLeverage: 1, riskPerTrade: 0.3, maxDailyLoss: 2, profitTarget: 3, takeProfit: 2, stopLoss: 1, minConfidence: 95, coinFilter: 'top50', volatilityFilter: 'low', trendFilter: 'uptrend' }),
  },
  {
    key: 'conservative', name: 'Muhafazakar', builtin: true, riskLevel: 3,
    description: 'Düşük-orta risk. Sermaye korumaya öncelik verir.',
    config: cfg({ maxOpenTrades: 4, maxLeverage: 2, riskPerTrade: 0.5, maxDailyLoss: 3, profitTarget: 5, takeProfit: 3, stopLoss: 1.5, minConfidence: 92, coinFilter: 'top50', volatilityFilter: 'low' }),
  },
  {
    key: 'balanced', name: 'Dengeli', builtin: true, riskLevel: 5,
    description: 'Orta risk. Risk ve getiri dengesi.',
    config: cfg({ maxOpenTrades: 8, maxLeverage: 3, riskPerTrade: 1, maxDailyLoss: 5, profitTarget: 8, takeProfit: 5, stopLoss: 2.5, minConfidence: 90, coinFilter: 'top100' }),
  },
  {
    key: 'professional', name: 'Profesyonel', builtin: true, riskLevel: 7,
    description: 'Orta-yüksek risk. Aktif işlem yönetimi.',
    config: cfg({ maxOpenTrades: 12, maxLeverage: 4, riskPerTrade: 1.5, maxDailyLoss: 7, profitTarget: 12, takeProfit: 7, stopLoss: 3, trailingStop: 2, breakEven: 2, minConfidence: 88, coinFilter: 'top100', volatilityFilter: 'high' }),
  },
  {
    key: 'master', name: 'Usta', builtin: true, riskLevel: 8,
    description: 'Yüksek risk, agresif. Deneyimli kullanıcılar için.',
    config: cfg({ maxOpenTrades: 15, maxLeverage: 5, riskPerTrade: 2, maxDailyLoss: 8, profitTarget: 15, takeProfit: 10, stopLoss: 4, trailingStop: 3, trailingProfit: 2, breakEven: 3, minConfidence: 87, coinFilter: 'all', volatilityFilter: 'high' }),
  },
  {
    key: 'gold', name: 'Gold', builtin: true, riskLevel: 9,
    description: 'Çok yüksek risk. Maksimum getiri hedefi.',
    config: cfg({ maxOpenTrades: 18, maxLeverage: 5, riskPerTrade: 3, maxDailyLoss: 10, profitTarget: 20, takeProfit: 12, stopLoss: 5, trailingStop: 4, trailingProfit: 3, breakEven: 4, minConfidence: 86, coinFilter: 'all', volatilityFilter: 'high', trendFilter: 'both' }),
  },
  {
    key: 'elite', name: 'Elite', builtin: true, riskLevel: 10,
    description: 'Kurumsal seviye. Tüm kaynaklar tam kapasite kullanılır.',
    config: cfg({ maxOpenTrades: 20, maxLeverage: 5, riskPerTrade: 4, maxDailyLoss: 12, profitTarget: 25, takeProfit: 15, stopLoss: 6, trailingStop: 5, trailingProfit: 4, breakEven: 5, minConfidence: 85, coinFilter: 'all', volatilityFilter: 'high', indicators: [...INDICATORS] }),
  },
];

// Keys applied to the live bot/risk settings when a profile is activated.
export const SETTINGS_MAP = ['maxOpenTrades', 'maxLeverage', 'riskPerTrade', 'maxDailyLoss', 'profitTarget', 'minConfidence'];

export function emptyCustomConfig() {
  return cfg({ maxOpenTrades: 5, maxLeverage: 2, riskPerTrade: 1, maxDailyLoss: 5, profitTarget: 8, takeProfit: 5, stopLoss: 2.5, minConfidence: 90 });
}
