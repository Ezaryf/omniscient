/**
 * Mulberry32 — a fast, seeded 32-bit PRNG.
 * Given the same seed, produces an identical sequence of numbers.
 * Returns a function that yields [0, 1) floats on each call.
 */
export function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pick a random element from an array using the seeded RNG.
 */
export function pickRandom<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Shuffle an array in-place using Fisher-Yates with the seeded RNG.
 * Returns the same array reference.
 */
export function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Returns true with probability `p` using the seeded RNG.
 */
export function chance(p: number, rng: () => number): boolean {
  return rng() < p;
}

/**
 * Generate a random float in [min, max) using the seeded RNG.
 */
export function randomInRange(
  min: number,
  max: number,
  rng: () => number
): number {
  return min + rng() * (max - min);
}
