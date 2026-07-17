import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import routes from './routes/index.js';
import { errorMiddleware } from './middleware/error.js';
import { globalRateLimit } from './middleware/global-rate-limit.js';
import logger from './utils/logger.js';
import { BodyLimit } from './constants/common.js';

const app = express();

app.set('trust proxy', true);

process.on('uncaughtException', (error) => {
	logger.error('Uncaught exception:', error);
});
  
process.on('unhandledRejection', (reason, promise) => {
	logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

process.on('SIGINT', async () => {
	logger.info('Interrupted');
	process.exit(0);
});

process.on('SIGTERM', async () => {
	logger.info('SIGTERM signal received');

	await new Promise(resolve => setTimeout(resolve, 3000));

	logger.info('Exiting');
	process.exit();
});

// --- Security headers (Task 1: security hardening) ---
app.use(helmet({
	contentSecurityPolicy: {
		useDefaults: true,
		directives: {
			defaultSrc: ["'self'"],
			connectSrc: ["'self'", 'https:', 'wss:'],
			imgSrc: ["'self'", 'data:', 'https:'],
			scriptSrc: ["'self'"],
			styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
			fontSrc: ["'self'", 'https:', 'data:'],
			frameAncestors: ["'none'"],
		},
	},
	hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
	frameguard: { action: 'deny' },
	referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
	crossOriginResourcePolicy: { policy: 'same-site' },
}));

// Explicit headers not fully covered by helmet defaults.
app.use((req, res, next) => {
	res.setHeader('X-Content-Type-Options', 'nosniff');
	res.setHeader('X-XSS-Protection', '1; mode=block');
	res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
	next();
});

// Redirect HTTP -> HTTPS in production (behind a proxy that sets x-forwarded-proto).
app.use((req, res, next) => {
	if (
		process.env.NODE_ENV === 'production' &&
		req.headers['x-forwarded-proto'] &&
		req.headers['x-forwarded-proto'] !== 'https'
	) {
		return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
	}
	next();
});

// --- CORS whitelist with restricted methods/headers ---
const corsWhitelist = (process.env.CORS_ORIGIN || '')
	.split(',')
	.map((o) => o.trim())
	.filter(Boolean);

app.use(cors({
	origin: (origin, callback) => {
		// Allow same-origin/non-browser (no Origin header) and whitelisted origins.
		// Empty whitelist or "*" = allow all (local/dev/preview convenience).
		const allowAll = corsWhitelist.length === 0 || corsWhitelist.includes('*');
		// Always allow platform preview/deploy domains so the app works in-sandbox.
		const isPlatformOrigin =
			!!origin &&
			/\.(app-preview\.(com|io)|hostingersite\.com)$/i.test(origin);
		if (!origin || allowAll || isPlatformOrigin || corsWhitelist.includes(origin)) {
			return callback(null, true);
		}
		return callback(new Error('Not allowed by CORS'));
	},
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
	credentials: true,
	maxAge: 86400,
}));
app.use(morgan('combined'));
app.use(globalRateLimit);
app.use(express.json({
	limit: BodyLimit,
}));
app.use(express.urlencoded({ 
	extended: true,
	limit: BodyLimit,
}));

app.use('/', routes());

app.use(errorMiddleware);

app.use((req, res) => {
	res.status(404).json({ error: 'Route not found' });
});

const port = process.env.PORT || 3001;

app.listen(port, () => {
	logger.info(`🚀 API Server running on http://localhost:${port}`);
});

export default app;
