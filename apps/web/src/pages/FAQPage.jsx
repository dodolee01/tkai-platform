import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronDown, ThumbsUp, ThumbsDown, MessageSquareText } from 'lucide-react';
import PageShell from '@/components/PageShell';
import { FAQS, FAQ_CATEGORIES } from '@/lib/helpContent';

export default function FAQPage() {
    const [query, setQuery] = useState('');
    const [cat, setCat] = useState('all');
    const [openId, setOpenId] = useState(null);
    const [votes, setVotes] = useState({});

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return FAQS.filter((f) => {
            if (cat !== 'all' && f.category !== cat) return false;
            if (!q) return true;
            return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
        });
    }, [query, cat]);

    return (
        <PageShell>
            <div className="mx-auto max-w-3xl px-5 py-12">
                <div className="text-center mb-8">
                    <p className="text-sm text-primary font-medium mb-2">Sıkça Sorulan Sorular</p>
                    <h1 className="font-display text-4xl font-extrabold tracking-tight">Aradığınız cevabı bulun</h1>
                </div>

                <div className="relative mb-5">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Soru ara..."
                        className="input-modern w-full pl-12 pr-4 py-3.5 text-sm"
                    />
                </div>

                <div className="flex flex-wrap gap-2 mb-8">
                    <Chip active={cat === 'all'} onClick={() => setCat('all')}>Tümü</Chip>
                    {FAQ_CATEGORIES.map((c) => (
                        <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>
                    ))}
                </div>

                <div className="space-y-3">
                    {filtered.map((f) => {
                        const open = openId === f.id;
                        const vote = votes[f.id];
                        return (
                            <div key={f.id} className="glass rounded-2xl overflow-hidden">
                                <button
                                    onClick={() => setOpenId(open ? null : f.id)}
                                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                                >
                                    <span className="font-medium">{f.q}</span>
                                    <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition ${open ? 'rotate-180' : ''}`} />
                                </button>
                                {open && (
                                    <div className="px-5 pb-5">
                                        <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                                        <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                                            <span>Bu yararlı oldu mu?</span>
                                            <button
                                                onClick={() => setVotes((v) => ({ ...v, [f.id]: 'up' }))}
                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border transition ${vote === 'up' ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' : 'border-white/10 hover:bg-white/5'}`}
                                            ><ThumbsUp className="h-3.5 w-3.5" /> Evet</button>
                                            <button
                                                onClick={() => setVotes((v) => ({ ...v, [f.id]: 'down' }))}
                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border transition ${vote === 'down' ? 'border-rose-500/50 text-rose-400 bg-rose-500/10' : 'border-white/10 hover:bg-white/5'}`}
                                            ><ThumbsDown className="h-3.5 w-3.5" /> Hayır</button>
                                            {vote && <span className="text-primary">Geri bildiriminiz için teşekkürler.</span>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {filtered.length === 0 && (
                        <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
                            “{query}” için sonuç bulunamadı. <Link to="/support" className="text-primary hover:underline">Destek ekibiyle iletişime geçin.</Link>
                        </div>
                    )}
                </div>

                <div className="mt-10 glass rounded-2xl p-6 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h3 className="font-semibold">Cevabı bulamadınız mı?</h3>
                        <p className="text-sm text-muted-foreground">Destek ekibimiz yardımcı olmaktan mutluluk duyar.</p>
                    </div>
                    <Link to="/support" className="gradient-btn px-5 py-2.5 rounded-xl font-medium inline-flex items-center gap-2">
                        <MessageSquareText className="h-4 w-4" /> Destek Al
                    </Link>
                </div>
            </div>
        </PageShell>
    );
}

function Chip({ active, onClick, children }) {
    return (
        <button
            onClick={onClick}
            className={`px-3.5 py-1.5 rounded-full text-sm border transition ${active ? 'nav-active border-transparent' : 'border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
        >{children}</button>
    );
}
