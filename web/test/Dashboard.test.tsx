// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { mount, settle, unmount } from "./renderHelper";
import type { FamilyEvent, FamilyMember, TreeData } from "../src/types";

const getTree = vi.fn();
const listEvents = vi.fn();

vi.mock("../src/api/client", () => ({
  api: { getTree: () => getTree(), listEvents: () => listEvents() },
  photoUrl: (key: string) => `/api/photos/${key}`,
}));

/** A birthday that next falls `days` from now (the birth year doesn't matter). */
function birthdayIn(days: number): string {
  const now = new Date();
  return new Date(Date.UTC(1990, now.getUTCMonth(), now.getUTCDate() + days)).toISOString();
}

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

const family: TreeData = {
  members: [
    member("h", "Hung TANG", { birthday: birthdayIn(0) }),
    member("m", "Mou TANG", { photoPath: "m.jpg" }),
    member("k", "Kevin TANG", { birthday: birthdayIn(1) }),
  ],
  links: [
    { id: "l1", parentId: "h", childId: "k", createdAt: "" },
    { id: "l2", parentId: "m", childId: "k", createdAt: "" },
  ],
  partnerships: [{ id: "p", aId: "h", bId: "m", status: "married", since: null, createdAt: "", updatedAt: "" }],
};

async function renderDashboard() {
  const { default: Dashboard } = await import("../src/pages/Dashboard");
  return mount(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

afterEach(() => {
  unmount();
  vi.clearAllMocks();
});

describe("Dashboard", () => {
  it("welcomes a brand-new family with a call to add the first member", async () => {
    getTree.mockResolvedValue({ members: [], links: [], partnerships: [] });
    listEvents.mockResolvedValue([]);
    const container = await renderDashboard();
    await settle();

    expect(container.textContent).toContain("Welcome to MaBigFam");
    expect(container.querySelector("a[href='/contacts?new=1']")).toBeTruthy();
  });

  it("summarises the family: members, generations, couples and photos", async () => {
    getTree.mockResolvedValue(family);
    listEvents.mockResolvedValue([]);
    const container = await renderDashboard();
    await settle();

    const text = container.textContent!;
    expect(text).toContain("Family members");
    expect(text).toMatch(/3\s*Family members/);
    expect(text).toMatch(/2\s*Generations/); // parents, then Kevin
    expect(text).toMatch(/1\s*Couple/);
    expect(text).toMatch(/1\/3\s*With a photo/);
  });

  it("celebrates a birthday today and counts down to the next", async () => {
    getTree.mockResolvedValue(family);
    listEvents.mockResolvedValue([]);
    const container = await renderDashboard();
    await settle();

    expect(container.textContent).toContain("It's Hung's birthday");
    const birthdays = [...container.querySelectorAll("section")]
      .find((s) => s.querySelector("h3")?.textContent === "Upcoming birthdays")!;
    expect(birthdays.textContent).toContain("Today");
    expect(birthdays.textContent).toContain("Tomorrow");
  });

  it("lists only upcoming events, soonest first, with their dates", async () => {
    const event = (id: string, title: string, startsAt: string): FamilyEvent => ({
      id,
      title,
      description: null,
      location: null,
      startsAt,
      endsAt: null,
      allDay: true,
      createdAt: "",
      updatedAt: "",
    });
    getTree.mockResolvedValue(family);
    listEvents.mockResolvedValue([
      event("old", "Long ago", "2000-01-01T00:00:00.000Z"),
      event("b", "Later reunion", "2099-08-01T00:00:00.000Z"),
      event("a", "Sooner dinner", "2099-02-01T00:00:00.000Z"),
    ]);
    const container = await renderDashboard();
    await settle();

    const text = container.textContent!;
    expect(text).not.toContain("Long ago");
    expect(text.indexOf("Sooner dinner")).toBeGreaterThan(-1);
    expect(text.indexOf("Sooner dinner")).toBeLessThan(text.indexOf("Later reunion"));
  });

  it("offers quick shortcuts that deep-link into the app", async () => {
    getTree.mockResolvedValue(family);
    listEvents.mockResolvedValue([]);
    const container = await renderDashboard();
    await settle();

    for (const href of ["/contacts?new=1", "/tree", "/calendar?new=1", "/game"]) {
      expect(container.querySelector(`a[href='${href}']`)).toBeTruthy();
    }
  });
});
