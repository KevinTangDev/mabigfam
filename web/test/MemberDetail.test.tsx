// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { mount, settle, unmount } from "./renderHelper";
import type { FamilyMember, MemberRelations } from "../src/types";

async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

const getMemberRelations = vi.fn();
const listLinks = vi.fn();
const listMembers = vi.fn();
const createLink = vi.fn();
const deleteLink = vi.fn();
const createPartnership = vi.fn();
const deletePartnership = vi.fn();
const deleteMember = vi.fn();
const navigateSpy = vi.fn();

vi.mock("../src/api/client", () => ({
  api: {
    getMemberRelations: (id: string) => getMemberRelations(id),
    listLinks: () => listLinks(),
    listMembers: () => listMembers(),
    createLink: (parentId: string, childId: string) => createLink(parentId, childId),
    deleteLink: (id: string) => deleteLink(id),
    createPartnership: (memberIds: [string, string], status: string) =>
      createPartnership(memberIds, status),
    deletePartnership: (id: string) => deletePartnership(id),
    deleteMember: (id: string) => deleteMember(id),
    uploadPhoto: vi.fn(),
    deletePhoto: vi.fn(),
  },
  downloadFile: vi.fn(),
  photoUrl: (key: string) => `/api/photos/${key}`,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateSpy };
});

function person(id: string, name: string): FamilyMember {
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
  };
}

function relations(overrides: Partial<MemberRelations> = {}): MemberRelations {
  return {
    ...person("kevin", "Kevin TANG"),
    parents: [],
    children: [],
    partners: [],
    ...overrides,
  };
}

async function renderDetail() {
  const { default: MemberDetail } = await import("../src/pages/MemberDetail");
  return mount(
    <MemoryRouter initialEntries={["/members/kevin"]}>
      <Routes>
        <Route path="/members/:id" element={<MemberDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  listLinks.mockResolvedValue([]);
  listMembers.mockResolvedValue([]);
});

afterEach(() => {
  unmount();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("MemberDetail", () => {
  it("renders the member's name and details", async () => {
    getMemberRelations.mockResolvedValue(relations());
    const container = await renderDetail();
    await settle();

    expect(container.textContent).toContain("Kevin TANG");
  });

  it("adds a partner and reloads", async () => {
    getMemberRelations.mockResolvedValue(relations());
    listMembers.mockResolvedValue([person("kevin", "Kevin TANG"), person("mou", "Mou TANG")]);
    createPartnership.mockResolvedValue({});
    const container = await renderDetail();
    await settle();

    const selects = [...container.querySelectorAll("select")];
    const partnerSelect = selects[0]!; // Partners section renders first
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )!.set!;
      setter.call(partnerSelect, "mou");
      partnerSelect.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    const addButtons = [...container.querySelectorAll("button")].filter((b) => b.textContent === "Add");
    await click(addButtons[0]!);
    await settle();

    expect(createPartnership).toHaveBeenCalledWith(["kevin", "mou"], "married");
  });

  it("removes a partner via its Remove button", async () => {
    getMemberRelations.mockResolvedValue(
      relations({
        partners: [
          { partnershipId: "p1", status: "married", since: null, member: person("mou", "Mou TANG") },
        ],
      }),
    );
    deletePartnership.mockResolvedValue(undefined);
    const container = await renderDetail();
    await settle();

    const removeBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Remove")!;
    await click(removeBtn);
    await settle();

    expect(deletePartnership).toHaveBeenCalledWith("p1");
  });

  it("asks for confirmation before moving to Trash, and does nothing if declined", async () => {
    getMemberRelations.mockResolvedValue(relations());
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const container = await renderDetail();
    await settle();

    const deleteBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Delete")!;
    await click(deleteBtn);

    expect(deleteMember).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("moves to Trash and navigates home once confirmed", async () => {
    getMemberRelations.mockResolvedValue(relations());
    vi.spyOn(window, "confirm").mockReturnValue(true);
    deleteMember.mockResolvedValue(undefined);
    const container = await renderDetail();
    await settle();

    const deleteBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Delete")!;
    await click(deleteBtn);
    await settle();

    expect(deleteMember).toHaveBeenCalledWith("kevin");
    expect(navigateSpy).toHaveBeenCalledWith("/");
  });
});
