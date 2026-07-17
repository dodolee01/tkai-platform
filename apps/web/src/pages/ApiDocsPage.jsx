import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import apiServerClient from '@/lib/apiServerClient';
import {
    ArrowLeft, Play, Copy, Check, Terminal, KeyRound,
    Zap, Shield, BookOpen, ChevronRight,
} from 'lucide-react';

const METHOD_COLORS = {
    GET: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
    POST: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
    PUT: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
    DELETE: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
};

const GROUPS = [
    {
        name: 'Kimlik Doğrulama',
        items: [
            { m: 'POST', p: '/v1/auth/register', d: 'Yeni kullanıcı kaydı', body: '{ "email": "you@mail.com", "password": "secret123", "name": "Trader" }' },
            { m: 'POST', p: '/v1/auth/login', d: 'Giriş — token döner', body: '{ "email": "you@mail.com", "password": "secret123" }' },
            { m: 'POST', p: '/v1/auth/logout', d: 'Çıkış (istemci token siler)' },
        ],
    },
    {
        name: 'Kullanıcı',
        items: [
            { m: 'GET', p: '/v1/user/profile', d: 'Profil bilgisi', auth: true },
            { m: 'PUT', p: '/v1/user/profile', d: 'Profil güncelle', auth: true, body: '{ "name": "New Name" }' },
        ],
    },
    {
        name: 'Portföy',
        items: [
            { m: 'GET', p: '/v1/portfolio', d: 'Portföy özeti (PnL, kazanma oranı)', try: true },
            { m: 'GET', p: '/v1/portfolio/balance', d: 'Bağlantı & bakiye durumu', auth: true },
            { m: 'GET', p: '/v1/portfolio/positions', d: 'Açık pozisyonlar', try: true },
        ],
    },
    {
        name: 'İşlemler & Emirler',
        items: [
            { m: 'GET', p: '/v1/trades?page=1&perPage=20', d: 'İşlem geçmişi (sayfalı)', try: true },
            { m: 'GET', p: '/v1/trades/:id', d: 'İşlem detayı' },
            { m: 'POST', p: '/v1/spot/order', d: 'Spot emir oluştur', auth: true, body: '{ "symbol": "BTCUSDT", "side": "BUY", "qty": 0.001 }' },
            { m: 'POST', p: '/v1/futures/order', d: 'Futures emir oluştur', auth: true, body: '{ "symbol": "BTCUSDT", "side": "SELL", "qty": 0.01 }' },
            { m: 'GET', p: '/v1/orders', d: 'Emirleri listele', try: true },
            { m: 'GET', p: '/v1/orders/:id', d: 'Emir detayı' },
            { m: 'DELETE', p: '/v1/orders/:id', d: 'Emri iptal et', auth: true },
        ],
    },
    {
        name: 'Piyasa Verisi',
        items: [
            { m: 'GET', p: '/v1/market/ticker?symbol=BTCUSDT', d: '24s ticker (Binance)', try: true },
            { m: 'GET', p: '/v1/market/klines?symbol=BTCUSDT&interval=1h&limit=100', d: 'Mum verisi (OHLCV)', try: true },
        ],
    },
    {
        name: 'Stratejiler',
        items: [
            { m: 'GET', p: '/v1/strategies', d: 'Stratejileri listele', try: true },
            { m: 'GET', p: '/v1/strategies/:id', d: 'Strateji detayı' },
            { m: 'POST', p: '/v1/strategies', d: 'Strateji oluştur', auth: true, body: '{ "key": "my-strat", "name": "My Strategy", "riskLevel": 5 }' },
            { m: 'PUT', p: '/v1/strategies/:id', d: 'Strateji güncelle', auth: true },
            { m: 'DELETE', p: '/v1/strategies/:id', d: 'Strateji sil', auth: true },
        ],
    },
    {
        name: 'Backtest & Analitik',
        items: [
            { m: 'GET', p: '/v1/backtest', d: 'Backtest sonuçları', try: true },
            { m: 'POST', p: '/v1/backtest', d: 'Backtest kaydet', auth: true, body: '{ "label": "Run 1", "symbol": "BTCUSDT", "timeframe": "1h" }' },
            { m: 'GET', p: '/v1/analytics', d: 'Performans analitiği', try: true },
            { m: 'GET', p: '/v1/risk', d: 'Risk metrikleri', try: true },
        ],
    },
    {
        name: 'Uyarılar & Webhook',
        items: [
            { m: 'GET', p: '/v1/alerts', d: 'Uyarıları listele', try: true },
            { m: 'POST', p: '/v1/alerts', d: 'Uyarı oluştur', auth: true, body: '{ "title": "BTC 100k", "symbol": "BTCUSDT", "severity": "warning" }' },
            { m: 'DELETE', p: '/v1/alerts/:id', d: 'Uyarı sil', auth: true },
            { m: 'POST', p: '/v1/webhook/signal', d: 'Gelen sinyal (TradingView)', body: '{ "symbol": "BTCUSDT", "action": "buy" }' },
        ],
    },
];

