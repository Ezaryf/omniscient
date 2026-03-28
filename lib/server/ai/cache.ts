/**
 * In-memory LRU cache for AI responses.
 * Keyed by branchStateHash + tick + agentId.
 */

import { AI_CACHE_SIZE } from "@/lib/sim/constants";

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

export class AICache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;

  constructor(maxSize = AI_CACHE_SIZE) {
    this.maxSize = maxSize;
  }

  /**
   * Build a cache key from branch state hash, tick, and agent ID.
   */
  static buildKey(stateHash: string, tick: number, agentId: string): string {
    return `${stateHash}:${tick}:${agentId}`;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, { value, timestamp: Date.now() });
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
