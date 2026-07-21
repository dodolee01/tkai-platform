/**
 * @file Vector memory abstraction: an interface plus a default
 * in-memory cosine-similarity implementation. Per the module's
 * requirements, no real vector database is implemented here — a
 * production deployment would swap in Pinecone/Weaviate/pgvector/etc.
 * behind this same interface without touching any calling code.
 * @module ai-core-engine/VectorMemory
 */

/**
 * The storage contract every vector memory implementation must satisfy.
 * @interface VectorMemoryContract
 */
/** @function @name VectorMemoryContract#upsert @param {string} id @param {number[]} vector @param {object} metadata @returns {Promise<void>} */
/** @function @name VectorMemoryContract#search @param {number[]} queryVector @param {number} topK @returns {Promise<{id: string, score: number, metadata: object}[]>} */
/** @function @name VectorMemoryContract#delete @param {string} id @returns {Promise<boolean>} */

/**
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} Cosine similarity in [-1, 1]; 0 for mismatched or zero-magnitude vectors.
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denominator = Math.sqrt(magA) * Math.sqrt(magB);
  return denominator === 0 ? 0 : dot / denominator;
}

/**
 * Abstract base class defining the vector memory contract.
 * @abstract
 */
export class VectorMemory {
  constructor() {
    if (new.target === VectorMemory) {
      throw new Error('VectorMemory is abstract and cannot be instantiated directly');
    }
  }

  /**
   * @param {string} methodName
   * @returns {never}
   * @protected
   */
  _notImplemented(methodName) {
    throw new Error(`${this.constructor.name} does not implement VectorMemory#${methodName}`);
  }

  /** @param {string} _id @param {number[]} _vector @param {object} [_metadata] @returns {Promise<void>} */
  async upsert(_id, _vector, _metadata) { this._notImplemented('upsert'); }

  /** @param {number[]} _queryVector @param {number} _topK @returns {Promise<{id: string, score: number, metadata: object}[]>} */
  async search(_queryVector, _topK) { this._notImplemented('search'); }

  /** @param {string} _id @returns {Promise<boolean>} */
  async delete(_id) { this._notImplemented('delete'); }
}

/**
 * In-memory implementation: brute-force cosine-similarity search over
 * a bounded vector set (`config.vectorMemory.maxVectors`), evicting
 * the oldest entry once full. Suitable for development, testing, and
 * small deployments; a real vector database is a drop-in replacement
 * behind the same interface for larger-scale production use.
 * @extends VectorMemory
 */
export class InMemoryVectorMemory extends VectorMemory {
  /**
   * @param {object} config - `config.vectorMemory` section.
   */
  constructor(config) {
    super();
    /** @private */ this._maxVectors = config.maxVectors;
    /** @private */ this._defaultTopK = config.defaultTopK;
    /** @private @type {Map<string, {vector: number[], metadata: object, insertedAt: number}>} */
    this._vectors = new Map();
  }

  /**
   * @param {string} id
   * @param {number[]} vector
   * @param {object} [metadata={}]
   * @returns {Promise<void>}
   */
  async upsert(id, vector, metadata = {}) {
    this._vectors.delete(id); // re-insert to refresh insertion order for FIFO eviction
    this._vectors.set(id, { vector, metadata, insertedAt: Date.now() });
    if (this._vectors.size > this._maxVectors) {
      const oldestKey = this._vectors.keys().next().value;
      this._vectors.delete(oldestKey);
    }
  }

  /**
   * @param {number[]} queryVector
   * @param {number} [topK]
   * @returns {Promise<{id: string, score: number, metadata: object}[]>} Sorted by similarity descending.
   */
  async search(queryVector, topK = this._defaultTopK) {
    const scored = Array.from(this._vectors.entries()).map(([id, entry]) => ({
      id, score: cosineSimilarity(queryVector, entry.vector), metadata: entry.metadata,
    }));
    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    return this._vectors.delete(id);
  }

  /**
   * @returns {number}
   */
  get size() {
    return this._vectors.size;
  }
}

export default { VectorMemory, InMemoryVectorMemory, cosineSimilarity };
