// Standard technical indicators used by both live signal generation and the
// backtesting engine. All functions take arrays of closing prices (or candle
// objects) and return arrays aligned to the input (NaN where undefined).

export function sma(values, period) {
  const out = new Array(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values, period) {
  const out = new Array(values.length).fill(NaN);
  const k = 2 / (period + 1);
  let prev;
  for (let i = 0; i < values.length; i++) {
    if (i === 0) { prev = values[0]; out[0] = prev; continue; }
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function rsi(values, period = 14) {
  const out = new Array(values.length).fill(NaN);
  let gain = 0, loss = 0;
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const g = Math.max(0, diff);
    const l = Math.max(0, -diff);
    if (i <= period) {
      gain += g; loss += l;
      if (i === period) {
        gain /= period; loss /= period;
        out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
      }
    } else {
      gain = (gain * (period - 1) + g) / period;
      loss = (loss * (period - 1) + l) / period;
      out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    }
  }
  return out;
}

export function macd(values, fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const line = values.map((_, i) => emaFast[i] - emaSlow[i]);
  const sig = ema(line, signal);
  const hist = line.map((v, i) => v - sig[i]);
  return { line, signal: sig, hist };
}

export function bollinger(values, period = 20, mult = 2) {
  const mid = sma(values, period);
  const upper = new Array(values.length).fill(NaN);
  const lower = new Array(values.length).fill(NaN);
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += (values[j] - mid[i]) ** 2;
    const sd = Math.sqrt(sum / period);
    upper[i] = mid[i] + mult * sd;
    lower[i] = mid[i] - mult * sd;
  }
  return { mid, upper, lower };
}

export function atr(candles, period = 14) {
  const out = new Array(candles.length).fill(NaN);
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const p = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - p), Math.abs(c.low - p));
  });
  const e = ema(tr, period);
  for (let i = 0; i < candles.length; i++) out[i] = e[i];
  return out;
}

// ---- Extended indicators (Phase 5 Market Intelligence) ----

export function stochastic(candles, kPeriod = 14, dPeriod = 3) {
  const k = new Array(candles.length).fill(NaN);
  for (let i = kPeriod - 1; i < candles.length; i++) {
    let hi = -Infinity, lo = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    const c = candles[i].close;
    k[i] = hi === lo ? 50 : ((c - lo) / (hi - lo)) * 100;
  }
  const d = sma(k.map((v) => (isNaN(v) ? 0 : v)), dPeriod);
  return { k, d };
}

export function cci(candles, period = 20) {
  const out = new Array(candles.length).fill(NaN);
  const tp = candles.map((c) => (c.high + c.low + c.close) / 3);
  const ma = sma(tp, period);
  for (let i = period - 1; i < candles.length; i++) {
    let dev = 0;
    for (let j = i - period + 1; j <= i; j++) dev += Math.abs(tp[j] - ma[i]);
    const md = dev / period;
    out[i] = md === 0 ? 0 : (tp[i] - ma[i]) / (0.015 * md);
  }
  return out;
}

export function adx(candles, period = 14) {
  const len = candles.length;
  const out = new Array(len).fill(NaN);
  if (len < period + 1) return out;
  const plusDM = new Array(len).fill(0);
  const minusDM = new Array(len).fill(0);
  const tr = new Array(len).fill(0);
  for (let i = 1; i < len; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDM[i] = up > down && up > 0 ? up : 0;
    minusDM[i] = down > up && down > 0 ? down : 0;
    const p = candles[i - 1].close;
    tr[i] = Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - p), Math.abs(candles[i].low - p));
  }
  const trE = ema(tr, period), pE = ema(plusDM, period), mE = ema(minusDM, period);
  const dx = new Array(len).fill(NaN);
  for (let i = 1; i < len; i++) {
    const pdi = trE[i] ? (pE[i] / trE[i]) * 100 : 0;
    const mdi = trE[i] ? (mE[i] / trE[i]) * 100 : 0;
    const sum = pdi + mdi;
    dx[i] = sum ? (Math.abs(pdi - mdi) / sum) * 100 : 0;
  }
  const dxE = ema(dx.map((v) => (isNaN(v) ? 0 : v)), period);
  for (let i = 0; i < len; i++) out[i] = dxE[i];
  return out;
}

export function ichimoku(candles) {
  const hl = (p, i) => {
    let hi = -Infinity, lo = Infinity;
    for (let j = Math.max(0, i - p + 1); j <= i; j++) { hi = Math.max(hi, candles[j].high); lo = Math.min(lo, candles[j].low); }
    return (hi + lo) / 2;
  };
  const i = candles.length - 1;
  if (i < 0) return null;
  const tenkan = hl(9, i);
  const kijun = hl(26, i);
  return {
    tenkan, kijun,
    senkouA: (tenkan + kijun) / 2,
    senkouB: hl(52, i),
    price: candles[i].close,
  };
}

// Build a full indicator signal set from candles for the intelligence heatmap.
// Returns [{ name, value, signal: 'bull'|'bear'|'neutral' }].
export function indicatorSet(candles) {
  const closes = candles.map((c) => c.close);
  const last = (a) => { for (let i = a.length - 1; i >= 0; i--) if (!isNaN(a[i])) return a[i]; return NaN; };
  const price = closes[closes.length - 1];
  const rsiV = last(rsi(closes));
  const macdO = macd(closes); const macdHist = last(macdO.hist);
  const bb = bollinger(closes); const bbU = last(bb.upper), bbL = last(bb.lower);
  const emaV = last(ema(closes, 20)); const smaV = last(sma(closes, 50));
  const atrV = last(atr(candles));
  const st = stochastic(candles); const stK = last(st.k);
  const cciV = last(cci(candles));
  const adxV = last(adx(candles));
  const ich = ichimoku(candles);
  const sig = (b, be) => (b ? 'bull' : be ? 'bear' : 'neutral');
  return [
    { name: 'RSI', value: rsiV, signal: sig(rsiV < 35, rsiV > 70) },
    { name: 'MACD', value: macdHist, signal: sig(macdHist > 0, macdHist < 0) },
    { name: 'Bollinger', value: price, signal: sig(price < bbL, price > bbU) },
    { name: 'EMA(20)', value: emaV, signal: sig(price > emaV, price < emaV) },
    { name: 'SMA(50)', value: smaV, signal: sig(price > smaV, price < smaV) },
    { name: 'ATR', value: atrV, signal: 'neutral' },
    { name: 'Stochastic', value: stK, signal: sig(stK < 20, stK > 80) },
    { name: 'CCI', value: cciV, signal: sig(cciV < -100, cciV > 100) },
    { name: 'ADX', value: adxV, signal: sig(adxV > 25, false) },
    { name: 'Ichimoku', value: ich ? ich.tenkan : NaN, signal: ich ? sig(ich.price > ich.senkouA && ich.price > ich.senkouB, ich.price < ich.senkouA && ich.price < ich.senkouB) : 'neutral' },
  ];
}
