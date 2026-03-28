import { describe, it, expect } from "vitest";
import { hashState, canonicalize } from "@/lib/sim/hash";

describe("State Hashing", () => {
  it("produces the same hash for identical objects", async () => {
    const obj = { a: 1, b: "hello", c: [1, 2, 3] };
    const hash1 = await hashState(obj);
    const hash2 = await hashState(obj);

    expect(hash1).toBe(hash2);
  });

  it("produces the same hash regardless of key order", async () => {
    const obj1 = { b: 2, a: 1, c: 3 };
    const obj2 = { a: 1, b: 2, c: 3 };

    const hash1 = await hashState(obj1);
    const hash2 = await hashState(obj2);

    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different objects", async () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 3 };

    const hash1 = await hashState(obj1);
    const hash2 = await hashState(obj2);

    expect(hash1).not.toBe(hash2);
  });

  it("handles nested objects", async () => {
    const obj1 = { a: { b: { c: 1 } } };
    const obj2 = { a: { b: { c: 1 } } };

    const hash1 = await hashState(obj1);
    const hash2 = await hashState(obj2);

    expect(hash1).toBe(hash2);
  });

  it("handles arrays", async () => {
    const obj1 = { items: [1, 2, 3] };
    const obj2 = { items: [1, 2, 3] };

    expect(await hashState(obj1)).toBe(await hashState(obj2));
  });

  it("distinguishes array order", async () => {
    const obj1 = { items: [1, 2, 3] };
    const obj2 = { items: [3, 2, 1] };

    expect(await hashState(obj1)).not.toBe(await hashState(obj2));
  });
});

describe("Canonicalize", () => {
  it("sorts object keys", () => {
    const result = canonicalize({ c: 3, a: 1, b: 2 });
    expect(result).toBe('{"a":1,"b":2,"c":3}');
  });

  it("handles null", () => {
    expect(canonicalize(null)).toBe("null");
  });

  it("handles arrays", () => {
    expect(canonicalize([1, 2, 3])).toBe("[1,2,3]");
  });

  it("handles nested objects with sorted keys", () => {
    const result = canonicalize({ b: { d: 4, c: 3 }, a: 1 });
    expect(result).toBe('{"a":1,"b":{"c":3,"d":4}}');
  });
});
