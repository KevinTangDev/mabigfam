import { describe, expect, it } from "vitest";
import type { ExtNode } from "relatives-tree/lib/types";
import { buildPartnerConnectors } from "../src/lib/partnerConnectors";
import type { Partnership, PartnershipStatus } from "../src/types";

function partnership(aId: string, bId: string, status: PartnershipStatus = "married"): Partnership {
  return { id: `${aId}-${bId}`, aId, bId, status, since: null, createdAt: "", updatedAt: "" };
}

/** A minimal ExtNode: only the fields buildPartnerConnectors reads. */
function node(id: string, left: number, top: number, spouseIds: string[]): ExtNode {
  return {
    id,
    gender: "male" as ExtNode["gender"],
    parents: [],
    children: [],
    siblings: [],
    spouses: spouseIds.map((spouseId) => ({ id: spouseId, type: "married" as never })),
    top,
    left,
    hasSubTree: false,
  };
}

describe("buildPartnerConnectors", () => {
  it("places a connector at the midpoint between a married pair", () => {
    const nodes = [node("a", 0, 0, ["b"]), node("b", 2, 0, ["a"])];
    const connectors = buildPartnerConnectors(nodes, [partnership("a", "b", "married")]);

    expect(connectors).toEqual([
      { aId: "a", bId: "b", x: 1, y: 0, status: "married", since: null },
    ]);
  });

  it("carries the divorced status and since date from the Partnership record", () => {
    const nodes = [node("a", 0, 0, ["b"]), node("b", 2, 0, ["a"])];
    const partnerships = [
      { ...partnership("a", "b", "divorced"), since: "2015-06-01T00:00:00.000Z" },
    ];

    const [connector] = buildPartnerConnectors(nodes, partnerships);
    expect(connector.status).toBe("divorced");
    expect(connector.since).toBe("2015-06-01T00:00:00.000Z");
  });

  it("falls back to 'inferred' for a spouse relation with no Partnership record", () => {
    const nodes = [node("a", 0, 0, ["b"]), node("b", 2, 0, ["a"])];
    const connectors = buildPartnerConnectors(nodes, []);

    expect(connectors).toHaveLength(1);
    expect(connectors[0].status).toBe("inferred");
    expect(connectors[0].since).toBeNull();
  });

  it("emits exactly one connector per pair, not one per direction", () => {
    const nodes = [node("a", 0, 0, ["b"]), node("b", 2, 0, ["a"])];
    const connectors = buildPartnerConnectors(nodes, [partnership("a", "b")]);
    expect(connectors).toHaveLength(1);
  });

  it("skips a spouse relation whose partner wasn't placed by this layout", () => {
    // "b" is a spouse of "a" but isn't in the rendered node list (e.g. outside
    // the connected subtree relatives-tree laid out from the chosen root).
    const nodes = [node("a", 0, 0, ["b"])];
    const connectors = buildPartnerConnectors(nodes, [partnership("a", "b")]);
    expect(connectors).toHaveLength(0);
  });

  it("handles multiple independent couples", () => {
    const nodes = [
      node("a", 0, 0, ["b"]),
      node("b", 2, 0, ["a"]),
      node("c", 0, 2, ["d"]),
      node("d", 2, 2, ["c"]),
    ];
    const connectors = buildPartnerConnectors(nodes, [
      partnership("a", "b", "married"),
      partnership("c", "d", "partner"),
    ]);

    expect(connectors).toHaveLength(2);
    expect(connectors.map((c) => c.status).sort()).toEqual(["married", "partner"]);
  });
});
