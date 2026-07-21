/**
 * @file Wraps an injected embedding-generation function. Real
 * embeddings require a call to a provider's embedding endpoint (e.g.
 * OpenAI's `/v1/embeddings`) — this module never fabricates vectors
 * itself; it validates and forwards to whatever embedding function
 * the host application supplies (consistent with this platform's
 * dependency-injection pattern for every real external call).
 * @module ai-core-engine/EmbeddingManager
 */

export class EmbeddingManager {
  /**
   * @param {Object} deps
   * @param {(text: string) => Promise<number[]>} deps.embed - Injected embedding function (e.g. wrapping a real provider's embeddings endpoint).
   */
  constructor({ embed }) {
    if (typeof embed !== 'function') throw new Error('EmbeddingManager: embed dependency is required');
    /** @private */ this._embed = embed;
  }

  /**
   * @param {string} text
   * @returns {Promise<number[]>}
   */
  async embedText(text) {
    if (!text || text.trim().length === 0) {
      throw new Error('EmbeddingManager.embedText: text must be non-empty');
    }
    const vector = await this._embed(text);
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error('EmbeddingManager.embedText: embed function must return a non-empty numeric array');
    }
    return vector;
  }

  /**
   * @param {string[]} texts
   * @returns {Promise<number[][]>}
   */
  async embedBatch(texts) {
    return Promise.all(texts.map((t) => this.embedText(t)));
  }
}

export default EmbeddingManager;
