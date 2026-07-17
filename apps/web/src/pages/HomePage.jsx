import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings, LogOut, UserCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import BotIcon from '@/components/BotIcon';
import {
  LayoutDashboard, Brain, Shield, GraduationCap, Server, Bell,
  Wallet, TrendingUp, TrendingDown, Percent, Activity, Gauge, CircleDollarSign, Menu, X,
  Target, CheckCircle2, Power, ListChecks, PlugZap, Radar, Play, Square, Clock,
  PieChart, BookOpen, Layers, FlaskConical, Sparkles, LineChart, Building2, Wallet2, Coins, Landmark,
  FunctionSquare, Webhook, Trophy, Code2, BellRing,
} from 'lucide-react';
import useNotificationCenter from '@/hooks/useNotificationCenter';
import { NotificationBell } from '@/components/dashboard/NotificationCenter';
import ThemeToggle from '@/components/ThemeToggle';
import { notify } from '@/lib/notifications';
import { useTradingSystem } from '@/hooks/useTradingSystem';
import { useStrategyProfiles } from '@/hooks/useStrategyProfiles';
import { useWeb3 } from '@/hooks/useWeb3';
import { fmtUsd, fmtPrice } from '@/lib/market';
import Ticker from '@/components/dashboard/Ticker';

// Lazy-loaded heavy panels — split out of the initial bundle and mounted
// on demand behind a Suspense boundary. Only the active tab is fetched.
const NotificationCenter = lazy(() => import('@/components/dashboard/NotificationCenter'));
const Web3Panel = lazy(() => import('@/components/dashboard/Web3Panel'));
const DeFiPanel = lazy(() => import('@/components/dashboard/DeFiPanel'));
const InstitutionalPanel = lazy(() => import('@/components/dashboard/InstitutionalPanel'));
const PriceChart = lazy(() => import('@/components/dashboard/PriceChart'));
const AIEngine = lazy(() => import('@/components/dashboard/AIEngine'));
const TradesPanel = lazy(() => import('@/components/dashboard/TradesPanel'));
const RiskPanel = lazy(() => import('@/components/dashboard/RiskPanel'));
const LearningPanel = lazy(() => import('@/components/dashboard/LearningPanel'));
const ConnectionPanel = lazy(() => import('@/components/dashboard/ConnectionPanel'));
const ScannerPanel = lazy(() => import('@/components/dashboard/ScannerPanel'));
const NotificationsPanel = lazy(() => import('@/components/dashboard/NotificationsPanel'));
const PortfolioPanel = lazy(() => import('@/components/dashboard/PortfolioPanel'));
const JournalPanel = lazy(() => import('@/components/dashboard/JournalPanel'));
const StrategyProfilesPanel = lazy(() => import('@/components/dashboard/StrategyProfilesPanel'));
const AIAssistant = lazy(() => import('@/components/dashboard/AIAssistant'));
const BacktestPanel = lazy(() => import('@/components/dashboard/BacktestPanel'));
const LearningDashboard = lazy(() => import('@/components/dashboard/LearningDashboard'));
const MarketIntelligencePanel = lazy(() => import('@/components/dashboard/MarketIntelligencePanel'));
const ExchangePanel = lazy(() => import('@/components/dashboard/ExchangePanel'));
const CustomIndicatorsPanel = lazy(() => import('@/components/dashboard/CustomIndicatorsPanel'));
const WebhooksPanel = lazy(() => import('@/components/dashboard/WebhooksPanel'));
const SocialTradingPanel = lazy(() => import('@/components/dashboard/SocialTradingPanel'));
const ApiDocsPanel = lazy(() => import('@/components/dashboard/ApiDocsPanel'));
const AdvancedChartPanel = lazy(() => import('@/components/dashboard/AdvancedChartPanel'));

function PanelFallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center" role="status" aria-label="Yükleniyor">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        <span className="text-xs">Yükleniyor…</span>
      </div>
    </div>
  );
}

