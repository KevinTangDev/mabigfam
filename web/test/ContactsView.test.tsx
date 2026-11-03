// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { mount, settle, unmount } from "./renderHelper";
import type { FamilyMember, ParentChildLink, Partnership, TreeData } from "../src/types";

async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

async function setValue(el: HTMLInputElement | HTMLSelectElement, value: string, event: "input" | "change") {
  await act(async () => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event(event, { bubbles: true }));
    await Promise.resolve();
  });
}

const getTree = vi.fn();
const deleteMember = vi.fn();
const createMember = vi.fn();

vi.mock("../src/api/client", () => ({
  api: {
    getTree: () => getTree(),
    deleteMember: (id: string) => deleteMember(id),
    createMember: (data: unknown) => createMember(data),
  },
  downloadFile: vi.fn(),
  photoUrl: (key: string) => `/api/photos/${key}`,
}));

function member(id: string, name: string, extra: Partial<FamilyMember> = {}): FamilyMember {
  return {
    id,
    name,
    nameZh: null,
    birthday: null,
    phone: null,
    address: null,
    note: null,
    photoPath: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...extra,
  };
}

function tree(
  members: FamilyMember[],
  links: Pick<ParentChildLink, "parentId" | "childId">[] = [],
  partnerships: Pick<Partnership, "aId" | "bId" | "status">[] = [],
): TreeData {
  return {
    members,
    links: links.map((l, i) => ({ id: `l${i}`, createdAt: "", ...l })),
    partnerships: partnerships.map((p, i) => ({ id: `p${i}`, since: null, createdAt: "", updatedAt: "", ...p })),
  };
}

async function renderContacts(initialEntry = "/contacts") {
  const { default: ContactsView } = await import("../src/pages/ContactsView");
  return mount(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ContactsView />
    </MemoryRouter>,
  );
}

/** Names in on-screen order, read from each card's delete button label. */
function cardNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll("button[aria-label^='Delete ']")].map((b) =>
    b.getAttribute("aria-label")!.slice("Delete ".length),
  );
}

function buttonWithText(container: HTMLElement, text: string) {
  return [...container.querySelectorAll("button")].find((b) => b.textContent === text)!;
}

