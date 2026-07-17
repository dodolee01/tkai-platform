import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Users, Copy, CheckCircle2, ShieldCheck, TrendingUp, Star } from 'lucide-react';
import usePersistentState from '@/hooks/usePersistentState';
import { fmtUsd } from '@/lib/market';

const TRADERS = [
  { id: 't1', name: 'AlphaWhale', verified: true, winRate: 78, pnl30d: 12480, sharpe: 2.9, followers: 1420, rating: 4.9 },
  { id: 't2', name: 'MomentumKing', verified: true, winRate: 71, pnl30d: 9260, sharpe: 2.4, followers: 980, rating: 4.7 },
  { id: 't3', name: 'GridMaster', verified: false, winRate: 66, pnl30d: 7110, sharpe: 2.1, followers: 640, rating: 4.5 },
  { id: 't4', name: 'ScalpNinja', verified: true, winRate: 63, pnl30d: 5890, sharpe: 1.9, followers: 512, rating: 4.4 },
  { id: 't5', name: 'SwingSage', verified: false, winRate: 60, pnl30d: 4300, sharpe: 1.7, followers: 388, rating: 4.2 },
];

const SORTS = [
  { id: 'pnl30d', label: 'PnL (30g)' },
  { id: 'winRate', label: 'Kazanma %' },
  { id: 'sharpe', label: 'Sharpe' },
];

export default function SocialTradingPanel() {
  const [copying, setCopying] = usePersistentState('tkai_copytrading_v1', {});
  const [sort, setSort] = useState('pnl30d');
  const [ratio, setRatio] = useState(25);

  const ranked = useMemo(
    () => [...TRADERS].sort((a, b) => b[sort] - a[sort]),
    [sort],
  );

  const toggleCopy = (t) =>
    setCopying((prev) => {
      const next = { ...prev };
      if (next[t.id]) delete next[t.id];
      else next[t.id] = { name: t.name, ratio, since: Date.now() };
      return next;
    });

  const activeCopies = Object.entries(copying);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold">Sosyal Trading</h2>
        <p className="text-xs text-muted-foreground">Liderlik tablosu, trader profilleri ve kopya işlem yönetimi</p>
      </div>

      {activeCopies.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Copy size={15} className="text-accent" /> Aktif Kopyalamalar</p>
          <div className="flex flex-wrap gap-2">
            {activeCopies.map(([id, c]) => (
              <span key={id} className="flex items-center gap-2 rounded-full border border-accent/40 bg-accent/[0.08] px-3 py-1 text-xs text-accent">
                {c.name} · %{c.ratio} sermaye
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="glass rounded-2xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-display text-sm font-bold"><Trophy size={16} className="text-primary" /> Liderlik Tablosu</h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Kopya oranı</span>
              <input type="range" min="5" max="100" step="5" value={ratio} onChange={(e) => setRatio(Number(e.target.value))} className="accent-primary" />
              <span className="w-9 font-mono font-bold text-primary">%{ratio}</span>
            </div>
            <div className="flex gap-1 rounded-lg border border-border bg-black/40 p-1">
              {SORTS.map((s) => (
                <button key={s.id} onClick={() => setSort(s.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${sort === s.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>{s.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {ranked.map((t, i) => {
            const isCopy = !!copying[t.id];
            return (
              <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-3 rounded-xl border border-border bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className={`grid h-8 w-8 place-items-center rounded-lg font-display text-sm font-bold ${i < 3 ? 'bg-primary/15 text-primary' : 'bg-white/[0.04] text-muted-foreground'}`}>{i + 1}</span>
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      {t.name}
                      {t.verified && <ShieldCheck size={13} className="text-accent" />}
                      <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground"><Star size={10} className="text-primary" /> {t.rating}</span>
                    </p>
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Users size={10} /> {t.followers} takipçi</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Metric label="PnL 30g" value={`+$${fmtUsd(t.pnl30d)}`} pos />
                  <Metric label="Kazanma" value={`%${t.winRate}`} />
                  <Metric label="Sharpe" value={t.sharpe.toFixed(1)} />
                  <button onClick={() => toggleCopy(t)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${isCopy ? 'bg-accent text-accent-foreground' : 'bg-primary/12 text-primary hover:bg-primary/20'}`}>
                    {isCopy ? <><CheckCircle2 size={13} /> Kopyalanıyor</> : <><Copy size={13} /> Kopyala</>}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <TrendingUp size={12} /> Kopya işlemler seçtiğin sermaye oranıyla otomatik uygulanır. Performans örnek verilerle gösterilir.
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value, pos }) {
  return (
    <div className="text-right">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`font-mono text-sm font-bold ${pos ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
