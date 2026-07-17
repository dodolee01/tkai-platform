import React from 'react';
import { Activity, ShieldCheck, Sparkles, LineChart } from 'lucide-react';

const FEATURES = [
  { Icon: LineChart, title: 'Çoklu Borsa Otomasyonu', desc: 'Binance, Bybit, OKX ve daha fazlası tek panelde.' },
  { Icon: Sparkles, title: '25 Katmanlı AI Analiz', desc: 'Her sinyal için güven skoru ve risk değerlendirmesi.' },
  { Icon: ShieldCheck, title: 'Şifreli Anahtar Deposu', desc: 'API anahtarlarınız izole edilir, asla tam görüntülenmez.' },
];

export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="grid-bg flex min-h-[100dvh] items-center justify-center px-4 py-10 text-foreground">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border/70 shadow-2xl md:grid-cols-2">
        {/* Brand / feature side */}
        <div className="relative hidden flex-col justify-between gap-8 bg-[#0a0e1c]/80 p-10 backdrop-blur-xl md:flex">
          <div className="flex items-center gap-2.5">
            <div className="icon-badge grid h-10 w-10 place-items-center gradient-accent text-white">
              <Activity size={20} />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold leading-none">
                TK <span className="text-primary">AI</span> FİNANCE
              </h1>
              <p className="text-[11px] text-muted-foreground">Kurumsal Otomatik İşlem Sistemi</p>
            </div>
          </div>

          <div className="space-y-5">
            <h2 className="font-display text-2xl font-bold leading-tight">
              Yapay zeka destekli <span className="gradient-text">otomatik trading</span> platformu
            </h2>
            <div className="space-y-4">
              {FEATURES.map(({ Icon, title: t, desc }) => (
                <div key={t} className="flex items-start gap-3">
                  <span className="icon-badge mt-0.5 grid h-9 w-9 shrink-0 place-items-center">
                    <Icon size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{t}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Garanti kâr taahhüdü yoktur; işlemler tanımlı strateji ve risk kuralları çerçevesinde üretilir.
          </p>
        </div>

        {/* Form side */}
        <div className="glass flex flex-col justify-center p-8 sm:p-10">
          <div className="mb-6 flex items-center gap-2.5 md:hidden">
            <div className="icon-badge grid h-9 w-9 place-items-center gradient-accent text-white">
              <Activity size={18} />
            </div>
            <h1 className="font-display text-base font-bold">
              TK <span className="text-primary">AI</span> FİNANCE
            </h1>
          </div>
          <h2 className="font-display text-2xl font-bold">{title}</h2>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
