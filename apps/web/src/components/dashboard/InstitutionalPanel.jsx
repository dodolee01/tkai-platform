import React, { useState } from 'react';
import { Shield, BarChart3, ClipboardList, Users, Sliders, FileText, Plus, X, AlertTriangle } from 'lucide-react';
import { useInstitutional } from '@/hooks/useInstitutional';
import { fmtUsd } from '@/lib/market';

const pct = (n) => `${(Number(n) || 0).toFixed(1)}`;
const TABS = [
  { id: 'risk', label: 'Risk Yöneticisi', Icon: Shield },
  { id: 'analytics', label: 'Portföy Analitiği', Icon: BarChart3 },
  { id: 'orders', label: 'Gelişmiş Emirler', Icon: ClipboardList },
  { id: 'accounts', label: 'Çoklu Hesap', Icon: Users },
  { id: 'settings', label: 'Gelişmiş Ayarlar', Icon: Sliders },
  { id: 'reports', label: 'Uyum & Rapor', Icon: FileText },
];

export default function InstitutionalPanel({ sys }) {
  const inst = useInstitutional(sys);
  const [tab, setTab] = useState('risk');
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold">Kurumsal İşlem Merkezi</h2>
        <p className="text-xs text-muted-foreground">AI risk yönetimi, portföy analitiği, gelişmiş emirler ve uyum raporları</p>
      </div>
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-border bg-black/25 p-1.5">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${tab === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      {tab === 'risk' && <RiskManager inst={inst} sys={sys} />}
      {tab === 'analytics' && <Analytics inst={inst} />}
      {tab === 'orders' && <Orders inst={inst} sys={sys} />}
      {tab === 'accounts' && <Accounts inst={inst} />}
      {tab === 'settings' && <AdvancedSettings sys={sys} />}
      {tab === 'reports' && <Reports inst={inst} sys={sys} />}
    </div>
  );
}

