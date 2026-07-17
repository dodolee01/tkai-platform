import rateLimit from 'express-rate-limit';

/**
 * Global per-IP rate limiter: 100 requests / 15 minutes.
 * Applied to every request before routing.
 */
export const globalRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 100,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many requests, please try again later' },
	validate: { trustProxy: false },
});

/**
 * Stricter limiter for sensitive state-changing endpoints
 * (order placement, exchange connect/disconnect): 20 requests / minute.
 */
export const sensitiveRateLimit = rateLimit({
	windowMs: 60 * 1000,
	max: 20,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many trading requests, slow down and try again shortly' },
	validate: { trustProxy: false },
});
