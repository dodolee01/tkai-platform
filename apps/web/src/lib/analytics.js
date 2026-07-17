// =============================================================
// TK AI FİNANCE — Analytics (Google Analytics 4)
// Loads gtag.js lazily and exposes a tiny, crash-proof API.
// Set the measurement id in apps/web/.env:  VITE_GA4_ID=G-XXXXXXXXXX
// Without an id, every call is a no-op (safe in dev / preview).
// =============================================================

const GA4_ID = import.meta.env.VITE_GA4_ID || '';
let initialized = false;

function gtag() {
	// eslint-disable-next-line prefer-rest-params
	window.dataLayer.push(arguments);
}

/** Injects the GA4 script once. Safe to call multiple times. */
export function initAnalytics() {
	if (initialized || !GA4_ID || typeof window === 'undefined') return;
	initialized = true;

	const s = document.createElement('script');
	s.async = true;
	s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
	document.head.appendChild(s);

	window.dataLayer = window.dataLayer || [];
	window.gtag = gtag;
	gtag('js', new Date());
	gtag('config', GA4_ID, { anonymize_ip: true });
}

/** Track a page view (call on route change). */
export function trackPageView(path) {
	if (!GA4_ID || typeof window === 'undefined' || !window.gtag) return;
	window.gtag('event', 'page_view', {
		page_path: path || window.location.pathname,
		page_location: window.location.href,
	});
}

/**
 * Track a custom event.
 * Business events used across the app:
 *  - bot_started / bot_stopped
 *  - trade_opened / trade_closed
 *  - strategy_activated
 *  - api_key_connected
 *  - backtest_run
 */
export function trackEvent(name, params = {}) {
	if (!GA4_ID || typeof window === 'undefined' || !window.gtag) return;
	window.gtag('event', name, params);
}

export default { initAnalytics, trackPageView, trackEvent };
