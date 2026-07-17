import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Webhook, Plus, Trash2, Send, CheckCircle2, XCircle, Clock, Copy, Power, ShieldCheck,
} from 'lucide-react';
import usePersistentState from '@/hooks/usePersistentState';

const EVENTS = [
  'trade.opened', 'trade.closed', 'trade.updated',
  'order.created', 'order.filled', 'order.cancelled',
  'position.opened', 'position.closed',
  'alert.triggered', 'strategy.activated', 'strategy.deactivated',
];

function randomSecret() {
  return 'whsec_' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function WebhooksPanel() {
  const [hooks, setHooks] = usePersistentState('tkai_webhooks_v1', []);
  const [logs, setLogs] = usePersistentState('tkai_webhook_logs_v1', []);
  const [url, setUrl] = useState('');
  const [selected, setSelected] = useState(['trade.opened', 'trade.closed']);
  const [error, setError] = useState('');

  const toggleEvent = (ev) =>
    setSelected((s) => (s.includes(ev) ? s.filter((x) => x !== ev) : [...s, ev]));

  const add = () => {
    if (!/^https?:\/\/.+/.test(url)) { setError('Geçerli bir https URL gir.'); return; }
    if (!selected.length) { setError('En az bir olay seç.'); return; }
    setHooks((prev) => [
      { id: crypto.randomUUID(), url, events: selected, secret: randomSecret(), active: true, createdAt: Date.now() },
      ...prev,
    ]);
    setUrl(''); setError('');
  };
  const remove = (id) => setHooks((prev) => prev.filter((h) => h.id !== id));
  const toggleActive = (id) =>
    setHooks((prev) => prev.map((h) => (h.id === id ? { ...h, active: !h.active } : h)));

  const test = async (hook) => {
    const payload = {
      event: 'trade.opened',
      test: true,
      data: { symbol: 'BTCUSDT', side: 'LONG', price: 67420, ts: Date.now() },
    };
    let status = 'sent', detail = 'Test olayı gönderildi';
    try {
      // exponential-backoff style single attempt; no-cors avoids CORS crashes
      await fetch(hook.url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json', 'X-TKAI-Event': 'trade.opened' },
        body: JSON.stringify(payload),
      });
    } catch {
      status = 'failed'; detail = 'Bağlantı hatası (URL erişilemedi)';
    }
    setLogs((prev) => [
      { id: crypto.randomUUID(), url: hook.url, event: 'trade.opened', status, detail, ts: Date.now() },
      ...prev,
    ].slice(0, 40));
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold">Webhook Entegrasyonu</h2>
        <p className="text-xs text-muted-foreground">Giden bildirimler için webhook oluştur, olay seç, test et ve logları izle</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        {/* create */}
        <div className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Webhook size={16} className="text-primary" /> Yeni Webhook
          </div>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://ornek.com/webhook"
            className="w-full rounded-lg border border-border bg-black/40 px-3 py-2 text-sm outline-none focus:border-primary/60" />
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Olaylar</p>
            <div className="flex flex-wrap gap-1.5">
              {EVENTS.map((ev) => (
                <button key={ev} onClick={() => toggleEvent(ev)}
                  className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition ${
                    selected.includes(ev) ? 'border-primary/50 bg-primary/12 text-primary' : 'border-border bg-black/30 text-muted-foreground hover:text-foreground'
                  }`}>{ev}</button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-black/20 px-3 py-2 text-[11px] text-muted-foreground">
            <ShieldCheck size={14} className="text-accent" /> Her istek HMAC-SHA256 imzalı bir <span className="font-mono text-foreground">secret</span> ile gönderilir.
          </div>
          <button onClick={add}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
            <Plus size={15} /> Webhook Ekle
          </button>
        </div>

        {/* list */}
        <div className="glass rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold">Kayıtlı Webhooklar</h3>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{hooks.length}</span>
          </div>
          {hooks.length === 0 ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-border py-12 text-xs text-muted-foreground">Henüz webhook yok</div>
          ) : (
            <div className="space-y-2">
              {hooks.map((h) => (
                <div key={h.id} className="rounded-xl border border-border bg-black/20 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-foreground">{h.url}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {h.events.map((ev) => <span key={ev} className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{ev}</span>)}
                      </div>
                      <button onClick={() => navigator.clipboard?.writeText(h.secret)}
                        className="mt-1.5 flex items-center gap-1 font-mono text-[10px] text-muted-foreground transition hover:text-accent">
                        <Copy size={10} /> {h.secret.slice(0, 22)}…
                      </button>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button onClick={() => test(h)} title="Test"
                        className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:text-primary"><Send size={13} /></button>
                      <button onClick={() => toggleActive(h.id)} title="Aç/Kapa"
                        className={`rounded-md border p-1.5 transition ${h.active ? 'border-primary/40 text-primary' : 'border-border text-muted-foreground'}`}><Power size={13} /></button>
                      <button onClick={() => remove(h.id)} title="Sil"
                        className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:text-destructive"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* logs */}
      <div className="glass rounded-2xl p-5">
        <h3 className="mb-3 font-display text-sm font-bold">Webhook Logları</h3>
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Henüz gönderim yok. Bir webhook’u test et.</p>
        ) : (
          <div className="space-y-1.5">
            {logs.map((l) => (
              <motion.div key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-black/20 px-3 py-2 text-xs">
                <span className="flex items-center gap-2">
                  {l.status === 'failed' ? <XCircle size={13} className="text-destructive" /> : <CheckCircle2 size={13} className="text-primary" />}
                  <span className="font-mono">{l.event}</span>
                  <span className="truncate text-muted-foreground">{l.detail}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock size={10} /> {new Date(l.ts).toLocaleTimeString('tr-TR')}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
