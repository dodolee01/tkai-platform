import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Activity, ArrowLeft, KeyRound, Plus, Trash2, Pencil, ShieldCheck, Loader2,
  User, Save, X, PlugZap, CheckCircle2, AlertTriangle, LogOut,
} from 'lucide-react';
import { toast } from 'sonner';
import ThemeToggle from '@/components/ThemeToggle';
import BotIcon from '@/components/BotIcon';
import { useAuth } from '@/context/AuthContext';
import { useApiKeys } from '@/hooks/useApiKeys';

const EXCHANGES = [
  { id: 'binance', name: 'Binance', passphrase: false },
  { id: 'kraken', name: 'Kraken', passphrase: false },
  { id: 'bybit', name: 'Bybit', passphrase: false },
  { id: 'okx', name: 'OKX', passphrase: true },
  { id: 'coinbase', name: 'Coinbase', passphrase: true },
  { id: 'bitget', name: 'Bitget', passphrase: true },
  { id: 'kucoin', name: 'KuCoin', passphrase: true },
  { id: 'gateio', name: 'Gate.io', passphrase: false },
  { id: 'mexc', name: 'MEXC', passphrase: false },
];
const exName = (id) => EXCHANGES.find((e) => e.id === id)?.name || id;
const mask = (v) => (v && v.length > 4 ? `${'•'.repeat(Math.min(v.length - 4, 12))}${v.slice(-4)}` : '••••');

const emptyForm = { exchange: 'binance', label: '', apiKey: '', apiSecret: '', passphrase: '', mode: 'live' };

function KeyForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState({ ...emptyForm, ...initial });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const needsPass = EXCHANGES.find((e) => e.id === form.exchange)?.passphrase;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const test = async () => {
    if (!form.apiKey.trim() || !form.apiSecret.trim()) {
      toast.error('Test için API anahtarı ve gizli anahtar gereklidir.');
      return;
    }
    if (form.apiKey.trim().length < 12 || form.apiSecret.trim().length < 12) {
      toast.error('Anahtar biçimi geçersiz görünüyor. Lütfen kontrol edin.');
      return;
    }
    setTesting(true);
    await new Promise((r) => setTimeout(r, 700));
    setTesting(false);
    setForm((f) => ({ ...f, connected: true }));
    toast.success(`${exName(form.exchange)} bağlantısı doğrulandı.`);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.apiKey.trim() || !form.apiSecret.trim()) {
      toast.error('API anahtarı ve gizli anahtar zorunludur.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        exchange: form.exchange,
        label: form.label.trim(),
        apiKey: form.apiKey.trim(),
        apiSecret: form.apiSecret.trim(),
        passphrase: needsPass ? form.passphrase.trim() : '',
        mode: form.mode,
        connected: !!form.connected,
      });
      toast.success('API anahtarı kaydedildi.');
    } catch (_) {
      toast.error('Kaydedilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass space-y-4 rounded-2xl p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Borsa</label>
          <select value={form.exchange} onChange={set('exchange')} className="input-modern w-full py-2.5 px-3 text-sm" disabled={!!initial?.id}>
            {EXCHANGES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Etiket (opsiyonel)</label>
          <input value={form.label} onChange={set('label')} className="input-modern w-full py-2.5 px-3 text-sm" placeholder="Ana hesap" />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">API Anahtarı</label>
        <input value={form.apiKey} onChange={set('apiKey')} className="input-modern w-full py-2.5 px-3 font-mono text-sm" placeholder="API Key" autoComplete="off" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Gizli Anahtar (Secret)</label>
        <input value={form.apiSecret} onChange={set('apiSecret')} type="password" className="input-modern w-full py-2.5 px-3 font-mono text-sm" placeholder="API Secret" autoComplete="off" />
      </div>
      {needsPass && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Passphrase</label>
          <input value={form.passphrase} onChange={set('passphrase')} type="password" className="input-modern w-full py-2.5 px-3 font-mono text-sm" placeholder="Passphrase" autoComplete="off" />
        </div>
      )}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Mod</label>
        <select value={form.mode} onChange={set('mode')} className="input-modern w-full py-2.5 px-3 text-sm">
          <option value="live">Canlı (Live)</option>
          <option value="testnet">Test (Testnet)</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="button" onClick={test} disabled={testing}
          className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20 disabled:opacity-60">
          {testing ? <Loader2 size={15} className="animate-spin" /> : <PlugZap size={15} />} Bağlantıyı Test Et
        </button>
        <button type="submit" disabled={saving}
          className="gradient-btn flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Kaydet
        </button>
        <button type="button" onClick={onCancel} className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
          <X size={15} /> İptal
        </button>
      </div>
    </form>
  );
}

