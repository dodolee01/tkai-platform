import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownUp, Droplets, Landmark, Sprout, PieChart, History,
  ArrowRight, Zap, TrendingUp, ShieldCheck, X,
} from 'lucide-react';
import { useDeFi, TOKENS_BY_CHAIN } from '@/hooks/useDeFi';
import { CHAINS, chainByKey, shortAddr } from '@/lib/web3/config';

const usd = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n, d = 4) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: d });

const TABS = [
  { id: 'swap', label: 'Takas', Icon: ArrowDownUp },
  { id: 'pools', label: 'Likidite', Icon: Droplets },
  { id: 'lending', label: 'Borç Verme', Icon: Landmark },
  { id: 'farming', label: 'Getiri Çiftliği', Icon: Sprout },
  { id: 'portfolio', label: 'DeFi Portföy', Icon: PieChart },
  { id: 'history', label: 'İşlemler', Icon: History },
];

export default function DeFiPanel({ web3 }) {
  const chainKey = web3?.account ? web3.chainKey : 'ethereum';
  const defi = useDeFi(chainKey, web3?.account);
  const [tab, setTab] = useState('swap');

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">DeFi İşlemleri</h2>
          <p className="text-xs text-muted-foreground">
            {web3?.account ? `${shortAddr(web3.account)} · ${defi.chain?.name}` : 'Çoklu protokol takas, likidite, borç verme ve getiri çiftçiliği'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Kpi label="Net Değer" value={`$${usd(defi.summary.net)}`} />
          <Kpi label="Ort. APY" value={`%${defi.summary.avgApy.toFixed(1)}`} pos />
          <Kpi label="Pozisyon" value={defi.summary.count} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-border bg-black/25 p-1.5">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${tab === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'swap' && <SwapInterface defi={defi} chainKey={chainKey} />}
      {tab === 'pools' && <LiquidityPools defi={defi} />}
      {tab === 'lending' && <LendingProtocols defi={defi} />}
      {tab === 'farming' && <YieldFarms defi={defi} />}
      {tab === 'portfolio' && <DeFiPortfolio defi={defi} />}
      {tab === 'history' && <TransactionHistory defi={defi} />}
    </div>
  );
}

function Kpi({ label, value, pos }) {
  return (
    <div className="rounded-xl border border-border bg-black/25 px-3 py-2 text-center">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`font-mono text-sm font-bold ${pos ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}

function SwapInterface({ defi, chainKey }) {
  const tokens = TOKENS_BY_CHAIN[chainKey] || TOKENS_BY_CHAIN.ethereum;
  const [fromToken, setFromToken] = useState(tokens[0]);
  const [toToken, setToToken] = useState(tokens[1]);
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const protocol = defi.dexes[0]?.key || 'uniswap';

  const quote = useMemo(() => (amount ? defi.getQuote(fromToken, toToken, amount, slippage) : null), [amount, fromToken, toToken, slippage, defi]);

  const flip = () => { setFromToken(toToken); setToToken(fromToken); };
  const doSwap = async () => {
    if (!quote || !amount) return;
    setBusy(true);
    try { await defi.swap({ protocol, fromToken, toToken, fromAmount: amount, quote }); setDone(true); setAmount(''); setTimeout(() => setDone(false), 2200); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <div className="glass rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-sm font-bold">Token Takası</p>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-black/25 px-2 py-1 text-[11px]">
            <span className="text-muted-foreground">Slippage</span>
            {[0.1, 0.5, 1].map((s) => (
              <button key={s} onClick={() => setSlippage(s)} className={`rounded px-1.5 ${slippage === s ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}>{s}%</button>
            ))}
          </div>
        </div>

        <TokenRow label="Öde" token={fromToken} tokens={tokens} onToken={setFromToken} amount={amount} onAmount={setAmount} editable />
        <div className="my-2 flex justify-center">
          <button onClick={flip} className="rounded-xl border border-border bg-black/40 p-2 text-primary transition hover:rotate-180"><ArrowDownUp size={15} /></button>
        </div>
        <TokenRow label="Al" token={toToken} tokens={tokens} onToken={setToToken} amount={quote ? num(quote.toAmount, 6) : ''} />

        {quote && (
          <div className="mt-3 space-y-1 rounded-xl border border-border bg-black/25 p-3 text-[11px] text-muted-foreground">
            <Line l="Kur" r={`1 ${fromToken} = ${num(quote.rate, 4)} ${toToken}`} />
            <Line l="Min. alınacak" r={`${num(quote.minReceived, 6)} ${toToken}`} />
            <Line l="Fiyat etkisi" r={`%${quote.priceImpact}`} warn={quote.priceImpact > 2} />
            <Line l="Protokol ücreti" r={`%${quote.fee}`} />
            <Line l="Tahmini gas" r={`$${usd(quote.gasUsd)}`} />
          </div>
        )}

        <button disabled={!quote || busy} onClick={doSwap}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40">
          {busy ? 'İşleniyor…' : done ? <><ShieldCheck size={16} /> Takas Tamamlandı</> : <><Zap size={16} /> Takası Onayla</>}
        </button>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">Protokol: {defi.dexes.find((d) => d.key === protocol)?.name || protocol}</p>
      </div>

      <div className="glass rounded-2xl p-5">
        <p className="mb-3 font-display text-sm font-bold">Mevcut DEX'ler · {defi.chain?.name}</p>
        <div className="space-y-2">
          {defi.dexes.map((d) => (
            <div key={d.key} className="flex items-center justify-between rounded-xl border border-border bg-black/25 p-3">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                <span className="text-sm font-semibold">{d.name}</span>
              </div>
              <span className="font-mono text-xs text-muted-foreground">TVL ${(d.tvl / 1e9).toFixed(1)}B</span>
            </div>
          ))}
          {defi.dexes.length === 0 && <p className="text-xs text-muted-foreground">Bu zincirde yapılandırılmış DEX yok.</p>}
        </div>
      </div>
    </div>
  );
}

