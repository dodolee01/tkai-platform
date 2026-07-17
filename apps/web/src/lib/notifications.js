import { toast } from 'sonner';
import pb from '@/lib/pocketbaseClient';

const PREF_KEY = 'tkai_notification_prefs_v1';

export const NOTIFICATION_TYPES = [
  { id: 'trade', label: 'İşlem', desc: 'Giriş, çıkış ve kapanış olayları' },
  { id: 'order', label: 'Emir', desc: 'Oluşturuldu, gerçekleşti, iptal edildi' },
  { id: 'portfolio', label: 'Portföy', desc: 'Bakiye ve K/Z değişimleri' },
  { id: 'price', label: 'Fiyat', desc: 'Fiyat hedefi bildirimleri' },
  { id: 'indicator', label: 'İndikatör', desc: 'Sinyal üretildiğinde' },
  { id: 'risk', label: 'Risk', desc: 'Drawdown ve kaldıraç uyarıları' },
  { id: 'performance', label: 'Performans', desc: 'Günlük/haftalık/aylık özet' },
  { id: 'system', label: 'Sistem', desc: 'Bot durumu ve hatalar' },
];

export function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    const prefs = {};
    for (const t of NOTIFICATION_TYPES) prefs[t.id] = raw[t.id] !== false;
    return prefs;
  } catch {
    const prefs = {};
    for (const t of NOTIFICATION_TYPES) prefs[t.id] = true;
    return prefs;
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

const toastForSeverity = {
  success: (t, m) => toast.success(t, { description: m }),
  warning: (t, m) => toast.warning(t, { description: m }),
  critical: (t, m) => toast.error(t, { description: m }),
  info: (t, m) => toast(t, { description: m }),
};

/**
 * Persist a notification to PocketBase and surface a toast (if enabled).
 * Fails silently — notifications must never crash the trading flow.
 */
export async function notify({ type = 'system', title, message = '', severity = 'info', channel = 'in_app', meta = {}, showToast = true } = {}) {
  if (!title) return null;
  const prefs = loadPrefs();
  if (prefs[type] === false) return null;

  if (showToast) (toastForSeverity[severity] || toastForSeverity.info)(title, message);

  try {
    return await pb.collection('notifications').create(
      { type, title, message, severity, channel, isRead: false, meta },
      { requestKey: `notify-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
    );
  } catch {
    return null;
  }
}
