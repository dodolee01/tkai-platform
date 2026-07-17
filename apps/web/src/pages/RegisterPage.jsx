import React, { useMemo, useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, UserPlus, Loader2, User } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import { useAuth } from '@/context/AuthContext';

function passwordStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}
const STRENGTH = [
  { label: '', color: '' },
  { label: 'Çok zayıf', color: 'bg-destructive' },
  { label: 'Zayıf', color: 'bg-warning' },
  { label: 'Orta', color: 'bg-accent' },
  { label: 'Güçlü', color: 'bg-success' },
];

function trMessage(err) {
  const data = err?.response?.data || err?.data || {};
  if (data.email) return 'Bu e-posta zaten kayıtlı veya geçersiz.';
  if (data.password) return 'Şifre en az 8 karakter olmalıdır.';
  if (err?.status === 429) return 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.';
  return 'Kayıt oluşturulamadı. Lütfen tekrar deneyin.';
}

export default function RegisterPage() {
  const { register, isAuthed } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const strength = useMemo(() => passwordStrength(password), [password]);
  if (isAuthed) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) return setError('Lütfen tüm alanları doldurun.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Geçerli bir e-posta adresi girin.');
    if (password.length < 8) return setError('Şifre en az 8 karakter olmalıdır.');
    if (password !== confirm) return setError('Şifreler eşleşmiyor.');
    if (!terms) return setError('Devam etmek için şartları kabul etmelisiniz.');
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim());
      navigate('/', { replace: true });
    } catch (err) {
      setError(trMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Hesap oluşturun" subtitle="Ücretsiz kaydolun ve panelinize erişin.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-muted-foreground">Ad Soyad (opsiyonel)</label>
          <div className="relative">
            <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input id="name" type="text" autoComplete="name" value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-modern w-full py-2.5 pl-9 pr-3 text-sm" placeholder="Adınız" />
          </div>
        </div>
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
            <input id="password" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-modern w-full py-2.5 pl-9 pr-10 text-sm" placeholder="••••••••" />
            <button type="button" onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? 'Şifreyi gizle' : 'Şifreyi göster'}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {password && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex h-1.5 flex-1 gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={`h-full flex-1 rounded-full ${i <= strength ? STRENGTH[strength].color : 'bg-border'}`} />
                ))}
              </div>
              <span className="w-16 text-right text-[11px] text-muted-foreground">{STRENGTH[strength].label}</span>
            </div>
          )}
        </div>
        <div>
          <label htmlFor="confirm" className="mb-1.5 block text-xs font-medium text-muted-foreground">Şifre (tekrar)</label>
          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input id="confirm" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input-modern w-full py-2.5 pl-9 pr-3 text-sm" placeholder="••••••••" />
          </div>
          {confirm && confirm !== password && (
            <p className="mt-1 text-[11px] text-destructive">Şifreler eşleşmiyor.</p>
          )}
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border accent-primary" />
          <span>
            <Link to="/legal/terms" className="text-primary hover:underline">Kullanım Koşulları</Link> ve{' '}
            <Link to="/legal/privacy" className="text-primary hover:underline">Gizlilik Politikası</Link>'nı okudum ve kabul ediyorum.
          </span>
        </label>
        <button type="submit" disabled={loading}
          className="gradient-btn flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
          {loading ? 'Hesap oluşturuluyor…' : 'Kayıt Ol'}
        </button>
        <p className="text-center text-xs text-muted-foreground">
          Zaten hesabınız var mı?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">Giriş yapın</Link>
        </p>
      </form>
    </AuthShell>
  );
}
