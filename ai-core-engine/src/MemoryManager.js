/**
 * @file Multi-tier conversation memory: short-term (recent turns kept
 * verbatim, bounded), long-term (persisted key facts, bounded), and
 * session memory (per-session scratch state with idle expiry). The
 * context-window budget itself is enforced by
 * {@link ConversationManager} when assembling a prompt — this module
 * owns storage and eviction policy only.
 * @module ai-core-engine/MemoryManager
 */

export class MemoryManager {
  /**
   * @param {object} config - `config.memory` section.
   * @param {() => number} [clock=Date.now]
   */
  constructor(config, clock = Date.now) {
    /** @private */ this._config = config;
    /** @private */ this._clock = clock;
    /** @private @type {Map<string, import('./types.js').ChatMessage[]>} */
    this._shortTerm = new Map();
    /** @private @type {Map<string, {fact: string, storedAt: number}[]>} */
    this._longTerm = new Map();
    /** @private @type {Map<string, {data: object, lastTouchedAt: number}>} */
    this._sessions = new Map();
  }

  /**
   * Append a turn to a conversation's short-term memory, evicting the
   * oldest turn once `shortTermTurnLimit` is exceeded.
   * @param {string} conversationId
   * @param {import('./types.js').ChatMessage} message
   * @returns {void}
   */
  addShortTermTurn(conversationId, message) {
    if (!this._shortTerm.has(conversationId)) this._shortTerm.set(conversationId, []);
    const turns = this._shortTerm.get(conversationId);
    turns.push(message);
    if (turns.length > this._config.shortTermTurnLimit) turns.shift();
  }

  /**
   * @param {string} conversationId
   * @returns {import('./types.js').ChatMessage[]}
   */
  getShortTermMemory(conversationId) {
    return (this._shortTerm.get(conversationId) ?? []).slice();
  }

  /**
   * Store a durable fact for long-term recall (e.g. "user prefers
   * conservative leverage"), evicting the oldest fact once
   * `longTermFactLimit` is exceeded.
   * @param {string} userId
   * @param {string} fact
   * @returns {void}
   */
  addLongTermFact(userId, fact) {
    if (!this._longTerm.has(userId)) this._longTerm.set(userId, []);
    const facts = this._longTerm.get(userId);
    facts.push({ fact, storedAt: this._clock() });
    if (facts.length > this._config.longTermFactLimit) facts.shift();
  }

  /**
   * @param {string} userId
   * @returns {string[]}
   */
  getLongTermFacts(userId) {
    return (this._longTerm.get(userId) ?? []).map((f) => f.fact);
  }

  /**
   * Store or update arbitrary session-scoped state (e.g. "currently
   * discussing BTCUSDT"), refreshing its idle-expiry clock.
   * @param {string} sessionId
   * @param {object} data - Merged into any existing session data.
   * @returns {void}
   */
  updateSession(sessionId, data) {
    const existing = this._sessions.get(sessionId);
    const merged = { ...(existing?.data ?? {}), ...data };
    this._sessions.set(sessionId, { data: merged, lastTouchedAt: this._clock() });
  }

  /**
   * @param {string} sessionId
   * @returns {object|null} `null` if the session doesn't exist or has expired.
   */
  getSession(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) return null;
    if (this._clock() - session.lastTouchedAt > this._config.sessionIdleTtlMs) {
      this._sessions.delete(sessionId);
      return null;
    }
    return { ...session.data };
  }

  /**
   * Remove every session whose idle TTL has elapsed. Call
   * periodically to bound memory for long-running processes.
   * @returns {number} Count of sessions removed.
   */
  pruneExpiredSessions() {
    const now = this._clock();
    let removed = 0;
    for (const [sessionId, session] of this._sessions) {
      if (now - session.lastTouchedAt > this._config.sessionIdleTtlMs) {
        this._sessions.delete(sessionId);
        removed += 1;
      }
    }
    return removed;
  }

  /**
   * @param {string} conversationId
   * @returns {void}
   */
  clearShortTermMemory(conversationId) {
    this._shortTerm.delete(conversationId);
  }
}

export default MemoryManager;
