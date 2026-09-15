import { describe, expect, it } from "vitest";
import { connectedComponent } from "../src/lib/connectedComponent";
import { buildRelativesTreeNodes } from "../src/lib/buildRelativesTree";

function link(parentId: string, childId: string) {
  return { id: `${parentId}->${childId}`, parentId, childId, createdAt: "" };
}

describe("connectedComponent", () => {
  it("is just the root when it has no relationships at all", () => {
    const nodes = buildRelativesTreeNodes(["solo", "unrelated"], []);
    expect(connectedComponent("solo", nodes)).toEqual(new Set(["solo"]));
  });

  it("reaches children and their other parent through the couple", () => {
    const nodes = buildRelativesTreeNodes(
      ["dad", "mum", "kid"],
      [link("dad", "kid"), link("mum", "kid")],
    );
    expect(connectedComponent("dad", nodes)).toEqual(new Set(["dad", "mum", "kid"]));
  });

  it("reaches up to parents and down to grandchildren", () => {
    const nodes = buildRelativesTreeNodes(
      ["gran", "mum", "kid"],
      [link("gran", "mum"), link("mum", "kid")],
    );
    expect(connectedComponent("mum", nodes)).toEqual(new Set(["gran", "mum", "kid"]));
  });

  it("does not cross into a separate, unconnected family branch", () => {
    const nodes = buildRelativesTreeNodes(
      ["dad", "mum", "kid", "stranger1", "stranger2"],
      [link("dad", "kid"), link("mum", "kid"), link("stranger1", "stranger2")],
    );
    expect(connectedComponent("dad", nodes)).toEqual(new Set(["dad", "mum", "kid"]));
  });

  it("reaches siblings even when they don't share every parent", () => {
    const nodes = buildRelativesTreeNodes(
      ["dad", "mum1", "mum2", "kidA", "kidB"],
      [link("dad", "kidA"), link("mum1", "kidA"), link("dad", "kidB"), link("mum2", "kidB")],
    );
    const component = connectedComponent("kidA", nodes);
    expect(component).toEqual(new Set(["dad", "mum1", "mum2", "kidA", "kidB"]));
  });

  it("is empty-ish (root only) when the root id isn't in the node list", () => {
    const nodes = buildRelativesTreeNodes(["a"], []);
    expect(connectedComponent("ghost", nodes)).toEqual(new Set(["ghost"]));
  });
});
