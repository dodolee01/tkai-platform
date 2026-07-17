import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    X, Rocket, KeyRound, SlidersHorizontal, Target, ShieldCheck, CheckCircle2,
    ArrowRight, ArrowLeft, TrendingUp, Bot, LineChart, Sparkles,
} from 'lucide-react';
import { useOnboarding } from '@/context/OnboardingContext';

const STRATEGIES = ['Başlangıç', 'Muhafazakar', 'Dengeli', 'Profesyonel', 'Usta', 'Gold', 'Elite', 'Custom'];

const FEATURES = [
    { Icon: Bot, title: 'Otomatik Bot', text: '25 katmanlı AI ile ≥%90 güvenli sinyallerde işlem açar.' },
    { Icon: LineChart, title: 'Gelişmiş Analiz', text: '10 teknik gösterge ve gerçek zamanlı piyasa istihbaratı.' },
    { Icon: ShieldCheck, title: 'Risk Yönetimi', text: 'İşlem başına risk, günlük zarar limiti ve kaldıraç kontrolü.' },
    { Icon: Sparkles, title: 'Kendi Kendine Öğrenme', text: 'Kazanan desenleri analiz eder, stratejileri iyileştirir.' },
];

const STEPS = [
    { key: 'api', title: 'Binance API Bağlantısı', Icon: KeyRound },
    { key: 'trading', title: 'İşlem Ayarları', Icon: SlidersHorizontal },
    { key: 'strategy', title: 'Strateji Seçimi', Icon: Target },
    { key: 'risk', title: 'Risk Parametreleri', Icon: ShieldCheck },
    { key: 'review', title: 'İncele & Etkinleştir', Icon: CheckCircle2 },
];

const initialData = {
    apiKey: '', apiSecret: '',
    leverage: 3, positionSize: 5,
    strategy: 'Dengeli',
    stopLoss: 2, takeProfit: 4,
};

