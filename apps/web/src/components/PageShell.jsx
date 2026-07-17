import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft, LifeBuoy, HelpCircle, MessageSquareText, Activity,
    BookOpen, ChevronDown, TrendingUp, Rocket,
} from 'lucide-react';
import { useOnboarding } from '@/context/OnboardingContext';
import ThemeToggle from '@/components/ThemeToggle';

const HELP_LINKS = [
    { to: '/support', label: 'Destek', icon: MessageSquareText },
    { to: '/faq', label: 'SSS', icon: HelpCircle },
    { to: '/help', label: 'Yardım Merkezi', icon: LifeBuoy },
    { to: '/status', label: 'Sistem Durumu', icon: Activity },
    { to: '/api-docs', label: 'API Dokümantasyonu', icon: BookOpen },
];

export function PageHeader() {
    const [open, setOpen] = useState(false);
    const { openOnboarding } = useOnboarding();
    return (
        <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur-xl bg-[#0b1020]/70">
            <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2 group">
                    <span className="icon-badge h-9 w-9"><TrendingUp className="h-5 w-5" strokeWidth={2} /></span>
                    <span className="font-display font-extrabold text-lg tracking-tight">
                        TK <span className="gradient-text">AI FİNANCE</span>
                    </span>
                </Link>
                <nav className="flex items-center gap-1">
                    <ThemeToggle className="mr-1" />
                    <Link to="/" className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition">
                        <ArrowLeft className="h-4 w-4" /> Panele Dön
                    </Link>
                    <div className="relative" onMouseLeave={() => setOpen(false)}>
                        <button
                            onClick={() => setOpen((v) => !v)}
                            onMouseEnter={() => setOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium hover:bg-white/5 transition"
                        >
                            <LifeBuoy className="h-4 w-4 text-primary" /> Yardım
                            <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
                        </button>
                        {open && (
                            <div className="absolute right-0 top-full mt-1 w-56 glass rounded-2xl p-2">
                                {HELP_LINKS.map(({ to, label, icon: Icon }) => (
                                    <Link key={to} to={to} onClick={() => setOpen(false)}
                                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm hover:bg-white/5 transition">
                                        <Icon className="h-4 w-4 text-primary" /> {label}
                                    </Link>
                                ))}
                                <button
                                    onClick={() => { setOpen(false); openOnboarding(); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm hover:bg-white/5 transition"
                                >
                                    <Rocket className="h-4 w-4 text-primary" /> Kurulum Sihirbazı
                                </button>
                            </div>
                        )}
                    </div>
                </nav>
            </div>
        </header>
    );
}

export function PageFooter() {
    const year = new Date().getFullYear();
    return (
        <footer className="border-t border-white/10 mt-16">
            <div className="mx-auto max-w-6xl px-5 py-10 grid gap-8 sm:grid-cols-2 md:grid-cols-4">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="icon-badge h-8 w-8"><TrendingUp className="h-4 w-4" /></span>
                        <span className="font-display font-bold">TK AI FİNANCE</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Yapay zeka destekli otomatik kripto işlem platformu.
                    </p>
                </div>
                <div>
                    <h4 className="font-semibold mb-3 text-sm">Yardım</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        <li><Link to="/support" className="hover:text-foreground transition">Destek</Link></li>
                        <li><Link to="/faq" className="hover:text-foreground transition">SSS</Link></li>
                        <li><Link to="/help" className="hover:text-foreground transition">Yardım Merkezi</Link></li>
                        <li><Link to="/status" className="hover:text-foreground transition">Sistem Durumu</Link></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-semibold mb-3 text-sm">Kaynaklar</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        <li><Link to="/api-docs" className="hover:text-foreground transition">API Dokümantasyonu</Link></li>
                        <li><Link to="/help" className="hover:text-foreground transition">Dökümanlar</Link></li>
                        <li><Link to="/" className="hover:text-foreground transition">Panel</Link></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-semibold mb-3 text-sm">Yasal</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        <li><Link to="/legal/terms" className="hover:text-foreground transition">Kullanım Şartları</Link></li>
                        <li><Link to="/legal/privacy" className="hover:text-foreground transition">Gizlilik Politikası</Link></li>
                        <li><Link to="/legal/cookies" className="hover:text-foreground transition">Çerez Politikası</Link></li>
                    </ul>
                </div>
            </div>
            <div className="border-t border-white/10">
                <div className="mx-auto max-w-6xl px-5 py-5 text-xs text-muted-foreground">
                    © {year} TK AI FİNANCE. Tüm hakları saklıdır.
                </div>
            </div>
        </footer>
    );
}

export default function PageShell({ children }) {
    return (
        <div className="min-h-[100dvh] grid-bg flex flex-col">
            <PageHeader />
            <main className="flex-1">{children}</main>
            <PageFooter />
        </div>
    );
}