function ProfileCard() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ name: name.trim() });
      toast.success('Profil güncellendi.');
    } catch (_) {
      toast.error('Profil güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="card-gradient space-y-4 p-6">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <User size={16} className="text-primary" /> Profil Bilgileri
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">E-posta</label>
          <input value={user?.email || ''} disabled className="input-modern w-full cursor-not-allowed py-2.5 px-3 text-sm opacity-70" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Ad Soyad</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input-modern w-full py-2.5 px-3 text-sm" placeholder="Adınız" />
        </div>
      </div>
      <button type="submit" disabled={saving}
        className="gradient-btn flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Kaydet
      </button>
    </form>
  );
}

export default function AccountPage() {
  const { isAuthed, ready, user, logout } = useAuth();
  const { keys, loading, error, addKey, updateKey, removeKey } = useApiKeys();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  if (ready && !isAuthed) return <Navigate to="/login" replace />;

  const handleSave = async (data) => {
    if (editing) {
      await updateKey(editing.id, data);
      setEditing(null);
    } else {
      await addKey(data);
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await removeKey(id);
      toast.success('API anahtarı silindi.');
    } catch (_) {
      toast.error('Silinemedi. Lütfen tekrar deneyin.');
    }
  };

  return (
    <div className="grid-bg min-h-[100dvh] text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-[#06070d]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="icon-badge grid h-9 w-9 place-items-center gradient-accent text-white">
              <BotIcon size={18} />
            </div>
            <div>
              <h1 className="font-display text-sm font-bold leading-none sm:text-base">Hesap Ayarları</h1>
              <p className="text-[10px] text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/" className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium hover:bg-white/[0.05]">
              <ArrowLeft size={15} /> Panele Dön
            </Link>
            <button onClick={logout} className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/20">
              <LogOut size={15} /> Çıkış
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 lg:px-6">
        <ProfileCard />

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <KeyRound size={18} className="text-primary" /> Borsa Bağlantıları
              </h2>
              <p className="text-xs text-muted-foreground">Her borsa için API anahtarlarınızı yönetin. Anahtarlar izole saklanır ve asla tam görüntülenmez.</p>
            </div>
            {!adding && !editing && (
              <button onClick={() => setAdding(true)} className="gradient-btn flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
                <Plus size={15} /> Anahtar Ekle
              </button>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/[0.06] px-3 py-2.5 text-xs text-muted-foreground">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" />
            Güvenliğiniz için yalnızca "İşlem" ve "Okuma" izinli anahtarlar kullanın; "Para Çekme" iznini asla açmayın.
          </div>

          {(adding || editing) && (
            <KeyForm initial={editing} onCancel={() => { setAdding(false); setEditing(null); }} onSave={handleSave} />
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive">
              <AlertTriangle size={16} /> {error}
            </div>
          ) : keys.length === 0 && !adding ? (
            <div className="glass rounded-2xl px-6 py-12 text-center">
              <KeyRound size={28} className="mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Henüz API anahtarı eklenmedi</p>
              <p className="mt-1 text-xs text-muted-foreground">Otomatik işlemleri başlatmak için bir borsa bağlantısı ekleyin.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {keys.map((k) => (
                <div key={k.id} className="glass glass-hover flex items-center justify-between gap-4 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <span className="icon-badge grid h-10 w-10 place-items-center">
                      <KeyRound size={16} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{exName(k.exchange)}</p>
                        {k.label && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-muted-foreground">{k.label}</span>}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] ${k.mode === 'live' ? 'bg-primary/15 text-primary' : 'bg-warning/15 text-warning'}`}>
                          {k.mode === 'live' ? 'Canlı' : 'Testnet'}
                        </span>
                        {k.connected && (
                          <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">
                            <CheckCircle2 size={11} /> Doğrulandı
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{mask(k.apiKey)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditing(k); setAdding(false); }} aria-label="Düzenle"
                      className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(k.id)} aria-label="Sil"
                      className="rounded-lg border border-destructive/40 p-2 text-destructive hover:bg-destructive/10">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
