import { sendEmail } from '../lib/email.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /email/send — validate + send/queue a templated email.
 * Body: { to, template?, data?, subject?, html? }
 */
export default async (req, res) => {
    const { to, template, data, subject, html } = req.body || {};

    if (!to || !EMAIL_RE.test(String(to))) {
        return res.status(422).json({ error: 'Geçerli bir e-posta adresi (to) gerekli.' });
    }
    if (!template && !(subject && html)) {
        return res.status(422).json({ error: 'template veya subject+html gerekli.' });
    }

    const result = await sendEmail({ to, template, data, subject, html });
    res.json({ ok: true, ...result });
};
