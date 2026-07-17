import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, Check, Copy, Pencil, Trash2, RotateCcw, Download, Upload, Plus, X, Shield, Gauge,
} from 'lucide-react';
import {
  CONFIG_NUMERIC_FIELDS, COIN_FILTERS, TIME_FILTERS, VOLATILITY_FILTERS, TREND_FILTERS,
  INDICATORS, emptyCustomConfig,
} from '@/lib/strategyProfiles';

function riskColor(level) {
  if (level <= 3) return 'text-primary';
  if (level <= 6) return 'text-accent';
  return 'text-destructive';
}

export default function StrategyProfilesPanel({ sp }) {
  const { profiles, activeProfile, selectProfile, cloneProfile, createCustom, updateProfile, deleteProfile, resetProfile } = sp;
  const [editing, setEditing] = useState(null); // profile record or 'new'
  const [confirmDel, setConfirmDel] = useState(null);

  const exportProfile = (p) => {
    const blob = new Blob([JSON.stringify({ name: p.name, description: p.description, riskLevel: p.riskLevel, config: p.config }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `strateji-${p.key}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const importProfile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        await createCustom({
          name: data.name || 'İçe Aktarılan', description: data.description || '',
          riskLevel: data.riskLevel || 5, config: { ...emptyCustomConfig(), ...(data.config || {}) },
        });
      } catch { /* invalid file */ }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">Strateji Profilleri</h2>
          <p className="text-xs text-muted-foreground">Hazır profiller ve kendi özel stratejilerin</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-black/30 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <Upload size={13} /> İçe Aktar
            <input type="file" accept="application/json" className="hidden" onChange={importProfile} />
          </label>
          <button onClick={() => setEditing('new')}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90">
            <Plus size={14} /> Yeni Profil
          </button>
        </div>
      </div>

      {activeProfile && (
        <div className="glass rounded-2xl p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-primary">
            <Check size={14} /> Aktif Profil
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-xl font-bold">{activeProfile.name}</h3>
              <p className="max-w-md text-xs text-muted-foreground">{activeProfile.description}</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-black/20 px-3 py-2">
              <Gauge size={15} className={riskColor(activeProfile.riskLevel)} />
              <span className="text-xs text-muted-foreground">Risk Seviyesi</span>
              <span className={`font-mono font-bold ${riskColor(activeProfile.riskLevel)}`}>{activeProfile.riskLevel}/10</span>
            </div>
          </div>
          <ConfigGrid config={activeProfile.config} />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {profiles.map((p) => {
          const active = activeProfile && p.key === activeProfile.key;
          return (
            <motion.div key={p.id || p.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`glass rounded-2xl p-4 transition ${active ? 'border-primary/50 ring-1 ring-primary/30' : 'glass-hover'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`rounded-lg p-1.5 ${active ? 'bg-primary/15 text-primary' : 'bg-white/[0.04] text-muted-foreground'}`}><Layers size={16} /></div>
                  <div>
                    <h4 className="font-display text-sm font-bold">{p.name}</h4>
                    <span className={`text-[10px] font-semibold ${p.builtin ? 'text-muted-foreground' : 'text-accent'}`}>{p.builtin ? 'Hazır' : 'Özel'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-border px-2 py-1">
                  <Shield size={11} className={riskColor(p.riskLevel)} />
                  <span className={`font-mono text-xs font-bold ${riskColor(p.riskLevel)}`}>{p.riskLevel}</span>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 h-8 text-[11px] text-muted-foreground">{p.description}</p>
              <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px]">
                <MiniStat label="Kaldıraç" v={`${p.config?.maxLeverage}x`} />
                <MiniStat label="Risk/İşlem" v={`%${p.config?.riskPerTrade}`} />
                <MiniStat label="Güven" v={`%${p.config?.minConfidence}`} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {!active ? (
                  <button onClick={() => selectProfile(p.key)}
                    className="flex-1 rounded-lg bg-primary/15 px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/25">
                    Etkinleştir
                  </button>
                ) : (
                  <span className="flex-1 rounded-lg bg-primary/15 px-2 py-1.5 text-center text-xs font-semibold text-primary">Aktif</span>
                )}
                <IconBtn title="Klonla" onClick={() => cloneProfile(p)}><Copy size={13} /></IconBtn>
                <IconBtn title="Dışa Aktar" onClick={() => exportProfile(p)}><Download size={13} /></IconBtn>
                {!p.builtin && <IconBtn title="Düzenle" onClick={() => setEditing(p)}><Pencil size={13} /></IconBtn>}
                {p.builtin
                  ? <IconBtn title="Varsayılana Sıfırla" onClick={() => resetProfile(p)}><RotateCcw size={13} /></IconBtn>
                  : <IconBtn title="Sil" danger onClick={() => setConfirmDel(p)}><Trash2 size={13} /></IconBtn>}
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {editing && (
          <ProfileEditor
            profile={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)}
            onSave={async (data) => {
              if (editing === 'new') await createCustom(data);
              else await updateProfile(editing.id, data);
              setEditing(null);
            }}
          />
        )}
        {confirmDel && (
          <Confirm
            title="Profili Sil"
            message={`"${confirmDel.name}" profilini silmek istediğine emin misin?`}
            onCancel={() => setConfirmDel(null)}
            onConfirm={async () => { await deleteProfile(confirmDel); setConfirmDel(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ConfigGrid({ config = {} }) {
  const items = [
    ['Maks. Açık İşlem', config.maxOpenTrades], ['Kaldıraç', `${config.maxLeverage}x`],
    ['Risk/İşlem', `%${config.riskPerTrade}`], ['Günlük Zarar', `%${config.maxDailyLoss}`],
    ['Kâr Hedefi', `%${config.profitTarget}`], ['Take Profit', `%${config.takeProfit}`],
    ['Stop Loss', `%${config.stopLoss}`], ['İz Süren Stop', `%${config.trailingStop}`],
    ['Başabaş', `%${config.breakEven}`], ['Güven Eşiği', `%${config.minConfidence}`],
    ['Coin Filtre', COIN_FILTERS.find((f) => f.value === config.coinFilter)?.label || '—'],
    ['Trend', TREND_FILTERS.find((f) => f.value === config.trendFilter)?.label || '—'],
  ];
  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {items.map(([l, v]) => (
          <div key={l} className="rounded-lg border border-border bg-black/20 p-2">
            <div className="text-[10px] text-muted-foreground">{l}</div>
            <div className="font-mono text-sm font-bold text-foreground">{v ?? '—'}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(config.indicators || []).map((i) => (
          <span key={i} className="rounded-md bg-accent/12 px-2 py-0.5 text-[10px] font-semibold text-accent">{i}</span>
        ))}
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${config.newsFilter ? 'bg-primary/12 text-primary' : 'bg-white/[0.04] text-muted-foreground'}`}>Haber {config.newsFilter ? 'Açık' : 'Kapalı'}</span>
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${config.aiFilter ? 'bg-primary/12 text-primary' : 'bg-white/[0.04] text-muted-foreground'}`}>AI {config.aiFilter ? 'Açık' : 'Kapalı'}</span>
      </div>
    </>
  );
}

function MiniStat({ label, v }) {
  return (
    <div className="rounded-lg border border-border bg-black/20 py-1.5">
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className="font-mono text-xs font-bold text-foreground">{v}</div>
    </div>
  );
}

function IconBtn({ children, onClick, title, danger }) {
  return (
    <button title={title} onClick={onClick}
      className={`rounded-lg border border-border p-1.5 transition ${danger ? 'text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive' : 'text-muted-foreground hover:bg-white/[0.06] hover:text-foreground'}`}>
      {children}
    </button>
  );
}

function ProfileEditor({ profile, onClose, onSave }) {
  const [name, setName] = useState(profile?.name || '');
  const [description, setDescription] = useState(profile?.description || '');
  const [riskLevel, setRiskLevel] = useState(profile?.riskLevel || 5);
  const [config, setConfig] = useState(() => ({ ...emptyCustomConfig(), ...(profile?.config || {}) }));
  const upd = (k, v) => setConfig((c) => ({ ...c, [k]: v }));
  const toggleInd = (i) => setConfig((c) => ({ ...c, indicators: c.indicators?.includes(i) ? c.indicators.filter((x) => x !== i) : [...(c.indicators || []), i] }));

  return (
    <Modal onClose={onClose} title={profile ? 'Profili Düzenle' : 'Yeni Profil'}>
      <div className="space-y-3">
        <Field label="Profil Adı">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Stratejim"
            className="w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm outline-none focus:border-primary/50" />
        </Field>
        <Field label="Açıklama">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            className="w-full resize-none rounded-lg border border-border bg-black/30 px-3 py-2 text-sm outline-none focus:border-primary/50" />
        </Field>
        <Field label={`Risk Seviyesi: ${riskLevel}/10`}>
          <input type="range" min={1} max={10} step={1} value={riskLevel} onChange={(e) => setRiskLevel(+e.target.value)} className="w-full accent-[hsl(var(--primary))]" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          {CONFIG_NUMERIC_FIELDS.map((f) => (
            <div key={f.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-foreground/80">{f.label}</span>
                <span className="font-mono font-semibold text-primary">{config[f.key]}{f.unit}</span>
              </div>
              <input type="range" min={f.min} max={f.max} step={f.step} value={config[f.key] ?? f.min}
                onChange={(e) => upd(f.key, +e.target.value)} className="w-full accent-[hsl(var(--primary))]" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Coin Filtresi" value={config.coinFilter} options={COIN_FILTERS} onChange={(v) => upd('coinFilter', v)} />
          <SelectField label="Zaman Filtresi" value={config.timeFilter} options={TIME_FILTERS} onChange={(v) => upd('timeFilter', v)} />
          <SelectField label="Volatilite" value={config.volatilityFilter} options={VOLATILITY_FILTERS} onChange={(v) => upd('volatilityFilter', v)} />
          <SelectField label="Trend" value={config.trendFilter} options={TREND_FILTERS} onChange={(v) => upd('trendFilter', v)} />
        </div>

        <Field label="İndikatörler">
          <div className="flex flex-wrap gap-1.5">
            {INDICATORS.map((i) => (
              <button key={i} onClick={() => toggleInd(i)}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${config.indicators?.includes(i) ? 'bg-accent/15 text-accent' : 'border border-border text-muted-foreground hover:text-foreground'}`}>
                {i}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex gap-4">
          <Toggle label="Haber Filtresi" on={config.newsFilter} onClick={() => upd('newsFilter', !config.newsFilter)} />
          <Toggle label="AI Filtresi" on={config.aiFilter} onClick={() => upd('aiFilter', !config.aiFilter)} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">İptal</button>
          <button disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), description, riskLevel, config })}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40">
            Kaydet
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Confirm({ title, message, onCancel, onConfirm }) {
  return (
    <Modal onClose={onCancel} title={title} small>
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Vazgeç</button>
        <button onClick={onConfirm} className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition hover:opacity-90">Sil</button>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose, title, small }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`glass max-h-[90vh] w-full overflow-y-auto rounded-2xl p-5 ${small ? 'max-w-sm' : 'max-w-2xl'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }) {
  return <div><label className="mb-1.5 block text-xs font-medium text-foreground/80">{label}</label>{children}</div>;
}

function SelectField({ label, value, options, onChange }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm outline-none focus:border-primary/50">
        {options.map((o) => <option key={o.value} value={o.value} className="bg-[#0b0e17]">{o.label}</option>)}
      </select>
    </Field>
  );
}

function Toggle({ label, on, onClick }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs" onClick={onClick}>
      <span className="text-foreground/80">{label}</span>
      <span className={`relative h-5 w-9 rounded-full transition ${on ? 'bg-primary' : 'bg-muted'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </label>
  );
}
