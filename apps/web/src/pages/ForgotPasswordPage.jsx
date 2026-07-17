import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Send, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import { useAuth } from '@/context/AuthContext';

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Geçerli bir e-posta adresi girin.');
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (_) {
      // Do not leak whether the email exists — always show success-like state.
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Şifremi unuttum"
      subtitle="E-posta adresinizi girin, sıfırlama bağlantısı gönderelim."
    >
      {sent ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-success/40 bg-success/10 px-3 py-3 text-sm">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
            <p>
              Eğer bu e-posta bir hesaba bağlıysa, şifre sıfırlama bağlantısı gönderildi.
              Gelen kutunuzu ve spam klasörünü kontrol edin.
            </p>
          </div>
          <Link to="/login" className="flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline">
            <ArrowLeft size={16} /> Girişe dön
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-muted-foreground">E-posta</label>
            <div className="relative">
              <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input id="email" type="email" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-modern w-full py-2.5 pl-9 pr-3 text-sm" placeholder="ornek@eposta.com" />
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="gradient-btn flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {loading ? 'Gönderiliyor…' : 'Sıfırlama Bağlantısı Gönder'}
          </button>
          <Link to="/login" className="flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline">
            <ArrowLeft size={16} /> Girişe dön
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
