import React, { useState } from 'react';
import { KeyRound, Lock, ShieldCheck, Plug, PlugZap, Server, Wallet, AlertTriangle, Loader2 } from 'lucide-react';
import { fmtUsd } from '@/lib/market';

// The single Binance connection panel is now duplicated into two fully
// independent connections — Spot and Futures. Each has its own keys, balance,
// mode and connect/disconnect flow. The markup/styling is unchanged.
export default function ConnectionPanel({ connection, connect, disconnect }) {
  // Single connection panel: one API key manages BOTH Spot and Futures in the
  // background. The user only ever sees one "Binance Bağlantısı" panel.
  return (
    <div className="space-y-5">
      <MarketConnection market="futures" title="Binance Bağlantısı"
        connection={connection} connect={connect} disconnect={disconnect} />
    </div>
  );
}

function MarketConnection({ market, title, connection, connect, disconnect }) {
  const [apiKey, setApiKey] = useState('');
  const [secret, setSecret] = useState('');
  const [mode, setMode] = useState(connection.mode || 'testnet');
  const [error, setError] = useState('');
  const [steps, setSteps] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!apiKey || !secret || busy) return;
    setError('');
    setSteps(null);
    setBusy(true);
    const res = await connect({ market, mode, apiKey, secret });
    setBusy(false);
    if (res && res.ok) {
      setSecret('');
    } else {
      setError((res && res.error) || 'Bağlantı doğrulanamadı. API anahtarlarını kontrol edin.');
      setSteps(res && res.steps ? res.steps : null);
    }
  };

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="rounded-xl bg-accent/12 p-2 text-accent"><Server size={18} /></div>
        <div>
          <h3 className="font-display font-bold">{title}</h3>
          <p className="text-xs text-muted-foreground">API anahtarları AES-256 ile şifrelenir</p>
        </div>
      </div>

      <div className={`mb-4 flex items-center justify-between rounded-xl border p-3 ${connection.connected ? 'border-primary/40 bg-primary/[0.06]' : 'border-border bg-black/20'}`}>
        <div className="flex items-center gap-2 text-sm">
          {connection.connected
            ? <><span className="pulse-dot h-2.5 w-2.5 rounded-full bg-primary" /><span className="font-semibold text-primary">Bağlı</span></>
            : <><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50" /><span className="text-muted-foreground">Bağlı değil</span></>}
          {connection.connected && (
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${connection.mode === 'live' ? 'bg-destructive/15 text-destructive' : 'bg-accent/15 text-accent'}`}>
              {connection.mode === 'live' ? 'GERÇEK HESAP' : 'TESTNET'}
            </span>
          )}
        </div>
        {connection.connected && (
          <button onClick={() => disconnect(market)} className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold hover:bg-destructive/15 hover:text-destructive">
            <Plug size={12} /> Kes
          </button>
        )}
      </div>

      {connection.connected ? (
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/[0.07] p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wallet size={14} className="text-primary" /> Gerçek Binance Bakiyesi (USDT)
            </div>
            <span className="font-mono text-base font-bold text-primary">
              {connection.usdtBalance != null ? `$${fmtUsd(connection.usdtBalance)}` : '—'}
            </span>
          </div>
          <Row label="API Key" value={connection.apiKey ? connection.apiKey.slice(0, 6) + '••••••••' : '••••••••'} />
          <Row label="Secret" value={connection.secretMasked || '••••••••••••'} />
          <Row label="İşlem Yetkisi" value={connection.canTrade ? 'Aktif' : connection.canTrade === false ? 'Pasif' : '—'} />
          <div className="flex items-center gap-2 rounded-lg bg-primary/[0.06] p-2.5 text-xs text-primary/90">
            <ShieldCheck size={14} /> Anahtarlar şifreli saklanıyor. Spot & Vadeli emirler için yetkilendirildi.
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs leading-relaxed text-destructive">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{error}</span>
              </div>
              {steps && steps.length > 0 && (
                <ol className="mt-2 list-decimal space-y-1 pl-6 text-destructive/90">
                  {steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              )}
            </div>
          )}
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Hesap Modu</p>
          <div className="flex gap-2">
            {['testnet', 'live'].map((m) => (
              <button type="button" key={m} onClick={() => { setMode(m); setError(''); setSteps(null); }}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${mode === m ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                {m === 'testnet' ? 'Testnet' : 'Gerçek Hesap'}
              </button>
            ))}
          </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/80">
              {mode === 'testnet'
                ? 'testnet.binance.vision üzerinden oluşturduğunuz test anahtarlarını kullanın.'
                : 'Gerçek Binance hesabınızın API anahtarlarını kullanın (Okuma + Spot İşlem yetkili).'}
            </p>
          </div>
          <Field icon={KeyRound} placeholder="API Key" value={apiKey} onChange={setApiKey} />
          <Field icon={Lock} placeholder="Secret Key" value={secret} onChange={setSecret} type="password" />
          <button type="submit" disabled={!apiKey || !secret || busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40">
            {busy ? <><Loader2 size={16} className="animate-spin" /> Doğrulanıyor…</> : <><PlugZap size={16} /> Bağlan & Şifrele</>}
          </button>
        </form>
      )}
    </div>
  );
}

function Field({ icon: Icon, ...p }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-black/30 px-3 focus-within:border-primary/50">
      <Icon size={15} className="text-muted-foreground" />
      <input {...p} type={p.type || 'text'} onChange={(e) => p.onChange(e.target.value)}
        className="w-full bg-transparent py-2.5 font-mono text-sm outline-none placeholder:text-muted-foreground/60" />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}
