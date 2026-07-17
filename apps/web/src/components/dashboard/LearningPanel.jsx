import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell as RCell } from 'recharts';
import { GraduationCap, Lightbulb } from 'lucide-react';
import { fmtUsd } from '@/lib/market';

export default function LearningPanel({ closedTrades }) {
  const stats = useMemo(() => {
    const wins = closedTrades.filter((t) => t.win);
    const losses = closedTrades.filter((t) => !t.win);
    const total = closedTrades.length;
    const winRate = total ? Math.round((wins.length / total) * 100) : 0;
    const gross = closedTrades.reduce((a, t) => a + t.pnl, 0);
    const avgWin = wins.length ? wins.reduce((a, t) => a + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((a, t) => a + t.pnl, 0) / losses.length : 0;
    const bySymbol = {};
    for (const t of closedTrades) {
      bySymbol[t.symbol] = (bySymbol[t.symbol] || 0) + t.pnl;
    }
    const chart = Object.entries(bySymbol).map(([symbol, pnl]) => ({ symbol: symbol.replace('USDT', ''), pnl: +pnl.toFixed(1) }));
    return { total, winRate, wins: wins.length, losses: losses.length, gross, avgWin, avgLoss, chart };
  }, [closedTrades]);

  const insights = useMemo(() => {
    const out = [];
    if (stats.total < 5) out.push('Anlamlı strateji önerisi için daha fazla kapalı işlem verisi toplanıyor.');
    if (stats.winRate >= 60) out.push(`Kazanma oranı güçlü (%${stats.winRate}). Yüksek güvenli LONG kurulumlarında pozisyon büyüklüğü kademeli artırılabilir.`);
    if (stats.winRate < 45 && stats.total >= 5) out.push('Kazanma oranı düşük — minimum güven eşiğini yükseltmek yanlış sinyalleri azaltabilir.');
    if (Math.abs(stats.avgLoss) > stats.avgWin && stats.total >= 5) out.push('Ortalama zarar ortalama kârı aşıyor — stop-loss mesafesi ve R/R oranı gözden geçirilmeli.');
    out.push('Öneriler yalnızca bilgilendirmedir; canlı işlem kuralları kullanıcı onayı olmadan değiştirilmez.');
    return out;
  }, [stats]);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="rounded-xl bg-primary/12 p-2 text-primary"><GraduationCap size={18} /></div>
        <div>
          <h3 className="font-display font-bold">Öğrenme & Performans</h3>
          <p className="text-xs text-muted-foreground">Geçmiş işlemlerden strateji analizi</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Kpi label="Kazanma Oranı" value={`%${stats.winRate}`} accent />
        <Kpi label="Kazanan / Kaybeden" value={`${stats.wins} / ${stats.losses}`} />
        <Kpi label="Ort. Kazanç" value={`+${fmtUsd(stats.avgWin)}`} accent />
        <Kpi label="Ort. Kayıp" value={fmtUsd(stats.avgLoss)} danger />
      </div>

      <div className="mt-4 h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.chart} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <XAxis dataKey="symbol" tick={{ fill: '#7b869c', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#7b869c', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{ background: 'rgba(10,13,22,0.95)', border: '1px solid rgba(120,140,190,0.2)', borderRadius: 10, fontSize: 12 }} />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {stats.chart.map((e, i) => (
                <RCell key={i} fill={e.pnl >= 0 ? '#10b981' : '#f43f5e'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 space-y-2">
        {insights.map((t, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg bg-black/25 p-2.5 text-xs leading-relaxed text-foreground/75">
            <Lightbulb size={14} className="mt-0.5 shrink-0 text-accent" /> {t}
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value, accent, danger }) {
  return (
    <div className="rounded-xl border border-border bg-black/20 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-lg font-bold ${accent ? 'text-primary' : danger ? 'text-destructive' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}
