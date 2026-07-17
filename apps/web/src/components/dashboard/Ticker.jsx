import React from 'react';
import { PAIRS, fmtPrice } from '@/lib/market';
import CoinIcon from '@/components/CoinIcon';

export default function Ticker({ prices }) {
  const items = PAIRS.map((p) => ({ ...p, price: undefined, change: 0, ...prices[p.symbol] }));
  const doubled = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-border/60 bg-black/30 py-2.5">
      <div className="ticker-track flex w-max gap-10 whitespace-nowrap px-6">
        {doubled.map((it, i) => (
          <div key={i} className="flex items-center gap-2 font-mono text-sm">
            <CoinIcon symbol={it.symbol} size={24} />
            <span className="font-semibold text-foreground/90">{it.symbol.replace('USDT', '')}</span>
            <span className="text-foreground/70">{it.price != null ? `$${fmtPrice(it.price)}` : '—'}</span>
            <span className={(it.change ?? 0) >= 0 ? 'text-primary' : 'text-destructive'}>
              {(it.change ?? 0) >= 0 ? '+' : ''}{(it.change ?? 0).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
