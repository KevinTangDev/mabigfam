import { describe, expect, it } from "vitest";
import { generationCount, generationMap } from "../src/lib/generations";

const link = (parentId: string, childId: string) => ({ parentId, childId });

describe("generationMap", () => {
  it("puts children one generation below their parents", () => {
    const g = generationMap(["gp", "p", "kid"], [link("gp", "p"), link("p", "kid")], []);
    expect([g.get("gp"), g.get("p"), g.get("kid")]).toEqual([0, 1, 2]);
    expect(generationCount(g)).toBe(3);
  });

  it("keeps a married-in spouse level with their partner, not a generation above", () => {
    // wife has no recorded parents, but her husband is a child of gp.
    const g = generationMap(
      ["gp", "husband", "wife", "kid"],
      [link("gp", "husband"), link("husband", "kid"), link("wife", "kid")],
      [{ aId: "husband", bId: "wife" }],
    );
    expect(g.get("wife")).toBe(g.get("husband"));
    expect(g.get("kid")).toBe(2);
  });

  it("uses the lowest-placed parent when a child has parents from two generations", () => {
    const g = generationMap(["a", "b", "c"], [link("a", "b"), link("a", "c"), link("b", "c")], []);
    expect(g.get("c")).toBe(2);
  });

  it("terminates on malformed cyclic data", () => {
    const g = generationMap(["a", "b"], [link("a", "b"), link("b", "a")], []);
    expect(g.size).toBe(2);
  });

  it("handles no members", () => {
    expect(generationCount(generationMap([], [], []))).toBe(0);
  });
});
