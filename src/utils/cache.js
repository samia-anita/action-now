'use strict';

/**
 * Simple in-memory LRU-style cache with TTL expiration.
 * Suitable for caching Groq API responses to reduce cost and latency.
 *
 * Cache key: deterministic hash of (location, issue, time, sorted skills)
 */
class Cache {
  /**
   * @param {object} [opts]
   * @param {number} [opts.ttlMs=300000]  TTL in milliseconds (default: 5 minutes)
   * @param {number} [opts.maxSize=100]   Maximum number of entries
   */
  constructor(opts = {}) {
    this.ttlMs = opts.ttlMs ?? 5 * 60 * 1000;
    this.maxSize = opts.maxSize ?? 100;
    this.store = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Builds a deterministic cache key from request parameters.
   * @param {string} location
   * @param {string} issue
   * @param {string} time
   * @param {string[]} skills
   * @returns {string}
   */
  static buildKey(location, issue, time, skills = []) {
    const normalizedLocation = location.trim().toLowerCase();
    const sortedSkills = [...skills].sort().join(',');
    return `${normalizedLocation}|${issue}|${time}|${sortedSkills}`;
  }

  /**
   * @param {string} key
   * @returns {unknown|null} Cached value or null if expired/missing
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) { this.misses++; return null; }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.value;
  }

  /**
   * @param {string} key
   * @param {unknown} value
   */
  set(key, value) {
    // Evict oldest entry if at capacity
    if (this.store.size >= this.maxSize) {
      const oldest = this.store.keys().next().value;
      this.store.delete(oldest);
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs
    });
  }

  /** @returns {{ size: number, hits: number, misses: number, hitRate: string }} */
  stats() {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 'N/A' : `${((this.hits / total) * 100).toFixed(1)}%`
    };
  }

  clear() {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

// Singleton shared across the app
const cache = new Cache();

module.exports = { Cache, cache };