const NAV = [
  { id: 'dashboard', label: 'Panel', Icon: LayoutDashboard },
  { id: 'trades', label: 'Aktif İşlemler', Icon: ListChecks },
  { id: 'portfolio', label: 'Portföy', Icon: PieChart },
  { id: 'journal', label: 'İşlem Günlüğü', Icon: BookOpen },
  { id: 'strategies', label: 'Stratejiler', Icon: Layers },
  { id: 'backtest', label: 'Backtest', Icon: FlaskConical },
  { id: 'chart', label: 'Gelişmiş Grafik', Icon: LineChart },
  { id: 'aiLearning', label: 'AI Öğrenme', Icon: Sparkles },
  { id: 'intel', label: 'Piyasa İstihbaratı', Icon: LineChart },
  { id: 'exchanges', label: 'Çoklu Borsa', Icon: Building2 },
  { id: 'web3', label: 'Web3 Cüzdan', Icon: Wallet2 },
  { id: 'defi', label: 'DeFi', Icon: Coins },
  { id: 'institutional', label: 'Kurumsal', Icon: Landmark },
  { id: 'indicators', label: 'Özel İndikatör', Icon: FunctionSquare },
  { id: 'social', label: 'Sosyal Trading', Icon: Trophy },
  { id: 'webhooks', label: 'Webhook', Icon: Webhook },
  { id: 'api', label: 'Geliştirici API', Icon: Code2 },
  { id: 'scanner', label: 'Coin Arama', Icon: Radar },
  { id: 'ai', label: 'AI Motoru', Icon: Brain },
  { id: 'risk', label: 'Risk', Icon: Shield },
  { id: 'learning', label: 'Öğrenme', Icon: GraduationCap },
  { id: 'connection', label: 'Bağlantı', Icon: Server },
  { id: 'notifications', label: 'Bildirim', Icon: Bell },
  { id: 'notifCenter', label: 'Bildirim Merkezi', Icon: BellRing },
];

