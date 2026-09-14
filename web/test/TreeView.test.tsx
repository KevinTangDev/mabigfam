// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { mount, settle, unmount } from "./renderHelper";
import type { TreeData } from "../src/types";

/**
 * Renders the real TreeView against stubbed API data.
 *
 * This is the harness that catches "the Tree view is a blank page": a throw
 * during render unmounts the whole app in the browser, leaving no visible
 * clue about what failed.
 */
const getTree = vi.fn();

vi.mock("../src/api/client", () => ({
  api: { getTree: () => getTree() },
  photoUrl: (key: string) => `/api/photos/${key}`,
}));

afterEach(() => {
  unmount();
  vi.clearAllMocks();
});

function member(id: string, name: string, over: object = {}) {
  return {
    id,
    name,
    nameZh: null,
    birthday: null,
    phone: null,
    address: null,
    note: null,
    photoPath: null,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

async function renderTree(data: TreeData) {
  getTree.mockResolvedValue(data);
  const { default: TreeView } = await import("../src/pages/TreeView");

  const container = await mount(
    <MemoryRouter>
      <TreeView />
    </MemoryRouter>,
  );

  await settle();
  return container;
}

const cards = () => document.querySelectorAll(".tree-canvas > div");
const lines = () => document.querySelectorAll(".tree-canvas > i");

/** The shape of the real family: a married couple with two children. */
const coupleWithTwoKids: TreeData = {
  members: [
    member("dad", "Hung VENG"),
    member("kid1", "Kevin TANG"),
    member("mum", "Mou TANG"),
    member("kid2", "Thierry TANG"),
  ],
  links: [
    { id: "l1", parentId: "mum", childId: "kid1", createdAt: "" },
    { id: "l2", parentId: "mum", childId: "kid2", createdAt: "" },
    { id: "l3", parentId: "dad", childId: "kid1", createdAt: "" },
    { id: "l4", parentId: "dad", childId: "kid2", createdAt: "" },
  ],
  partnerships: [
    {
      id: "p1",
      aId: "dad",
      bId: "mum",
      status: "married",
      since: null,
      createdAt: "",
      updatedAt: "",
    },
  ],
};

describe("TreeView", () => {
  it("renders a married couple with two children without throwing", async () => {
    const container = await renderTree(coupleWithTwoKids);

    expect(cards()).toHaveLength(4);
    expect(container.textContent).toContain("Hung VENG");
    expect(container.textContent).toContain("Kevin TANG");
  });

  it("draws the ancestry lines", async () => {
    await renderTree(coupleWithTwoKids);
    expect(lines().length).toBeGreaterThan(0);
  });

  it("insets each card within its grid cell so the lines show through", async () => {
    await renderTree(coupleWithTwoKids);

    const card = cards()[0] as HTMLElement;
    // Cards narrower and shorter than the cell is what creates the gutters;
    // at full cell size they touch and cover the connectors.
    expect(parseInt(card.style.width)).toBeLessThan(220);
    expect(parseInt(card.style.height)).toBeLessThan(140);
    expect(card.style.transform).toMatch(/translate\(/);
  });

  it("renders a single member with no relationships", async () => {
    await renderTree({
      members: [member("solo", "Only Child")],
      links: [],
      partnerships: [],
    });
    expect(cards()).toHaveLength(1);
  });

  it("renders a three-generation line", async () => {
    await renderTree({
      members: [member("gran", "Gran"), member("mum", "Mum"), member("kid", "Kid")],
      links: [
        { id: "l1", parentId: "gran", childId: "mum", createdAt: "" },
        { id: "l2", parentId: "mum", childId: "kid", createdAt: "" },
      ],
      partnerships: [],
    });
    expect(cards()).toHaveLength(3);
  });

  it("renders a divorced couple", async () => {
    await renderTree({
      ...coupleWithTwoKids,
      partnerships: [
        {
          id: "p1",
          aId: "dad",
          bId: "mum",
          status: "divorced",
          since: null,
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    expect(cards()).toHaveLength(4);
  });

  it("renders half-siblings from a second relationship", async () => {
    await renderTree({
      members: [
        member("dad", "Dad"),
        member("mum1", "First wife"),
        member("mum2", "Second wife"),
        member("kidA", "Kid A"),
        member("kidB", "Kid B"),
      ],
      links: [
        { id: "l1", parentId: "dad", childId: "kidA", createdAt: "" },
        { id: "l2", parentId: "mum1", childId: "kidA", createdAt: "" },
        { id: "l3", parentId: "dad", childId: "kidB", createdAt: "" },
        { id: "l4", parentId: "mum2", childId: "kidB", createdAt: "" },
      ],
      partnerships: [
        {
          id: "p1",
          aId: "dad",
          bId: "mum1",
          status: "divorced",
          since: null,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "p2",
          aId: "dad",
          bId: "mum2",
          status: "married",
          since: null,
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    expect(cards().length).toBeGreaterThan(0);
  });

  it("tolerates a tree payload with no partnerships field", async () => {
    await renderTree({
      members: [member("a", "A"), member("b", "B")],
      links: [{ id: "l1", parentId: "a", childId: "b", createdAt: "" }],
    } as unknown as TreeData);
    expect(cards()).toHaveLength(2);
  });

  it("shows a message when there are no members", async () => {
    const container = await renderTree({ members: [], links: [], partnerships: [] });
    expect(container.textContent).toMatch(/No family members yet/i);
    expect(cards()).toHaveLength(0);
  });

  /**
   * relatives-tree lays out the family reachable from the root *through
   * couples*. A child with only one parent recorded, whose parent has a
   * partner, falls outside that and was silently absent from the tree — the
   * real shape of the user's data, where one child had a single parent link.
   */
  it("names the members it could not place instead of dropping them silently", async () => {
    const container = await renderTree({
      members: [
        member("dad", "Hung VENG"),
        member("onlyOneParent", "Kevin TANG"),
        member("mum", "Mou TANG"),
        member("shared", "Thierry TANG"),
      ],
      links: [
        { id: "l1", parentId: "mum", childId: "shared", createdAt: "" },
        { id: "l2", parentId: "dad", childId: "onlyOneParent", createdAt: "" },
        { id: "l3", parentId: "dad", childId: "shared", createdAt: "" },
      ],
      partnerships: [],
    });

    expect(container.textContent).toMatch(/isn't shown here|aren't shown here/i);
    expect(container.textContent).toContain("Kevin TANG");
  });

  it("says nothing about missing members when everyone is placed", async () => {
    const container = await renderTree(coupleWithTwoKids);
    expect(container.textContent).not.toMatch(/shown here/i);
  });

  it("also reports members with no relationships at all", async () => {
    const container = await renderTree({
      members: [member("a", "Linked One"), member("b", "Linked Two"), member("z", "Unconnected")],
      links: [{ id: "l1", parentId: "a", childId: "b", createdAt: "" }],
      partnerships: [],
    });

    expect(container.textContent).toMatch(/shown here/i);
    expect(container.textContent).toContain("Unconnected");
  });
});

describe("TreeView when the layout library fails", () => {
  it("explains the failure instead of blanking the page", async () => {
    // No real family shape is known to throw, so the failure is injected: the
    // point is that a throw is reported, not that it crashes the app.
    vi.doMock("relatives-tree", () => ({
      default: () => {
        throw new Error("can't access property \"pos\", nextFamily.children[index] is undefined");
      },
    }));
    vi.resetModules();

    try {
      const container = await renderTree(coupleWithTwoKids);

      expect(container.textContent).toMatch(/can't be laid out/i);
      expect(container.textContent).toContain("nextFamily.children");
      // The rest of the page survives: the root picker is still usable.
      expect(container.querySelector("select")).toBeTruthy();
    } finally {
      vi.doUnmock("relatives-tree");
      vi.resetModules();
    }
  });
});