export default function OnboardingModal() {
    const { open, dismiss, complete } = useOnboarding();
    const [phase, setPhase] = useState('welcome'); // welcome | wizard
    const [step, setStep] = useState(0);
    const [data, setData] = useState(initialData);
    const [error, setError] = useState('');

    if (!open) return null;

    const set = (k, v) => setData((d) => ({ ...d, [k]: v }));

    const validateStep = () => {
        if (STEPS[step].key === 'api') {
            if (!data.apiKey.trim() || !data.apiSecret.trim()) return 'Devam etmek için API anahtarı ve gizli anahtarı girin (veya Atla’yı kullanın).';
        }
        if (STEPS[step].key === 'trading') {
            if (data.leverage < 1 || data.leverage > 5) return 'Kaldıraç 1x–5x arasında olmalı.';
            if (data.positionSize <= 0) return 'Pozisyon büyüklüğü 0’dan büyük olmalı.';
        }
        if (STEPS[step].key === 'risk') {
            if (data.stopLoss <= 0 || data.takeProfit <= 0) return 'Stop-loss ve take-profit 0’dan büyük olmalı.';
        }
        return '';
    };

    const next = () => {
        const err = validateStep();
        if (err) { setError(err); return; }
        setError('');
        if (step < STEPS.length - 1) setStep((s) => s + 1);
        else complete(data);
    };
    const prev = () => { setError(''); setStep((s) => Math.max(0, s - 1)); };

    const overlay = (
        <div className="fixed inset-0 z-[100] grid place-items-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="glass rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto relative">
                <button onClick={dismiss} aria-label="Kapat" className="absolute right-4 top-4 z-10 h-9 w-9 grid place-items-center rounded-xl hover:bg-white/10 transition">
                    <X className="h-5 w-5" />
                </button>

                {phase === 'welcome' ? (
                    <div className="p-8 sm:p-10 text-center">
                        <span className="icon-badge h-16 w-16 mx-auto mb-5"><Rocket className="h-7 w-7" /></span>
                        <h2 className="font-display text-3xl font-extrabold tracking-tight">
                            <span className="gradient-text">TK AI FİNANCE</span>’a hoş geldiniz
                        </h2>
                        <p className="text-muted-foreground mt-3 max-w-md mx-auto">
                            Birkaç dakikada hesabınızı kurun ve yapay zeka destekli otomatik işlemin gücünü keşfedin.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2 mt-8 text-left">
                            {FEATURES.map(({ Icon, title, text }) => (
                                <div key={title} className="card-gradient p-4 flex gap-3">
                                    <span className="icon-badge h-9 w-9 shrink-0"><Icon className="h-4 w-4" /></span>
                                    <div>
                                        <p className="font-semibold text-sm">{title}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-center gap-3 mt-8">
                            <button onClick={dismiss} className="px-5 py-2.5 rounded-xl border border-white/10 text-sm hover:bg-white/5 transition">Şimdilik atla</button>
                            <button onClick={() => setPhase('wizard')} className="gradient-btn px-6 py-2.5 rounded-xl font-medium inline-flex items-center gap-2">
                                Kuruluma başla <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 sm:p-8">
                        {/* progress */}
                        <div className="flex items-center gap-2 mb-6">
                            {STEPS.map((s, i) => (
                                <div key={s.key} className="flex-1">
                                    <div className={`h-1.5 rounded-full transition ${i <= step ? 'gradient-accent' : 'bg-white/10'}`} />
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center gap-3 mb-6">
                            <span className="icon-badge h-10 w-10">{React.createElement(STEPS[step].Icon, { className: 'h-5 w-5' })}</span>
                            <div>
                                <p className="text-xs text-muted-foreground">Adım {step + 1} / {STEPS.length}</p>
                                <h3 className="font-display text-xl font-bold">{STEPS[step].title}</h3>
                            </div>
                        </div>

                        <div className="min-h-[220px]">
                            {STEPS[step].key === 'api' && (
                                <div className="space-y-4">
                                    <Input label="API Anahtarı" value={data.apiKey} onChange={(v) => set('apiKey', v)} placeholder="Binance API Key" />
                                    <Input label="Gizli Anahtar" type="password" value={data.apiSecret} onChange={(v) => set('apiSecret', v)} placeholder="Binance Secret Key" />
                                    <p className="text-xs text-muted-foreground">Anahtarlarınız sunucuda AES-256-GCM ile şifrelenir. Futures izinlerini etkinleştirin.</p>
                                </div>
                            )}
                            {STEPS[step].key === 'trading' && (
                                <div className="space-y-6">
                                    <Range label={`Kaldıraç: ${data.leverage}x`} min={1} max={5} step={1} value={data.leverage} onChange={(v) => set('leverage', v)} />
                                    <Range label={`Pozisyon büyüklüğü: %${data.positionSize}`} min={1} max={50} step={1} value={data.positionSize} onChange={(v) => set('positionSize', v)} />
                                </div>
                            )}
                            {STEPS[step].key === 'strategy' && (
                                <div className="space-y-4">
                                    <label className="block text-sm font-medium mb-1">Strateji Profili</label>
                                    <select className="input-modern w-full px-4 py-2.5 text-sm" value={data.strategy} onChange={(e) => set('strategy', e.target.value)}>
                                        {STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <p className="text-xs text-muted-foreground">Profil, risk seviyesi ve filtreleri belirler. Daha sonra Strateji bölümünden değiştirebilirsiniz.</p>
                                </div>
                            )}
                            {STEPS[step].key === 'risk' && (
                                <div className="space-y-6">
                                    <Range label={`Zarar Durdur (SL): %${data.stopLoss}`} min={0.5} max={10} step={0.5} value={data.stopLoss} onChange={(v) => set('stopLoss', v)} />
                                    <Range label={`Kâr Al (TP): %${data.takeProfit}`} min={0.5} max={20} step={0.5} value={data.takeProfit} onChange={(v) => set('takeProfit', v)} />
                                </div>
                            )}
                            {STEPS[step].key === 'review' && (
                                <div className="space-y-2 text-sm">
                                    <Row k="API Bağlantısı" v={data.apiKey ? 'Girildi' : 'Atlandı'} />
                                    <Row k="Kaldıraç" v={`${data.leverage}x`} />
                                    <Row k="Pozisyon büyüklüğü" v={`%${data.positionSize}`} />
                                    <Row k="Strateji" v={data.strategy} />
                                    <Row k="Zarar Durdur" v={`%${data.stopLoss}`} />
                                    <Row k="Kâr Al" v={`%${data.takeProfit}`} />
                                    <p className="text-xs text-muted-foreground pt-3">“Etkinleştir” ile ayarlarınız kaydedilir ve panele yönlendirilirsiniz.</p>
                                </div>
                            )}
                        </div>

                        {error && <p className="text-sm text-rose-400 mt-4">{error}</p>}

                        <div className="flex items-center justify-between mt-6">
                            <button onClick={step === 0 ? () => setPhase('welcome') : prev} className="px-4 py-2.5 rounded-xl border border-white/10 text-sm hover:bg-white/5 transition inline-flex items-center gap-1.5">
                                <ArrowLeft className="h-4 w-4" /> Geri
                            </button>
                            <div className="flex items-center gap-3">
                                <button onClick={dismiss} className="text-sm text-muted-foreground hover:text-foreground transition">Atla</button>
                                <button onClick={next} className="gradient-btn px-6 py-2.5 rounded-xl font-medium inline-flex items-center gap-2">
                                    {step === STEPS.length - 1 ? <><TrendingUp className="h-4 w-4" /> Etkinleştir</> : <>İleri <ArrowRight className="h-4 w-4" /></>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(overlay, document.body);
}

function Input({ label, value, onChange, type = 'text', placeholder }) {
    return (
        <label className="block">
            <span className="block text-sm font-medium mb-1.5">{label}</span>
            <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input-modern w-full px-4 py-2.5 text-sm" />
        </label>
    );
}

function Range({ label, min, max, step, value, onChange }) {
    return (
        <label className="block">
            <span className="block text-sm font-medium mb-2">{label}</span>
            <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[hsl(255_92%_76%)]" />
        </label>
    );
}

function Row({ k, v }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-white/5">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-medium">{v}</span>
        </div>
    );
}