export default function HomePage() {
  const { user, logout } = useAuth();
  const sys = useTradingSystem();
  const sp = useStrategyProfiles(sys.setSettings);
  const web3 = useWeb3();
  const center = useNotificationCenter();
  const [view, setView] = useState('dashboard');
  const [navOpen, setNavOpen] = useState(false);

  const connected = sys.connection.connected;

  // --- Emit realtime notifications from live trading events ---
  const prevConnRef = useRef(connected);
  useEffect(() => {
    if (prevConnRef.current !== connected) {
      notify({
        type: 'system',
        title: connected ? 'Binance bağlantısı kuruldu' : 'Binance bağlantısı kesildi',
        message: connected ? `${sys.connection.mode === 'live' ? 'Live' : 'Testnet'} modunda canlı veri akışı aktif.` : 'İşlemler duraklatıldı.',
        severity: connected ? 'success' : 'warning',
      });
      prevConnRef.current = connected;
    }
  }, [connected, sys.connection.mode]);

  const seenOpenRef = useRef(null);
  useEffect(() => {
    if (seenOpenRef.current === null) { seenOpenRef.current = new Set(sys.openTrades.map((t) => t.id)); return; }
    for (const t of sys.openTrades) {
      if (!seenOpenRef.current.has(t.id)) {
        seenOpenRef.current.add(t.id);
        notify({
          type: 'trade',
          title: `Yeni işlem açıldı · ${t.symbol.replace('USDT', '')}`,
          message: `${t.side} · Giriş $${fmtPrice(t.entry)} · Güven %${t.confidence}`,
          severity: 'info',
          meta: { tradeId: t.id },
        });
      }
    }
  }, [sys.openTrades]);

  const seenClosedRef = useRef(null);
  useEffect(() => {
    if (seenClosedRef.current === null) { seenClosedRef.current = new Set(sys.closedTrades.map((t) => t.id + (t.closedAt || ''))); return; }
    for (const t of sys.closedTrades) {
      const key = t.id + (t.closedAt || '');
      if (!seenClosedRef.current.has(key)) {
        seenClosedRef.current.add(key);
        notify({
          type: 'trade',
          title: `İşlem kapandı · ${t.symbol.replace('USDT', '')}`,
          message: `${t.result || 'MANUAL'} · K/Z ${t.pnl >= 0 ? '+' : ''}$${fmtUsd(t.pnl)}`,
          severity: t.pnl >= 0 ? 'success' : 'warning',
          meta: { tradeId: t.id },
        });
      }
    }
  }, [sys.closedTrades]);

  const lossHitRef = useRef(sys.dailyLossHit);
  useEffect(() => {
    if (sys.dailyLossHit && !lossHitRef.current) {
      notify({ type: 'risk', title: 'Günlük zarar limiti', message: 'Bot durduruldu — günlük zarar limitine ulaşıldı.', severity: 'critical' });
    }
    lossHitRef.current = sys.dailyLossHit;
  }, [sys.dailyLossHit]);

  const targetRef = useRef(sys.targetReached);
  useEffect(() => {
    if (sys.targetReached && !targetRef.current) {
      notify({ type: 'performance', title: 'Kâr hedefine ulaşıldı', message: 'Günlük kâr hedefi tamamlandı.', severity: 'success' });
    }
    targetRef.current = sys.targetReached;
  }, [sys.targetReached]);

  const kpis = useMemo(() => {
    const openPnl = sys.openTrades.reduce((a, t) => a + t.pnl, 0);
    const now = Date.now();
    const dayPnl = sys.closedTrades.filter((t) => now - t.closedAt < 864e5).reduce((a, t) => a + t.pnl, 0);
    const weekPnl = sys.closedTrades.filter((t) => now - t.closedAt < 6048e5).reduce((a, t) => a + t.pnl, 0);
    const monthPnl = sys.closedTrades.reduce((a, t) => a + t.pnl, 0);
    const wins = sys.closedTrades.filter((t) => t.win).length;
    const winRate = sys.closedTrades.length ? Math.round((wins / sys.closedTrades.length) * 100) : 0;
    const totalTrades = sys.closedTrades.length + sys.openTrades.length;
    const balance = Number(sys.connection.usdtBalance) || 0;
    const equity = balance + openPnl;
    const usedRisk = Math.min(100, Math.round((sys.openTrades.length / sys.settings.maxOpenTrades) * 100));
    const dailyTarget = (sys.settings.profitTarget / 100) * sys.settings.startBalance;
    const remainingTarget = Math.max(0, dailyTarget - dayPnl);
    const lastOpenedAt = sys.openTrades.reduce((m, t) => Math.max(m, t.openedAt || 0), 0);
    return { openPnl, dayPnl, weekPnl, monthPnl, winRate, totalTrades, equity, usedRisk, dailyTarget, remainingTarget, lastOpenedAt };
  }, [sys.openTrades, sys.closedTrades, sys.connection.usdtBalance, sys.settings.maxOpenTrades, sys.settings.profitTarget, sys.settings.startBalance]);

  const botStatus = sys.targetReached
    ? { label: 'Kâr Hedefine Ulaştı', cls: 'border-accent/40 bg-accent/[0.08] text-accent' }
    : sys.dailyLossHit
    ? { label: 'Durduruldu (Zarar Limiti)', cls: 'border-destructive/40 bg-destructive/[0.08] text-destructive' }
    : sys.settings.autoTrade
    ? { label: 'Çalışıyor', cls: 'border-primary/40 bg-primary/[0.08] text-primary' }
    : { label: 'Duraklatıldı', cls: 'border-border bg-black/30 text-muted-foreground' };

  const ProfitBanner = () => sys.targetReached ? (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-3 rounded-2xl border border-accent/40 bg-accent/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <p className="font-display font-bold text-accent">Günlük kâr hedefine ulaşıldı</p>
          <p className="text-xs text-muted-foreground">Bugünkü kâr ${fmtUsd(kpis.dayPnl)} · Hedef ${fmtUsd(kpis.dailyTarget)}. Devam etmek ister misin?</p>
        </div>
      </div>
      <button onClick={sys.continueTrading}
        className="gradient-btn flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
        <Power size={15} /> Evet, devam et
      </button>
    </motion.div>
  ) : null;

  return (
    <div className="grid-bg min-h-[100dvh] text-foreground">
      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-[#06070d]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-lg border border-border p-2 lg:hidden" onClick={() => setNavOpen((o) => !o)}>
              {navOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="flex items-center gap-2.5">
              <div className="icon-badge grid h-9 w-9 place-items-center gradient-accent text-white">
                <BotIcon size={18} />
              </div>
              <div>
                <h1 className="font-display text-sm font-bold leading-none sm:text-base">TK <span className="text-primary">AI</span> FİNANCE</h1>
                <p className="text-[10px] text-muted-foreground">Kişisel Otomatik İşlem Sistemi</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <NotificationBell center={center} />
            <Link to="/account" title="Hesap Ayarları"
              className="hidden items-center gap-2 rounded-full border border-border bg-black/30 px-3 py-1.5 text-xs hover:bg-white/[0.05] sm:flex">
              <UserCircle2 size={15} className="text-primary" />
              <span className="max-w-[120px] truncate">{user?.name || user?.email}</span>
            </Link>
            <Link to="/account" aria-label="Ayarlar" className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground sm:hidden">
              <Settings size={16} />
            </Link>
            <button onClick={logout} aria-label="Çıkış" title="Çıkış Yap"
              className="rounded-lg border border-destructive/40 p-2 text-destructive hover:bg-destructive/10">
              <LogOut size={16} />
            </button>
            <div className="hidden items-center gap-2 rounded-full border border-border bg-black/30 px-3 py-1.5 text-xs sm:flex">
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-primary pulse-dot' : 'bg-muted-foreground/50'}`} />
              {connected ? `Binance ${sys.connection.mode === 'live' ? 'Live' : 'Testnet'}` : 'Bağlı değil'}
            </div>
            {connected && (
              <>
                <div className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs sm:flex ${sys.liveStatus === 'connected' ? 'border-accent/30 bg-accent/[0.07] text-accent' : 'border-border bg-black/30 text-muted-foreground'}`}>
                  <span className={`h-2 w-2 rounded-full ${sys.liveStatus === 'connected' ? 'bg-accent pulse-dot' : 'bg-muted-foreground/50'}`} />
                  {sys.liveStatus === 'connected' ? 'Binance Canlı Veri' : 'Veri bağlanıyor…'}
                </div>
                <div className="hidden items-center gap-2 rounded-full border border-primary/30 bg-primary/[0.06] px-3 py-1.5 text-xs text-primary sm:flex">
                  <span className="pulse-dot h-2 w-2 rounded-full bg-primary" /> AI {sys.settings.autoTrade ? 'Aktif' : 'Duraklatıldı'}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Toplam Bakiye</p>
                  <p className="font-mono text-sm font-bold text-primary">${fmtUsd(kpis.equity)}</p>
                </div>
              </>
            )}
          </div>
        </div>
        {connected && <Ticker prices={sys.prices} />}
      </header>

      <div className="flex">
        {/* sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-40 mt-[env(safe-area-inset-top)] flex w-64 transform flex-col border-r border-border/70 bg-[#0a0e1c]/95 p-3 pt-4 backdrop-blur-xl transition-transform lg:sticky lg:top-[97px] lg:z-10 lg:h-[calc(100dvh-97px)] lg:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
            {NAV.map(({ id, label, Icon }) => {
              const active = view === id;
              return (
                <button key={id} onClick={() => { setView(id); setNavOpen(false); }}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active ? 'nav-active' : 'text-muted-foreground hover:bg-white/[0.05] hover:text-foreground'
                  }`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition ${active ? 'bg-white/20' : 'bg-white/[0.04] text-primary/80 group-hover:bg-white/[0.08]'}`}>
                    <Icon size={15} />
                  </span>
                  <span className="truncate">{label}</span>
                  {id === 'notifications' && sys.notifications.length > 0 && (
                    <span className={`ml-auto rounded-full px-1.5 text-[10px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-primary/20 text-primary'}`}>{sys.notifications.length}</span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="mt-3 shrink-0 space-y-3">
            <div className="rounded-xl border border-border bg-black/30 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground/80">Güvenlik</p>
              <p className="mt-1 leading-relaxed">JWT · 2FA · AES-256 · Rate Limit · Audit Log aktif.</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-black/30 p-2.5">
              <div className="icon-badge grid h-9 w-9 place-items-center gradient-accent text-white">
                <BotIcon size={18} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">TK AI Bot</p>
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-400 pulse-dot' : 'bg-muted-foreground/50'}`} />
                  {connected ? 'Çevrimiçi' : 'Bağlı değil'}
                </p>
              </div>
            </div>
          </div>
        </aside>
        {navOpen && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setNavOpen(false)} />}

        {/* main */}
        <main className="min-w-0 flex-1 p-4 lg:p-6">
         <Suspense fallback={<PanelFallback />}>
          {/* Not connected: every panel is empty except the connection view */}
          {!connected && !['connection', 'web3', 'defi', 'notifCenter'].includes(view) && (
            <NotConnected onConnect={() => { setView('connection'); setNavOpen(false); }} />
          )}

          {view === 'web3' && <Web3Panel web3={web3} />}

          {view === 'defi' && <DeFiPanel web3={web3} />}

          {connected && view === 'institutional' && <InstitutionalPanel sys={sys} />}

          {connected && view === 'indicators' && <CustomIndicatorsPanel candles={sys.candles} prices={sys.prices} />}

          {connected && view === 'social' && <SocialTradingPanel />}

          {connected && view === 'webhooks' && <WebhooksPanel />}

          {connected && view === 'api' && <ApiDocsPanel />}

          {view === 'notifCenter' && <NotificationCenter center={center} />}

          {connected && view === 'dashboard' && (
            <div className="space-y-5">
              <ProfitBanner />
              <PriceCardsRow prices={sys.prices} />
              <BotControl sys={sys} botStatus={botStatus} kpis={kpis} />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat Icon={Wallet} label="Toplam Bakiye" value={`$${fmtUsd(kpis.equity)}`} sub="Öz sermaye" />
                <Stat Icon={CircleDollarSign} label="Anlık K/Z" value={`${kpis.openPnl >= 0 ? '+' : ''}${fmtUsd(kpis.openPnl)}`} pos={kpis.openPnl >= 0} sub="Açık pozisyonlar" />
                <Stat Icon={TrendingUp} label="Bugünkü Kâr" value={`${kpis.dayPnl >= 0 ? '+' : ''}${fmtUsd(kpis.dayPnl)}`} pos={kpis.dayPnl >= 0} />
                <Stat Icon={Percent} label="Kazanma Oranı" value={`%${kpis.winRate}`} sub={`${kpis.totalTrades} işlem`} />
                <Stat Icon={TrendingUp} label="Haftalık Kâr" value={`${kpis.weekPnl >= 0 ? '+' : ''}${fmtUsd(kpis.weekPnl)}`} pos={kpis.weekPnl >= 0} />
                <Stat Icon={TrendingDown} label="Aylık Kâr" value={`${kpis.monthPnl >= 0 ? '+' : ''}${fmtUsd(kpis.monthPnl)}`} pos={kpis.monthPnl >= 0} />
                <Stat Icon={Activity} label="Açık / Kapalı" value={`${sys.openTrades.length} / ${sys.closedTrades.length}`} />
                <Stat Icon={Gauge} label="Risk Kullanımı" value={`%${kpis.usedRisk}`} sub={`Maks ${sys.settings.maxOpenTrades} işlem`} />
                <Stat Icon={Target} label="Günlük Kâr Hedefi" value={`$${fmtUsd(kpis.dailyTarget)}`} sub={`%${sys.settings.profitTarget} · Başlangıç $${fmtUsd(sys.settings.startBalance)}`} />
                <Stat Icon={CircleDollarSign} label="Kalan Hedef" value={`$${fmtUsd(kpis.remainingTarget)}`} pos={kpis.remainingTarget === 0} sub={kpis.remainingTarget === 0 ? 'Hedefe ulaşıldı' : 'Kâr hedefine kalan'} />
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
                <div className="space-y-5">
                  <PriceChart candles={sys.candles} prices={sys.prices} />
                  <TradesPanel openTrades={sys.openTrades} closedTrades={sys.closedTrades} onClose={sys.closeTrade} />
                </div>
                <div className="space-y-5">
                  <AIMarketPanel prices={sys.prices} signals={sys.signals} onOpen={() => setView('ai')} />
                  <AIEngine signals={sys.signals} minConfidence={sys.settings.minConfidence} />
                </div>
              </div>
            </div>
          )}

          {connected && view === 'trades' && (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-lg font-bold">Aktif İşlemler</h2>
                <p className="text-xs text-muted-foreground">Bot tarafından açılan gerçek Binance işlemleri</p>
              </div>

              <BotControl sys={sys} botStatus={botStatus} kpis={kpis} />

              <ProfitBanner />

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat Icon={Target} label="Günlük Kâr Hedefi" value={`$${fmtUsd(kpis.dailyTarget)}`} sub={`%${sys.settings.profitTarget} · Başlangıç $${fmtUsd(sys.settings.startBalance)}`} />
                <Stat Icon={CircleDollarSign} label="Kalan Hedef" value={`$${fmtUsd(kpis.remainingTarget)}`} pos={kpis.remainingTarget === 0} sub={kpis.remainingTarget === 0 ? 'Hedefe ulaşıldı' : 'Kâr hedefine kalan'} />
                <Stat Icon={TrendingUp} label="Bugünkü Kâr" value={`${kpis.dayPnl >= 0 ? '+' : ''}${fmtUsd(kpis.dayPnl)}`} pos={kpis.dayPnl >= 0} />
                <Stat Icon={Activity} label="Açık / Kapalı" value={`${sys.openTrades.length} / ${sys.closedTrades.length}`} />
              </div>

              <TradesPanel openTrades={sys.openTrades} closedTrades={sys.closedTrades} onClose={sys.closeTrade} />
            </div>
          )}

          {connected && view === 'portfolio' && <PortfolioPanel sys={sys} />}

          {connected && view === 'journal' && <JournalPanel sys={sys} />}

          {connected && view === 'strategies' && <StrategyProfilesPanel sp={sp} />}

          {connected && view === 'backtest' && <BacktestPanel profiles={sp.profiles} connected={connected} />}

          {connected && view === 'aiLearning' && <LearningDashboard closedTrades={sys.closedTrades} />}

          {connected && view === 'chart' && <AdvancedChartPanel candles={sys.candles} prices={sys.prices} />}

          {connected && view === 'intel' && <MarketIntelligencePanel />}

          {connected && view === 'exchanges' && <ExchangePanel />}

          {connected && view === 'scanner' && (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-lg font-bold">Coin Arama & Analiz</h2>
                <p className="text-xs text-muted-foreground">Tüm coinleri tara, ara, 25 katmanlı analizi incele ve işlem aç</p>
              </div>
              <ScannerPanel prices={sys.prices} minConfidence={sys.settings.minConfidence} onOpenTrade={sys.openManualTrade} connected={connected} />
            </div>
          )}

          {connected && view === 'ai' && (
            <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
              <AIEngine signals={sys.signals} minConfidence={sys.settings.minConfidence} />
              <div className="space-y-5">
                <PriceChart candles={sys.candles} prices={sys.prices} />
                <TradesPanel openTrades={sys.openTrades} closedTrades={sys.closedTrades} onClose={sys.closeTrade} />
              </div>
            </div>
          )}

          {connected && view === 'risk' && (
            <div className="grid gap-5 lg:grid-cols-2">
              <RiskPanel settings={sys.settings} setSettings={sys.setSettings} dailyLossHit={sys.dailyLossHit} resetGuard={sys.resetGuard} />
              <TradesPanel openTrades={sys.openTrades} closedTrades={sys.closedTrades} onClose={sys.closeTrade} />
            </div>
          )}

          {connected && view === 'learning' && (
            <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
              <LearningPanel closedTrades={sys.closedTrades} />
              <TradesPanel openTrades={sys.openTrades} closedTrades={sys.closedTrades} onClose={sys.closeTrade} />
            </div>
          )}

          {view === 'connection' && (
            <div className="grid gap-5 lg:grid-cols-2">
              <ConnectionPanel connection={sys.connection} connect={sys.connect} disconnect={sys.disconnect} />
              {connected && <NotificationsPanel notifications={sys.notifications} settings={sys.settings} />}
            </div>
          )}

          {connected && view === 'notifications' && (
            <div className="grid gap-5 lg:grid-cols-2">
              <NotificationsPanel notifications={sys.notifications} settings={sys.settings} />
              <ConnectionPanel connection={sys.connection} connect={sys.connect} disconnect={sys.disconnect} />
            </div>
          )}
         </Suspense>
        </main>
      </div>

      {connected && (
        <Suspense fallback={null}>
          <AIAssistant sys={sys} activeProfile={sp.activeProfile} />
        </Suspense>
      )}

      <footer className="border-t border-border/70 px-6 py-4 text-center text-xs text-muted-foreground">
        TK AI FİNANCE · Kişisel kullanım · {new Date().getFullYear()} — Garanti kâr taahhüdü yoktur; işlemler yalnızca tanımlı strateji ve risk kuralları çerçevesinde üretilir.
      </footer>
    </div>
  );
}

const COIN_META = {
  BTCUSDT: { label: 'BTC', name: 'Bitcoin', color: '#f7931a' },
  ETHUSDT: { label: 'ETH', name: 'Ethereum', color: '#a78bfa' },
  SOLUSDT: { label: 'SOL', name: 'Solana', color: '#10b981' },
  BNBUSDT: { label: 'BNB', name: 'BNB', color: '#eab308' },
  XRPUSDT: { label: 'XRP', name: 'Ripple', color: '#38bdf8' },
  LINKUSDT: { label: 'LINK', name: 'Chainlink', color: '#2563eb' },
};

function CoinDot({ symbol, size = 34 }) {
  const m = COIN_META[symbol] || { label: symbol.replace('USDT', '').slice(0, 3), color: '#7c5cf6' };
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-display text-[11px] font-bold text-white"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${m.color}, ${m.color}bb)`, boxShadow: `0 6px 18px -8px ${m.color}` }}>
      {m.label.slice(0, 3)}
    </span>
  );
}

function PriceCardsRow({ prices }) {
  const top = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {top.map((sym) => {
        const meta = COIN_META[sym];
        const p = prices[sym] || {};
        const chg = p.change ?? 0;
        return (
          <motion.div key={sym} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="glass glass-hover rounded-2xl p-4">
            <div className="flex items-center gap-2.5">
              <CoinDot symbol={sym} />
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-bold">{meta.label}<span className="text-muted-foreground">/USDT</span></p>
                <p className="truncate text-[11px] text-muted-foreground">{meta.name}</p>
              </div>
            </div>
            <p className="mt-3 font-mono text-lg font-bold">{p.price != null ? `$${fmtPrice(p.price)}` : '—'}</p>
            <p className={`mt-0.5 font-mono text-xs font-semibold ${chg >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>
              {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}

function AIMarketPanel({ prices, signals, onOpen }) {
  const watch = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'LINKUSDT'];
  const topSignal = (signals || [])[0];
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <div className="icon-badge grid h-11 w-11 place-items-center gradient-accent text-white"><Brain size={20} /></div>
        <div>
          <h3 className="font-display text-base font-bold">AI Piyasa Analizi</h3>
          <p className="text-xs text-muted-foreground">Piyasayı analiz et, fırsatları yakala</p>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-border bg-black/25 p-3 text-xs text-muted-foreground">
        {topSignal
          ? <>En güçlü sinyal <span className="font-semibold text-foreground">{topSignal.symbol.replace('USDT', '')}</span> · {topSignal.side} · <span className="text-primary">%{topSignal.confidence}</span> güven</>
          : 'AI motoru piyasayı sürekli tarıyor. Yeni fırsatlar burada görünür.'}
      </div>
      <button onClick={onOpen} className="gradient-btn mt-3 w-full rounded-xl px-4 py-2 text-sm font-semibold">Detaylı Analiz</button>

      <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">İzleme Listesi</p>
      <div className="mt-2 space-y-1">
        {watch.map((sym) => {
          const meta = COIN_META[sym] || { label: sym.replace('USDT', ''), name: sym };
          const p = prices[sym] || {};
          const chg = p.change ?? 0;
          return (
            <div key={sym} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.04]">
              <CoinDot symbol={sym} size={30} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{meta.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{meta.label}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-semibold">{p.price != null ? `$${fmtPrice(p.price)}` : '—'}</p>
                <p className={`font-mono text-[11px] ${chg >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>{chg >= 0 ? '+' : ''}{chg.toFixed(2)}%</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BotControl({ sys, botStatus, kpis }) {
  const running = sys.settings.autoTrade && !sys.dailyLossHit && !sys.targetReached;
  const toggle = () => sys.setSettings((s) => ({ ...s, autoTrade: !s.autoTrade }));
  const lastOpen = kpis.lastOpenedAt
    ? new Date(kpis.lastOpenedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Henüz yok';
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${botStatus.cls}`}>
          <BotIcon size={13} /> Bot Durumu: {botStatus.label}
        </div>
        <button onClick={toggle}
          className={`flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:opacity-90 ${
            sys.settings.autoTrade
              ? 'bg-destructive text-destructive-foreground'
              : 'gradient-btn'
          }`}>
          {sys.settings.autoTrade ? <><Square size={15} /> Botu Durdur</> : <><Play size={15} /> Botu Başlat</>}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <BotStat label="Durum" value={running ? 'Çalışıyor' : 'Durdu'} pos={running} />
        <BotStat label="Açık İşlem" value={`${sys.openTrades.length}`} />
        <BotStat label="Günlük Kâr" value={`${kpis.dayPnl >= 0 ? '+' : ''}$${fmtUsd(kpis.dayPnl)}`} pos={kpis.dayPnl >= 0} />
        <BotStat label="Son İşlem" value={lastOpen} icon={Clock} />
      </div>
    </div>
  );
}

function BotStat({ label, value, sub, pos, icon: Icon }) {
  return (
    <div className="rounded-xl border border-border bg-black/20 p-2.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {Icon && <Icon size={11} />} {label}
      </div>
      <div className={`mt-0.5 font-mono text-sm font-bold ${pos === undefined ? 'text-foreground' : pos ? 'text-primary' : 'text-destructive'}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function NotConnected({ onConnect }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass mx-auto mt-10 flex max-w-lg flex-col items-center gap-4 rounded-2xl p-10 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20">
        <BotIcon size={40} />
      </div>
      <div>
        <h2 className="font-display text-lg font-bold">Binance bağlı değil</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sistem yalnızca gerçek Binance verisiyle çalışır. Veriler ve işlemler, hesabınızı bağladıktan sonra görüntülenir.
        </p>
      </div>
      <button onClick={onConnect}
        className="gradient-btn flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold">
        <Server size={16} /> Binance'i Bağla
      </button>
    </motion.div>
  );
}

function Stat({ Icon, label, value, sub, pos }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="card-gradient p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="icon-badge h-10 w-10">
          <Icon size={18} />
        </div>
        <span className="pt-1 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <div className={`mt-3 font-mono text-2xl font-bold tracking-tight ${pos === undefined ? 'text-foreground' : pos ? 'text-emerald-400' : 'text-destructive'}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </motion.div>
  );
}
