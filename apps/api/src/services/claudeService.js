import logger from '../utils/logger.js';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
const CLAUDE_API_URL = process.env.CLAUDE_API_URL || 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = [
	'Sen TK AI FİNANCE platformunun kripto ticaret asistanısın.',
	'Kullanıcıya Türkçe, net ve kısa yanıtlar ver.',
	'Uzmanlık alanların: ticaret tavsiyeleri, piyasa analizi, strateji önerileri,',
	'risk yönetimi ipuçları, portföy analizi ve genel kripto soruları.',
	'Sana [CANLI VERİ] bloğu verilirse yanıtını bu verilere dayandır.',
	'Yatırım tavsiyesi verirken riskleri belirt; kesin kâr vaadi verme.',
	'Markdown kullanabilirsin (kalın, madde işaretleri, kısa başlıklar).',
].join(' ');

export function isConfigured() {
	return Boolean(CLAUDE_API_KEY);
}

/**
 * Streams a Claude chat completion. Calls onChunk(text) for each token
 * delta. Resolves when the stream completes. Throws on any failure so the
 * caller (route) can forward the error to the client / errorMiddleware.
 *
 * @param {Object}   opts
 * @param {string}   opts.message  Sanitized user message (may include context).
 * @param {AbortSignal} [opts.signal]
 * @param {(text:string)=>void} opts.onChunk
 */
export async function streamClaudeChat({ message, signal, onChunk }) {
	if (!CLAUDE_API_KEY) {
		throw new Error(
			'CLAUDE_API_KEY tanımlı değil. Lütfen apps/api/.env dosyasına Anthropic API anahtarınızı ekleyin.',
		);
	}

	const upstream = await fetch(CLAUDE_API_URL, {
		method: 'POST',
		signal,
		headers: {
			'content-type': 'application/json',
			'x-api-key': CLAUDE_API_KEY,
			'anthropic-version': '2023-06-01',
		},
		body: JSON.stringify({
			model: CLAUDE_MODEL,
			max_tokens: 1500,
			stream: true,
			system: SYSTEM_PROMPT,
			messages: [{ role: 'user', content: message }],
		}),
	});

	if (!upstream.ok || !upstream.body) {
		let detail = '';
		try {
			detail = await upstream.text();
		} catch {
			detail = '';
		}
		logger.error(`Claude API error: ${upstream.status} ${upstream.statusText}`);
		throw new Error(
			`Claude API isteği başarısız oldu: ${upstream.status} ${upstream.statusText}${detail ? ` — ${detail.slice(0, 300)}` : ''}`,
		);
	}

	const reader = upstream.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const events = buffer.split('\n\n');
		buffer = events.pop() || '';
		for (const ev of events) {
			const dataLine = ev
				.split('\n')
				.filter((l) => l.startsWith('data:'))
				.map((l) => l.slice(5).trim())
				.join('');
			if (!dataLine || dataLine === '[DONE]') continue;
			let parsed;
			try {
				parsed = JSON.parse(dataLine);
			} catch {
				continue;
			}
			if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
				onChunk(parsed.delta.text);
			} else if (parsed.type === 'error') {
				throw new Error(parsed.error?.message || 'Claude akış hatası');
			}
		}
	}
}
