import React from 'react';
import { Shield, AlertTriangle, RotateCcw } from 'lucide-react';

const FIELDS = [
  { key: 'minConfidence', label: 'Minimum Güven Puanı', min: 85, max: 99, step: 1, unit: '%' },
  { key: 'riskPerTrade', label: 'İşlem Başına Risk (Bakiye %)', min: 0.1, max: 2, step: 0.1, unit: '%' },
  { key: 'maxDailyLoss', label: 'Maksimum Günlük Zarar', min: 1, max: 10, step: 0.5, unit: '%' },
  { key: 'maxOpenTrades', label: 'Maksimum Açık İşlem', min: 1, max: 20, step: 1, unit: '' },
  { key: 'maxLeverage', label: 'Maksimum Kaldıraç', min: 1, max: 5, step: 1, unit: 'x' },
  { key: 'maxPositionSize', label: 'Maks. Pozisyon Büyüklüğü', min: 100, max: 10000, step: 100, unit: ' USDT' },
  { key: 'maxDailyTrades', label: 'Günlük Maks. İşlem', min: 1, max: 60, step: 1, unit: '' },
  { key: 'startBalance', label: 'Başlangıç Bakiyesi', min: 100, max: 100000, step: 100, unit: ' USDT' },
  { key: 'profitTarget', label: 'Günlük Kâr Hedefi', min: 1, max: 50, step: 1, unit: '%' },
];

export default function RiskPanel({ settings, setSettings, dailyLossHit, resetGuard }) {
  const upd = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-accent/12 p-2 text-accent"><Shield size={18} /></div>
          <div>
            <h3 className="font-display font-bold">Risk Yönetimi</h3>
            <p className="text-xs text-muted-foreground">Sistem limitleri aşılırsa yeni işlem durur</p>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <span className="text-muted-foreground">Oto-İşlem</span>
          <button
            onClick={() => upd('autoTrade', !settings.autoTrade)}
            className={`relative h-5 w-9 rounded-full transition ${settings.autoTrade ? 'bg-primary' : 'bg-muted'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${settings.autoTrade ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
        </label>
      </div>

      {dailyLossHit && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <span className="flex items-center gap-2 text-destructive"><AlertTriangle size={15} /> Günlük zarar limiti aşıldı — işlemler durduruldu</span>
          <button onClick={resetGuard} className="flex items-center gap-1 rounded-lg bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/25">
            <RotateCcw size={12} /> Sıfırla
          </button>
        </div>
      )}

      <div className="space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm text-foreground/80">{f.label}</label>
              <span className="font-mono text-sm font-semibold text-primary">{settings[f.key]}{f.unit}</span>
            </div>
            <input
              type="range" min={f.min} max={f.max} step={f.step} value={settings[f.key]}
              onChange={(e) => upd(f.key, +e.target.value)}
              className="w-full accent-[hsl(var(--primary))]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
