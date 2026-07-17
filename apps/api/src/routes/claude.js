import { streamClaudeChat, isConfigured } from '../services/claudeService.js';
import logger from '../utils/logger.js';

// Basic input sanitization: strip control chars, cap length.
function sanitize(text) {
	return String(text)
		// eslint-disable-next-line no-control-regex
		.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
		.slice(0, 12000);
}

/**
 * POST /claude/chat
 * Body: { message, conversationId?, context? }
 * Streams a Server-Sent Events response compatible with the AI Assistant UI:
 *   data: {"type":"content","data":{"content":"..."}}
 *   data: {"type":"completed","conversationId":"..."}
 *   data: {"type":"error","data":{"content":"..."}}
 */
export default async (req, res) => {
	const { message, conversationId, context } = req.body || {};

	if (!message || typeof message !== 'string' || !message.trim()) {
		return res.status(422).json({ error: 'message alanı zorunludur.' });
	}

	if (!isConfigured()) {
		return res.status(422).json({
			error: 'Claude API anahtarı yapılandırılmamış. apps/api/.env dosyasına CLAUDE_API_KEY ekleyin.',
		});
	}

	const convId = (conversationId && String(conversationId)) || `conv_${Date.now()}`;
	const prompt = context && typeof context === 'string'
		? `${sanitize(context)}\n\n[SORU]\n${sanitize(message)}`
		: sanitize(message);

	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache, no-transform');
	res.setHeader('Connection', 'keep-alive');
	res.setHeader('X-Accel-Buffering', 'no');
	res.flushHeaders?.();

	const abort = new AbortController();
	req.on('close', () => abort.abort());

	const write = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

	try {
		await streamClaudeChat({
			message: prompt,
			signal: abort.signal,
			onChunk: (text) => write({ type: 'content', data: { content: text } }),
		});
		write({ type: 'completed', conversationId: convId });
		res.end();
	} catch (err) {
		if (abort.signal.aborted) {
			return res.end();
		}
		logger.error(`Claude chat failed: ${err.message}`);
		write({ type: 'error', data: { content: err.message || 'Bir hata oluştu.' } });
		res.end();
	}
};