function Card({ label, value, sub, pos }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-lg font-bold ${pos === undefined ? 'text-foreground' : pos ? 'text-primary' : 'text-destructive'}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function RiskManager({ inst, sys }) {
  const rs = inst.riskScore;
  const band = rs < 35 ? { l: 'Düşük', c: 'text-primary' } : rs < 65 ? { l: 'Orta', c: 'text-accent' } : { l: 'Yüksek', c: 'text-destructive' };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label="Risk Skoru" value={`${rs}/100`} sub={band.l + ' risk'} pos={rs < 65} />
        <Card label="Maks Drawdown" value={`%${pct(inst.analytics.maxDd)}`} pos={inst.analytics.maxDd < 15} />
        <Card label="VaR (95%)" value={`$${fmtUsd(inst.analytics.var95)}`} />
        <Card label="Açık Pozisyon" value={`${sys.openTrades.length} / ${sys.settings.maxOpenTrades}`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <p className="mb-3 flex items-center gap-2 font-display text-sm font-bold"><AlertTriangle size={15} className={band.c} /> Portföy Isı Haritası</p>
          {inst.heat.length === 0 ? <p className="text-xs text-muted-foreground">Açık pozisyon yok.</p> : inst.heat.map((h) => (
            <div key={h.sym} className="mb-2">
              <div className="mb-1 flex justify-between text-xs"><span>{h.sym}</span><span className="font-mono">%{h.pct.toFixed(0)} · ${fmtUsd(h.value)}</span></div>
              <div className="h-2 rounded-full bg-black/40"><div className={`h-full rounded-full ${h.pct > 40 ? 'bg-destructive' : h.pct > 20 ? 'bg-accent' : 'bg-primary'}`} style={{ width: `${h.pct}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="mb-3 font-display text-sm font-bold">Risk Önerileri</p>
          <ul className="space-y-2 text-xs text-muted-foreground">
            {rs >= 65 && <Rec>Risk skoru yüksek — kaldıracı ve açık pozisyon sayısını azaltın.</Rec>}
            {inst.analytics.maxDd > 15 && <Rec>Drawdown %{pct(inst.analytics.maxDd)} — günlük zarar limitini sıkılaştırın.</Rec>}
            {inst.heat[0]?.pct > 40 && <Rec>{inst.heat[0].sym} tek pozisyonda %{inst.heat[0].pct.toFixed(0)} yoğunlaşma — çeşitlendirin.</Rec>}
            {sys.settings.leverage > 3 && <Rec>Kaldıraç {sys.settings.leverage}x — kurumsal limit önerisi 3x.</Rec>}
            {(rs < 65 && inst.analytics.maxDd <= 15 && (inst.heat[0]?.pct || 0) <= 40 && sys.settings.leverage <= 3) && <Rec>Risk parametreleri sağlıklı aralıkta. Mevcut disiplini koruyun.</Rec>}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <Mini label="Sharpe" value={inst.analytics.sharpe.toFixed(2)} />
            <Mini label="Sortino" value={inst.analytics.sortino.toFixed(2)} />
            <Mini label="Beta" value={inst.analytics.beta.toFixed(2)} />
            <Mini label="Kar Faktörü" value={Number.isFinite(inst.analytics.profitFactor) ? inst.analytics.profitFactor.toFixed(2) : '∞'} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Rec({ children }) { return <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{children}</li>; }
function Mini({ label, value }) { return <div className="rounded-lg border border-border bg-black/25 p-2"><p className="text-[10px] text-muted-foreground">{label}</p><p className="font-mono text-sm font-bold">{value}</p></div>; }

function Analytics({ inst }) {
  const a = inst.analytics;
  const { syms, matrix } = inst.correlation;
  const metrics = [
    ['Sharpe Oranı', a.sharpe.toFixed(2)], ['Sortino Oranı', a.sortino.toFixed(2)], ['Calmar Oranı', a.calmar.toFixed(2)],
    ['Bilgi Oranı', a.information.toFixed(2)], ['Alpha', `%${a.alpha.toFixed(1)}`], ['Beta', a.beta.toFixed(2)],
    ['Maks Drawdown', `%${pct(a.maxDd)}`], ['VaR (95%)', `$${fmtUsd(a.var95)}`], ['CVaR (95%)', `$${fmtUsd(a.cvar95)}`],
    ['Volatilite', `%${pct(a.std)}`], ['Kar Faktörü', Number.isFinite(a.profitFactor) ? a.profitFactor.toFixed(2) : '∞'], ['Kazanma Oranı', `%${pct(a.winRate)}`],
  ];
  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-5">
        <p className="mb-3 font-display text-sm font-bold">Performans Metrikleri {a.n === 0 && <span className="text-[10px] font-normal text-muted-foreground">(kapalı işlem geldikçe güncellenir)</span>}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {metrics.map(([l, v]) => <div key={l} className="rounded-xl border border-border bg-black/25 p-3"><p className="text-[10px] text-muted-foreground">{l}</p><p className="mt-0.5 font-mono text-base font-bold">{v}</p></div>)}
        </div>
      </div>
      <div className="glass rounded-2xl p-5">
        <p className="mb-3 font-display text-sm font-bold">Korelasyon Matrisi</p>
        {syms.length === 0 ? <p className="text-xs text-muted-foreground">Korelasyon için birden fazla sembolde kapalı işlem gerekli.</p> : (
          <div className="overflow-x-auto">
            <table className="text-[11px]">
              <thead><tr><th className="p-1.5" />{syms.map((s) => <th key={s} className="p-1.5 font-mono text-muted-foreground">{s.replace('USDT', '')}</th>)}</tr></thead>
              <tbody>{matrix.map((row, i) => (
                <tr key={syms[i]}><td className="p-1.5 font-mono text-muted-foreground">{syms[i].replace('USDT', '')}</td>
                  {row.map((v, j) => <td key={j} className="p-1.5 text-center font-mono" style={{ background: `rgba(${v > 0 ? '16,185,129' : '244,63,94'},${Math.abs(v) * 0.4})` }}>{v.toFixed(2)}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const ORDER_TYPES = [
  { v: 'iceberg', l: 'Iceberg' }, { v: 'twap', l: 'TWAP' }, { v: 'vwap', l: 'VWAP' }, { v: 'trailing', l: 'Trailing Stop' },
  { v: 'bracket', l: 'Bracket' }, { v: 'oco', l: 'OCO' }, { v: 'if_touched', l: 'If-Touched' }, { v: 'conditional', l: 'Koşullu' },
];

function Orders({ inst, sys }) {
  const [f, setF] = useState({ type: 'twap', symbol: 'BTCUSDT', side: 'BUY', quantity: '', price: '' });
  const submit = async (e) => { e.preventDefault(); if (!f.quantity) return; await inst.createOrder({ ...f, quantity: Number(f.quantity), price: Number(f.price) || 0, accountId: '' }); setF({ ...f, quantity: '', price: '' }); };
  const active = inst.orders.filter((o) => o.status === 'active');
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      <form onSubmit={submit} className="glass rounded-2xl p-5">
        <p className="mb-3 font-display text-sm font-bold">Yeni Gelişmiş Emir</p>
        <div className="space-y-3 text-xs">
          <Field label="Emir Tipi"><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className="inp">{ORDER_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sembol"><input value={f.symbol} onChange={(e) => setF({ ...f, symbol: e.target.value.toUpperCase() })} className="inp" /></Field>
            <Field label="Yön"><select value={f.side} onChange={(e) => setF({ ...f, side: e.target.value })} className="inp"><option>BUY</option><option>SELL</option></select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Miktar"><input value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value.replace(/[^0-9.]/g, '') })} className="inp" inputMode="decimal" /></Field>
            <Field label="Fiyat (ops.)"><input value={f.price} onChange={(e) => setF({ ...f, price: e.target.value.replace(/[^0-9.]/g, '') })} className="inp" inputMode="decimal" /></Field>
          </div>
        </div>
        <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"><Plus size={15} /> Emir Oluştur</button>
        <style>{`.inp{width:100%;border-radius:0.6rem;border:1px solid hsl(var(--border));background:rgba(0,0,0,0.3);padding:0.5rem 0.65rem;outline:none;font-family:"JetBrains Mono",monospace}`}</style>
      </form>
      <div className="glass overflow-hidden rounded-2xl">
        <p className="border-b border-border p-4 font-display text-sm font-bold">Aktif Emirler ({active.length})</p>
        {active.length === 0 ? <p className="p-6 text-center text-xs text-muted-foreground">Aktif gelişmiş emir yok.</p> : (
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border/60">
            {active.map((o) => (
              <div key={o.id} className="flex items-center justify-between p-3 text-xs">
                <div>
                  <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] uppercase text-primary">{o.type}</span>
                  <span className={`ml-2 font-semibold ${o.side === 'BUY' ? 'text-primary' : 'text-destructive'}`}>{o.side}</span> {o.symbol}
                  <p className="mt-0.5 font-mono text-muted-foreground">Miktar {o.quantity} {o.price ? `@ ${o.price}` : ''}</p>
                </div>
                <button onClick={() => inst.cancelOrder(o.id)} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-destructive"><X size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) { return <label className="block"><span className="mb-1 block text-[11px] text-muted-foreground">{label}</span>{children}</label>; }

function Accounts({ inst }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', allocationUsd: '', maxLeverage: '3', maxDrawdown: '15', dailyLossLimit: '5', maxPositionSize: '10' });
  const total = inst.accounts.reduce((a, x) => a + (x.allocationUsd || 0), 0);
  const submit = async (e) => { e.preventDefault(); if (!f.name) return; await inst.createAccount({ name: f.name, allocationUsd: Number(f.allocationUsd), maxLeverage: Number(f.maxLeverage), maxDrawdown: Number(f.maxDrawdown), dailyLossLimit: Number(f.dailyLossLimit), maxPositionSize: Number(f.maxPositionSize) }); setOpen(false); setF({ ...f, name: '', allocationUsd: '' }); };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card label="Toplam Hesap" value={inst.accounts.length} />
        <Card label="Toplam Tahsis" value={`$${fmtUsd(total)}`} />
        <Card label="Konsolide K/Z" value={`$${fmtUsd(inst.accounts.reduce((a, x) => a + (x.pnl || 0), 0))}`} pos />
      </div>
      <div className="glass rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-sm font-bold">Alt Hesaplar</p>
          <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-primary/15 px-2.5 py-1.5 text-xs font-semibold text-primary"><Plus size={13} /> Hesap Ekle</button>
        </div>
        {inst.accounts.length === 0 ? <p className="text-xs text-muted-foreground">Henüz alt hesap yok.</p> : (
          <div className="space-y-2">
            {inst.accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-border bg-black/25 p-3 text-xs">
                <div>
                  <p className="font-semibold">{a.name}</p>
                  <p className="mt-0.5 text-muted-foreground">Tahsis ${fmtUsd(a.allocationUsd)} · Maks {a.maxLeverage}x · DD %{a.maxDrawdown} · Günlük zarar %{a.dailyLossLimit}</p>
                </div>
                <button onClick={() => inst.removeAccount(a.id)} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-destructive"><X size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <form onSubmit={submit} className="glass w-full max-w-md rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><h3 className="font-display text-sm font-bold">Yeni Alt Hesap</h3><button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border p-1.5"><X size={14} /></button></div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Field label="Hesap Adı"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="inp2" /></Field>
              <Field label="Tahsis (USD)"><input value={f.allocationUsd} onChange={(e) => setF({ ...f, allocationUsd: e.target.value.replace(/[^0-9.]/g, '') })} className="inp2" inputMode="decimal" /></Field>
              <Field label="Maks Kaldıraç"><input value={f.maxLeverage} onChange={(e) => setF({ ...f, maxLeverage: e.target.value })} className="inp2" /></Field>
              <Field label="Maks DD %"><input value={f.maxDrawdown} onChange={(e) => setF({ ...f, maxDrawdown: e.target.value })} className="inp2" /></Field>
              <Field label="Günlük Zarar %"><input value={f.dailyLossLimit} onChange={(e) => setF({ ...f, dailyLossLimit: e.target.value })} className="inp2" /></Field>
              <Field label="Maks Pozisyon %"><input value={f.maxPositionSize} onChange={(e) => setF({ ...f, maxPositionSize: e.target.value })} className="inp2" /></Field>
            </div>
            <button className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">Oluştur</button>
            <style>{`.inp2{width:100%;border-radius:0.6rem;border:1px solid hsl(var(--border));background:rgba(0,0,0,0.3);padding:0.5rem 0.65rem;outline:none}`}</style>
          </form>
        </div>
      )}
    </div>
  );
}

function AdvancedSettings({ sys }) {
  const s = sys.settings;
  const set = (k, v) => sys.setSettings((p) => ({ ...p, [k]: v }));
  const rows = [
    ['riskPerTrade', 'İşlem Başına Risk %', 0.1, 5, 0.1], ['maxOpenTrades', 'Maks Açık Pozisyon', 1, 50, 1],
    ['leverage', 'Maks Kaldıraç', 1, 5, 1], ['dailyLossLimit', 'Günlük Zarar Limiti %', 1, 20, 0.5],
    ['profitTarget', 'Günlük Kâr Hedefi %', 1, 50, 1], ['minConfidence', 'Min Güven %', 50, 99, 1],
  ];
  return (
    <div className="glass rounded-2xl p-5">
      <p className="mb-4 font-display text-sm font-bold">Gelişmiş Risk Parametreleri</p>
      <div className="grid gap-5 md:grid-cols-2">
        {rows.map(([k, label, min, max, step]) => (
          <div key={k}>
            <div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-mono font-bold text-primary">{s[k] ?? min}</span></div>
            <input type="range" min={min} max={max} step={step} value={s[k] ?? min} onChange={(e) => set(k, Number(e.target.value))} className="w-full accent-[hsl(var(--primary))]" />
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-muted-foreground">Değişiklikler anında bot risk motoruna uygulanır. Korelasyon, volatilite ve slippage limitleri kurumsal profil aktifken otomatik uygulanır.</p>
    </div>
  );
}

function Reports({ inst, sys }) {
  const a = inst.analytics;
  const exportCsv = () => {
    const rows = [['Metrik', 'Değer'], ['Toplam İşlem', a.n], ['Toplam K/Z', a.total.toFixed(2)], ['Kazanma Oranı %', a.winRate.toFixed(1)], ['Sharpe', a.sharpe.toFixed(2)], ['Sortino', a.sortino.toFixed(2)], ['Maks Drawdown %', a.maxDd.toFixed(2)], ['VaR 95%', a.var95.toFixed(2)], ['CVaR 95%', a.cvar95.toFixed(2)]];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a'); link.href = url; link.download = `tkai-rapor-${Date.now()}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card label="Toplam İşlem" value={a.n} />
          <Card label="Toplam K/Z" value={`$${fmtUsd(a.total)}`} pos={a.total >= 0} />
          <Card label="Kazanma Oranı" value={`%${pct(a.winRate)}`} />
          <Card label="Denetim Kaydı" value={inst.audit.length} />
        </div>
        <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-xl bg-primary/15 px-3 py-2 text-xs font-semibold text-primary"><FileText size={14} /> CSV İndir</button>
      </div>
      <div className="glass overflow-hidden rounded-2xl">
        <p className="border-b border-border p-4 font-display text-sm font-bold">Denetim Kaydı (Compliance)</p>
        {inst.audit.length === 0 ? <p className="p-6 text-center text-xs text-muted-foreground">Denetim kaydı boş.</p> : (
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border/60">
            {inst.audit.map((l) => (
              <div key={l.id} className="flex items-center justify-between p-3 text-xs">
                <div><span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] uppercase text-muted-foreground">{l.category}</span> <span className="ml-2 font-semibold">{l.action}</span><p className="mt-0.5 text-muted-foreground">{l.detail}</p></div>
                <span className="text-[10px] text-muted-foreground">{new Date(l.created).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
