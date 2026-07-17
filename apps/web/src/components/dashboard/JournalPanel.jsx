import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Download, Printer, Filter, ChevronDown, Tag, GraduationCap, Brain, Search,
} from 'lucide-react';
import { fmtUsd, fmtPrice } from '@/lib/market';
import { useTradeNotes } from '@/hooks/useTradeNotes';
import CoinIcon from '@/components/CoinIcon';

function fmtDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtDur(open, close) {
  if (!open) return '—';
  const ms = (close || Date.now()) - open;
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}dk`;
  return `${Math.floor(m / 60)}sa ${m % 60}dk`;
}

const TAG_OPTIONS = ['Strateji', 'Duygusal', 'FOMO', 'Plana Uygun', 'Hatalı'];

export default function JournalPanel({ sys }) {
  const { getNote, setNote } = useTradeNotes();
  const [filters, setFilters] = useState({ q: '', side: 'all', market: 'all', status: 'all', pnl: 'all', from: '', to: '' });
  const [expanded, setExpanded] = useState(null);

  const allTrades = useMemo(() => {
    const open = sys.openTrades.map((t) => ({ ...t, _status: 'open' }));
    const closed = sys.closedTrades.map((t) => ({ ...t, _status: 'closed' }));
    return [...open, ...closed].sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0));
  }, [sys.openTrades, sys.closedTrades]);

  const rows = useMemo(() => {
    return allTrades.filter((t) => {
      if (filters.q && !t.symbol.toLowerCase().includes(filters.q.toLowerCase())) return false;
      if (filters.side !== 'all' && t.side !== filters.side) return false;
      if (filters.market !== 'all' && (t.mode === 'sim' ? 'futures' : 'futures') !== filters.market) {
        // all bot trades are futures; spot filter yields none
        if (filters.market === 'spot') return false;
      }
      if (filters.status !== 'all' && t._status !== filters.status) return false;
      if (filters.pnl === 'profit' && (t.pnl || 0) < 0) return false;
      if (filters.pnl === 'loss' && (t.pnl || 0) >= 0) return false;
      if (filters.from && (t.openedAt || 0) < new Date(filters.from).getTime()) return false;
      if (filters.to && (t.openedAt || 0) > new Date(filters.to).getTime() + 864e5) return false;
      return true;
    });
  }, [allTrades, filters]);

  const exportCsv = () => {
    const head = ['ID', 'Coin', 'Yön', 'Piyasa', 'Durum', 'Giriş Zamanı', 'Giriş', 'Miktar', 'Çıkış Zamanı', 'Çıkış', 'PnL', 'PnL %', 'RR', 'Güven', 'Süre'];
    const lines = rows.map((t) => {
      const entryVal = t.entry * t.qty;
      const pnlPct = entryVal ? ((t.pnl || 0) / entryVal) * 100 : 0;
      return [
        t.id, t.symbol, t.side, 'Futures', t._status === 'open' ? 'Açık' : 'Kapalı',
        fmtDateTime(t.openedAt), t.entry, t.qty, fmtDateTime(t.closedAt), t.exit ?? t.price ?? '',
        (t.pnl || 0).toFixed(2), pnlPct.toFixed(2), t.rr, t.confidence, fmtDur(t.openedAt, t.closedAt),
      ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
    });
    const csv = [head.join(','), ...lines].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `islem-gunlugu-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">İşlem Günlüğü</h2>
          <p className="text-xs text-muted-foreground">Her işlemin girişi, analizi, performansı ve notları</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-lg border border-border bg-black/30 px-3 py-1.5 text-xs font-semibold hover:bg-white/5"><Download size={13} /> CSV</button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg border border-border bg-black/30 px-3 py-1.5 text-xs font-semibold hover:bg-white/5"><Printer size={13} /> PDF / Yazdır</button>
        </div>
      </div>

      {/* filters */}
      <div className="glass rounded-2xl p-4 print:hidden">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Filter size={15} className="text-primary" /> Filtreler</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground" />
            <input value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Coin ara" className="w-full rounded-lg border border-border bg-black/30 py-1.5 pl-8 pr-2 text-xs outline-none focus:border-primary/40" />
          </div>
          <Sel value={filters.side} onChange={(v) => setFilters((f) => ({ ...f, side: v }))} opts={[['all', 'Tüm Yönler'], ['LONG', 'LONG'], ['SHORT', 'SHORT']]} />
          <Sel value={filters.market} onChange={(v) => setFilters((f) => ({ ...f, market: v }))} opts={[['all', 'Tüm Piyasalar'], ['futures', 'Futures'], ['spot', 'Spot']]} />
          <Sel value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} opts={[['all', 'Tüm Durumlar'], ['open', 'Açık'], ['closed', 'Kapalı']]} />
          <Sel value={filters.pnl} onChange={(v) => setFilters((f) => ({ ...f, pnl: v }))} opts={[['all', 'Tüm K/Z'], ['profit', 'Kâr'], ['loss', 'Zarar']]} />
          <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="rounded-lg border border-border bg-black/30 px-2 py-1.5 text-xs outline-none focus:border-primary/40" />
          <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="rounded-lg border border-border bg-black/30 px-2 py-1.5 text-xs outline-none focus:border-primary/40" />
        </div>
      </div>

      {/* trade list */}
      <div className="glass rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-semibold"><BookOpen size={15} className="text-primary" /> {rows.length} işlem</span>
        </div>
        {rows.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">Filtrelere uyan işlem yok.</div>}
        <div className="space-y-2">
          {rows.map((t) => {
            const note = getNote(t.id);
            const entryVal = t.entry * t.qty;
            const exitPrice = t.exit ?? t.price;
            const exitVal = (exitPrice || t.entry) * t.qty;
            const pnlPct = entryVal ? ((t.pnl || 0) / entryVal) * 100 : 0;
            const isOpen = t._status === 'open';
            const open = expanded === t.id;
            return (
              <div key={t.id} className="rounded-xl border border-border bg-black/20">
                <button onClick={() => setExpanded(open ? null : t.id)} className="flex w-full items-center gap-3 p-3 text-left">
                  <CoinIcon symbol={t.symbol} size={24} />
                  <span className="font-display text-sm font-bold">{t.symbol.replace('USDT', '')}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${t.side === 'LONG' ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive'}`}>{t.side}</span>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Futures</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${isOpen ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'}`}>{isOpen ? 'Açık' : 'Kapalı'}</span>
                  {note.learning && <span className="flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary"><GraduationCap size={10} /> Öğrenme</span>}
                  <span className="ml-auto text-[10px] text-muted-foreground">{fmtDateTime(t.openedAt)}</span>
                  <span className={`font-mono text-sm font-bold ${(t.pnl || 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>{(t.pnl || 0) >= 0 ? '+' : ''}{fmtUsd(t.pnl || 0)}</span>
                  <ChevronDown size={15} className={`text-muted-foreground transition ${open ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="grid gap-4 border-t border-border/60 p-4 md:grid-cols-3">
                        {/* entry / exit */}
                        <div>
                          <H>Giriş & Çıkış</H>
                          <KV k="Trade ID" v={t.id} />
                          <KV k="Giriş Zamanı" v={fmtDateTime(t.openedAt)} />
                          <KV k="Giriş Fiyatı" v={`$${fmtPrice(t.entry)}`} />
                          <KV k="Miktar" v={t.qty} />
                          <KV k="Çıkış Zamanı" v={fmtDateTime(t.closedAt)} />
                          <KV k="Çıkış Fiyatı" v={exitPrice ? `$${fmtPrice(exitPrice)}` : '—'} />
                          <KV k="Çıkış Sebebi" v={isOpen ? 'Pozisyon açık' : (t.result === 'TP' ? 'Take Profit' : t.result === 'SL' ? 'Stop Loss' : 'Manuel')} />
                        </div>
                        {/* analysis */}
                        <div>
                          <H>Analiz</H>
                          <KV k="Giriş Sebebi" v={t.reason || 'AI sinyali'} />
                          <KV k="Güven Skoru" v={`%${t.confidence ?? '—'}`} />
                          <KV k="Risk Skoru" v={t.riskScore ?? '—'} />
                          <KV k="RR Oranı" v={t.rr ?? '—'} />
                          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-black/30 p-2 text-[11px] leading-relaxed text-foreground/70">
                            <Brain size={13} className="mt-0.5 shrink-0 text-accent" />
                            {t.confidence >= 95 ? 'AI görüşü: Çok güçlü kurulum — çoklu katman uyumlu.' : t.confidence >= 90 ? 'AI görüşü: Güçlü sinyal, trend yönünde giriş.' : 'AI görüşü: Orta seviye kurulum.'}
                          </div>
                        </div>
                        {/* performance */}
                        <div>
                          <H>Performans</H>
                          <KV k="Giriş Değeri" v={`$${fmtUsd(entryVal)}`} />
                          <KV k="Çıkış Değeri" v={`$${fmtUsd(exitVal)}`} />
                          <KV k="PnL" v={`${(t.pnl || 0) >= 0 ? '+' : ''}$${fmtUsd(t.pnl || 0)}`} pos={(t.pnl || 0) >= 0} />
                          <KV k="PnL %" v={`${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`} pos={pnlPct >= 0} />
                          <KV k="Süre" v={fmtDur(t.openedAt, t.closedAt)} />
                        </div>
                      </div>

                      {/* notes */}
                      <div className="border-t border-border/60 p-4 print:hidden">
                        <H>Notlar & Etiketler</H>
                        <textarea value={note.text} onChange={(e) => setNote(t.id, { text: e.target.value })} placeholder="Bu işlemle ilgili notunuz…"
                          className="mt-1 w-full rounded-lg border border-border bg-black/30 p-2 text-xs outline-none focus:border-primary/40" rows={2} />
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {TAG_OPTIONS.map((tag) => {
                            const active = note.tags.includes(tag);
                            return (
                              <button key={tag} onClick={() => setNote(t.id, { tags: active ? note.tags.filter((x) => x !== tag) : [...note.tags, tag] })}
                                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${active ? 'border-primary/40 bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                                <Tag size={10} /> {tag}
                              </button>
                            );
                          })}
                          <button onClick={() => setNote(t.id, { learning: !note.learning })}
                            className={`ml-auto flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${note.learning ? 'border-accent/40 bg-accent/15 text-accent' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                            <GraduationCap size={12} /> {note.learning ? 'Öğrenme İşareti Kaldır' : 'Öğrenme Olarak İşaretle'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Sel({ value, onChange, opts }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-border bg-black/30 px-2 py-1.5 text-xs outline-none focus:border-primary/40">
      {opts.map(([v, l]) => <option key={v} value={v} className="bg-[#0b0e17]">{l}</option>)}
    </select>
  );
}

function H({ children }) {
  return <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-primary">{children}</p>;
}

function KV({ k, v, pos }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className={`font-mono ${pos === undefined ? 'text-foreground/85' : pos ? 'text-primary' : 'text-destructive'}`}>{v}</span>
    </div>
  );
}
