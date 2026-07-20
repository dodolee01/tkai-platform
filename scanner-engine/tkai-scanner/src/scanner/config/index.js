/**
 * @file Configuration loader — selects the active environment profile.
 * @module scanner/config
 */

import development from './development.js';
import production from './production.js';
import testnet from './testnet.js';
import live from './live.js';

const PROFILES = { development, production, testnet, live };

/**
 * Load the scanner configuration for a given environment.
 * Falls back to `development` if the requested environment is unknown.
 * @param {string} [env] - One of 'development' | 'production' | 'testnet' | 'live'.
 *   Defaults to `process.env.SCANNER_ENV` or 'development'.
 * @returns {object} The resolved, deep-cloned configuration object.
 */
export function loadConfig(env = process.env.SCANNER_ENV || 'development') {
  const profile = PROFILES[env];
  if (!profile) {
    throw new Error(
      `loadConfig: unknown environment "${env}". Valid options: ${Object.keys(PROFILES).join(', ')}`
    );
  }
  // Deep clone via structuredClone so callers can safely mutate their copy
  // without corrupting the shared profile object.
  return structuredClone(profile);
}

export default loadConfig;
