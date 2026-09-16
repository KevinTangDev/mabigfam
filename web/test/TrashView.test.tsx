// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { mount, settle, unmount } from "./renderHelper";
import type { FamilyMember } from "../src/types";

/** Fires a click and lets any resulting async state updates flush. */
async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

const listTrash = vi.fn();
const restoreMember = vi.fn();
const purgeMember = vi.fn();

vi.mock("../src/api/client", () => ({
  api: {
    listTrash: () => listTrash(),
    restoreMember: (id: string) => restoreMember(id),
    purgeMember: (id: string) => purgeMember(id),
  },
  photoUrl: (key: string) => `/api/photos/${key}`,
}));

function trashedMember(id: string, name: string): FamilyMember {
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
    deletedAt: "2026-06-15T10:30:00.000Z",
  };
}

async function renderTrash() {
  const { default: TrashView } = await import("../src/pages/TrashView");
  return mount(
    <MemoryRouter>
      <TrashView />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  restoreMember.mockResolvedValue(trashedMember("a", "Kevin"));
  purgeMember.mockResolvedValue(undefined);
});

afterEach(() => {
  unmount();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("TrashView", () => {
  it("shows an empty state when nothing is trashed", async () => {
    listTrash.mockResolvedValue([]);
    const container = await renderTrash();
    await settle();

    expect(container.textContent).toContain("The trash is empty");
  });

  it("lists trashed members with Restore and Delete permanently actions", async () => {
    listTrash.mockResolvedValue([trashedMember("a", "Kevin TANG")]);
    const container = await renderTrash();
    await settle();

    expect(container.textContent).toContain("Kevin TANG");
    expect(container.querySelector("button[disabled]")).toBeFalsy();
    const buttons = [...container.querySelectorAll("button")].map((b) => b.textContent);
    expect(buttons).toContain("Restore");
    expect(buttons).toContain("Delete permanently");
  });

  it("restores a member and reloads the list", async () => {
    listTrash
      .mockResolvedValueOnce([trashedMember("a", "Kevin TANG")])
      .mockResolvedValueOnce([]); // gone from trash after restore

    const container = await renderTrash();
    await settle();

    const restoreBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Restore",
    )!;
    await click(restoreBtn);
    await settle();

    expect(restoreMember).toHaveBeenCalledWith("a");
    expect(listTrash).toHaveBeenCalledTimes(2);
  });

  it("asks for confirmation before permanently deleting, and does nothing if declined", async () => {
    listTrash.mockResolvedValue([trashedMember("a", "Kevin TANG")]);
    vi.spyOn(window, "confirm").mockReturnValue(false);

    const container = await renderTrash();
    await settle();

    const purgeBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Delete permanently",
    )!;
    await click(purgeBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(purgeMember).not.toHaveBeenCalled();
  });

  it("permanently deletes once confirmed", async () => {
    listTrash
      .mockResolvedValueOnce([trashedMember("a", "Kevin TANG")])
      .mockResolvedValueOnce([]);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const container = await renderTrash();
    await settle();

    const purgeBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Delete permanently",
    )!;
    await click(purgeBtn);
    await settle();

    expect(purgeMember).toHaveBeenCalledWith("a");
    expect(listTrash).toHaveBeenCalledTimes(2);
  });
});
