import { useState, useEffect, useRef, useCallback } from 'react';
import { PAIRS, buildSignal } from '@/lib/market';
import { fetchSnapshot, openStream } from '@/lib/binanceLive';
import {
  loadTrades, persistOpen, persistClose,
  connectBinance, disconnectBinance, placeBinanceOrder, fetchBinanceBalance,
} from '@/lib/tradeStore';

const SETTINGS_KEY = 'ats.settings.v2';
const CONN_KEY = 'ats.connection.v2';
const SPOT_CONN_KEY = 'ats.connection.spot.v2';

// One-time clean slate: drop legacy settings/connection state from prior versions.
try {
  ['ats.settings.v1', 'ats.connection.v1'].forEach((k) => localStorage.removeItem(k));
} catch {
  /* ignore */
}

const DEFAULT_SETTINGS = {
  minConfidence: 90,
  riskPerTrade: 0.5,
  maxDailyLoss: 5,
  maxOpenTrades: 20,
  maxLeverage: 5,
  maxPositionSize: 1500,
  maxDailyTrades: 40,
  profitTarget: 10,
  startBalance: 1000,
  autoTrade: true,
  notifyTelegram: true,
  notifyEmail: true,
  notifyWeb: true,
};

const DEFAULT_CONN = {
  mode: 'testnet',
  connected: false,
  apiKey: '',
  secretMasked: '',
  usdtBalance: null,
  usdtLocked: null,
  canTrade: null,
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

let idc = 1;

export function useTradingSystem() {
  const [settings, setSettings] = useState(() => load(SETTINGS_KEY, DEFAULT_SETTINGS));
  const [connection, setConnection] = useState(() => load(CONN_KEY, DEFAULT_CONN));
  // Fully independent Spot connection (isolated keys / balance / config).
  const [spotConnection, setSpotConnection] = useState(() => load(SPOT_CONN_KEY, DEFAULT_CONN));
  // Real Binance data only — no seeded/simulated market values.
  const [prices, setPrices] = useState({});
  const [candles, setCandles] = useState({});
  const [openTrades, setOpenTrades] = useState([]);
  const [closedTrades, setClosedTrades] = useState([]);
  const [signals, setSignals] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [dailyLossHit, setDailyLossHit] = useState(false);
  const [targetReached, setTargetReached] = useState(false);
  const [liveStatus, setLiveStatus] = useState('connecting');

  const targetReachedRef = useRef(false);
  targetReachedRef.current = targetReached;
  const dailyLossHitRef = useRef(false);
  dailyLossHitRef.current = dailyLossHit;
  const verifyingRef = useRef(false);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const pricesRef = useRef(prices);
  pricesRef.current = prices;
  const openTradesRef = useRef(openTrades);
  openTradesRef.current = openTrades;
  const connectionRef = useRef(connection);
  connectionRef.current = connection;
  const spotConnectionRef = useRef(spotConnection);
  spotConnectionRef.current = spotConnection;

  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);
  useEffect(() => {
    const { apiKey, ...safe } = connection;
    localStorage.setItem(CONN_KEY, JSON.stringify({ ...safe, apiKey: apiKey ? '***stored***' : '' }));
  }, [connection]);
  useEffect(() => {
    const { apiKey, ...safe } = spotConnection;
    localStorage.setItem(SPOT_CONN_KEY, JSON.stringify({ ...safe, apiKey: apiKey ? '***stored***' : '' }));
  }, [spotConnection]);

  // Load persisted trades once on mount.
  useEffect(() => {
    let cancelled = false;
    loadTrades()
      .then(({ open, closed }) => {
        if (cancelled) return;
        if (open.length) setOpenTrades(open);
        if (closed.length) setClosedTrades(closed);
      })
      .catch(() => { /* first run — collections may be empty */ });
    return () => { cancelled = true; };
  }, []);

  const notify = useCallback((type, title, msg) => {
    setNotifications((prev) => [
      { id: idc++, type, title, msg, at: Date.now(), read: false },
      ...prev,
    ].slice(0, 60));
  }, []);

  // Real-time Binance market data: REST snapshot + WebSocket live stream.
  useEffect(() => {
    const symbols = PAIRS.map((p) => p.symbol);
    let stream = null;
    let cancelled = false;

    (async () => {
      try {
        const snap = await fetchSnapshot(symbols, '1m', 80);
        if (cancelled) return;
        setPrices((prev) => {
          const next = { ...prev };
          for (const sym of symbols) {
            const d = snap[sym];
            if (d) next[sym] = { price: d.price, prev: d.price, change: d.change };
          }
          return next;
        });
        setCandles((prev) => {
          const next = { ...prev };
          for (const sym of symbols) {
            const d = snap[sym];
            if (d && d.candles?.length) next[sym] = d.candles;
          }
          return next;
        });
      } catch {
        if (!cancelled) notify('error', 'Snapshot Hatası', 'Binance anlık verisi alınamadı — canlı akış deneniyor.');
      }

      if (cancelled) return;

      stream = openStream(symbols, {
        interval: '1m',
        onStatus: (st) => setLiveStatus(st),
        onTicker: (symbol, t) => {
          setPrices((prev) => {
            const cur = prev[symbol];
            if (!cur) return prev;
            return { ...prev, [symbol]: { price: t.price, prev: cur.price, change: t.change } };
          });
        },
        onKline: (symbol, { candle }) => {
          setCandles((prev) => {
            const arr = prev[symbol];
            if (!arr) return prev;
            const last = arr[arr.length - 1];
            let nextArr;
            if (last && last.t === candle.t) {
              nextArr = [...arr.slice(0, -1), candle];
            } else {
              nextArr = [...arr.slice(-119), candle];
            }
            return { ...prev, [symbol]: nextArr };
          });
        },
      });
    })();

    return () => {
      cancelled = true;
      if (stream) stream.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // manage open trades against live prices
  useEffect(() => {
    setOpenTrades((prev) => {
      if (!prev.length) return prev;
      const still = [];
      for (const t of prev) {
        const price = prices[t.symbol]?.price ?? t.entry;
        const dir = t.side === 'LONG' ? 1 : -1;
        const pnl = (price - t.entry) * dir * t.qty;
        const hitTp = dir === 1 ? price >= t.tp : price <= t.tp;
        const hitSl = dir === 1 ? price <= t.sl : price >= t.sl;
        if (hitTp || hitSl) {
          const closed = {
            ...t, exit: price, pnl, closedAt: Date.now(),
            result: hitTp ? 'TP' : 'SL', win: pnl > 0,
          };
          setClosedTrades((c) => [closed, ...c].slice(0, 200));
          persistClose(closed);
          notify(hitTp ? 'tp' : 'sl',
            `${t.symbol} ${hitTp ? 'Take Profit' : 'Stop Loss'}`,
            `${t.side} pozisyon kapandı • PnL ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`);
        } else {
          still.push({ ...t, price, pnl });
        }
      }
      return still;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices]);

  // AI multi-coin scan loop — scans the whole futures universe every tick,
  // opens trades on every coin that clears the confidence threshold (up to
  // maxOpenTrades concurrently, one position per symbol).
  useEffect(() => {
    const iv = setInterval(() => {
      const s = settingsRef.current;
      const conn0 = connectionRef.current;
      let open = openTradesRef.current;

      const scanCandidates = PAIRS
        .map((pair) => {
          const price = pricesRef.current[pair.symbol]?.price;
          if (!price) return null;
          return buildSignal(pair, price);
        })
.filter(Boolean);

      if (scanCandidates.length) {
        setSignals((prev) => [...scanCandidates, ...prev].slice(0, 40));
      }

      const canTradeGlobally =
        s.autoTrade && conn0.connected && !dailyLossHitRef.current && !targetReachedRef.current;
      if (!canTradeGlobally) return;
      // Only one live account verification / order dispatch per tick to avoid
      // spamming Binance while the connection is invalid.
      if (verifyingRef.current) return;

      (async () => {
        // 1) API key validation + live balance — refuse to trade if invalid.
        verifyingRef.current = true;
        let balance;
        try {
          const bal = await fetchBinanceBalance('futures');
          if (bal.canTrade === false) {
            notify('error', 'İşlem İzni Yok', 'Binance hesabınızda işlem izni (canTrade) kapalı — işlem açılmadı.');
            return;
          }
          balance = Number(bal.usdtBalance) || 0;
          setConnection((c) => ({ ...c, usdtBalance: bal.usdtBalance, usdtLocked: bal.usdtLocked, canTrade: bal.canTrade }));
        } catch (err) {
          const m = String(err.message || err).toLowerCase();
          if (m.includes('not connected')) {
            setConnection((c) => ({ ...c, connected: false }));
            notify('error', 'Bağlantı Yok', 'Binance bağlı değil — işlem açılmadı.');
          } else {
            notify('error', 'API Anahtarı Geçersiz', 'API anahtarları doğrulanamadı — hiçbir işlem açılmadı. Lütfen bağlantıyı kontrol edin.');
          }
          return;
        }

        for (const sig of scanCandidates) {
          if (open.length >= s.maxOpenTrades) break;
          if (sig.confidence < Math.max(90, s.minConfidence)) continue;
          if (open.some((o) => o.symbol === sig.symbol)) continue;

          const conn = connectionRef.current;
          const riskAmount = (s.riskPerTrade / 100) * balance;
          const stopDist = Math.abs(sig.entry - sig.sl) || sig.entry * 0.01;
          const rawQty = riskAmount / stopDist;
          const capQty = s.maxPositionSize / sig.entry;
          const qty = +Math.min(rawQty, capQty).toFixed(4);
          if (!qty || qty <= 0) continue;

          // 2) Balance sufficiency check — never open without enough funds.
          const notional = qty * sig.entry;
          if (notional > balance) {
            notify('error', `${sig.symbol} Yetersiz Bakiye`,
              `İşlem için gereken ${notional.toFixed(2)} USDT > mevcut bakiye ${balance.toFixed(2)} USDT — işlem açılmadı.`);
            continue;
          }

          // 3) Place the real Binance order FIRST; only record the trade if it
          // actually executes. No local trade is ever created on failure.
          let r;
          try {
            r = await placeBinanceOrder({ market: 'futures', symbol: sig.symbol, side: sig.side, quantity: qty, tp: sig.tp, sl: sig.sl });
          } catch (err) {
            const msg = String(err.message || err);
            const steps = Array.isArray(err.steps) && err.steps.length ? ` Yapılması gerekenler: ${err.steps.join(' ')}` : '';
            notify('error', `${sig.symbol} Emir Hatası`, `${msg}${steps}`);
            continue;
          }

          balance -= notional;
          const trade = {
            id: `T${idc++}`,
            symbol: sig.symbol, name: sig.name, side: sig.side,
            entry: sig.entry, tp: sig.tp, sl: sig.sl, qty,
            rr: sig.rr, confidence: sig.confidence, riskScore: sig.riskScore,
            openedAt: Date.now(), price: sig.entry, pnl: 0,
            mode: conn.mode, reason: sig.reason, binanceOrderId: r.entryOrderId,
          };
          open = [trade, ...open];
          setOpenTrades((prev) => [trade, ...prev]);
          persistOpen(trade);
          notify('open', `${sig.symbol} İşlem Açıldı`,
            `${sig.side} • Güven ${sig.confidence}% • RR ${sig.rr} • Emir #${r.entryOrderId} • Risk %${s.riskPerTrade}`);
        }
      })().finally(() => { verifyingRef.current = false; });
    }, 8000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // daily loss guard
  const todayPnl = closedTrades
    .filter((t) => Date.now() - t.closedAt < 86400000)
    .reduce((a, t) => a + t.pnl, 0);

  useEffect(() => {
    // Daily loss limit = configured % of the account balance (live USDT when
    // connected, otherwise the configured starting balance).
    const balance = Number(connection.usdtBalance) || settings.startBalance || 0;
    const limit = -(settings.maxDailyLoss / 100) * balance;
    if (limit < 0 && todayPnl < limit && !dailyLossHit) {
      setDailyLossHit(true);
      notify('error', 'Günlük Zarar Limiti', 'Maksimum günlük zarar aşıldı — yeni işlem açma durduruldu.');
    }
  }, [todayPnl, settings, connection.usdtBalance, dailyLossHit, notify]);

  // daily profit target guard — pause when reached, await user approval
  useEffect(() => {
    const target = (settings.profitTarget / 100) * settings.startBalance;
    if (target > 0 && todayPnl >= target && !targetReached) {
      setTargetReached(true);
      notify('tp', 'Günlük Kâr Hedefine Ulaşıldı',
        `Bugünkü kâr $${todayPnl.toFixed(2)} · Hedef $${target.toFixed(2)}. Yeni işlemler durduruldu — devam etmek için onay bekleniyor.`);
    }
  }, [todayPnl, settings.profitTarget, settings.startBalance, targetReached, notify]);

  const continueTrading = useCallback(() => {
    setTargetReached(false);
    notify('open', 'İşleme Devam', 'Kullanıcı onayı alındı — bot yeni işlem açmaya devam ediyor.');
  }, [notify]);

  const openManualTrade = useCallback(async (sig) => {
    const conn = connectionRef.current;
    // 1) Connection check.
    if (!conn.connected) { notify('error', 'Bağlantı Yok', 'İşlem açmak için önce Binance bağlayın.'); return; }
    const s = settingsRef.current;
    // 2) Risk limit checks.
    if (dailyLossHitRef.current) { notify('error', 'Günlük Zarar Limiti', 'Zarar limiti aşıldı — işlem açılmadı.'); return; }
    if (openTradesRef.current.length >= s.maxOpenTrades) { notify('error', 'Limit Doldu', 'Maksimum açık işlem sayısına ulaşıldı.'); return; }
    if (openTradesRef.current.some((o) => o.symbol === sig.symbol)) { notify('error', sig.symbol, 'Bu coin için zaten açık işlem var.'); return; }

    // 3) API key validation + live balance fetch.
    let balance;
    try {
      const bal = await fetchBinanceBalance('futures');
      if (bal.canTrade === false) { notify('error', 'İşlem İzni Yok', 'Hesabınızda işlem izni kapalı — işlem açılmadı.'); return; }
      balance = Number(bal.usdtBalance) || 0;
      setConnection((c) => ({ ...c, usdtBalance: bal.usdtBalance, usdtLocked: bal.usdtLocked, canTrade: bal.canTrade }));
    } catch (err) {
      const m = String(err.message || err).toLowerCase();
      if (m.includes('not connected')) setConnection((c) => ({ ...c, connected: false }));
      notify('error', 'API Anahtarı Geçersiz', 'API anahtarları doğrulanamadı — işlem açılmadı.');
      return;
    }

    const riskAmount = (s.riskPerTrade / 100) * balance;
    const stopDist = Math.abs(sig.entry - sig.sl) || sig.entry * 0.01;
    const rawQty = riskAmount / stopDist;
    const capQty = s.maxPositionSize / sig.entry;
    const qty = +Math.min(rawQty, capQty).toFixed(4);
    if (!qty || qty <= 0) { notify('error', sig.symbol, 'Geçersiz işlem miktarı — işlem açılmadı.'); return; }

    // 4) Balance sufficiency check.
    const notional = qty * sig.entry;
    if (notional > balance) {
      notify('error', `${sig.symbol} Yetersiz Bakiye`,
        `Gereken ${notional.toFixed(2)} USDT > mevcut bakiye ${balance.toFixed(2)} USDT — işlem açılmadı.`);
      return;
    }

    // 5) Place real order FIRST; record trade only on success.
    let r;
    try {
      r = await placeBinanceOrder({ market: 'futures', symbol: sig.symbol, side: sig.side, quantity: qty, tp: sig.tp, sl: sig.sl });
    } catch (err) {
      const msg = String(err.message || err);
      const steps = Array.isArray(err.steps) && err.steps.length ? ` Yapılması gerekenler: ${err.steps.join(' ')}` : '';
      notify('error', `${sig.symbol} Emir Hatası`, `${msg}${steps}`);
      return;
    }

    const trade = {
      id: `T${idc++}`, symbol: sig.symbol, name: sig.name, side: sig.side,
      entry: sig.entry, tp: sig.tp, sl: sig.sl, qty,
      rr: sig.rr, confidence: sig.confidence, riskScore: sig.riskScore,
      openedAt: Date.now(), price: sig.entry, pnl: 0, mode: conn.mode, reason: sig.reason,
      binanceOrderId: r.entryOrderId,
    };
    setOpenTrades((prev) => [trade, ...prev]);
    persistOpen(trade);
    notify('open', `${sig.symbol} Manuel İşlem Açıldı`, `${sig.side} • Güven ${sig.confidence}% • Emir #${r.entryOrderId} • Entry ${sig.entry.toFixed(2)}`);
  }, [notify]);

  const closeTrade = useCallback((id) => {
    setOpenTrades((prev) => {
      const t = prev.find((x) => x.id === id);
      if (!t) return prev;
      const closed = { ...t, exit: t.price, closedAt: Date.now(), result: 'MANUAL', win: t.pnl > 0 };
      setClosedTrades((c) => [closed, ...c].slice(0, 200));
      persistClose(closed);
      notify('close', `${t.symbol} Manuel Kapatıldı`, `PnL ${t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)} USDT`);
      return prev.filter((x) => x.id !== id);
    });
  }, [notify]);

  const connect = useCallback(async (cfg) => {
    const market = cfg.market === 'spot' ? 'spot' : 'futures';
    const label = market === 'spot' ? 'Spot' : 'Futures';
    try {
      const r = await connectBinance({ market, mode: cfg.mode, apiKey: cfg.apiKey, secret: cfg.secret });
      // SINGLE API KEY SYSTEM: one credential connects BOTH Spot and Futures,
      // so reflect the connection on both connection states.
      const applied = (c) => ({
        ...c, mode: r.mode, connected: true,
        apiKey: r.apiKeyMasked || '',
        secretMasked: '••••••••••••',
        usdtBalance: r.usdtBalance ?? c.usdtBalance,
        canTrade: r.canTrade ?? c.canTrade,
      });
      setConnection(applied);
      setSpotConnection(applied);
      notify('open', `Binance ${label} Bağlandı`,
        `${r.mode === 'live' ? 'Gerçek hesap' : 'Testnet'} doğrulandı • API anahtarları AES-256 ile şifrelendi${r.usdtBalance != null ? ` • Bakiye ${r.usdtBalance} USDT` : ''}.`);
      return { ok: true };
    } catch (err) {
      setConnection((c) => ({ ...c, connected: false }));
      setSpotConnection((c) => ({ ...c, connected: false }));
      const msg = String(err.message || err);
      notify('error', 'Bağlantı Hatası', msg);
      return { ok: false, error: msg, steps: Array.isArray(err.steps) ? err.steps : null };
    }
  }, [notify]);

  const disconnect = useCallback((market = 'futures') => {
    const useMarket = market === 'spot' ? 'spot' : 'futures';
    // Single-key system: disconnecting revokes BOTH markets.
    disconnectBinance(useMarket).catch(() => {});
    const cleared = (c) => ({ ...c, connected: false, usdtBalance: null, usdtLocked: null, canTrade: null });
    setConnection(cleared);
    setSpotConnection(cleared);
    notify('disc', 'Bağlantı Kesildi', 'Binance API bağlantısı (Spot + Futures) kapatıldı.');
  }, [notify]);

  const refreshSpotBalance = useCallback(async () => {
    if (!spotConnectionRef.current.connected) return;
    try {
      const r = await fetchBinanceBalance('spot');
      setSpotConnection((c) => ({ ...c, usdtBalance: r.usdtBalance, usdtLocked: r.usdtLocked, canTrade: r.canTrade }));
    } catch (err) {
      if (String(err.message || err).toLowerCase().includes('not connected')) {
        setSpotConnection((c) => ({ ...c, connected: false, usdtBalance: null, usdtLocked: null, canTrade: null }));
      }
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!connectionRef.current.connected) return;
    try {
      const r = await fetchBinanceBalance('futures');
      setConnection((c) => ({ ...c, usdtBalance: r.usdtBalance, usdtLocked: r.usdtLocked, canTrade: r.canTrade }));
    } catch (err) {
      // Stale "connected" state from a previous session with no server-side
      // config (e.g. after a fresh deploy) — reset so the UI asks to reconnect.
      if (String(err.message || err).toLowerCase().includes('not connected')) {
        setConnection((c) => ({ ...c, connected: false, usdtBalance: null, usdtLocked: null, canTrade: null }));
      }
    }
  }, []);

  // Refresh live balance every 20s while connected.
  useEffect(() => {
    if (!connection.connected) return;
    refreshBalance();
    const iv = setInterval(refreshBalance, 20000);
    return () => clearInterval(iv);
  }, [connection.connected, refreshBalance]);

  useEffect(() => {
    if (!spotConnection.connected) return;
    refreshSpotBalance();
    const iv = setInterval(refreshSpotBalance, 20000);
    return () => clearInterval(iv);
  }, [spotConnection.connected, refreshSpotBalance]);

  return {
    settings, setSettings,
    connection, spotConnection, connect, disconnect, refreshBalance, refreshSpotBalance,
    prices, candles, liveStatus,
    openTrades, closedTrades, signals, notifications,
    todayPnl, dailyLossHit, targetReached, continueTrading, closeTrade, openManualTrade,
    markRead: () => setNotifications((p) => p.map((n) => ({ ...n, read: true }))),
    resetGuard: () => setDailyLossHit(false),
  };
}
