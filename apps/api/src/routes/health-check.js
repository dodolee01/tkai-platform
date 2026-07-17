/**
 * Health check endpoint used for uptime monitoring and status pages.
 * Returns service status, uptime, timestamp, and memory footprint.
 */
export default async (req, res) => {
	const mem = process.memoryUsage();
	res.json({
		status: 'ok',
		uptime: Math.round(process.uptime()),
		timestamp: new Date().toISOString(),
		memory: {
			rss: Math.round(mem.rss / 1024 / 1024),
			heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
		},
	});
};
