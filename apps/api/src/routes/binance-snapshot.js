// Fetches an initial snapshot (recent candles + 24h ticker) from Binance REST
// so the dashboard starts aligned with the real market before the browser
// WebSocket takes over live streaming.
const BINANCE_REST = 'https://api.binance.com/api/v3';

export default async (req, res) => {
	const symbolsParam = (req.query.symbols || '').toString().trim();
	const interval = (req.query.interval || '1m').toString();
	const limit = Math.min(parseInt(req.query.limit, 10) || 60, 500);

	if (!symbolsParam) {
		return res.status(422).json({ error: 'symbols query param is required (comma separated)' });
	}

	const symbols = symbolsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
	if (!symbols.length) {
		return res.status(422).json({ error: 'no valid symbols provided' });
	}

	const result = {};

	for (const symbol of symbols) {
		const klineUrl = `${BINANCE_REST}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
		const tickerUrl = `${BINANCE_REST}/ticker/24hr?symbol=${symbol}`;

		const [klineRes, tickerRes] = await Promise.all([
			fetch(klineUrl),
			fetch(tickerUrl),
		]);

		if (!klineRes.ok) {
			throw new Error(`binance klines failed for ${symbol}: ${klineRes.status} ${klineRes.statusText}`);
		}
		if (!tickerRes.ok) {
			throw new Error(`binance ticker failed for ${symbol}: ${tickerRes.status} ${tickerRes.statusText}`);
		}

		const klines = await klineRes.json();
		const ticker = await tickerRes.json();

		const candles = klines.map((k) => ({
			t: k[0],
			time: new Date(k[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
			open: parseFloat(k[1]),
			high: parseFloat(k[2]),
			low: parseFloat(k[3]),
			close: parseFloat(k[4]),
			price: parseFloat(k[4]),
			volume: parseFloat(k[5]),
		}));

		result[symbol] = {
			candles,
			price: parseFloat(ticker.lastPrice),
			change: parseFloat(ticker.priceChangePercent),
			bid: parseFloat(ticker.bidPrice),
			ask: parseFloat(ticker.askPrice),
			high: parseFloat(ticker.highPrice),
			low: parseFloat(ticker.lowPrice),
			volume: parseFloat(ticker.volume),
		};
	}

	res.json({ interval, symbols, data: result });
};
