import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, ThumbsUp, ThumbsDown, Printer, Share2, FileText, ArrowLeft } from 'lucide-react';
import PageShell from '@/components/PageShell';
import { ARTICLES, HELP_CATEGORIES } from '@/lib/helpContent';

export default function ArticlePage() {
    const { articleId } = useParams();
    const article = ARTICLES.find((a) => a.id === articleId);
    const [vote, setVote] = useState(null);
    const [shared, setShared] = useState(false);

    const catLabel = useMemo(
        () => HELP_CATEGORIES.find((c) => c.key === article?.category)?.label || '',
        [article]
    );
    const related = useMemo(
        () => article ? ARTICLES.filter((a) => a.category === article.category && a.id !== article.id).slice(0, 4) : [],
        [article]
    );

    if (!article) {
        return (
            <PageShell>
                <div className="mx-auto max-w-3xl px-5 py-20 text-center">
                    <h1 className="font-display text-2xl font-bold mb-3">Makale bulunamadı</h1>
                    <Link to="/help" className="text-primary hover:underline inline-flex items-center gap-1.5">
                        <ArrowLeft className="h-4 w-4" /> Yardım Merkezi’ne dön
                    </Link>
                </div>
            </PageShell>
        );
    }

    const onShare = async () => {
        const url = window.location.href;
        try {
            if (navigator.share) await navigator.share({ title: article.title, url });
            else await navigator.clipboard.writeText(url);
            setShared(true);
            setTimeout(() => setShared(false), 2000);
        } catch { /* dismissed */ }
    };

    return (
        <PageShell>
            <div className="mx-auto max-w-3xl px-5 py-10">
                <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6 flex-wrap">
                    <Link to="/help" className="hover:text-foreground transition">Yardım Merkezi</Link>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <span>{catLabel}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <span className="text-foreground truncate max-w-[50%]">{article.title}</span>
                </nav>

                <article className="glass rounded-3xl p-6 sm:p-9">
                    <p className="text-sm text-primary font-medium mb-2">{catLabel}</p>
                    <h1 className="font-display text-3xl font-extrabold tracking-tight">{article.title}</h1>
                    <p className="text-xs text-muted-foreground mt-2">Son güncelleme: {article.updated}</p>

                    {article.content.length > 1 && (
                        <div className="mt-6 glass rounded-2xl p-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">İçindekiler</p>
                            <ol className="space-y-1 text-sm list-decimal list-inside marker:text-primary">
                                {article.content.map((_, i) => (
                                    <li key={i}><a href={`#s-${i}`} className="hover:text-primary transition">Bölüm {i + 1}</a></li>
                                ))}
                            </ol>
                        </div>
                    )}

                    <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
                        {article.content.map((p, i) => (
                            <p key={i} id={`s-${i}`} className="scroll-mt-24">{p}</p>
                        ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span>Yararlı mıydı?</span>
                            <button onClick={() => setVote('up')} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border transition ${vote === 'up' ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' : 'border-white/10 hover:bg-white/5'}`}><ThumbsUp className="h-4 w-4" /> Evet</button>
                            <button onClick={() => setVote('down')} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border transition ${vote === 'down' ? 'border-rose-500/50 text-rose-400 bg-rose-500/10' : 'border-white/10 hover:bg-white/5'}`}><ThumbsDown className="h-4 w-4" /> Hayır</button>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={onShare} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-sm hover:bg-white/5 transition"><Share2 className="h-4 w-4" /> {shared ? 'Kopyalandı' : 'Paylaş'}</button>
                            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-sm hover:bg-white/5 transition"><Printer className="h-4 w-4" /> Yazdır</button>
                        </div>
                    </div>
                </article>

                {related.length > 0 && (
                    <div className="mt-8">
                        <h2 className="font-semibold mb-3">İlgili Makaleler</h2>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {related.map((a) => (
                                <Link key={a.id} to={`/help/${a.id}`} className="card-gradient p-4 flex items-center gap-3 group">
                                    <span className="icon-badge h-8 w-8 shrink-0"><FileText className="h-4 w-4" /></span>
                                    <span className="text-sm group-hover:text-primary transition truncate">{a.title}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </PageShell>
    );
}
