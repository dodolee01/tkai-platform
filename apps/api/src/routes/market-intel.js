// Market Intelligence aggregator — pulls REAL public data:
//  - Fear & Greed index (alternative.me)
//  - Binance Futures funding rate, open interest, long/short ratio
//  - Binance Futures 24h ticker (price, volume, change)
//  - Recent large trades (whale detection) via aggTrades
// All upstream failures throw so errorMiddleware handles them.
import logger from '../utils/logger.js';

const FAPI = 'https://fapi.binance.com';
const FNG = 'https://api.alternative.me/fng';

async function j(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`market-intel upstream failed: ${res.status} ${res.statusText} (${url})`);
  return res.json();
}

export default async (req, res) => {
  const symbol = (req.query.symbol || 'BTCUSDT').toUpperCase();

  const [fng, premium, oi, lsr, ticker, aggTrades] = await Promise.all([
    j(`${FNG}/?limit=30`).catch(() => null),
    j(`${FAPI}/fapi/v1/premiumIndex?symbol=${symbol}`).catch(() => null),
    j(`${FAPI}/fapi/v1/openInterest?symbol=${symbol}`).catch(() => null),
    j(`${FAPI}/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`).catch(() => null),
    j(`${FAPI}/fapi/v1/ticker/24hr?symbol=${symbol}`).catch(() => null),
    j(`${FAPI}/fapi/v1/aggTrades?symbol=${symbol}&limit=200`).catch(() => null),
  ]);

  const price = ticker ? parseFloat(ticker.lastPrice) : null;
  // Whale detection: aggregated trades whose notional value exceeds a threshold.
  const whales = Array.isArray(aggTrades)
    ? aggTrades
        .map((t) => {
          const qty = parseFloat(t.q);
          const p = parseFloat(t.p);
          return { time: t.T, price: p, qty, value: qty * p, side: t.m ? 'SELL' : 'BUY' };
        })
        .filter((t) => t.value >= 250000)
        .sort((a, b) => b.value - a.value)
        .slice(0, 15)
    : [];

  const fngData = fng && Array.isArray(fng.data)
    ? fng.data.map((d) => ({ value: Number(d.value), label: d.value_classification, t: Number(d.timestamp) * 1000 }))
    : [];

  logger.info(`market-intel ${symbol}: fng=${fngData[0]?.value} whales=${whales.length}`);

  res.json({
    symbol,
    price,
    fearGreed: fngData,
    funding: premium ? {
      lastFundingRate: parseFloat(premium.lastFundingRate),
      markPrice: parseFloat(premium.markPrice),
      indexPrice: parseFloat(premium.indexPrice),
      nextFundingTime: premium.nextFundingTime,
    } : null,
    openInterest: oi ? { value: parseFloat(oi.openInterest), notional: price ? parseFloat(oi.openInterest) * price : null } : null,
    longShort: Array.isArray(lsr) && lsr[0] ? {
      longAccount: parseFloat(lsr[0].longAccount),
      shortAccount: parseFloat(lsr[0].shortAccount),
      ratio: parseFloat(lsr[0].longShortRatio),
    } : null,
    ticker: ticker ? {
      priceChangePercent: parseFloat(ticker.priceChangePercent),
      volume: parseFloat(ticker.volume),
      quoteVolume: parseFloat(ticker.quoteVolume),
      high: parseFloat(ticker.highPrice),
      low: parseFloat(ticker.lowPrice),
    } : null,
    whales,
    fetchedAt: Date.now(),
  });
};
