/**
 * @file Owns conversation sessions: creation, message history,
 * and context-window-budgeted prompt assembly (trims oldest turns
 * first when the estimated token count exceeds the configured budget).
 * @module ai-core-engine/ConversationManager
 */

import { randomUUID } from 'node:crypto';

export class ConversationManager {
  /**
   * @param {Object} deps
   * @param {import('./MemoryManager.js').MemoryManager} deps.memoryManager
   * @param {import('./TokenManager.js').TokenManager} deps.tokenManager
   * @param {import('./AIEvents.js').AIEventPublisher} deps.eventPublisher
   * @param {object} config - `config.memory` section.
   */
  constructor({ memoryManager, tokenManager, eventPublisher }, config) {
    /** @private */ this._memoryManager = memoryManager;
    /** @private */ this._tokenManager = tokenManager;
    /** @private */ this._eventPublisher = eventPublisher;
    /** @private */ this._config = config;
    /** @private @type {Map<string, {id: string, userId: string|undefined, createdAt: number}>} */
    this._conversations = new Map();
  }

  /**
   * @param {string} [userId]
   * @returns {{id: string, userId: string|undefined, createdAt: number}}
   */
  createConversation(userId) {
    const conversation = { id: randomUUID(), userId, createdAt: Date.now() };
    this._conversations.set(conversation.id, conversation);
    this._eventPublisher.safeEmit('conversationCreated', conversation);
    return conversation;
  }

  /**
   * @param {string} conversationId
   * @returns {{id: string, userId: string|undefined, createdAt: number}|undefined}
   */
  getConversation(conversationId) {
    return this._conversations.get(conversationId);
  }

  /**
   * Append a message to a conversation's history.
   * @param {string} conversationId
   * @param {import('./types.js').ChatMessage} message
   * @returns {void}
   * @throws {Error} If the conversation doesn't exist.
   */
  addMessage(conversationId, message) {
    if (!this._conversations.has(conversationId)) {
      throw new Error(`ConversationManager: no conversation with id "${conversationId}"`);
    }
    this._memoryManager.addShortTermTurn(conversationId, message);
  }

  /**
   * @param {string} conversationId
   * @returns {import('./types.js').ChatMessage[]}
   */
  getHistory(conversationId) {
    return this._memoryManager.getShortTermMemory(conversationId);
  }

  /**
   * Assemble the conversation history trimmed to fit within the
   * configured context-window token budget — drops the oldest turns
   * first, always keeping the most recent ones (which matter most
   * for continuity).
   * @param {string} conversationId
   * @returns {import('./types.js').ChatMessage[]}
   */
  getHistoryWithinBudget(conversationId) {
    const fullHistory = this.getHistory(conversationId);
    const budget = this._config.contextWindowTokenBudget;

    let totalTokens = 0;
    const kept = [];
    for (let i = fullHistory.length - 1; i >= 0; i--) {
      const messageTokens = this._tokenManager.estimate(fullHistory[i].content);
      if (totalTokens + messageTokens > budget && kept.length > 0) break;
      totalTokens += messageTokens;
      kept.unshift(fullHistory[i]);
    }
    return kept;
  }

  /**
   * @param {string} conversationId
   * @returns {boolean}
   */
  endConversation(conversationId) {
    this._memoryManager.clearShortTermMemory(conversationId);
    return this._conversations.delete(conversationId);
  }
}

export default ConversationManager;
