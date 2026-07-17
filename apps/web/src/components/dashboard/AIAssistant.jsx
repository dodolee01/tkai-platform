import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Trash2, Minus, Sparkles } from 'lucide-react';
import { API_SERVER_URL } from '@/lib/apiServerClient';
import { fmtUsd } from '@/lib/market';

const HISTORY_KEY = 'ats.aiChat.v1';

const SUGGESTIONS = [
  'Bugün ne kadar kazandım?',
  'Kazanma oranım nedir?',
  'En büyük riskim ne?',
  'Hangi coin en iyi performansı gösterdi?',
  'Kaldıracımı azaltmalı mıyım?',
  'Hangi stratejiyi kullanıyorum?',
];

function buildContext(sys, activeProfile) {
  const now = Date.now();
  const openPnl = sys.openTrades.reduce((a, t) => a + (t.pnl || 0), 0);
  const closed = sys.closedTrades;
  const wins = closed.filter((t) => t.win).length;
  const winRate = closed.length ? Math.round((wins / closed.length) * 100) : 0;
  const dayPnl = closed.filter((t) => now - t.closedAt < 864e5).reduce((a, t) => a + t.pnl, 0);
  const weekPnl = closed.filter((t) => now - t.closedAt < 6048e5).reduce((a, t) => a + t.pnl, 0);
  const futCash = Number(sys.connection?.usdtBalance) || 0;
  const spotCash = Number(sys.spotConnection?.usdtBalance) || 0;
  const s = sys.settings;
  const notional = sys.openTrades.reduce((a, t) => a + t.entry * t.qty, 0);
  const coinPnl = {};
  for (const t of closed) { const k = t.symbol.replace('USDT', ''); coinPnl[k] = (coinPnl[k] || 0) + t.pnl; }
  const ranked = Object.entries(coinPnl).sort((a, b) => b[1] - a[1]);

  const lines = [
    '[CANLI VERİ]',
    `Bağlantı: ${sys.connection?.connected ? `Bağlı (${sys.connection.mode})` : 'Bağlı değil'}`,
    `Bot durumu: ${s.autoTrade ? 'Çalışıyor' : 'Duraklatıldı'}${sys.targetReached ? ' (kâr hedefine ulaştı)' : ''}${sys.dailyLossHit ? ' (zarar limiti)' : ''}`,
    `Aktif strateji: ${activeProfile ? `${activeProfile.name} (risk ${activeProfile.riskLevel}/10)` : 'yok'}`,
    `Toplam bakiye: $${fmtUsd(spotCash + futCash + openPnl)} (Spot $${fmtUsd(spotCash)}, Futures $${fmtUsd(futCash)})`,
    `Anlık açık K/Z: ${openPnl >= 0 ? '+' : ''}$${fmtUsd(openPnl)}`,
    `Bugünkü K/Z: ${dayPnl >= 0 ? '+' : ''}$${fmtUsd(dayPnl)} · Haftalık: ${weekPnl >= 0 ? '+' : ''}$${fmtUsd(weekPnl)}`,
    `Kazanma oranı: %${winRate} (${closed.length} kapalı işlem, ${wins} kazanan)`,
    `Açık işlem sayısı: ${sys.openTrades.length} · Toplam maruziyet: $${fmtUsd(notional)}`,
    `Günlük kâr hedefi: %${s.profitTarget} · Günlük zarar limiti: %${s.maxDailyLoss}`,
    `Ayarlar: kaldıraç ${s.maxLeverage}x, işlem başına risk %${s.riskPerTrade}, güven eşiği %${s.minConfidence}, maks açık işlem ${s.maxOpenTrades}`,
  ];
  if (ranked.length) {
    lines.push(`En iyi coin: ${ranked[0][0]} (${ranked[0][1] >= 0 ? '+' : ''}$${fmtUsd(ranked[0][1])})`);
    lines.push(`En kötü coin: ${ranked[ranked.length - 1][0]} ($${fmtUsd(ranked[ranked.length - 1][1])})`);
  }
  if (sys.openTrades.length) {
    lines.push('Açık pozisyonlar:');
    sys.openTrades.slice(0, 10).forEach((t) => {
      lines.push(`- ${t.symbol.replace('USDT', '')} ${t.side} giriş $${t.entry} güncel $${t.price} K/Z ${t.pnl >= 0 ? '+' : ''}$${fmtUsd(t.pnl)} güven %${t.confidence} sebep: ${t.reason || '—'}`);
    });
  }
  return lines.join('\n');
}

