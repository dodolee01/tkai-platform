import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Clock } from 'lucide-react';
import { fmtPrice, fmtUsd } from '@/lib/market';
import CoinIcon from '@/components/CoinIcon';

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}dk`;
  return `${Math.floor(s / 3600)}sa`;
}

function fmtDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function TradesPanel({ openTrades, closedTrades, onClose }) {
  const [tab, setTab] = useState('open');
  const list = tab === 'open' ? openTrades : closedTrades;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-1 rounded-xl border border-border bg-black/40 p-1">
        {[['open', `Açık (${openTrades.length})`], ['closed', `Kapalı (${closedTrades.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === k ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {list.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {tab === 'open' ? 'Açık pozisyon yok.' : 'Henüz kapalı işlem yok.'}
            </div>
          )}
          {list.map((t) => (
            <motion.div key={t.id + (t.closedAt || '')}
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }}
              className="rounded-xl border border-border bg-black/20 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CoinIcon symbol={t.symbol} size={24} />
                  <span className="font-display text-sm font-bold">{t.symbol.replace('USDT', '')}</span>
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${t.side === 'LONG' ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive'}`}>{t.side}</span>
                  {tab === 'closed' && (
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${t.result === 'TP' ? 'bg-primary/15 text-primary' : t.result === 'SL' ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'}`}>{t.result}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-sm font-bold ${t.pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {t.pnl >= 0 ? '+' : ''}{fmtUsd(t.pnl)}
                  </span>
                  {tab === 'open' && (
                    <button onClick={() => onClose(t.id)} className="rounded-md p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 font-mono text-[11px]">
                <Cell label="Entry" v={`$${fmtPrice(t.entry)}`} />
                <Cell label={tab === 'open' ? 'Fiyat' : 'Çıkış'} v={`$${fmtPrice(tab === 'open' ? t.price : t.exit)}`} />
                <Cell label="TP" v={`$${fmtPrice(t.tp)}`} c="text-primary/80" />
                <Cell label="SL" v={`$${fmtPrice(t.sl)}`} c="text-destructive/80" />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><Activity size={10} /> Güven %{t.confidence}</span>
                <span>RR {t.rr}</span>
                <span className="flex items-center gap-1"><Clock size={10} /> Açılış: {fmtDateTime(t.openedAt)}</span>
                {tab === 'closed' && (
                  <span className="flex items-center gap-1"><Clock size={10} /> Kapanış: {fmtDateTime(t.closedAt)}</span>
                )}
                {tab === 'open' && (
                  <span className="ml-auto text-muted-foreground/70">{timeAgo(t.openedAt)} önce açıldı</span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Cell({ label, v, c = 'text-foreground/80' }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`${c}`}>{v}</div>
    </div>
  );
}
