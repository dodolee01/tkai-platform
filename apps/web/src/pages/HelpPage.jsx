import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, FileText, Star, Clock, ArrowRight, MessageSquareText } from 'lucide-react';
import PageShell from '@/components/PageShell';
import { ARTICLES, HELP_CATEGORIES } from '@/lib/helpContent';

export default function HelpPage() {
    const [query, setQuery] = useState('');
    const [cat, setCat] = useState('all');

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        let list = ARTICLES.filter((a) => (cat === 'all' || a.category === cat));
        if (q) {
            list = list.filter((a) =>
                a.title.toLowerCase().includes(q) ||
                a.excerpt.toLowerCase().includes(q) ||
                a.content.join(' ').toLowerCase().includes(q));
        }
        return list;
    }, [query, cat]);

    const popular = ARTICLES.filter((a) => a.popular).slice(0, 4);
    const recent = [...ARTICLES].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 4);

    return (
        <PageShell>
            <div className="mx-auto max-w-5xl px-5 py-12">
                <div className="text-center mb-8">
                    <p className="text-sm text-primary font-medium mb-2">Yardım Merkezi</p>
                    <h1 className="font-display text-4xl font-extrabold tracking-tight">Dökümanlar & Rehberler</h1>
                    <p className="text-muted-foreground mt-3">{ARTICLES.length} makale, {HELP_CATEGORIES.length} kategori.</p>
                </div>

                <div className="relative mb-8 max-w-2xl mx-auto">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Makale ara..." className="input-modern w-full pl-12 pr-4 py-3.5 text-sm" />
                </div>

                <div className="flex flex-wrap gap-2 mb-10 justify-center">
                    <Chip active={cat === 'all'} onClick={() => setCat('all')}>Tümü</Chip>
                    {HELP_CATEGORIES.map((c) => (
                        <Chip key={c.key} active={cat === c.key} onClick={() => setCat(c.key)}>{c.label}</Chip>
                    ))}
                </div>

                {!query && cat === 'all' && (
                    <div className="grid gap-6 md:grid-cols-2 mb-10">
                        <Section title="Popüler Makaleler" icon={Star}>
                            {popular.map((a) => <ArticleRow key={a.id} a={a} />)}
                        </Section>
                        <Section title="Son Güncellenenler" icon={Clock}>
                            {recent.map((a) => <ArticleRow key={a.id} a={a} />)}
                        </Section>
                    </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                    {filtered.map((a) => (
                        <Link key={a.id} to={`/help/${a.id}`} className="card-gradient p-5 group">
                            <div className="flex items-start gap-3">
                                <span className="icon-badge h-9 w-9 shrink-0"><FileText className="h-4 w-4" /></span>
                                <div className="min-w-0">
                                    <h3 className="font-semibold group-hover:text-primary transition truncate">{a.title}</h3>
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.excerpt}</p>
                                    <span className="inline-flex items-center gap-1 text-xs text-primary mt-2">
                                        Oku <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition" />
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
                {filtered.length === 0 && (
                    <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
                        Sonuç bulunamadı. <Link to="/support" className="text-primary hover:underline">Destek alın.</Link>
                    </div>
                )}

                <div className="mt-10 glass rounded-2xl p-6 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h3 className="font-semibold">Hâlâ yardıma mı ihtiyacınız var?</h3>
                        <p className="text-sm text-muted-foreground">Destek talebi oluşturun.</p>
                    </div>
                    <Link to="/support" className="gradient-btn px-5 py-2.5 rounded-xl font-medium inline-flex items-center gap-2">
                        <MessageSquareText className="h-4 w-4" /> Destek Al
                    </Link>
                </div>
            </div>
        </PageShell>
    );
}

function Section({ title, icon: Icon, children }) {
    return (
        <div className="glass rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-semibold mb-3"><Icon className="h-4 w-4 text-primary" /> {title}</h2>
            <div className="divide-y divide-white/5">{children}</div>
        </div>
    );
}

function ArticleRow({ a }) {
    return (
        <Link to={`/help/${a.id}`} className="flex items-center justify-between gap-3 py-2.5 group">
            <span className="text-sm group-hover:text-primary transition truncate">{a.title}</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition" />
        </Link>
    );
}

function Chip({ active, onClick, children }) {
    return (
        <button onClick={onClick} className={`px-3.5 py-1.5 rounded-full text-sm border transition ${active ? 'nav-active border-transparent' : 'border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5'}`}>{children}</button>
    );
}
