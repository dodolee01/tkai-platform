import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronRight, Target, Shield, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { fmtPrice } from '@/lib/market';
import CoinIcon from '@/components/CoinIcon';

function ConfidenceRing({ value }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  const col = value >= 85 ? '#10b981' : value >= 65 ? '#f59e0b' : '#f43f5e';
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={col} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .6s' }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold">{value}%</span>
    </div>
  );
}

export default function AIEngine({ signals, minConfidence }) {
  const [open, setOpen] = useState(null);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-primary/12 p-2 text-primary"><Brain size={18} /></div>
          <div>
            <h3 className="font-display font-bold">AI Analiz Motoru</h3>
            <p className="text-xs text-muted-foreground">25 katmanlı çoklu zaman dilimi değerlendirmesi</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-primary">
          <span className="pulse-dot h-2 w-2 rounded-full bg-primary" /> Canlı tarama
        </div>
      </div>

      <div className="space-y-2.5 max-h-[430px] overflow-y-auto pr-1">
        {signals.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">Sinyaller taranıyor...</div>
        )}
        {signals.map((s) => {
          const pass = s.confidence >= minConfidence;
          const isOpen = open === s.id;
          return (
            <div key={s.id} className={`rounded-xl border p-3 transition ${pass ? 'border-primary/30 bg-primary/[0.04]' : 'border-border bg-black/20'}`}>
              <button onClick={() => setOpen(isOpen ? null : s.id)} className="flex w-full items-center gap-3 text-left">
                <ConfidenceRing value={s.confidence} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <CoinIcon symbol={s.symbol} size={24} />
                    <span className="font-display font-bold">{s.symbol.replace('USDT', '')}</span>
                    <span className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold ${s.side === 'LONG' ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive'}`}>
                      {s.side === 'LONG' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{s.side}
                    </span>
                    {pass && <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">İŞLEME UYGUN</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
                    <span>Entry ${fmtPrice(s.entry)}</span>
                    <span>RR {s.rr}</span>
                    <span>Başarı %{s.successProb}</span>
                    <span>Risk {s.riskScore}</span>
                  </div>
                </div>
                <ChevronRight size={16} className={`shrink-0 text-muted-foreground transition ${isOpen ? 'rotate-90' : ''}`} />
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
                      <div className="flex items-start gap-2 rounded-lg bg-black/30 p-2.5 text-xs leading-relaxed text-foreground/80">
                        <Sparkles size={14} className="mt-0.5 shrink-0 text-accent" />
                        <p>{s.reason}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Metric icon={Target} label="Take Profit" value={`$${fmtPrice(s.tp)}`} color="text-primary" />
                        <Metric icon={Shield} label="Stop Loss" value={`$${fmtPrice(s.sl)}`} color="text-destructive" />
                        <Metric icon={TrendingUp} label="R/R" value={s.rr} color="text-accent" />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {s.layers.map((l) => (
                          <div key={l.name} className="flex items-center justify-between rounded-md bg-black/25 px-2 py-1 text-[10px]">
                            <span className="truncate text-muted-foreground">{l.name}</span>
                            <span className={`font-mono font-semibold ${l.bull ? 'text-primary' : 'text-destructive'}`}>{l.strength}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-lg bg-black/30 p-2">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Icon size={11} /> {label}</div>
      <div className={`mt-0.5 font-mono text-sm font-bold ${color}`}>{value}</div>
    </div>
  );
}
