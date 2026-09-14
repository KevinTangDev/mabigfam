import { describe, expect, it } from "vitest";
import { buildRelativesTreeNodes } from "../src/lib/buildRelativesTree";
import type { ParentChildLink, Partnership, PartnershipStatus } from "../src/types";

function link(parentId: string, childId: string): ParentChildLink {
  return { id: `${parentId}->${childId}`, parentId, childId, createdAt: "" };
}

function partnership(aId: string, bId: string, status: PartnershipStatus = "married"): Partnership {
  return { id: `${aId}+${bId}`, aId, bId, status, since: null, createdAt: "", updatedAt: "" };
}

function nodeFor(nodes: ReturnType<typeof buildRelativesTreeNodes>, id: string) {
  const node = nodes.find((n) => n.id === id);
  if (!node) throw new Error(`no node for ${id}`);
  return node;
}

const ids = (relations: readonly { id: string }[]) => relations.map((r) => r.id).sort();

describe("buildRelativesTreeNodes", () => {
  it("returns one node per member", () => {
    const nodes = buildRelativesTreeNodes(["a", "b"], []);
    expect(nodes).toHaveLength(2);
    expect(ids(nodes)).toEqual(["a", "b"]);
  });

  it("gives every node the shape relatives-tree requires", () => {
    const node = nodeFor(buildRelativesTreeNodes(["a"], []), "a");
    expect(node).toMatchObject({
      id: "a",
      gender: expect.any(String),
      parents: [],
      children: [],
      siblings: [],
      spouses: [],
    });
  });

  it("maps parent links in both directions", () => {
    const nodes = buildRelativesTreeNodes(["p", "c"], [link("p", "c")]);
    expect(ids(nodeFor(nodes, "c").parents)).toEqual(["p"]);
    expect(ids(nodeFor(nodes, "p").children)).toEqual(["c"]);
  });

  it("ignores links referencing unknown members", () => {
    const nodes = buildRelativesTreeNodes(["a"], [link("ghost", "a"), link("a", "ghost")]);
    expect(nodeFor(nodes, "a").parents).toEqual([]);
    expect(nodeFor(nodes, "a").children).toEqual([]);
  });

  it("treats children of a shared parent as siblings", () => {
    const nodes = buildRelativesTreeNodes(
      ["p", "x", "y"],
      [link("p", "x"), link("p", "y")],
    );
    expect(ids(nodeFor(nodes, "x").siblings)).toEqual(["y"]);
    expect(ids(nodeFor(nodes, "y").siblings)).toEqual(["x"]);
  });

  it("does not make someone their own sibling", () => {
    const nodes = buildRelativesTreeNodes(["p", "x"], [link("p", "x")]);
    expect(nodeFor(nodes, "x").siblings).toEqual([]);
  });

  it("marks full siblings blood and half siblings half", () => {
    // x and y share both parents; z shares only dad.
    const nodes = buildRelativesTreeNodes(
      ["mum", "dad", "other", "x", "y", "z"],
      [
        link("mum", "x"),
        link("dad", "x"),
        link("mum", "y"),
        link("dad", "y"),
        link("dad", "z"),
        link("other", "z"),
      ],
    );

    const x = nodeFor(nodes, "x");
    expect(x.siblings.find((s) => s.id === "y")?.type).toBe("blood");
    expect(x.siblings.find((s) => s.id === "z")?.type).toBe("half");
  });

  it("uses explicit partnerships as spouses", () => {
    const nodes = buildRelativesTreeNodes(["a", "b"], [], [partnership("a", "b")]);
    expect(ids(nodeFor(nodes, "a").spouses)).toEqual(["b"]);
    expect(ids(nodeFor(nodes, "b").spouses)).toEqual(["a"]);
  });

  it("marks a divorced partnership as divorced", () => {
    const nodes = buildRelativesTreeNodes(["a", "b"], [], [partnership("a", "b", "divorced")]);
    expect(nodeFor(nodes, "a").spouses[0]!.type).toBe("divorced");
  });

  it("treats a non-married partner as married for layout purposes", () => {
    // relatives-tree only understands married/divorced for couples.
    const nodes = buildRelativesTreeNodes(["a", "b"], [], [partnership("a", "b", "partner")]);
    expect(nodeFor(nodes, "a").spouses[0]!.type).toBe("married");
  });

  it("infers co-parents as partners when no partnership is recorded", () => {
    const nodes = buildRelativesTreeNodes(
      ["mum", "dad", "kid"],
      [link("mum", "kid"), link("dad", "kid")],
    );
    expect(ids(nodeFor(nodes, "mum").spouses)).toEqual(["dad"]);
    expect(ids(nodeFor(nodes, "dad").spouses)).toEqual(["mum"]);
  });

  it("lets an explicit partnership win over the co-parent inference", () => {
    // Divorced, but still co-parents: the record must not be overwritten.
    const nodes = buildRelativesTreeNodes(
      ["mum", "dad", "kid"],
      [link("mum", "kid"), link("dad", "kid")],
      [partnership("dad", "mum", "divorced")],
    );
    expect(nodeFor(nodes, "mum").spouses).toHaveLength(1);
    expect(nodeFor(nodes, "mum").spouses[0]!.type).toBe("divorced");
  });

  it("ignores partnerships referencing unknown members", () => {
    const nodes = buildRelativesTreeNodes(["a"], [], [partnership("a", "ghost")]);
    expect(nodeFor(nodes, "a").spouses).toEqual([]);
  });

  it("does not duplicate a partner who co-parents several children", () => {
    const nodes = buildRelativesTreeNodes(
      ["mum", "dad", "kid1", "kid2"],
      [link("mum", "kid1"), link("dad", "kid1"), link("mum", "kid2"), link("dad", "kid2")],
    );
    expect(nodeFor(nodes, "mum").spouses).toHaveLength(1);
  });

  it("does not duplicate parents or children on repeated ids", () => {
    const nodes = buildRelativesTreeNodes(
      ["p", "c"],
      [link("p", "c"), { ...link("p", "c"), id: "duplicate-row" }],
    );
    expect(nodeFor(nodes, "c").parents).toHaveLength(1);
    expect(nodeFor(nodes, "p").children).toHaveLength(1);
  });

  it("handles a three-generation line", () => {
    const nodes = buildRelativesTreeNodes(
      ["gran", "mum", "kid"],
      [link("gran", "mum"), link("mum", "kid")],
    );
    expect(ids(nodeFor(nodes, "mum").parents)).toEqual(["gran"]);
    expect(ids(nodeFor(nodes, "mum").children)).toEqual(["kid"]);
    expect(nodeFor(nodes, "gran").parents).toEqual([]);
    expect(nodeFor(nodes, "kid").children).toEqual([]);
  });

  it("copes with no members at all", () => {
    expect(buildRelativesTreeNodes([], [])).toEqual([]);
  });
});