function renderMd(text) {
  // lightweight markdown: bold, inline code, bullet lines
  const html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="rounded bg-black/40 px-1 py-0.5 text-primary">$1</code>')
    .replace(/^### (.*)$/gm, '<div class="mt-2 font-display font-bold text-foreground">$1</div>')
    .replace(/^## (.*)$/gm, '<div class="mt-2 font-display font-bold text-foreground">$1</div>')
    .replace(/^[-*] (.*)$/gm, '<div class="flex gap-1.5"><span class="text-primary">•</span><span>$1</span></div>')
    .replace(/\n/g, '<br/>');
  return { __html: html };
}

export default function AIAssistant({ sys, activeProfile }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef(null);
  const abortRef = useRef(null);
  const convIdRef = useRef(null);

  const sysRef = useRef(sys); sysRef.current = sys;
  const profileRef = useRef(activeProfile); profileRef.current = activeProfile;

  useEffect(() => { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-50))); } catch { /* ignore */ } }, [messages]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(async (text) => {
    const q = (text ?? input).trim();
    if (!q || streaming) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: q }, { role: 'assistant', content: '' }]);
    setStreaming(true);
    const abort = new AbortController();
    abortRef.current = abort;

    const context = buildContext(sysRef.current, profileRef.current);

    try {
      const response = await fetch(`${API_SERVER_URL}/claude/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ message: q, context, conversationId: convIdRef.current }),
        signal: abort.signal,
      });
      if (!response.ok) {
        let msg = `Yanıt alınamadı (${response.status})`;
        try { const j = await response.json(); msg = j.error || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const ev of events) {
          const dataLine = ev.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('');
          if (!dataLine) continue;
          let parsed;
          try { parsed = JSON.parse(dataLine); } catch { continue; }
          if (parsed.type === 'error') throw new Error(parsed.data?.content || 'Hata');
          if (parsed.type === 'completed') { if (parsed.conversationId) convIdRef.current = parsed.conversationId; setStreaming(false); return; }
          if (parsed.type === 'content') {
            setMessages((prev) => {
              const u = [...prev];
              u[u.length - 1] = { ...u[u.length - 1], content: u[u.length - 1].content + parsed.data.content };
              return u;
            });
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setMessages((prev) => {
        const u = [...prev];
        const last = u[u.length - 1];
        u[u.length - 1] = { ...last, content: last.content || `Yanıt alınamadı: ${err.message}` };
        return u;
      });
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }, [input, streaming]);

  const clear = () => { setMessages([]); try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ } };

  return (
    <>
      <button onClick={() => setOpen((o) => !o)} aria-label="AI Asistan"
        className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_18px_40px_-12px_rgba(16,185,129,0.6)] transition hover:scale-105 active:scale-95">
        {open ? <X size={22} /> : <Bot size={24} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}
            className="glass fixed bottom-24 right-5 z-50 flex h-[70vh] max-h-[560px] w-[calc(100vw-2.5rem)] max-w-[400px] flex-col overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-border/70 bg-black/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/15 text-primary"><Sparkles size={16} /></div>
                <div>
                  <p className="font-display text-sm font-bold leading-none">AI Asistan</p>
                  <p className="text-[10px] text-muted-foreground">Portföyün hakkında sor</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={clear} title="Geçmişi Temizle" className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive"><Trash2 size={15} /></button>
                <button onClick={() => setOpen(false)} title="Küçült" className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"><Minus size={15} /></button>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Merhaba! Portföyün, işlemlerin, riskin ve stratejin hakkında her şeyi sorabilirsin.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => send(s)}
                        className="rounded-lg border border-border bg-black/20 px-2.5 py-1.5 text-[11px] text-foreground/80 transition hover:border-primary/40 hover:text-primary">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-primary/15 text-foreground' : 'border border-border bg-black/20 text-foreground/90'}`}>
                    {m.role === 'assistant' && !m.content && streaming
                      ? <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-primary" />
                      : <div className="leading-relaxed [&_code]:font-mono" dangerouslySetInnerHTML={renderMd(m.content)} />}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2 border-t border-border/70 p-3">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Bir soru sor…"
                className="flex-1 rounded-xl border border-border bg-black/30 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <button type="submit" disabled={streaming || !input.trim()}
                className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40">
                <Send size={16} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
