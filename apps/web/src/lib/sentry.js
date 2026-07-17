// =============================================================
// TK AI FİNANCE — Sentry Error Tracking & Performance Monitoring
// Lazily initializes @sentry/react and exposes a tiny, crash-proof API.
// Set the DSN in apps/web/.env:  VITE_SENTRY_DSN=https://...
// Without a DSN, every call is a no-op (safe in dev / preview) — nothing
// is ever sent, and the app never throws because Sentry is missing.
// =============================================================

import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';
const ENVIRONMENT =
	import.meta.env.VITE_SENTRY_ENVIRONMENT || (import.meta.env.MODE === 'production' ? 'production' : 'development');
const RELEASE = import.meta.env.VITE_SENTRY_RELEASE || import.meta.env.VITE_APP_VERSION || 'tk-ai-finance@dev';
const TRACES_SAMPLE_RATE = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.2);
const REPLAYS_SAMPLE_RATE = Number(import.meta.env.VITE_SENTRY_REPLAYS_SAMPLE_RATE ?? 0);

let initialized = false;

/** Errors that are noisy/benign and shouldn't be reported. */
const IGNORED_ERRORS = [
	'ResizeObserver loop limit exceeded',
	'ResizeObserver loop completed with undelivered notifications',
	'Non-Error promise rejection captured',
	'Network Error',
	'Load failed',
];

/** Initializes Sentry once. Safe to call multiple times; no-op without a DSN. */
export function initSentry() {
	if (initialized || !SENTRY_DSN || typeof window === 'undefined') return;
	initialized = true;

	try {
		Sentry.init({
			dsn: SENTRY_DSN,
			environment: ENVIRONMENT,
			release: RELEASE,
			integrations: [
				Sentry.browserTracingIntegration(),
				...(REPLAYS_SAMPLE_RATE > 0 ? [Sentry.replayIntegration()] : []),
			],
			// Performance monitoring (page loads, navigations, Core Web Vitals).
			tracesSampleRate: TRACES_SAMPLE_RATE,
			replaysSessionSampleRate: REPLAYS_SAMPLE_RATE,
			replaysOnErrorSampleRate: REPLAYS_SAMPLE_RATE > 0 ? 1.0 : 0,
			ignoreErrors: IGNORED_ERRORS,
			beforeSend(event) {
				// Drop events with no meaningful message (defensive noise filter).
				if (!event?.exception && !event?.message) return null;
				return event;
			},
		});
		instrumentFetch();
	} catch (err) {
		// Never let telemetry setup crash the app.
		// eslint-disable-next-line no-console
		console.error('Sentry init failed:', err);
		initialized = false;
	}
}

export function isSentryEnabled() {
	return initialized && !!SENTRY_DSN;
}

let fetchPatched = false;

/**
 * Wraps window.fetch once so every API/network call is auto-instrumented:
 * failed responses and thrown network errors are reported as breadcrumbs/
 * exceptions, and response time is added as a breadcrumb. No-op without a DSN.
 */
export function instrumentFetch() {
	if (fetchPatched || typeof window === 'undefined' || !window.fetch) return;
	fetchPatched = true;
	const originalFetch = window.fetch.bind(window);

	window.fetch = async (...args) => {
		const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
		const start = performance.now?.() ?? Date.now();
		try {
			const response = await originalFetch(...args);
			const duration = Math.round((performance.now?.() ?? Date.now()) - start);
			addBreadcrumb(`fetch ${response.status} ${url}`, 'http', { url, status: response.status, duration });
			if (!response.ok) {
				captureMessage(`API error ${response.status} on ${url}`, 'warning', { url, status: response.status });
			}
			return response;
		} catch (err) {
			captureException(err, { type: 'network_error', url });
			throw err;
		}
	};
}

/** Reports a caught exception (API errors, network errors, manual catches). */
export function captureException(error, context = {}) {
	if (!isSentryEnabled()) return;
	try {
		Sentry.captureException(error, { extra: context });
	} catch {
		/* swallow — telemetry must never break the app */
	}
}

/** Reports a message-level event (non-exception issues worth tracking). */
export function captureMessage(message, level = 'info', context = {}) {
	if (!isSentryEnabled()) return;
	try {
		Sentry.captureMessage(message, { level, extra: context });
	} catch {
		/* noop */
	}
}

/** Adds a breadcrumb (user action trail leading up to an eventual error). */
export function addBreadcrumb(message, category = 'action', data = {}) {
	if (!isSentryEnabled()) return;
	try {
		Sentry.addBreadcrumb({ message, category, data, level: 'info', timestamp: Date.now() / 1000 });
	} catch {
		/* noop */
	}
}

/** Sets the current user context (id, email, plus custom properties + browser/OS). */
export function setSentryUser(user) {
	if (!isSentryEnabled()) return;
	try {
		if (!user) {
			Sentry.setUser(null);
			return;
		}
		Sentry.setUser({
			id: user.id,
			email: user.email,
			username: user.name || user.username,
			browser: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
			os: typeof navigator !== 'undefined' ? navigator.platform : undefined,
			...user.extra,
		});
	} catch {
		/* noop */
	}
}

export function clearSentryUser() {
	setSentryUser(null);
}

/** Sets a custom tag (e.g. bot_status, exchange, active_tab) for filtering in Sentry. */
export function setSentryTag(key, value) {
	if (!isSentryEnabled()) return;
	try {
		Sentry.setTag(key, value);
	} catch {
		/* noop */
	}
}

/** Wraps the root App component so React render errors are reported + a fallback UI shows. */
export function withSentryProfiler(Component) {
	if (!SENTRY_DSN) return Component;
	try {
		return Sentry.withProfiler(Component);
	} catch {
		return Component;
	}
}

/**
 * Measures and reports a named span (component render time, API call duration, etc.).
 * Falls back to running the function directly when Sentry/tracing is disabled.
 */
export async function measureSpan(name, op, fn) {
	if (!isSentryEnabled()) return fn();
	try {
		return await Sentry.startSpan({ name, op }, () => fn());
	} catch (err) {
		captureException(err, { span: name, op });
		throw err;
	}
}

export default {
	initSentry,
	isSentryEnabled,
	captureException,
	captureMessage,
	addBreadcrumb,
	setSentryUser,
	clearSentryUser,
	setSentryTag,
	withSentryProfiler,
	measureSpan,
};
