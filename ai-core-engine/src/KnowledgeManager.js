/**
 * @file A simple, in-memory domain-knowledge store: platform
 * documentation snippets, trading-concept explanations, and other
 * static reference material the AI can be given as grounding context
 * alongside live platform data. Search is substring/keyword based —
 * semantic search over this content is {@link VectorMemory}'s job,
 * not this module's.
 * @module ai-core-engine/KnowledgeManager
 */

/**
 * @typedef {Object} KnowledgeEntry
 * @property {string} id
 * @property {string} topic
 * @property {string} content
 * @property {string[]} tags
 */

export class KnowledgeManager {
  constructor() {
    /** @private @type {Map<string, KnowledgeEntry>} */
    this._entries = new Map();
  }

  /**
   * @param {string} id
   * @param {string} topic
   * @param {string} content
   * @param {string[]} [tags=[]]
   * @returns {void}
   */
  addEntry(id, topic, content, tags = []) {
    this._entries.set(id, { id, topic, content, tags });
  }

  /**
   * @param {string} id
   * @returns {KnowledgeEntry|undefined}
   */
  getEntry(id) {
    return this._entries.get(id);
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  removeEntry(id) {
    return this._entries.delete(id);
  }

  /**
   * Case-insensitive search across topic, content, and tags.
   * @param {string} query
   * @returns {KnowledgeEntry[]}
   */
  search(query) {
    const needle = query.toLowerCase();
    return Array.from(this._entries.values()).filter(
      (e) => e.topic.toLowerCase().includes(needle) || e.content.toLowerCase().includes(needle) || e.tags.some((t) => t.toLowerCase().includes(needle))
    );
  }

  /**
   * @param {string} tag
   * @returns {KnowledgeEntry[]}
   */
  getByTag(tag) {
    return Array.from(this._entries.values()).filter((e) => e.tags.includes(tag));
  }

  /**
   * @returns {KnowledgeEntry[]}
   */
  getAll() {
    return Array.from(this._entries.values());
  }

  /**
   * @returns {number}
   */
  get size() {
    return this._entries.size;
  }
}

export default KnowledgeManager;
