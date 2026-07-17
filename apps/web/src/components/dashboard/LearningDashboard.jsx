import React from 'react';
import { motion } from 'framer-motion';
import {
  Brain, TrendingUp, TrendingDown, Percent, Clock, CalendarDays, Coins,
  Lightbulb, CheckCircle2, Circle, AlertTriangle, Info, Save, Trash2, Download, Sparkles,
} from 'lucide-react';
import { fmtUsd } from '@/lib/market';
import { useLearning } from '@/hooks/useLearning';

const PERIODS = [
  { value: 7, label: '7 Gün' },
  { value: 30, label: '30 Gün' },
  { value: 90, label: '90 Gün' },
  { value: null, label: 'Tümü' },
];

const SEV = {
  info: { Icon: Info, cls: 'border-accent/30 bg-accent/[0.07] text-accent' },
  warning: { Icon: AlertTriangle, cls: 'border-yellow-500/30 bg-yellow-500/[0.07] text-yellow-400' },
  critical: { Icon: AlertTriangle, cls: 'border-destructive/40 bg-destructive/[0.08] text-destructive' },
};

function download(name, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function LearningDashboard({ closedTrades = [] }) {
  const L = useLearning(closedTrades);
  const a = L.analysis;
  const dayName = (k) => a.dayNames[Number(k)] ?? k;

  const exportReport = () => {
    const lines = [
      ['Metrik', 'Değer'],
      ['Dönem', L.period ? `${L.period} gün` : 'Tümü'],
      ['Toplam İşlem', a.totalTrades],
      ['Kazanma Oranı', `%${a.winRate}`],
      ['Toplam K/Z', a.totalPnl.toFixed(2)],
      ['En İyi Coin', a.coinRank.best ? `${a.coinRank.best.key} (${a.coinRank.best.pnl.toFixed(2)})` : '—'],
      ['En Kötü Coin', a.coinRank.worst ? `${a.coinRank.worst.key} (${a.coinRank.worst.pnl.toFixed(2)})` : '—'],
      ['En İyi Saat', a.hourRank.best ? `${a.hourRank.best.key}:00` : '—'],
      ['En İyi Gün', a.dayRank.best ? dayName(a.dayRank.best.key) : '—'],
    ];
    download('ai_learning_report.csv', lines.map((r) => r.join(',')).join('\n'));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">AI Öğrenme Merkezi</h2>
          <p className="text-xs text-muted-foreground">Tamamlanan işlemlerden desenler öğrenir ve strateji önerileri üretir</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex overflow-hidden rounded-xl border border-border">
            {PERIODS.map((p) => (
              <button key={String(p.value)} onClick={() => L.setPeriod(p.value)}
                className={`px-3 py-1.5 text-xs font-medium transition ${L.period === p.value ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={exportReport} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"><Download size={13} /> Rapor</button>
        </div>
      </div>

      {/* Trend cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card Icon={Percent} label="Kazanma Oranı" value={`%${a.winRate}`} sub={`${a.totalTrades} işlem`} />
        <Card Icon={a.totalPnl >= 0 ? TrendingUp : TrendingDown} label="Toplam K/Z" value={`${a.totalPnl >= 0 ? '+' : ''}$${fmtUsd(a.totalPnl)}`} pos={a.totalPnl >= 0} />
        <Card Icon={Coins} label="En İyi Coin" value={a.coinRank.best?.key?.replace('USDT', '') || '—'} sub={a.coinRank.best ? `+$${fmtUsd(a.coinRank.best.pnl)}` : ''} pos />
        <Card Icon={Clock} label="En İyi Saat" value={a.hourRank.best ? `${a.hourRank.best.key}:00` : '—'} sub={a.hourRank.best ? `%${a.hourRank.best.winRate} kazanma` : ''} />
      </div>

      {/* Win-rate trend across periods */}
      <div className="glass rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Sparkles size={15} className="text-primary" /> Trend (Kazanma Oranı & K/Z)</div>
        <div className="grid grid-cols-3 gap-3">
          {[['7 Gün', L.trends.d7], ['30 Gün', L.trends.d30], ['90 Gün', L.trends.d90]].map(([label, t]) => (
            <div key={label} className="rounded-xl border border-border bg-black/20 p-3">
              <div className="text-[11px] text-muted-foreground">{label}</div>
              <div className="mt-1 font-mono text-lg font-bold">%{t.winRate}</div>
              <div className={`text-xs font-mono ${t.totalPnl >= 0 ? 'text-primary' : 'text-destructive'}`}>{t.totalPnl >= 0 ? '+' : ''}${fmtUsd(t.totalPnl)}</div>
              <div className="text-[10px] text-muted-foreground">{t.totalTrades} işlem</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <RankTable title="Coin Performansı" Icon={Coins} rows={a.coins} labelFn={(r) => r.key.replace('USDT', '')} />
        <RankTable title="Saat Performansı" Icon={Clock} rows={a.hours} labelFn={(r) => `${r.key}:00`} />
        <RankTable title="Gün Performansı" Icon={CalendarDays} rows={a.days} labelFn={(r) => dayName(r.key)} />
        <RankTable title="Yön (LONG/SHORT)" Icon={TrendingUp} rows={a.sides} labelFn={(r) => r.key} />
      </div>

      {/* Recommendations */}
      <div className="glass rounded-2xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-semibold"><Lightbulb size={15} className="text-yellow-400" /> AI Önerileri</span>
          <button onClick={L.saveRecommendations} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"><Save size={13} /> Önerileri Kaydet</button>
        </div>
        <div className="space-y-2">
          {L.recommendations.map((r, i) => {
            const sev = SEV[r.severity] || SEV.info;
            return (
              <div key={i} className={`rounded-xl border p-3 ${sev.cls}`}>
                <div className="flex items-center gap-2 text-sm font-semibold"><sev.Icon size={14} /> {r.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-foreground/80">{r.detail}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feedback loop */}
      <div className="glass rounded-2xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-semibold"><Brain size={15} className="text-accent" /> Geri Bildirim Döngüsü ({L.recFeedback.length})</span>
          {L.recFeedback.length > 0 && (
            <button onClick={L.clearFeedback} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-destructive"><Trash2 size={13} /> Temizle</button>
          )}
        </div>
        {L.recFeedback.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">Kaydedilmiş öneri yok. Yukarıdan "Önerileri Kaydet" ile takibe alın; uyguladıklarınızı işaretleyin.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">Uyguladığınız önerileri işaretleyin — sistem hangi önerilerin uygulandığını ve sonucunu izler.</p>
            {L.recFeedback.map((r) => (
              <button key={r.id} onClick={() => L.toggleFollowed(r)}
                className="flex w-full items-start gap-2 rounded-xl border border-border bg-black/20 p-3 text-left transition hover:border-primary/30">
                {r.followed ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" /> : <Circle size={16} className="mt-0.5 shrink-0 text-muted-foreground" />}
                <div className="min-w-0">
                  <div className={`text-sm font-medium ${r.followed ? 'text-primary' : ''}`}>{r.title}</div>
                  <div className="text-[11px] text-muted-foreground">{r.category} · {r.followed ? 'Uygulandı' : 'Beklemede'}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ Icon, label, value, sub, pos }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass glass-hover rounded-2xl p-4 transition">
      <div className="flex items-center justify-between text-xs text-muted-foreground">{label}<Icon size={15} className="text-muted-foreground/70" /></div>
      <div className={`mt-2 font-mono text-xl font-bold ${pos === undefined ? 'text-foreground' : pos ? 'text-primary' : 'text-destructive'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>}
    </motion.div>
  );
}

function RankTable({ title, Icon, rows, labelFn }) {
  const sorted = [...rows].sort((a, b) => b.pnl - a.pnl);
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Icon size={15} className="text-muted-foreground" /> {title}</div>
      {sorted.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">Veri yok</p>
      ) : (
        <div className="max-h-56 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase text-muted-foreground">
              <tr><th className="py-1">Ad</th><th>İşlem</th><th>Kazanma</th><th className="text-right">K/Z</th></tr>
            </thead>
            <tbody className="font-mono">
              {sorted.map((r) => (
                <tr key={r.key} className="border-t border-border/50">
                  <td className="py-1">{labelFn(r)}</td>
                  <td>{r.trades}</td>
                  <td>%{r.winRate}</td>
                  <td className={`text-right ${r.pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>{r.pnl >= 0 ? '+' : ''}{r.pnl.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
