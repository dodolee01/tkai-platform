import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, X, Check, Link2, Power, Copy, ExternalLink, Globe, ShieldAlert } from 'lucide-react';
import { CHAINS, WALLETS, chainByKey, shortAddr } from '@/lib/web3/config';

function WalletSelector({ open, onClose, onPick, connecting }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4" onClick={onClose}>
          <motion.div initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="glass w-full max-w-md rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold">Cüzdan Seç</h3>
              <button onClick={onClose} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground"><X size={15} /></button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Bağlanmak istediğiniz cüzdanı seçin. EVM cüzdanları için tarayıcı eklentisi gereklidir.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {WALLETS.map((w) => {
                const available = w.detect?.();
                return (
                  <button key={w.key} disabled={connecting} onClick={() => onPick(w)}
                    className="glass-hover flex flex-col items-start gap-1 rounded-xl border border-border bg-black/25 p-3 text-left transition disabled:opacity-50">
                    <div className="flex w-full items-center justify-between">
                      <span className="text-sm font-semibold">{w.name}</span>
                      {available && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{w.kind}</span>
                    <span className="text-[10px] text-muted-foreground/70">{available ? 'Algılandı' : 'Kurulum gerekli'}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Web3Panel({ web3 }) {
  const { wallets, account, chainKey, nativeBalance, connecting, error, connect, disconnect, switchNetwork } = web3;
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const chain = chainByKey(chainKey) || CHAINS[0];

  const pick = async (w) => {
    if (w.kind === 'solana' || w.kind === 'hardware' || w.key === 'walletconnect') {
      // Non-injected flows: still attempt EVM connect if provider exists, else inform.
      if (w.kind !== 'solana' && !window.ethereum) { setSelectorOpen(false); await connect(w.key); return; }
    }
    await connect(w.key);
    setSelectorOpen(false);
  };

  const copyAddr = () => { if (account) { navigator.clipboard?.writeText(account); setCopied(true); setTimeout(() => setCopied(false), 1400); } };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">Web3 Cüzdan</h2>
          <p className="text-xs text-muted-foreground">Çoklu zincir cüzdan bağlantısı, bakiyeler ve ağ değiştirme</p>
        </div>
        <button onClick={() => setSelectorOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
          <Wallet size={16} /> Cüzdan Bağla
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/[0.08] p-3 text-xs text-destructive">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {/* Active connection */}
      {account ? (
        <div className="glass rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: `${chain.color}22`, color: chain.color }}>
                <Wallet size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm font-bold">{shortAddr(account)}</p>
                  <button onClick={copyAddr} className="text-muted-foreground hover:text-foreground">{copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />}</button>
                  <a href={`${chain.explorer}/address/${account}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink size={13} /></a>
                </div>
                <p className="text-[11px] text-muted-foreground">{chain.name} · Bağlı</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Yerel Bakiye</p>
              <p className="font-mono text-lg font-bold text-primary">{nativeBalance.toFixed(4)} {chain.symbol}</p>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Globe size={12} /> Ağ Değiştir</p>
            <div className="flex flex-wrap gap-2">
              {CHAINS.filter((c) => c.key !== 'solana').map((c) => (
                <button key={c.key} onClick={() => switchNetwork(c.key)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                    c.key === chainKey ? 'border-primary/50 bg-primary/[0.1] text-primary' : 'border-border bg-black/25 text-muted-foreground hover:text-foreground'
                  }`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: c.color }} /> {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="glass flex flex-col items-center gap-3 rounded-2xl p-10 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/12 text-primary"><Link2 size={26} /></div>
          <p className="font-display font-bold">Cüzdan bağlı değil</p>
          <p className="max-w-sm text-sm text-muted-foreground">DeFi işlemleri, bakiye takibi ve zincir üstü analiz için bir Web3 cüzdanı bağlayın.</p>
        </div>
      )}

      {/* Saved wallets */}
      {wallets.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <p className="mb-3 font-display text-sm font-bold">Kayıtlı Cüzdanlar</p>
          <div className="space-y-2">
            {wallets.map((w) => {
              const c = chainByKey(w.chainKey) || CHAINS[0];
              return (
                <div key={w.id} className="flex items-center justify-between rounded-xl border border-border bg-black/25 p-3">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                    <div>
                      <p className="font-mono text-xs font-semibold">{shortAddr(w.address)}</p>
                      <p className="text-[10px] text-muted-foreground">{w.walletType} · {c.name} {w.primary ? '· Birincil' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${w.connected ? 'bg-primary/15 text-primary' : 'bg-black/40 text-muted-foreground'}`}>{w.connected ? 'Bağlı' : 'Kesildi'}</span>
                    {w.connected && (
                      <button onClick={() => disconnect(w.id)} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-destructive"><Power size={13} /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <WalletSelector open={selectorOpen} onClose={() => setSelectorOpen(false)} onPick={pick} connecting={connecting} />
    </div>
  );
}
