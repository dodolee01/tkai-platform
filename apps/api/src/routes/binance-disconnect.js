import pocketbaseClient from '../utils/pocketbaseClient.js';

// POST /binance/disconnect — mark stored credentials as disconnected.
export default async (req, res) => {
  try {
    const cfg = await pocketbaseClient.collection('bot_config').getFirstListItem('key="default"');
    await pocketbaseClient.collection('bot_config').update(cfg.id, { connected: false });
  } catch {
    // nothing stored yet — treat as already disconnected
  }
  res.json({ connected: false });
};
