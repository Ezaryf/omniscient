/**
 * Deterministic state hashing.
 * Produces a canonical JSON string and hashes it with SHA-256.
 * Uses Web Crypto API (available in Node 18+ and all modern browsers).
 */

/**
 * Canonical JSON: sorts object keys recursively to ensure
 * the same state always produces the same string.
 */
function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const pairs = keys.map(
      (k) =>
        JSON.stringify(k) +
        ":" +
        canonicalize((value as Record<string, unknown>)[k])
    );
    return "{" + pairs.join(",") + "}";
  }
  return "null";
}

/**
 * Hash any JS value into a hex-encoded SHA-256 string.
 * Async because Web Crypto digest is async.
 */
export async function hashState(state: unknown): Promise<string> {
  const canonical = canonicalize(state);
  const data = new TextEncoder().encode(canonical);

  // Use Node crypto if available (server), otherwise Web Crypto
  if (typeof globalThis.crypto?.subtle !== "undefined") {
    const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Fallback: FNV-1a hash (better distribution, fewer collisions)
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Synchronous canonical JSON for comparison (not hashing).
 */
export { canonicalize };
