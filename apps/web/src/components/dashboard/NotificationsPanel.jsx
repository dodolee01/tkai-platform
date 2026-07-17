import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, TrendingUp, ShieldX, Target, XCircle, PlugZap, Send, Mail, Globe } from 'lucide-react';

const ICONS = {
  open: { Icon: TrendingUp, c: 'text-primary bg-primary/12' },
  tp: { Icon: Target, c: 'text-primary bg-primary/12' },
  close: { Icon: XCircle, c: 'text-muted-foreground bg-muted' },
  sl: { Icon: ShieldX, c: 'text-destructive bg-destructive/12' },
  error: { Icon: ShieldX, c: 'text-destructive bg-destructive/12' },
  disc: { Icon: PlugZap, c: 'text-amber-400 bg-amber-400/12' },
};

function ago(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s önce`;
  if (s < 3600) return `${Math.floor(s / 60)}dk önce`;
  return `${Math.floor(s / 3600)}sa önce`;
}

export default function NotificationsPanel({ notifications, settings }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-primary/12 p-2 text-primary"><Bell size={18} /></div>
          <h3 className="font-display font-bold">Bildirimler</h3>
        </div>
        <div className="flex gap-1.5">
          <Chan on={settings.notifyTelegram} Icon={Send} />
          <Chan on={settings.notifyEmail} Icon={Mail} />
          <Chan on={settings.notifyWeb} Icon={Globe} />
        </div>
      </div>

      <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {notifications.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">Henüz bildirim yok.</div>
          )}
          {notifications.map((n) => {
            const { Icon, c } = ICONS[n.type] || ICONS.open;
            return (
              <motion.div key={n.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="flex gap-3 rounded-xl border border-border bg-black/20 p-3">
                <div className={`h-fit rounded-lg p-1.5 ${c}`}><Icon size={14} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{n.title}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{ago(n.at)}</span>
                  </div>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{n.msg}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Chan({ on, Icon }) {
  return (
    <div className={`rounded-lg p-1.5 ${on ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground/50'}`} title={on ? 'Aktif' : 'Kapalı'}>
      <Icon size={13} />
    </div>
  );
}
