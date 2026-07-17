import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Check, CheckCheck, Trash2, X, Radio, Info, TrendingUp, ShoppingCart,
  Wallet, DollarSign, Activity, ShieldAlert, Gauge, Server, Settings2, Send,
} from 'lucide-react';
import {
  NOTIFICATION_TYPES, loadPrefs, savePrefs, notify,
} from '@/lib/notifications';

const TYPE_ICON = {
  trade: TrendingUp,
  order: ShoppingCart,
  portfolio: Wallet,
  price: DollarSign,
  indicator: Activity,
  risk: ShieldAlert,
  performance: Gauge,
  system: Server,
};

const SEV_CLS = {
  info: 'text-sky-400',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  critical: 'text-destructive',
};

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}dk`;
  if (s < 86400) return `${Math.floor(s / 3600)}sa`;
  return `${Math.floor(s / 86400)}g`;
}

function NotifRow({ n, onRead, onRemove }) {
  const Icon = TYPE_ICON[n.type] || Info;
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 12 }}
      className={`flex items-start gap-3 rounded-xl border p-3 transition ${n.isRead ? 'border-border bg-black/15' : 'border-primary/30 bg-primary/[0.06]'}`}>
      <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.05] ${SEV_CLS[n.severity] || SEV_CLS.info}`}>
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{n.title}</p>
        {n.message && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>}
        <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">{n.type} · {timeAgo(n.created)} önce</p>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        {!n.isRead && (
          <button onClick={() => onRead(n.id)} title="Okundu"
            className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:text-primary"><Check size={12} /></button>
        )}
        <button onClick={() => onRemove(n.id)} title="Sil"
          className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:text-destructive"><Trash2 size={12} /></button>
      </div>
    </motion.div>
  );
}

/** Compact bell dropdown for the top header. */
export function NotificationBell({ center }) {
  const { notifications, unread, markRead, markAllRead, status } = center;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-black/30 text-muted-foreground transition hover:text-foreground">
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="glass absolute right-0 z-50 mt-2 w-[340px] max-w-[92vw] rounded-2xl p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold">Bildirimler</span>
                <span className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] ${status === 'connected' ? 'border-emerald-400/30 text-emerald-400' : 'border-border text-muted-foreground'}`}>
                  <Radio size={9} /> {status === 'connected' ? 'Canlı' : 'Bağlanıyor'}
                </span>
              </div>
              {unread > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                  <CheckCheck size={12} /> Tümünü oku
                </button>
              )}
            </div>
            <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">Henüz bildirim yok</div>
                ) : (
                  notifications.slice(0, 20).map((n) => (
                    <NotifRow key={n.id} n={n} onRead={markRead} onRemove={center.remove} />
                  ))
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Full notification-center view with filters, preferences and history. */
export default function NotificationCenter({ center }) {
  const { notifications, unread, status, markRead, markAllRead, remove, clearAll } = center;
  const [filter, setFilter] = useState('all');
  const [prefs, setPrefs] = useState(loadPrefs());

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter((n) => !n.isRead);
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const togglePref = (id) => {
    const next = { ...prefs, [id]: !prefs[id] };
    setPrefs(next);
    savePrefs(next);
  };

  const sendTest = () =>
    notify({
      type: 'system',
      title: 'Test bildirimi',
      message: 'Bildirim merkezi ve gerçek zamanlı akış çalışıyor.',
      severity: 'success',
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">Bildirim Merkezi</h2>
          <p className="text-xs text-muted-foreground">Gerçek zamanlı bildirimler · {unread} okunmamış</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${status === 'connected' ? 'border-emerald-400/30 text-emerald-400' : 'border-border text-muted-foreground'}`}>
            <Radio size={11} className={status === 'connected' ? 'pulse-dot' : ''} /> {status === 'connected' ? 'Canlı bağlantı' : 'Bağlanıyor…'}
          </span>
          <button onClick={sendTest} className="flex items-center gap-1.5 rounded-xl border border-border bg-black/30 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/40">
            <Send size={13} /> Test
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        {/* feed */}
        <div className="glass rounded-2xl p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {[['all', 'Tümü'], ['unread', 'Okunmamış'], ...NOTIFICATION_TYPES.map((t) => [t.id, t.label])].map(([id, label]) => (
                <button key={id} onClick={() => setFilter(id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition ${filter === id ? 'border-primary/50 bg-primary/12 text-primary' : 'border-border bg-black/30 text-muted-foreground hover:text-foreground'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3 flex items-center gap-2">
            <button onClick={markAllRead} disabled={!unread}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition enabled:hover:text-primary disabled:opacity-40">
              <CheckCheck size={13} /> Tümünü oku
            </button>
            <button onClick={clearAll} disabled={!notifications.length}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition enabled:hover:text-destructive disabled:opacity-40">
              <X size={13} /> Temizle
            </button>
          </div>
          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Bu filtrede bildirim yok.</div>
              ) : (
                filtered.map((n) => <NotifRow key={n.id} n={n} onRead={markRead} onRemove={remove} />)
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* preferences */}
        <div className="glass rounded-2xl p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="rounded-xl bg-primary/12 p-2 text-primary"><Settings2 size={18} /></div>
            <div>
              <h3 className="font-display font-bold">Bildirim Tercihleri</h3>
              <p className="text-xs text-muted-foreground">Hangi olaylarda bildirim alacağını seç</p>
            </div>
          </div>
          <div className="space-y-2">
            {NOTIFICATION_TYPES.map((t) => {
              const Icon = TYPE_ICON[t.id] || Info;
              const on = prefs[t.id] !== false;
              return (
                <div key={t.id} className="flex items-center justify-between rounded-xl border border-border bg-black/20 p-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.05] text-primary/80"><Icon size={15} /></span>
                    <div>
                      <p className="text-sm font-semibold">{t.label}</p>
                      <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                    </div>
                  </div>
                  <button onClick={() => togglePref(t.id)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-primary' : 'bg-black/40 border border-border'}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
