import { describe, it, expect } from "vitest";
import { secureRandomPick } from "../src/services/token-engine";

describe("secureRandomPick (Cryptographically secure RNG)", () => {
  it("picks the exact requested count from an available list without duplicates", () => {
    const availableNumbers = Array.from({ length: 80 }, (_, i) => i + 1);
    const count = 5;

    const { selected, entropyLog } = secureRandomPick(availableNumbers, count);

    expect(selected.length).toBe(count);
    expect(new Set(selected).size).toBe(count); // all unique
    selected.forEach((num) => {
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(80);
    });
    expect(entropyLog).toContain("Step 1");
    expect(entropyLog).toContain("Step 5");
  });

  it("handles empty lists or zero count gracefully", () => {
    const emptyResult = secureRandomPick([], 5);
    expect(emptyResult.selected).toEqual([]);

    const zeroResult = secureRandomPick([1, 2, 3], 0);
    expect(zeroResult.selected).toEqual([]);
  });

  it("does not pick more than the available items if count exceeds pool", () => {
    const pool = [10, 20, 30];
    const { selected } = secureRandomPick(pool, 10);
    expect(selected.length).toBe(3);
    expect(selected).toEqual(expect.arrayContaining([10, 20, 30]));
  });

  it("produces diverse random distributions across multiple runs", () => {
    const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const runs = new Set();
    for (let i = 0; i < 20; i++) {
      const { selected } = secureRandomPick(pool, 3);
      runs.add(selected.sort().join(","));
    }
    // High probability of distinct combinations with cryptographic RNG
    expect(runs.size).toBeGreaterThan(1);
  });
});
