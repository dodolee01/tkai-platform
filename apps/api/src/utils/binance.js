import crypto from 'crypto';

export const BINANCE_HOSTS = {
  live: 'https://api.binance.com',
  testnet: 'https://testnet.binance.vision',
};

function sign(query, secret) {
  return crypto.createHmac('sha256', secret).update(query).digest('hex');
}

// Perform a SIGNED Binance Spot REST request.
// Throws on any non-2xx so errorMiddleware handles it.
export async function signedRequest({ host, apiKey, secret, method, path, params = {} }) {
  const timestamp = Date.now();
  const query = new URLSearchParams({ ...params, timestamp, recvWindow: 5000 }).toString();
  const signature = sign(query, secret);
  const url = `${host}${path}?${query}&signature=${signature}`;

  const res = await fetch(url, {
    method,
    headers: { 'X-MBX-APIKEY': apiKey },
  });

  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }

  if (!res.ok) {
    const detail = body && body.msg ? body.msg : res.statusText;
    const err = new Error(`binance ${path} failed: ${res.status} ${res.statusText} — ${detail}`);
    // Preserve Binance's numeric error code so callers can surface precise,
    // user-friendly guidance (e.g. -2015 = bad key/IP/permissions).
    if (body && body.code != null) err.binanceCode = body.code;
    err.httpStatus = res.status;
    throw err;
  }
  return body;
}

// Map a Binance error (from signedRequest) to a user-friendly Turkish message
// plus step-by-step guidance and the HTTP status to respond with. Used by order
// / close handlers so a 401 on trade execution tells the user exactly what to
// fix, instead of the generic "Something went wrong!" from errorMiddleware.
export function binanceGuidance(err, market = 'futures') {
  const code = err && err.binanceCode;
  const http = (err && err.httpStatus) || 500;
  const marketPerm = market === 'futures'
    ? '"Enable Futures" (Vadeli İşlem) yetkisini açın.'
    : '"Enable Spot & Margin Trading" (İşlem) yetkisini açın.';

  if (code === -2015 || code === -2014 || http === 401) {
    return {
      status: 401,
      message: 'API anahtarınızın işlem (order) açma izni yok, IP kısıtlaması hatalı ya da anahtar geçersiz. Bakiye okunabilse bile işlem izni ayrıdır.',
      steps: [
        'Binance → API Yönetimi bölümünde bu API Key için ' + marketPerm,
        'API Key\'e IP kısıtlaması eklediyseniz sunucu IP\'sini beyaz listeye ekleyin veya kısıtlamayı kaldırın.',
        'İzinleri değiştirdiyseniz anahtarı silip yeniden oluşturmanız gerekebilir; sonra tekrar bağlanın.',
        market === 'futures' ? 'Futures cüzdanınızda işlem için yeterli USDT teminatı olduğundan emin olun.' : 'Spot cüzdanınızda yeterli bakiye olduğundan emin olun.',
      ],
    };
  }
  if (code === -1022 || code === -1021) {
    return {
      status: 401,
      message: code === -1022 ? 'İmza doğrulanamadı — Secret Key hatalı olabilir.' : 'Zaman damgası hatası — sistem saati Binance ile uyuşmuyor.',
      steps: ['Bağlantıyı kesip Secret Key\'i baştan girerek yeniden bağlanın.'],
    };
  }
  if (code === -2019 || code === -4131 || code === -1013) {
    return {
      status: 400,
      message: 'Yetersiz teminat veya geçersiz işlem büyüklüğü — işlem açılamadı.',
      steps: [
        market === 'futures' ? 'Futures cüzdanınıza USDT teminatı ekleyin.' : 'Spot cüzdanınıza USDT ekleyin.',
        'İşlem miktarı borsanın minimum notional/lot limitlerini karşılamıyor olabilir.',
      ],
    };
  }
  return {
    status: 400,
    message: 'Binance emri reddedildi: ' + String((err && err.message) || err),
    steps: ['API anahtarı izinlerini ve cüzdan bakiyenizi kontrol edip tekrar deneyin.'],
  };
}

// Round a quantity to the symbol step size using exchange filters.
export function roundStep(qty, step) {
  if (!step || step <= 0) return qty;
  const precision = Math.max(0, Math.round(-Math.log10(step)));
  return Number((Math.floor(qty / step) * step).toFixed(precision));
}