afterEach(() => {
  unmount();
  localStorage.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("ContactsView", () => {
  it("shows an empty state when there are no members", async () => {
    getTree.mockResolvedValue(tree([]));
    const container = await renderContacts();
    await settle();

    expect(container.textContent).toContain("No family members yet");
  });

  it("lists members as cards sorted by name", async () => {
    getTree.mockResolvedValue(tree([member("b", "Zoe"), member("a", "Amy")]));
    const container = await renderContacts();
    await settle();

    expect(cardNames(container)).toEqual(["Amy", "Zoe"]);
    expect(container.textContent).toContain("2 of 2 people");
  });

  it("re-sorts from the sort menu", async () => {
    getTree.mockResolvedValue(tree([member("a", "Amy"), member("b", "Zoe")]));
    const container = await renderContacts();
    await settle();

    await setValue(container.querySelector("select[aria-label='Sort contacts']")!, "name:desc", "change");
    expect(cardNames(container)).toEqual(["Zoe", "Amy"]);
  });

  it("puts the soonest birthday first when sorting by next birthday", async () => {
    const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const later = new Date(Date.now() + 100 * 86_400_000).toISOString();
    getTree.mockResolvedValue(
      tree([member("a", "Later", { birthday: later }), member("b", "Soon", { birthday: soon }), member("c", "Unknown")]),
    );
    const container = await renderContacts();
    await settle();

    await setValue(container.querySelector("select[aria-label='Sort contacts']")!, "upcoming:asc", "change");
    expect(cardNames(container)).toEqual(["Soon", "Later", "Unknown"]);
  });

  it("shows how people are related on their card", async () => {
    getTree.mockResolvedValue(
      tree(
        [member("h", "Hung TANG"), member("m", "Mou TANG"), member("k", "Kevin TANG")],
        [
          { parentId: "h", childId: "k" },
          { parentId: "m", childId: "k" },
        ],
        [{ aId: "h", bId: "m", status: "married" }],
      ),
    );
    const container = await renderContacts();
    await settle();

    expect(container.textContent).toContain("Child of Hung & Mou");
    expect(container.textContent).toContain("Married to Mou");
    expect(container.textContent).toContain("1 child");
  });

  it("filters by the search box, matching name or Chinese name", async () => {
    getTree.mockResolvedValue(tree([member("a", "Kevin TANG"), member("b", "Mou TANG", { nameZh: "湯" })]));
    const container = await renderContacts();
    await settle();

    await setValue(container.querySelector("input[type=search]")!, "Kevin", "input");
    expect(cardNames(container)).toEqual(["Kevin TANG"]);

    await setValue(container.querySelector("input[type=search]")!, "湯", "input");
    expect(cardNames(container)).toEqual(["Mou TANG"]);
  });

  it("narrows with the quick filters and links Call/Message from the phone number", async () => {
    getTree.mockResolvedValue(
      tree([member("a", "Has Phone", { phone: "+33 6 12 34 56 78" }), member("b", "No Phone")]),
    );
    const container = await renderContacts();
    await settle();

    await click(buttonWithText(container, "With phone1"));
    expect(cardNames(container)).toEqual(["Has Phone"]);

    expect(container.querySelector("a[href='tel:+33612345678']")).toBeTruthy();
    expect(container.querySelector("a[href='sms:+33612345678']")).toBeTruthy();
  });

  it("can switch to the table view, where column headers still sort", async () => {
    getTree.mockResolvedValue(tree([member("a", "Amy"), member("b", "Zoe")]));
    const container = await renderContacts();
    await settle();

    await click(container.querySelector("button[aria-label='Table view']")!);
    const rowNames = () => [...container.querySelectorAll("tbody tr")].map((tr) => tr.children[1]!.textContent);
    expect(rowNames()).toEqual(["Amy", "Zoe"]);

    const nameHeader = [...container.querySelectorAll("th")].find((h) => h.textContent?.includes("Name"))!;
    await click(nameHeader);
    expect(rowNames()).toEqual(["Zoe", "Amy"]);
    expect(localStorage.getItem("mabigfam-contacts-view")).toBe("table");
  });

  it("moving a member to Trash asks for confirmation, and does nothing if declined", async () => {
    getTree.mockResolvedValue(tree([member("a", "Kevin")]));
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const container = await renderContacts();
    await settle();

    await click(container.querySelector("button[aria-label='Delete Kevin']")!);

    expect(window.confirm).toHaveBeenCalled();
    expect(deleteMember).not.toHaveBeenCalled();
  });

  it("moves a member to Trash once confirmed, and reloads the list", async () => {
    getTree.mockResolvedValueOnce(tree([member("a", "Kevin")])).mockResolvedValueOnce(tree([]));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    deleteMember.mockResolvedValue(undefined);
    const container = await renderContacts();
    await settle();

    await click(container.querySelector("button[aria-label='Delete Kevin']")!);
    await settle();

    expect(deleteMember).toHaveBeenCalledWith("a");
    expect(getTree).toHaveBeenCalledTimes(2);
  });

  it("creates a member from the Add member modal and reloads the list", async () => {
    getTree.mockResolvedValueOnce(tree([])).mockResolvedValueOnce(tree([member("a", "New Person")]));
    createMember.mockResolvedValue(member("a", "New Person"));
    const container = await renderContacts();
    await settle();

    await click(buttonWithText(container, "Add member"));
    await setValue(container.querySelector("[role=dialog] input")!, "New Person", "input");
    await click(buttonWithText(container, "Save"));
    await settle();

    expect(createMember).toHaveBeenCalledWith(expect.objectContaining({ name: "New Person" }));
    expect(getTree).toHaveBeenCalledTimes(2);
    expect(container.querySelector("[role=dialog]")).toBeFalsy(); // closes after saving
  });

  it("opens the Add member modal straight away when arriving from the dashboard shortcut", async () => {
    getTree.mockResolvedValue(tree([]));
    const container = await renderContacts("/contacts?new=1");
    await settle();

    expect(container.querySelector("[role=dialog]")).toBeTruthy();
  });
});
