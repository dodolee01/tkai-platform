import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Code2, Play, Copy, Check, Terminal, BookOpen, KeyRound, Gauge } from 'lucide-react';
import apiServerClient from '@/lib/apiServerClient';

const ENDPOINTS = [
  { method: 'GET', path: '/v1/status', desc: 'API sağlık ve sürüm bilgisi', group: 'Sistem' },
  { method: 'GET', path: '/v1/portfolio', desc: 'Portföy özeti (K/Z, kazanma oranı, işlem sayısı)', group: 'Portföy' },
  { method: 'GET', path: '/v1/portfolio/positions', desc: 'Açık pozisyonlar', group: 'Portföy' },
  { method: 'GET', path: '/v1/trades', desc: 'İşlem listesi (sayfalama, filtre, sıralama, arama)', group: 'İşlemler', params: 'page, perPage, sort, filter, q' },
  { method: 'GET', path: '/v1/trades/:id', desc: 'Tek işlem detayı (tradeId veya kayıt id)', group: 'İşlemler' },
  { method: 'GET', path: '/v1/strategies', desc: 'Strateji profilleri', group: 'Stratejiler' },
  { method: 'GET', path: '/v1/strategies/:id', desc: 'Tek strateji (id veya key)', group: 'Stratejiler' },
  { method: 'GET', path: '/v1/backtests', desc: 'Backtest sonuçları', group: 'Backtest' },
  { method: 'GET', path: '/v1/backtests/:id', desc: 'Backtest detayı', group: 'Backtest' },
  { method: 'GET', path: '/v1/exchanges', desc: 'Bağlı borsalar (şifreli anahtarlar gizli)', group: 'Borsa' },
  { method: 'GET', path: '/v1/web3/wallets', desc: 'Bağlı Web3 cüzdanlar', group: 'Web3' },
  { method: 'GET', path: '/v1/defi/positions', desc: 'DeFi pozisyonları', group: 'DeFi' },
  { method: 'GET', path: '/v1/market/fear-greed', desc: 'Fear & Greed endeksi', group: 'Piyasa', params: 'limit' },
  { method: 'GET', path: '/v1/market/indicators', desc: 'Sembol 24s göstergeleri', group: 'Piyasa', params: 'symbol' },
];

function codeSamples(path) {
  const clean = path.replace(':id', '123');
  const base = '/hcgi/api' + clean;
  return {
    cURL: `curl -H "Authorization: Bearer <API_KEY>" \\\n  "${base}"`,
    JavaScript: `const res = await fetch("${base}", {\n  headers: { Authorization: "Bearer <API_KEY>" }\n});\nconst data = await res.json();`,
    Python: `import requests\nr = requests.get(\n  "${base}",\n  headers={"Authorization": "Bearer <API_KEY>"})\nprint(r.json())`,
    Go: `req, _ := http.NewRequest("GET", "${base}", nil)\nreq.Header.Set("Authorization", "Bearer <API_KEY>")\nres, _ := http.DefaultClient.Do(req)`,
  };
}

export default function ApiDocsPanel() {
  const [selected, setSelected] = useState(ENDPOINTS[0]);
  const [lang, setLang] = useState('cURL');
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  const groups = useMemo(() => {
    const m = {};
    ENDPOINTS.forEach((e) => { (m[e.group] ||= []).push(e); });
    return m;
  }, []);

  const samples = codeSamples(selected.path);

  const copy = () => {
    navigator.clipboard.writeText(samples[lang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const run = async () => {
    setRunning(true);
    setError(null);
    setResponse(null);
    try {
      const path = selected.path.replace(':id', 'BTCUSDT') === selected.path
        ? selected.path
        : selected.path.replace(':id', '1');
      const res = await apiServerClient.fetch(path.replace(':id', '1'));
      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch { body = text; }
      setResponse({ status: res.status, body });
    } catch (e) {
      setError(e.message || 'İstek başarısız');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold">Geliştirici API</h2>
        <p className="text-xs text-muted-foreground">Sürümlü REST API (v1) — canlı deneyin, kod örneklerini kopyalayın</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <InfoCard Icon={KeyRound} title="Kimlik Doğrulama" body="Bearer <API_KEY> başlığı ile. Anahtarınızı Bağlantı panelinden yönetin." />
        <InfoCard Icon={Gauge} title="Rate Limit" body="Kullanıcı başına 100 istek/dakika. Aşımda 429 döner." />
        <InfoCard Icon={BookOpen} title="Temel URL" body="/hcgi/api/v1 — tüm yanıtlar JSON; liste uçları sayfalama içerir." />
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="glass rounded-2xl p-3">
          <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold text-muted-foreground">
            <Terminal size={13} /> Uç Noktalar ({ENDPOINTS.length})
          </div>
          <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {Object.entries(groups).map(([group, items]) => (
              <div key={group}>
                <p className="px-1 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">{group}</p>
                {items.map((e) => (
                  <button key={e.path} onClick={() => { setSelected(e); setResponse(null); setError(null); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                      selected.path === e.path ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-white/[0.04]'
                    }`}>
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-primary">{e.method}</span>
                    <span className="truncate font-mono">{e.path}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-primary px-2 py-1 font-mono text-xs font-bold text-primary-foreground">{selected.method}</span>
              <span className="font-mono text-sm">/hcgi/api{selected.path}</span>
              <button onClick={run} disabled={running}
                className="ml-auto flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
                <Play size={14} /> {running ? 'Çalışıyor…' : 'Dene'}
              </button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{selected.desc}</p>
            {selected.params && (
              <p className="mt-1 text-xs text-muted-foreground/80">Parametreler: <span className="font-mono text-primary/80">{selected.params}</span></p>
            )}
          </div>

          <div className="glass rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-2">
              <Code2 size={14} className="text-primary" />
              <span className="text-xs font-semibold">Kod Örneği</span>
              <div className="ml-auto flex gap-1">
                {Object.keys(samples).map((l) => (
                  <button key={l} onClick={() => setLang(l)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${lang === l ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-white/[0.04]'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <pre className="overflow-x-auto rounded-xl border border-border bg-black/40 p-3 font-mono text-xs leading-relaxed text-foreground/90">{samples[lang]}</pre>
              <button onClick={copy} className="absolute right-2 top-2 rounded-lg border border-border bg-black/50 p-1.5 text-muted-foreground transition hover:text-foreground">
                {copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          {(response || error) && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
                Yanıt
                {response && <span className={`rounded px-2 py-0.5 font-mono ${response.status < 300 ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive'}`}>{response.status}</span>}
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : (
                <pre className="max-h-80 overflow-auto rounded-xl border border-border bg-black/40 p-3 font-mono text-xs text-foreground/90">
                  {typeof response.body === 'string' ? response.body : JSON.stringify(response.body, null, 2)}
                </pre>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ Icon, title, body }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon size={15} className="text-primary" /> {title}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