function TokenRow({ label, token, tokens, onToken, amount, onAmount, editable }) {
  return (
    <div className="rounded-xl border border-border bg-black/25 p-3">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground"><span>{label}</span></div>
      <div className="mt-1 flex items-center gap-2">
        <input value={amount} onChange={(e) => editable && onAmount?.(e.target.value.replace(/[^0-9.]/g, ''))} readOnly={!editable}
          placeholder="0.0" inputMode="decimal"
          className="w-full bg-transparent font-mono text-lg font-bold outline-none placeholder:text-muted-foreground/40" />
        <select value={token} onChange={(e) => onToken(e.target.value)}
          className="rounded-lg border border-border bg-black/40 px-2 py-1.5 text-sm font-semibold outline-none">
          {tokens.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
    </div>
  );
}

function Line({ l, r, warn }) {
  return <div className="flex justify-between"><span>{l}</span><span className={warn ? 'text-destructive' : 'text-foreground'}>{r}</span></div>;
}

function AmountModal({ open, onClose, title, apy, onConfirm, extra }) {
  const [amt, setAmt] = useState('');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="glass w-full max-w-sm rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground"><X size={14} /></button>
        </div>
        {extra}
        <label className="mt-3 block text-[11px] text-muted-foreground">Tutar (USD)</label>
        <input value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" inputMode="decimal"
          className="mt-1 w-full rounded-xl border border-border bg-black/30 px-3 py-2.5 font-mono outline-none focus:border-primary/50" />
        {apy != null && <p className="mt-2 text-xs text-primary">APY: %{apy} · Tahmini yıllık: ${usd((Number(amt) || 0) * apy / 100)}</p>}
        <button disabled={!amt} onClick={() => { onConfirm(Number(amt)); onClose(); }}
          className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40">Onayla</button>
      </div>
    </div>
  );
}

