/**
 * BotIcon Showcase Component
 * 
 * This file demonstrates all the different ways the BotIcon can be used
 * throughout the TK AI FINANCE dashboard.
 * 
 * To view this showcase, you can import and render it in a page:
 * import BotIconShowcase from '@/components/BotIcon.showcase';
 * 
 * This is a reference file and is not used in production.
 */

import React from 'react';
import BotIcon from './BotIcon';

export default function BotIconShowcase() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="mx-auto max-w-6xl space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-display text-4xl font-bold text-white mb-2">
            BotIcon Showcase
          </h1>
          <p className="text-slate-400">
            Professional AI Trading Bot Icon for TK AI FINANCE
          </p>
        </div>

        {/* Size Presets */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-white">Size Presets</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {['xs', 'sm', 'md', 'lg', 'xl', '2xl'].map((size) => (
              <div
                key={size}
                className="flex flex-col items-center gap-2 rounded-lg bg-slate-700/50 p-4"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                  <BotIcon size={size} />
                </div>
                <span className="text-xs font-mono text-slate-300">{size}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Custom Sizes */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-white">Custom Sizes</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[16, 24, 32, 48, 64, 80, 96, 128].map((size) => (
              <div
                key={size}
                className="flex flex-col items-center gap-2 rounded-lg bg-slate-700/50 p-4"
              >
                <div className="flex items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 p-4">
                  <BotIcon size={size} />
                </div>
                <span className="text-xs font-mono text-slate-300">{size}px</span>
              </div>
            ))}
          </div>
        </section>

        {/* Integration Examples */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-white">Integration Examples</h2>

          {/* Header Logo */}
          <div className="rounded-lg bg-slate-700/50 p-6">
            <h3 className="mb-4 font-display text-lg font-bold text-white">
              Dashboard Header Logo
            </h3>
            <div className="flex items-center gap-3 rounded-lg bg-slate-800 p-4">
              <div className="icon-badge grid h-9 w-9 place-items-center gradient-accent text-white">
                <BotIcon size={18} />
              </div>
              <div>
                <p className="font-display text-sm font-bold text-white">
                  TK <span className="text-blue-400">AI</span> FİNANCE
                </p>
                <p className="text-[10px] text-slate-400">
                  Kişisel Otomatik İşlem Sistemi
                </p>
              </div>
            </div>
          </div>

          {/* Bot Status Badge */}
          <div className="rounded-lg bg-slate-700/50 p-6">
            <h3 className="mb-4 font-display text-lg font-bold text-white">
              Bot Status Indicator
            </h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-purple-500/40 bg-purple-500/[0.08] px-3 py-2 text-xs font-semibold text-purple-300">
                <BotIcon size={13} /> Bot Durumu: Çalışıyor
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-500/40 bg-slate-500/[0.08] px-3 py-2 text-xs font-semibold text-slate-300">
                <BotIcon size={13} /> Bot Durumu: Duraklatıldı
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/[0.08] px-3 py-2 text-xs font-semibold text-red-300">
                <BotIcon size={13} /> Bot Durumu: Durduruldu
              </div>
            </div>
          </div>

          {/* Sidebar Card */}
          <div className="rounded-lg bg-slate-700/50 p-6">
            <h3 className="mb-4 font-display text-lg font-bold text-white">
              Sidebar Bot Status Card
            </h3>
            <div className="flex items-center gap-3 rounded-xl border border-slate-600 bg-slate-800 p-2.5">
              <div className="icon-badge grid h-9 w-9 place-items-center gradient-accent text-white">
                <BotIcon size={18} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">TK AI Bot</p>
                <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Çevrimiçi
                </p>
              </div>
            </div>
          </div>

          {/* Not Connected State */}
          <div className="rounded-lg bg-slate-700/50 p-6">
            <h3 className="mb-4 font-display text-lg font-bold text-white">
              Not Connected State (Large Hero)
            </h3>
            <div className="mx-auto flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-slate-600 bg-slate-800 p-10 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                <BotIcon size={40} />
              </div>
              <div>
                <h4 className="font-display text-lg font-bold text-white">
                  Binance bağlı değil
                </h4>
                <p className="mt-1 text-sm text-slate-400">
                  Sistem yalnızca gerçek Binance verisiyle çalışır.
                </p>
              </div>
              <button className="gradient-btn rounded-xl px-5 py-2.5 text-sm font-semibold">
                Binance'i Bağla
              </button>
            </div>
          </div>
        </section>

        {/* Animation Example */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-white">With Animation</h2>
          <div className="rounded-lg bg-slate-700/50 p-6">
            <div className="flex items-center justify-center gap-8">
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                  <BotIcon size={48} animated={true} />
                </div>
                <span className="text-xs font-mono text-slate-300">animated=true</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                  <BotIcon size={48} animated={false} />
                </div>
                <span className="text-xs font-mono text-slate-300">animated=false</span>
              </div>
            </div>
          </div>
        </section>

        {/* Design Specifications */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-white">Design Specifications</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-slate-700/50 p-6">
              <h3 className="mb-3 font-display font-bold text-white">Colors</h3>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded bg-gradient-to-r from-purple-400 to-blue-400" />
                  <span>Purple → Blue Gradient</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded bg-purple-500" />
                  <span>#a78bfa (Primary)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded bg-blue-500" />
                  <span>#3b82f6 (Accent)</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-slate-700/50 p-6">
              <h3 className="mb-3 font-display font-bold text-white">Specifications</h3>
              <div className="space-y-2 text-sm text-slate-300">
                <p><strong>Viewbox:</strong> 64x64</p>
                <p><strong>Stroke Width:</strong> 1.2px (main), 0.8px (details)</p>
                <p><strong>Format:</strong> Inline SVG</p>
                <p><strong>File Size:</strong> ~5KB</p>
              </div>
            </div>
          </div>
        </section>

        {/* Usage Code */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-white">Usage Code</h2>
          <div className="rounded-lg bg-slate-900 p-6 font-mono text-sm text-slate-300">
            <pre className="overflow-x-auto">
{`// Import
import BotIcon from '@/components/BotIcon';

// Basic usage
<BotIcon size="md" />

// Size presets
<BotIcon size="xs" />   {/* 20px */}
<BotIcon size="sm" />   {/* 24px */}
<BotIcon size="md" />   {/* 32px */}
<BotIcon size="lg" />   {/* 48px */}
<BotIcon size="xl" />   {/* 64px */}
<BotIcon size="2xl" />  {/* 80px */}

// Custom size
<BotIcon size={40} />

// With animation
<BotIcon size="md" animated={true} />

// With custom class
<BotIcon size="lg" className="text-primary" />`}
            </pre>
          </div>
        </section>

        {/* Integration Locations */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-white">Integration Locations</h2>
          <div className="space-y-3">
            {[
              {
                title: 'Dashboard Header Logo',
                file: 'HomePage.jsx',
                size: '18px',
                purpose: 'Main branding in top-left header',
              },
              {
                title: 'Bot Status Indicator',
                file: 'HomePage.jsx (BotControl)',
                size: '13px',
                purpose: 'Visual indicator in bot status badge',
              },
              {
                title: 'Sidebar Bot Status Card',
                file: 'HomePage.jsx',
                size: '18px',
                purpose: 'Connection status in sidebar',
              },
              {
                title: 'Not Connected State',
                file: 'HomePage.jsx (NotConnected)',
                size: '40px',
                purpose: 'Large hero icon for connection prompt',
              },
              {
                title: 'Account Settings Header',
                file: 'AccountPage.jsx',
                size: '18px',
                purpose: 'Consistent branding on settings page',
              },
            ].map((item, idx) => (
              <div key={idx} className="rounded-lg bg-slate-700/50 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display font-bold text-white">{item.title}</h3>
                    <p className="text-sm text-slate-400">{item.purpose}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-slate-300">{item.file}</p>
                    <p className="text-xs font-mono text-slate-400">{item.size}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-slate-700 pt-8 text-center text-slate-400">
          <p>BotIcon Component v1.0 • TK AI FINANCE Dashboard</p>
          <p className="text-xs mt-2">Professional AI Trading Bot Icon • Glassmorphism Design</p>
        </div>
      </div>
    </div>
  );
}
