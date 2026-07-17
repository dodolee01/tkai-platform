import pocketbaseClient from '../utils/pocketbaseClient.js';
import { encryptSecret } from '../utils/crypto.js';
import { BINANCE_HOSTS, signedRequest } from '../utils/binance.js';
import logger from '../utils/logger.js';

const CONFIG_KEY = 'default';

async function upsertConfig(data) {
  try {
    const existing = await pocketbaseClient.collection('bot_config').getFirstListItem(`key="${CONFIG_KEY}"`);
    return await pocketbaseClient.collection('bot_config').update(existing.id, data);
  } catch {
    return await pocketbaseClient.collection('bot_config').create({ key: CONFIG_KEY, ...data });
  }
}

// POST /binance/connect — verify credentials against Binance, then store
// AES-256 encrypted keys server-side. The browser never receives the secret.
export default async (req, res) => {
  const { mode, apiKey, secret } = req.body || {};

  if (!apiKey || !secret) {
    return res.status(422).json({ error: 'apiKey and secret are required' });
  }
  const useMode = mode === 'live' ? 'live' : 'testnet';
  const host = BINANCE_HOSTS[useMode];

  // Verify by calling the signed account endpoint. A failure here almost
  // always means the user pasted invalid credentials (or keys for the wrong
  // network / IP) — that is user input, so respond with a clear 401 message
  // instead of a generic 500.
  let account;
  try {
    account = await signedRequest({
      host, apiKey, secret, method: 'GET', path: '/api/v3/account',
    });
  } catch (err) {
    const detail = String(err.message || err);
    logger.warn(`Binance ${useMode} connection rejected: ${detail}`);

    const networkHint = useMode === 'testnet'
      ? 'Şu an "Testnet" modu seçili. Gerçek Binance hesabınızın anahtarlarını kullanıyorsanız ayarlardan "Gerçek Hesap" modunu seçin.'
      : 'Şu an "Gerçek Hesap" modu seçili. Testnet anahtarları bu modda çalışmaz — testnet.binance.vision anahtarları kullanıyorsanız "Testnet" modunu seçin.';

    const code = err.binanceCode;
    let message;
    let steps;

    if (code === -2014 || code === -2015) {
      // Bad key format / invalid key, IP or permissions — the most common case.
      message = 'API anahtarları geçersiz veya yetkileri eksik.';
      steps = [
        'Binance → Hesap → API Yönetimi bölümünden yeni bir API Key oluşturun.',
        '"Enable Reading" (Okuma) ve "Enable Spot & Margin Trading" (İşlem) yetkilerini açın.',
        'IP kısıtlaması eklediyseniz sunucu IP\'sini beyaz listeye ekleyin veya kısıtlamayı kaldırın.',
        'API Key ve Secret Key\'i eksiksiz, boşluksuz kopyalayıp tekrar deneyin.',
      ];
    } else if (code === -1022 || code === -1021) {
      message = code === -1022
        ? 'İmza doğrulanamadı — Secret Key hatalı girilmiş olabilir.'
        : 'Zaman damgası hatası — sistem saati Binance ile uyuşmuyor.';
      steps = [
        'Secret Key\'i baştan, boşluksuz kopyalayın.',
        'API Key ile Secret Key\'in aynı anahtar çiftine ait olduğundan emin olun.',
      ];
    } else {
      message = 'Binance bağlantısı doğrulanamadı.';
      steps = [
        'API Key ve Secret Key değerlerini kontrol edin.',
        'API anahtarında okuma ve işlem yetkilerinin açık olduğundan emin olun.',
        'IP kısıtlamalarını kontrol edin.',
      ];
    }

    return res.status(401).json({
      error: `${message} ${networkHint}`,
      steps,
      mode: useMode,
    });
  }

  const masked = apiKey.slice(0, 6) + '••••••••';
  await upsertConfig({
    apiKeyMasked: masked,
    apiKeyEnc: encryptSecret(apiKey),
    secretEnc: encryptSecret(secret),
    mode: useMode,
    connected: true,
  });

  logger.info(`Binance ${useMode} connection verified & stored`);

  const usdt = (account.balances || []).find((b) => b.asset === 'USDT');
  res.json({
    connected: true,
    mode: useMode,
    apiKeyMasked: masked,
    canTrade: account.canTrade === true,
    usdtBalance: usdt ? parseFloat(usdt.free) : null,
  });
};
