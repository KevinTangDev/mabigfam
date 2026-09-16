// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { mount, settle, unmount } from "./renderHelper";
import type { FamilyMember } from "../src/types";

async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

const listMembers = vi.fn();
const deleteMember = vi.fn();
const createMember = vi.fn();

vi.mock("../src/api/client", () => ({
  api: {
    listMembers: (search?: string) => listMembers(search),
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

async function renderTable() {
  const { default: TableView } = await import("../src/pages/TableView");
  return mount(
    <MemoryRouter>
      <TableView />
    </MemoryRouter>,
  );
}

function rowNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll("tbody tr")].map((tr) => tr.children[1]!.textContent!);
}

afterEach(() => {
  unmount();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("TableView", () => {
  it("shows an empty state when there are no members", async () => {
    listMembers.mockResolvedValue([]);
    const container = await renderTable();
    await settle();

    expect(container.textContent).toContain("No family members yet");
  });

  it("lists members sorted by name", async () => {
    listMembers.mockResolvedValue([member("b", "Zoe"), member("a", "Amy")]);
    const container = await renderTable();
    await settle();

    expect(rowNames(container)).toEqual(["Amy", "Zoe"]);
  });

  it("reverses sort order when a column header is clicked twice", async () => {
    listMembers.mockResolvedValue([member("a", "Amy"), member("b", "Zoe")]);
    const container = await renderTable();
    await settle();
    expect(rowNames(container)).toEqual(["Amy", "Zoe"]);

    const nameHeader = [...container.querySelectorAll("th")].find((h) => h.textContent?.includes("Name"))!;
    await click(nameHeader);
    expect(rowNames(container)).toEqual(["Zoe", "Amy"]);
  });

  it("filters by the search box, matching name or Chinese name", async () => {
    listMembers.mockResolvedValue([member("a", "Kevin TANG"), member("b", "Mou TANG", { nameZh: "湯" })]);
    const container = await renderTable();
    await settle();

    const search = container.querySelector("input[placeholder='Filter by name...']") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(search, "Kevin");
      search.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });

    expect(rowNames(container)).toEqual(["Kevin TANG"]);
  });

  it("moving a member to Trash asks for confirmation, and does nothing if declined", async () => {
    listMembers.mockResolvedValue([member("a", "Kevin")]);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const container = await renderTable();
    await settle();

    const deleteBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Delete")!;
    await click(deleteBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(deleteMember).not.toHaveBeenCalled();
  });

  it("moves a member to Trash once confirmed, and reloads the list", async () => {
    listMembers.mockResolvedValueOnce([member("a", "Kevin")]).mockResolvedValueOnce([]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    deleteMember.mockResolvedValue(undefined);
    const container = await renderTable();
    await settle();

    const deleteBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Delete")!;
    await click(deleteBtn);
    await settle();

    expect(deleteMember).toHaveBeenCalledWith("a");
    expect(listMembers).toHaveBeenCalledTimes(2);
  });

  it("creates a member from the Add member modal and reloads the list", async () => {
    listMembers.mockResolvedValueOnce([]).mockResolvedValueOnce([member("a", "New Person")]);
    createMember.mockResolvedValue(member("a", "New Person"));
    const container = await renderTable();
    await settle();

    const addBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "+ Add member")!;
    await click(addBtn);

    const nameInput = container.querySelector("[role=dialog] input") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(nameInput, "New Person");
      nameInput.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });

    const saveBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Save")!;
    await click(saveBtn);
    await settle();

    expect(createMember).toHaveBeenCalledWith(expect.objectContaining({ name: "New Person" }));
    expect(listMembers).toHaveBeenCalledTimes(2);
    // The modal closes after a successful save.
    expect(container.querySelector("[role=dialog]")).toBeFalsy();
  });
});