function LiquidityPools({ defi }) {
  const [modal, setModal] = useState(null);
  const pools = defi.dexes.flatMap((d) => [
    { protocol: d.key, name: d.name, pair: 'ETH/USDC', apy: 8.4 + (d.tvl / 1e10), color: d.color },
    { protocol: d.key, name: d.name, pair: 'WBTC/ETH', apy: 6.1 + (d.tvl / 1.4e10), color: d.color },
  ]);
  const lp = defi.activePositions.filter((p) => p.kind === 'liquidity');
  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <div className="glass rounded-2xl p-5">
        <p className="mb-3 font-display text-sm font-bold">Likidite Havuzları</p>
        <div className="space-y-2">
          {pools.map((p, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-black/25 p-3">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                <div><p className="text-sm font-semibold">{p.pair}</p><p className="text-[10px] text-muted-foreground">{p.name}</p></div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-primary">%{p.apy.toFixed(1)} APY</span>
                <button onClick={() => setModal(p)} className="rounded-lg bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">Ekle</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <PositionsCol title="LP Pozisyonlarım" items={lp} action="Çıkar" onAction={defi.removeLiquidity} />
      <AmountModal open={!!modal} onClose={() => setModal(null)} title={`Likidite Ekle · ${modal?.pair}`} apy={modal?.apy?.toFixed(1)}
        onConfirm={(amt) => defi.addLiquidity({ protocol: modal.protocol, pair: modal.pair, amountUsd: amt, apy: modal.apy })} />
    </div>
  );
}

function LendingProtocols({ defi }) {
  const [modal, setModal] = useState(null);
  const supplied = defi.activePositions.filter((p) => p.kind === 'lending');
  const borrowed = defi.activePositions.filter((p) => p.kind === 'borrow');
  const collateral = supplied.reduce((a, p) => a + p.amountUsd, 0);
  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <div className="glass rounded-2xl p-5">
        <p className="mb-3 font-display text-sm font-bold">Borç Verme Protokolleri</p>
        <div className="space-y-2">
          {defi.lenders.map((l) => (
            <div key={l.key} className="rounded-xl border border-border bg-black/25 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{l.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">TVL ${(l.tvl / 1e9).toFixed(1)}B</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-primary">Yatır %{l.supplyApy}</span>
                <span className="text-accent">Borç al %{l.borrowApy}</span>
                <div className="flex gap-2">
                  <button onClick={() => setModal({ ...l, mode: 'supply' })} className="rounded-lg bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">Yatır</button>
                  {l.borrowApy > 0 && <button onClick={() => setModal({ ...l, mode: 'borrow' })} className="rounded-lg bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">Borç Al</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-5">
        <PositionsCol title="Yatırdıklarım" items={supplied} action="Çek" onAction={defi.repay} />
        <PositionsCol title="Borçlarım" items={borrowed} action="Öde" onAction={defi.repay} showHf />
      </div>
      <AmountModal open={!!modal} onClose={() => setModal(null)}
        title={`${modal?.mode === 'borrow' ? 'Borç Al' : 'Yatır'} · ${modal?.name}`}
        apy={modal ? (modal.mode === 'borrow' ? modal.borrowApy : modal.supplyApy) : null}
        extra={modal?.mode === 'borrow' ? <p className="mt-2 text-[11px] text-muted-foreground">Teminat: ${usd(collateral)} · Maks borç: ${usd(collateral * 0.8)}</p> : null}
        onConfirm={(amt) => modal.mode === 'borrow'
          ? defi.borrow({ protocol: modal.key, token: 'USDC', amountUsd: amt, apy: modal.borrowApy, collateralUsd: collateral })
          : defi.supply({ protocol: modal.key, token: 'USDC', amountUsd: amt, apy: modal.supplyApy })} />
    </div>
  );
}

function YieldFarms({ defi }) {
  const [modal, setModal] = useState(null);
  const farms = defi.dexes.map((d) => ({ protocol: d.key, name: d.name, pair: 'LP-' + d.name.slice(0, 4).toUpperCase(), apy: 22 + (d.tvl / 5e9) * 10, color: d.color }));
  const staked = defi.activePositions.filter((p) => p.kind === 'farm');
  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <div className="glass rounded-2xl p-5">
        <p className="mb-3 font-display text-sm font-bold">Getiri Çiftlikleri</p>
        <div className="space-y-2">
          {farms.map((f, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-black/25 p-3">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: f.color }} />
                <div><p className="text-sm font-semibold">{f.pair}</p><p className="text-[10px] text-muted-foreground">{f.name}</p></div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-primary">%{f.apy.toFixed(0)} APY</span>
                <button onClick={() => setModal(f)} className="rounded-lg bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">Stake</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="glass rounded-2xl p-5">
        <p className="mb-3 font-display text-sm font-bold">Stake Pozisyonlarım</p>
        {staked.length === 0 ? <p className="text-xs text-muted-foreground">Aktif stake yok.</p> : (
          <div className="space-y-2">
            {staked.map((p) => (
              <div key={p.id} className="rounded-xl border border-border bg-black/25 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{p.pair}</p>
                  <p className="font-mono text-xs text-primary">${usd(p.amountUsd)}</p>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">APY %{p.apy} · Ödül ${usd(p.rewardsUsd || p.amountUsd * p.apy / 100 / 52)}</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => defi.claim(p)} className="rounded-lg bg-accent/15 px-2 py-1 text-xs font-semibold text-accent">Topla</button>
                    <button onClick={() => defi.unstake(p)} className="rounded-lg bg-black/40 px-2 py-1 text-xs text-muted-foreground">Çöz</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <AmountModal open={!!modal} onClose={() => setModal(null)} title={`Stake · ${modal?.pair}`} apy={modal?.apy?.toFixed(0)}
        onConfirm={(amt) => defi.stake({ protocol: modal.protocol, pair: modal.pair, amountUsd: amt, apy: modal.apy })} />
    </div>
  );
}

function PositionsCol({ title, items, action, onAction, showHf }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="mb-3 font-display text-sm font-bold">{title}</p>
      {items.length === 0 ? <p className="text-xs text-muted-foreground">Aktif pozisyon yok.</p> : (
        <div className="space-y-2">
          {items.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-black/25 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{p.pair}</p>
                <p className="font-mono text-xs text-primary">${usd(p.amountUsd)}</p>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{p.protocol} · %{p.apy} APY {showHf && p.healthFactor ? `· HF ${p.healthFactor}` : ''}</span>
                <button onClick={() => onAction(p)} className="rounded-lg bg-black/40 px-2 py-1 text-xs text-foreground hover:text-destructive">{action}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeFiPortfolio({ defi }) {
  const byKind = useMemo(() => {
    const g = {};
    defi.activePositions.forEach((p) => { g[p.kind] = (g[p.kind] || 0) + p.amountUsd; });
    return g;
  }, [defi.activePositions]);
  const labels = { liquidity: 'Likidite', farm: 'Çiftlik', lending: 'Yatırım', borrow: 'Borç' };
  const total = Object.values(byKind).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="glass rounded-2xl p-5">
        <p className="mb-3 font-display text-sm font-bold">Pozisyon Dağılımı</p>
        {Object.keys(byKind).length === 0 ? <p className="text-xs text-muted-foreground">Henüz DeFi pozisyonu yok.</p> : Object.entries(byKind).map(([k, v]) => (
          <div key={k} className="mb-3">
            <div className="mb-1 flex justify-between text-xs"><span>{labels[k] || k}</span><span className="font-mono">${usd(v)} · %{((v / total) * 100).toFixed(0)}</span></div>
            <div className="h-2 rounded-full bg-black/40"><div className="h-full rounded-full bg-primary" style={{ width: `${(v / total) * 100}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="glass rounded-2xl p-5">
        <p className="mb-3 font-display text-sm font-bold">Özet</p>
        <div className="grid grid-cols-2 gap-3">
          <Metric icon={TrendingUp} label="Toplam Yatırım" value={`$${usd(defi.summary.supplied)}`} />
          <Metric icon={Landmark} label="Toplam Borç" value={`$${usd(defi.summary.borrowed)}`} />
          <Metric icon={PieChart} label="Net Değer" value={`$${usd(defi.summary.net)}`} pos />
          <Metric icon={Sprout} label="Bekleyen Ödül" value={`$${usd(defi.summary.rewards)}`} pos />
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, pos }) {
  return (
    <div className="rounded-xl border border-border bg-black/25 p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Icon size={11} /> {label}</div>
      <p className={`mt-1 font-mono text-base font-bold ${pos ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}

function TransactionHistory({ defi }) {
  const kindLabel = { swap: 'Takas', addLiquidity: 'Likidite Ekle', removeLiquidity: 'Likidite Çıkar', stake: 'Stake', unstake: 'Unstake', claim: 'Ödül Topla', deposit: 'Yatırım', borrow: 'Borç Al', repay: 'Geri Öde' };
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <p className="border-b border-border p-4 font-display text-sm font-bold">İşlem Geçmişi</p>
      {defi.transactions.length === 0 ? <p className="p-6 text-center text-xs text-muted-foreground">Henüz DeFi işlemi yok.</p> : (
        <div className="max-h-[520px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-black/40 text-muted-foreground">
              <tr>{['Tür', 'Protokol', 'Detay', 'Değer', 'Gas', 'Tarih'].map((h) => <th key={h} className="p-2.5 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {defi.transactions.map((t) => (
                <tr key={t.id} className="border-t border-border/60">
                  <td className="p-2.5"><span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] text-primary">{kindLabel[t.kind] || t.kind}</span></td>
                  <td className="p-2.5 capitalize">{t.protocol}</td>
                  <td className="p-2.5 text-muted-foreground">{t.fromToken ? `${t.fromToken}${t.toToken ? ` → ${t.toToken}` : ''}` : (t.meta?.pair || '—')}</td>
                  <td className="p-2.5 font-mono">${usd(t.valueUsd)}</td>
                  <td className="p-2.5 font-mono text-muted-foreground">${usd(t.gasUsd)}</td>
                  <td className="p-2.5 text-muted-foreground">{new Date(t.created).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
