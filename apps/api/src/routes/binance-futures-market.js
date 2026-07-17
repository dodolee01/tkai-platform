// Returns the full active Binance USDT-M Futures perpetual universe
// (symbol + display name) merged with the latest 24h ticker snapshot
// (price, change) in a single response, so the frontend Coin Arama panel
// can list every tradable futures pair instead of a hardcoded shortlist.
const FAPI_BASE = 'https://fapi.binance.com/fapi/v1';

let cache = { at: 0, data: null };
const CACHE_MS = 15000;

export default async (req, res) => {
	const now = Date.now();
	if (cache.data && now - cache.at < CACHE_MS) {
		return res.json(cache.data);
	}

	const [infoRes, tickerRes] = await Promise.all([
		fetch(`${FAPI_BASE}/exchangeInfo`),
		fetch(`${FAPI_BASE}/ticker/24hr`),
	]);

	if (!infoRes.ok) {
		throw new Error(`binance futures exchangeInfo failed: ${infoRes.status} ${infoRes.statusText}`);
	}
	if (!tickerRes.ok) {
		throw new Error(`binance futures ticker failed: ${tickerRes.status} ${tickerRes.statusText}`);
	}

	const info = await infoRes.json();
	const tickers = await tickerRes.json();

	const tickerMap = new Map(tickers.map((t) => [t.symbol, t]));

	const symbols = info.symbols
		.filter((s) => s.status === 'TRADING' && s.quoteAsset === 'USDT' && s.contractType === 'PERPETUAL')
		.map((s) => {
			const t = tickerMap.get(s.symbol);
			return {
				symbol: s.symbol,
				name: s.baseAsset,
				price: t ? parseFloat(t.lastPrice) : null,
				change: t ? parseFloat(t.priceChangePercent) : null,
				volume: t ? parseFloat(t.quoteVolume) : null,
			};
		})
		.filter((s) => s.price != null);

	const payload = { count: symbols.length, symbols };
	cache = { at: now, data: payload };
	res.json(payload);
};
