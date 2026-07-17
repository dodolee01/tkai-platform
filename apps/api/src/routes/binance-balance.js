import pocketbaseClient from '../utils/pocketbaseClient.js';
import { decryptSecret } from '../utils/crypto.js';
import { BINANCE_HOSTS, signedRequest } from '../utils/binance.js';

const CONFIG_KEY = 'default';

// GET /binance/balance — return the live USDT balance for the currently
// connected account. Credentials are decrypted server-side only.
export default async (req, res) => {
  let cfg;
  try {
    cfg = await pocketbaseClient.collection('bot_config').getFirstListItem(`key="${CONFIG_KEY}"`);
  } catch {
    // No stored config yet — treat as "not connected" (client-side input state), not an upstream failure.
    return res.status(422).json({ error: 'Binance is not connected' });
  }

  if (!cfg.connected || !cfg.apiKeyEnc || !cfg.secretEnc) {
    return res.status(422).json({ error: 'Binance is not connected' });
  }

  const mode = cfg.mode === 'live' ? 'live' : 'testnet';
  const apiKey = decryptSecret(cfg.apiKeyEnc);
  const secret = decryptSecret(cfg.secretEnc);
  const host = BINANCE_HOSTS[mode];

  const account = await signedRequest({ host, apiKey, secret, method: 'GET', path: '/api/v3/account' });
  const usdt = (account.balances || []).find((b) => b.asset === 'USDT');

  res.json({
    mode,
    usdtBalance: usdt ? parseFloat(usdt.free) : 0,
    usdtLocked: usdt ? parseFloat(usdt.locked) : 0,
    canTrade: account.canTrade === true,
  });
};
