import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Loader2, CheckCircle2, Mail, HelpCircle, BookOpen } from 'lucide-react';
import PageShell from '@/components/PageShell';
import apiServerClient from '@/lib/apiServerClient';
import { SUPPORT_EMAIL } from '@/lib/helpContent';

const CATEGORIES = [
    { value: 'support', label: 'Teknik Destek' },
    { value: 'feedback', label: 'Geri Bildirim' },
    { value: 'bug', label: 'Hata Bildirimi' },
    { value: 'feature', label: 'Özellik İsteği' },
    { value: 'other', label: 'Diğer' },
];

const emptyForm = { name: '', email: '', subject: '', category: 'support', message: '' };

export default function SupportPage() {
    const [form, setForm] = useState(emptyForm);
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState('idle'); // idle | loading | success | error
    const [ticket, setTicket] = useState('');
    const [errMsg, setErrMsg] = useState('');

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const validate = () => {
        const next = {};
        if (!form.name.trim()) next.name = 'Ad Soyad gerekli.';
        if (!form.email.trim()) next.email = 'E-posta gerekli.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Geçerli bir e-posta girin.';
        if (!form.subject.trim()) next.subject = 'Konu gerekli.';
        if (!form.message.trim() || form.message.trim().length < 10) next.message = 'Lütfen en az 10 karakterlik bir mesaj yazın.';
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setStatus('loading');
        setErrMsg('');
        const ref = `TK-${Date.now().toString(36).toUpperCase().slice(-6)}`;
        try {
            const res = await apiServerClient.fetch('/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: form.email,
                    template: 'supportTicket',
                    data: { ...form, ticket: ref },
                }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error || `Sunucu hatası (${res.status})`);
            }
            setTicket(ref);
            setStatus('success');
            setForm(emptyForm);
        } catch (err) {
            setErrMsg(err.message || 'Talebiniz gönderilemedi. Lütfen tekrar deneyin.');
            setStatus('error');
        }
    };

    return (
        <PageShell>
            <div className="mx-auto max-w-3xl px-5 py-12">
                <div className="mb-8">
                    <p className="text-sm text-primary font-medium mb-2">Destek Merkezi</p>
                    <h1 className="font-display text-4xl font-extrabold tracking-tight">Size nasıl yardımcı olabiliriz?</h1>
                    <p className="text-muted-foreground mt-3">
                        Bir talep oluşturun; ekibimiz en kısa sürede dönüş yapacaktır. Doğrudan{' '}
                        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">{SUPPORT_EMAIL}</a>{' '}
                        adresine de yazabilirsiniz.
                    </p>
                </div>

                {status === 'success' ? (
                    <div className="glass rounded-3xl p-8 text-center">
                        <CheckCircle2 className="h-14 w-14 mx-auto text-emerald-400 mb-4" strokeWidth={1.5} />
                        <h2 className="font-display text-2xl font-bold mb-2">Talebiniz alındı</h2>
                        <p className="text-muted-foreground">Talep numaranız:</p>
                        <p className="font-mono text-xl text-primary my-3">{ticket}</p>
                        <p className="text-sm text-muted-foreground mb-6">
                            Onay e-postası <span className="text-foreground">{SUPPORT_EMAIL}</span> üzerinden gönderildi.
                        </p>
                        <button onClick={() => setStatus('idle')} className="gradient-btn px-6 py-2.5 rounded-xl font-medium">
                            Yeni talep oluştur
                        </button>
                    </div>
                ) : (
                    <form onSubmit={onSubmit} className="glass rounded-3xl p-6 sm:p-8 space-y-5">
                        <div className="grid gap-5 sm:grid-cols-2">
                            <Field label="Ad Soyad" error={errors.name}>
                                <input className="input-modern w-full px-4 py-2.5 text-sm" value={form.name} onChange={set('name')} placeholder="Adınız" />
                            </Field>
                            <Field label="E-posta" error={errors.email}>
                                <input type="email" className="input-modern w-full px-4 py-2.5 text-sm" value={form.email} onChange={set('email')} placeholder="siz@ornek.com" />
                            </Field>
                        </div>
                        <div className="grid gap-5 sm:grid-cols-2">
                            <Field label="Konu" error={errors.subject}>
                                <input className="input-modern w-full px-4 py-2.5 text-sm" value={form.subject} onChange={set('subject')} placeholder="Kısa bir başlık" />
                            </Field>
                            <Field label="Kategori">
                                <select className="input-modern w-full px-4 py-2.5 text-sm" value={form.category} onChange={set('category')}>
                                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </Field>
                        </div>
                        <Field label="Mesaj" error={errors.message}>
                            <textarea rows={6} className="input-modern w-full px-4 py-3 text-sm resize-y" value={form.message} onChange={set('message')} placeholder="Sorununuzu veya isteğinizi ayrıntılı açıklayın..." />
                        </Field>

                        {status === 'error' && (
                            <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">{errMsg}</p>
                        )}

                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <Link to="/faq" className="inline-flex items-center gap-1.5 hover:text-foreground transition"><HelpCircle className="h-4 w-4" /> SSS</Link>
                                <Link to="/help" className="inline-flex items-center gap-1.5 hover:text-foreground transition"><BookOpen className="h-4 w-4" /> Dökümanlar</Link>
                            </div>
                            <button type="submit" disabled={status === 'loading'} className="gradient-btn px-6 py-2.5 rounded-xl font-medium inline-flex items-center gap-2 disabled:opacity-60">
                                {status === 'loading' ? <><Loader2 className="h-4 w-4 animate-spin" /> Gönderiliyor</> : <><Send className="h-4 w-4" /> Talep Gönder</>}
                            </button>
                        </div>
                    </form>
                )}

                <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" /> Ortalama yanıt süresi: 24 saat
                </div>
            </div>
        </PageShell>
    );
}

function Field({ label, error, children }) {
    return (
        <label className="block">
            <span className="block text-sm font-medium mb-2">{label}</span>
            {children}
            {error && <span className="block text-xs text-rose-400 mt-1.5">{error}</span>}
        </label>
    );
}
