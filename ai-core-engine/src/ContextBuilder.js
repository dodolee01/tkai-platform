/**
 * @file Collects platform context from every upstream module
 * (Scanner, Indicators, Decision, Risk, Execution, Position,
 * Portfolio, Analytics, Learning, Notification) via injected fetch
 * functions — never by importing their source. Each module is
 * registered once with `registerSource(name, fetchFn)`; callers then
 * request whichever subset of sources a given prompt actually needs.
 * @module ai-core-engine/ContextBuilder
 */

/** @type {string[]} The 10 documented upstream module names. */
export const KNOWN_SOURCES = Object.freeze([
  'scanner', 'indicators', 'decision', 'risk', 'execution',
  'position', 'portfolio', 'analytics', 'learning', 'notification',
]);

export class ContextBuilder {
  /**
   * @param {import('./types.js').Logger} [logger]
   */
  constructor(logger = null) {
    /** @private */ this._logger = logger;
    /** @private @type {Map<string, (args?: object) => Promise<object>>} */
    this._sources = new Map();
  }

  /**
   * Register a context source. `fetchFn` is typically a thin wrapper
   * around the corresponding module's own read API (e.g.
   * `() => portfolioEngine.getEquityReport(userId)`), supplied by the
   * host application at wiring time.
   * @param {string} name - One of {@link KNOWN_SOURCES}, or a custom name for future modules.
   * @param {(args?: object) => Promise<object>} fetchFn
   * @returns {void}
   */
  registerSource(name, fetchFn) {
    if (typeof fetchFn !== 'function') throw new Error('ContextBuilder.registerSource: fetchFn must be a function');
    this._sources.set(name, fetchFn);
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  hasSource(name) {
    return this._sources.has(name);
  }

  /**
   * @returns {string[]}
   */
  getRegisteredSources() {
    return Array.from(this._sources.keys());
  }

  /**
   * Build a {@link import('./types.js').PlatformContext} by calling
   * every requested source's fetch function. A source that throws or
   * isn't registered is omitted from the result (with a logged
   * warning) rather than failing the whole context build — a single
   * unavailable module should never block AI analysis of the others.
   * @param {string[]} sourceNames
   * @param {object} [args] - Passed through to every fetch function (e.g. `{userId}`).
   * @returns {Promise<import('./types.js').PlatformContext>}
   */
  async buildContext(sourceNames, args = {}) {
    const context = {};
    const results = await Promise.allSettled(
      sourceNames.map(async (name) => {
        const fetchFn = this._sources.get(name);
        if (!fetchFn) throw new Error(`no source registered for "${name}"`);
        return { name, data: await fetchFn(args) };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        context[result.value.name] = result.value.data;
      } else {
        this._logger?.warn?.(`ContextBuilder: failed to build context`, { error: result.reason?.message });
      }
    }

    return context;
  }

  /**
   * Build context from every currently-registered source.
   * @param {object} [args]
   * @returns {Promise<import('./types.js').PlatformContext>}
   */
  async buildFullContext(args = {}) {
    return this.buildContext(this.getRegisteredSources(), args);
  }
}

export default { ContextBuilder, KNOWN_SOURCES };
