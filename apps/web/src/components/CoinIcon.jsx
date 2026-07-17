import React, { useEffect, useState } from 'react';
import { resolveCoinIconUrl, normalizeSymbol } from '@/lib/coingecko';

const SIZE_MAP = { 24: 24, 32: 32, 48: 48, sm: 24, md: 32, lg: 48 };

// Deterministic accent color for the text-fallback avatar, derived from the symbol.
function fallbackColor(symbol) {
  const hues = [262, 217, 160, 38, 0, 280, 190, 320];
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) % 360;
  const hue = hues[h % hues.length];
  return `hsl(${hue} 70% 55%)`;
}

/**
 * CoinIcon — shows a circular coin logo fetched from CoinGecko, with
 * localStorage caching and a graceful text-symbol fallback.
 *
 * Props:
 *  - symbol: trading symbol, e.g. "BTC", "BTCUSDT", "ETHUSDT"
 *  - size: 24 | 32 | 48 (px) — default 24
 *  - className: extra classes for the wrapper
 */
export default function CoinIcon({ symbol, size = 24, className = '' }) {
  const px = SIZE_MAP[size] || 24;
  const base = normalizeSymbol(symbol) || '?';
  const [src, setSrc] = useState(() => resolveCoinIconUrl(symbol));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setSrc(resolveCoinIconUrl(symbol));
  }, [symbol]);

  const showFallback = !src || failed;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden transition-transform duration-200 ease-out hover:scale-105 ${className}`}
      style={{
        width: px,
        height: px,
        boxShadow: '0 2px 8px -2px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.08)',
        background: showFallback ? fallbackColor(base) : 'rgba(255,255,255,0.04)',
      }}
      aria-label={base}
      title={base}
    >
      {showFallback ? (
        <span
          className="font-display font-semibold text-white select-none"
          style={{ fontSize: px * 0.34, lineHeight: 1 }}
        >
          {base.slice(0, px >= 48 ? 4 : 3)}
        </span>
      ) : (
        <img
          src={src}
          alt={base}
          width={px}
          height={px}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
