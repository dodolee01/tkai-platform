import React, { useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import { useAuth } from '@/context/AuthContext';

function trMessage(err) {
  const status = err?.status;
  if (status === 400) return 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.';
  if (status === 429) return 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.';
  if (status === 0) return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.';
  return 'Giriş yapılamadı. Lütfen tekrar deneyin.';
}

export default function LoginPage() {
  const { login, isAuthed } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (isAuthed) return <Navigate to="/" replace />;

  const from = location.state?.from?.pathname || '/';

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Lütfen e-posta ve şifrenizi girin.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(trMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Tekrar hoş geldiniz" subtitle="Hesabınıza giriş yaparak panele erişin.">
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
        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-muted-foreground">Şifre</label>
          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input id="password" type={showPw ? 'text' : 'password'} autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-modern w-full py-2.5 pl-9 pr-10 text-sm" placeholder="••••••••" />
            <button type="button" onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? 'Şifreyi gizle' : 'Şifreyi göster'}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary" />
            Beni hatırla
          </label>
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">Şifremi unuttum</Link>
        </div>
        <button type="submit" disabled={loading}
          className="gradient-btn flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
          {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
        </button>
        <p className="text-center text-xs text-muted-foreground">
          Hesabınız yok mu?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">Kayıt olun</Link>
        </p>
      </form>
    </AuthShell>
  );
}
