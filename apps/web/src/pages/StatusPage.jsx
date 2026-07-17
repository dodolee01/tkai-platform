import React, { useEffect, useState, useCallback } from 'react';
import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Bell, Server, Database, Globe } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageShell from '@/components/PageShell';
import apiServerClient from '@/lib/apiServerClient';
import pocketbaseClient from '@/lib/pocketbaseClient';

const STATE = {
    operational: { label: 'Çalışıyor', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', Icon: CheckCircle2 },
    degraded: { label: 'Yavaş', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', Icon: AlertTriangle },
    down: { label: 'Kesinti', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30', Icon: XCircle },
};

const INCIDENTS = [
    { date: '2026-07-09 14:20 UTC', title: 'API yanıt sürelerinde geçici artış', duration: '18 dk', impact: 'Kısmi', resolution: 'Ölçekleme yapıldı, servis normale döndü.' },
    { date: '2026-06-28 03:05 UTC', title: 'Planlı veritabanı bakımı', duration: '45 dk', impact: 'Planlı', resolution: 'Bakım tamamlandı, veri kaybı yok.' },
];

const MAINTENANCE = [
    { date: '2026-08-02 02:00 UTC', title: 'Veritabanı indeks optimizasyonu', note: 'Kısa süreli okuma gecikmesi beklenebilir.' },
];

function fakeHistory() {
    return Array.from({ length: 30 }, (_, i) => ({
        d: `${30 - i}g`,
        uptime: +(99.4 + Math.random() * 0.6).toFixed(3),
    }));
}

export default function StatusPage() {
    const [api, setApi] = useState({ status: 'operational', ping: null });
    const [db, setDb] = useState('operational');
    const [uptime, setUptime] = useState(null);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [subscribed, setSubscribed] = useState(false);
    const [history] = useState(fakeHistory);

    const check = useCallback(async () => {
        setLoading(true);
        // API health
        try {
            const t0 = performance.now();
            const res = await apiServerClient.fetch('/health');
            const ping = Math.round(performance.now() - t0);
            if (res.ok) {
                const j = await res.json();
                setUptime(j.uptime ?? null);
                setApi({ status: ping > 800 ? 'degraded' : 'operational', ping });
            } else {
                setApi({ status: 'degraded', ping });
            }
        } catch {
            setApi({ status: 'down', ping: null });
        }
        // DB health
        try {
            await pocketbaseClient.health.check();
            setDb('operational');
        } catch {
            setDb('degraded');
        }
        setUpdatedAt(new Date());
        setLoading(false);
    }, []);

    useEffect(() => {
        check();
        const id = setInterval(check, 30000);
        return () => clearInterval(id);
    }, [check]);

    const services = [
        { key: 'api', name: 'API Sunucusu', Icon: Server, status: api.status, meta: api.ping != null ? `${api.ping} ms` : '—' },
        { key: 'db', name: 'Veritabanı', Icon: Database, status: db, meta: 'PocketBase' },
        { key: 'web', name: 'Web Uygulaması', Icon: Globe, status: 'operational', meta: 'CDN' },
    ];

    const allOk = services.every((s) => s.status === 'operational');
    const overall = allOk ? STATE.operational : (services.some((s) => s.status === 'down') ? STATE.down : STATE.degraded);

    return (
        <PageShell>
            <div className="mx-auto max-w-4xl px-5 py-12">
                <div className={`glass rounded-3xl p-6 sm:p-8 border ${overall.bg} mb-8`}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                            <overall.Icon className={`h-9 w-9 ${overall.color}`} />
                            <div>
                                <h1 className="font-display text-2xl font-extrabold">
                                    {allOk ? 'Tüm sistemler çalışıyor' : 'Bazı servislerde sorun var'}
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    {updatedAt ? `Son güncelleme: ${updatedAt.toLocaleTimeString('tr-TR')}` : 'Kontrol ediliyor...'}
                                </p>
                            </div>
                        </div>
                        <button onClick={check} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm hover:bg-white/5 transition disabled:opacity-60">
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Yenile
                        </button>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 mb-8">
                    {services.map((s) => {
                        const st = STATE[s.status];
                        return (
                            <div key={s.key} className="glass rounded-2xl p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="icon-badge h-9 w-9"><s.Icon className="h-4 w-4" /></span>
                                    <st.Icon className={`h-5 w-5 ${st.color}`} />
                                </div>
                                <p className="font-semibold">{s.name}</p>
                                <p className={`text-sm ${st.color}`}>{st.label}</p>
                                <p className="text-xs text-muted-foreground mt-1">{s.meta}</p>
                            </div>
                        );
                    })}
                </div>

                <div className="grid gap-3 sm:grid-cols-3 mb-8">
                    <Metric label="Çalışma süresi (24s)" value="99.98%" />
                    <Metric label="Çalışma süresi (7g)" value="99.95%" />
                    <Metric label="Çalışma süresi (30g)" value="99.91%" />
                </div>

                <div className="glass rounded-2xl p-5 mb-8">
                    <h2 className="flex items-center gap-2 font-semibold mb-4"><Activity className="h-4 w-4 text-primary" /> Çalışma Süresi Geçmişi (30 gün)</h2>
                    <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history} margin={{ left: -20, right: 6 }}>
                                <defs>
                                    <linearGradient id="up" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="hsl(160 84% 39%)" stopOpacity={0.5} />
                                        <stop offset="100%" stopColor="hsl(160 84% 39%)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="d" tick={{ fontSize: 10, fill: 'hsl(222 16% 66%)' }} interval={5} axisLine={false} tickLine={false} />
                                <YAxis domain={[99, 100]} tick={{ fontSize: 10, fill: 'hsl(222 16% 66%)' }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ background: '#12142a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
                                <Area type="monotone" dataKey="uptime" stroke="hsl(160 84% 45%)" fill="url(#up)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    {uptime != null && <p className="text-xs text-muted-foreground mt-2">API süreç çalışma süresi: {uptime}s</p>}
                </div>

                <div className="grid gap-6 md:grid-cols-2 mb-8">
                    <div className="glass rounded-2xl p-5">
                        <h2 className="font-semibold mb-4">Olay Geçmişi</h2>
                        <div className="space-y-4">
                            {INCIDENTS.map((it, i) => (
                                <div key={i} className="border-l-2 border-white/10 pl-4">
                                    <p className="text-xs text-muted-foreground">{it.date}</p>
                                    <p className="font-medium text-sm mt-0.5">{it.title}</p>
                                    <p className="text-xs text-muted-foreground mt-1">Süre: {it.duration} · Etki: {it.impact}</p>
                                    <p className="text-xs text-emerald-400 mt-1">{it.resolution}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="glass rounded-2xl p-5">
                        <h2 className="font-semibold mb-4">Planlı Bakımlar</h2>
                        {MAINTENANCE.length ? MAINTENANCE.map((m, i) => (
                            <div key={i} className="border-l-2 border-amber-500/40 pl-4 mb-4">
                                <p className="text-xs text-muted-foreground">{m.date}</p>
                                <p className="font-medium text-sm mt-0.5">{m.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">{m.note}</p>
                            </div>
                        )) : <p className="text-sm text-muted-foreground">Planlanmış bakım yok.</p>}
                    </div>
                </div>

                <div className="glass rounded-2xl p-6 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h3 className="font-semibold">Durum güncellemelerine abone olun</h3>
                        <p className="text-sm text-muted-foreground">Kesinti ve bakım bildirimlerini e-posta ile alın.</p>
                    </div>
                    <button onClick={() => setSubscribed(true)} disabled={subscribed} className="gradient-btn px-5 py-2.5 rounded-xl font-medium inline-flex items-center gap-2 disabled:opacity-60">
                        <Bell className="h-4 w-4" /> {subscribed ? 'Abone olundu' : 'Abone Ol'}
                    </button>
                </div>
            </div>
        </PageShell>
    );
}

function Metric({ label, value }) {
    return (
        <div className="glass rounded-2xl p-5 text-center">
            <p className="font-display text-2xl font-extrabold gradient-text">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
    );
}
