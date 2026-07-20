/**
 * @file Process entrypoint for running the scanner standalone
 * (e.g. under Docker/PM2/systemd on the VPS). Wires SIGTERM/SIGINT
 * to a graceful shutdown, per the "graceful shutdown" requirement.
 * @module scanner/bin/start
 */

import { ScannerManager } from '../ScannerManager.js';

const scanner = new ScannerManager({ env: process.env.SCANNER_ENV });

async function shutdown(signal) {
  scanner.logger.info(`Received ${signal}, shutting down gracefully`);
  try {
    await scanner.stop();
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error during graceful shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

scanner.start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error starting scanner:', err);
  process.exit(1);
});
