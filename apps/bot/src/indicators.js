// Hafif teknik gösterge kütüphanesi (harici bağımlılık yok).
// Girdi: kapanış fiyatları dizisi (eski -> yeni).

export function sma(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let prev = sma(values.slice(0, period), period);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
  }
  return prev;
}

export function rsi(values, period = 14) {
  if (values.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function macd(values, fast = 12, slow = 26, signal = 9) {
  if (values.length < slow + signal) return null;
  const macdLine = [];
  for (let i = slow; i <= values.length; i++) {
    const sub = values.slice(0, i);
    const f = ema(sub, fast);
    const s = ema(sub, slow);
    if (f != null && s != null) macdLine.push(f - s);
  }
  const signalLine = ema(macdLine, signal);
  const current = macdLine[macdLine.length - 1];
  return { macd: current, signal: signalLine, histogram: signalLine != null ? current - signalLine : null };
}

export default { sma, ema, rsi, macd };
