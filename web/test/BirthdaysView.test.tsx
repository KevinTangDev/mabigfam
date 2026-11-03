// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { mount, settle, unmount } from "./renderHelper";
import type { FamilyMember } from "../src/types";

const listMembers = vi.fn();

vi.mock("../src/api/client", () => ({
  api: { listMembers: () => listMembers() },
  photoUrl: (key: string) => `/api/photos/${key}`,
}));

function birthdayIn(days: number): string {
  const now = new Date();
  return new Date(Date.UTC(1990, now.getUTCMonth(), now.getUTCDate() + days)).toISOString();
}

function member(id: string, name: string, birthday: string | null): FamilyMember {
  return {
    id,
    name,
    nameZh: null,
    birthday,
    phone: null,
    address: null,
    note: null,
    photoPath: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
  };
}

async function renderBirthdays() {
  const { default: BirthdaysView } = await import("../src/pages/BirthdaysView");
  return mount(
    <MemoryRouter>
      <BirthdaysView />
    </MemoryRouter>,
  );
}

afterEach(() => {
  unmount();
  vi.clearAllMocks();
});

describe("BirthdaysView", () => {
  it("shows an empty state when nobody has a birthday on file", async () => {
    listMembers.mockResolvedValue([member("a", "Nobody", null)]);
    const container = await renderBirthdays();
    await settle();

    expect(container.textContent).toContain("No birthdays yet");
  });

  it("features the next birthdays with countdowns and the age they turn", async () => {
    listMembers.mockResolvedValue([
      member("a", "Today Person", birthdayIn(0)),
      member("b", "Tomorrow Person", birthdayIn(1)),
      member("c", "Soon Person", birthdayIn(5)),
    ]);
    const container = await renderBirthdays();
    await settle();

    const text = container.textContent!;
    expect(text).toContain("Today");
    expect(text).toContain("Tomorrow");
    expect(text).toContain("In 5 days");
    // Born 1990, so whoever's birthday is today/soon is turning (this year - 1990) or one more.
    expect(text).toMatch(/years today/);
  });

  it("puts everyone past the first three in a month-grouped list, soonest first", async () => {
    listMembers.mockResolvedValue([
      member("a", "Alpha", birthdayIn(1)),
      member("b", "Bravo", birthdayIn(2)),
      member("c", "Charlie", birthdayIn(3)),
      member("d", "Delta", birthdayIn(4)),
      member("e", "Echo", birthdayIn(5)),
    ]);
    const container = await renderBirthdays();
    await settle();

    const rows = [...container.querySelectorAll("ul li")].map((li) => li.textContent!);
    expect(rows.some((r) => r.includes("Delta"))).toBe(true);
    expect(rows.findIndex((r) => r.includes("Delta"))).toBeLessThan(rows.findIndex((r) => r.includes("Echo")));
  });

  it("switches to a month calendar that places birthdays on their day", async () => {
    listMembers.mockResolvedValue([member("a", "Today Person", birthdayIn(0))]);
    const container = await renderBirthdays();
    await settle();

    const calendarBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Calendar"))!;
    await act(async () => {
      calendarBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.querySelector("a[aria-label=\"Today Person's birthday\"]")).toBeTruthy();
    expect(container.querySelector("button[aria-label='Next month']")).toBeTruthy();
  });
});
