import logger from '../utils/logger.js';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@tkaifinance.com';
const APP_NAME = 'TK AI FİNANCE';

const wrap = (title, bodyHtml) => `
<div style="font-family:Inter,Arial,sans-serif;background:#0b1020;padding:32px;color:#e8ecf7">
  <div style="max-width:560px;margin:0 auto;background:#12142a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden">
    <div style="padding:20px 28px;background:linear-gradient(120deg,#7c5cf6,#3b82f6);color:#fff;font-weight:800;font-size:18px">${APP_NAME}</div>
    <div style="padding:28px">
      <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
      ${bodyHtml}
    </div>
    <div style="padding:18px 28px;border-top:1px solid rgba(255,255,255,0.08);font-size:12px;color:#8891ad">
      © ${new Date().getFullYear()} ${APP_NAME}. Bu e-postayı almak istemiyorsanız
      <a href="#" style="color:#a78bfa">abonelikten çıkın</a>.
    </div>
  </div>
</div>`;

// Email templates. Each returns { subject, html }.
export const TEMPLATES = {
    welcome: (d = {}) => ({
        subject: `${APP_NAME}’a hoş geldiniz`,
        html: wrap('Hoş geldiniz!', `<p>Merhaba ${d.name || ''}, aramıza katıldığınız için teşekkürler. Kurulum sihirbazıyla hesabınızı dakikalar içinde hazırlayın.</p>`),
    }),
    passwordReset: (d = {}) => ({
        subject: 'Parola sıfırlama isteği',
        html: wrap('Parolanızı sıfırlayın', `<p>Parolanızı sıfırlamak için bağlantıya tıklayın:</p><p><a href="${d.link || '#'}" style="color:#a78bfa">Parolayı sıfırla</a></p>`),
    }),
    verify: (d = {}) => ({
        subject: 'E-posta adresinizi doğrulayın',
        html: wrap('E-postanızı doğrulayın', `<p>Hesabınızı etkinleştirmek için: <a href="${d.link || '#'}" style="color:#a78bfa">Doğrula</a></p>`),
    }),
    supportTicket: (d = {}) => ({
        subject: `Destek talebiniz alındı — ${d.ticket || ''}`,
        html: wrap('Talebiniz alındı', `
            <p>Merhaba ${d.name || ''}, destek talebiniz oluşturuldu.</p>
            <p><strong>Talep No:</strong> ${d.ticket || '-'}<br/>
            <strong>Konu:</strong> ${d.subject || '-'}<br/>
            <strong>Kategori:</strong> ${d.category || '-'}</p>
            <p style="color:#8891ad">Mesajınız: ${(d.message || '').slice(0, 500)}</p>
            <p>Ekibimiz 24 saat içinde dönüş yapacaktır.</p>`),
    }),
    tradeNotification: (d = {}) => ({
        subject: `İşlem bildirimi: ${d.symbol || ''}`,
        html: wrap('İşlem bildirimi', `<p>${d.symbol || ''} işleminizde bir güncelleme var: ${d.detail || ''}</p>`),
    }),
    strategyAlert: (d = {}) => ({
        subject: `Strateji uyarısı: ${d.strategy || ''}`,
        html: wrap('Strateji uyarısı', `<p>${d.detail || 'Stratejiniz bir sinyal üretti.'}</p>`),
    }),
    dailySummary: (d = {}) => ({
        subject: 'Günlük özet',
        html: wrap('Günlük performans özeti', `<p>Bugünkü PnL: ${d.pnl ?? '-'} · İşlem: ${d.trades ?? '-'} · Kazanma oranı: ${d.winRate ?? '-'}</p>`),
    }),
    weeklyReport: (d = {}) => ({
        subject: 'Haftalık rapor',
        html: wrap('Haftalık performans raporu', `<p>Haftalık PnL: ${d.pnl ?? '-'} · Toplam işlem: ${d.trades ?? '-'}</p>`),
    }),
};

/**
 * Send an email via SendGrid. Throws on failure so errorMiddleware handles it.
 * When no API key is configured, logs and returns a queued status (dev-safe no-op).
 */
export async function sendEmail({ to, template, data = {}, subject, html }) {
    let payloadSubject = subject;
    let payloadHtml = html;

    if (template) {
        const builder = TEMPLATES[template];
        if (!builder) throw new Error(`Unknown email template: ${template}`);
        const built = builder(data);
        payloadSubject = built.subject;
        payloadHtml = built.html;
    }

    if (!payloadSubject || !payloadHtml) {
        throw new Error('Email requires a template or subject+html');
    }

    if (!SENDGRID_API_KEY) {
        logger.info(`[email] SENDGRID_API_KEY not set — queued (not sent) to ${to}: ${payloadSubject}`);
        return { status: 'queued', delivered: false, to, subject: payloadSubject };
    }

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: FROM_EMAIL, name: APP_NAME },
            subject: payloadSubject,
            content: [{ type: 'text/html', value: payloadHtml }],
        }),
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`sendgrid send failed: ${res.status} ${res.statusText} ${detail.slice(0, 200)}`);
    }

    logger.info(`[email] sent to ${to}: ${payloadSubject}`);
    return { status: 'sent', delivered: true, to, subject: payloadSubject };
}