function CodeBlock({ text }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard?.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
        });
    };
    return (
        <div className="relative group">
            <pre className="font-mono text-[12px] leading-relaxed text-slate-300 bg-black/40 border border-white/5 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap">{text}</pre>
            <button onClick={copy} className="absolute top-2 right-2 p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-slate-400 opacity-0 group-hover:opacity-100 transition">
                {copied ? <Check size={13} className="text-violet-400" /> : <Copy size={13} />}
            </button>
        </div>
    );
}

function Endpoint({ item, token }) {
    const [open, setOpen] = useState(false);
    const [resp, setResp] = useState(null);
    const [loading, setLoading] = useState(false);

    const run = async () => {
        setLoading(true);
        setResp(null);
        try {
            const path = item.p.split('#')[0];
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const r = await apiServerClient.fetch(path, { headers });
            const j = await r.json();
            setResp({ status: r.status, body: JSON.stringify(j, null, 2) });
        } catch (e) {
            setResp({ status: 'ERR', body: String(e) });
        } finally {
            setLoading(false);
        }
    };

    const curl = `curl -s "${window.location.origin}/hcgi/api${item.p}"${item.auth ? ` \\\n  -H "Authorization: Bearer $TOKEN"` : ''}${item.body ? ` \\\n  -X ${item.m} -H "Content-Type: application/json" \\\n  -d '${item.body}'` : (item.m !== 'GET' ? ` \\\n  -X ${item.m}` : '')}`;

    return (
        <div className="glass rounded-xl overflow-hidden">
            <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition">
                <span className={`font-mono text-[11px] font-bold px-2 py-1 rounded-md border ${METHOD_COLORS[item.m]}`}>{item.m}</span>
                <code className="font-mono text-[13px] text-slate-200 flex-1 truncate">{item.p}</code>
                {item.auth && <KeyRound size={13} className="text-amber-400/70 shrink-0" title="Kimlik doğrulama gerekli" />}
                <ChevronRight size={15} className={`text-slate-500 transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>
            {open && (
                <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                    <p className="text-sm text-slate-400">{item.d}</p>
                    {item.body && (
                        <div>
                            <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">İstek gövdesi</div>
                            <CodeBlock text={item.body} />
                        </div>
                    )}
                    <div>
                        <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">cURL</div>
                        <CodeBlock text={curl} />
                    </div>
                    {item.try && (
                        <div>
                            <button onClick={run} disabled={loading} className="inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-300 hover:bg-violet-500/25 transition disabled:opacity-50">
                                <Play size={13} /> {loading ? 'Çalışıyor…' : 'Dene'}
                            </button>
                            {resp && (
                                <div className="mt-2">
                                    <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Yanıt · {resp.status}</div>
                                    <CodeBlock text={resp.body.length > 4000 ? resp.body.slice(0, 4000) + '\n…' : resp.body} />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function ApiDocsPage() {
    const [token, setToken] = useState('');

    return (
        <div className="min-h-screen grid-bg text-slate-100">
            <div className="max-w-4xl mx-auto px-5 py-10">
                <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-violet-300 transition mb-8">
                    <ArrowLeft size={15} /> Panele dön
                </Link>

                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30">
                        <Terminal size={22} className="text-violet-300" />
                    </div>
                    <div>
                        <h1 className="font-display text-2xl font-bold">TK AI FİNANCE — REST API</h1>
                        <p className="text-sm text-slate-400 font-mono">v1 · taban: <span className="text-violet-300">/hcgi/api</span></p>
                    </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-3 my-6">
                    {[
                        { icon: Shield, t: 'JWT & API Key', d: 'Bearer token veya X-API-Key' },
                        { icon: Zap, t: 'Rate Limit', d: '120 istek / dakika' },
                        { icon: BookOpen, t: '30+ uç nokta', d: 'İşlem, piyasa, strateji' },
                    ].map((f) => (
                        <div key={f.t} className="glass rounded-xl p-4">
                            <f.icon size={18} className="text-violet-300 mb-2" />
                            <div className="text-sm font-semibold">{f.t}</div>
                            <div className="text-xs text-slate-400">{f.d}</div>
                        </div>
                    ))}
                </div>

                <div className="glass rounded-xl p-4 mb-8">
                    <div className="flex items-center gap-2 mb-2">
                        <KeyRound size={15} className="text-amber-400" />
                        <span className="text-sm font-semibold">Kimlik doğrulama</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">
                        <code className="text-violet-300">POST /v1/auth/login</code> ile bir token alın, aşağıya yapıştırın. "Dene" butonları bu token'ı kullanır.
                    </p>
                    <input
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Bearer token yapıştır (opsiyonel)…"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/40"
                    />
                </div>

                <div className="space-y-8">
                    {GROUPS.map((g) => (
                        <section key={g.name}>
                            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">{g.name}</h2>
                            <div className="space-y-2">
                                {g.items.map((it) => (
                                    <Endpoint key={it.m + it.p} item={it} token={token} />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                <p className="text-center text-xs text-slate-600 mt-12 font-mono">
                    TK AI FİNANCE API v1 · tüm yanıtlar {'{ success, data, meta }'} zarfı ile döner
                </p>
            </div>
        </div>
    );
}
