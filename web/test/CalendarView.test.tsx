// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, settle, unmount } from "./renderHelper";
import type { FamilyEvent, FamilyMember } from "../src/types";

async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

const listEvents = vi.fn();
const listMembers = vi.fn();
const deleteEvent = vi.fn();
const createEvent = vi.fn();
const getCalendarSubscription = vi.fn();

vi.mock("../src/api/client", () => ({
  api: {
    listEvents: () => listEvents(),
    listMembers: () => listMembers(),
    deleteEvent: (id: string) => deleteEvent(id),
    createEvent: (data: unknown) => createEvent(data),
    updateEvent: vi.fn(),
    getCalendarSubscription: () => getCalendarSubscription(),
  },
  downloadFile: vi.fn(),
}));

function event(id: string, title: string, startsAt: string, extra: Partial<FamilyEvent> = {}): FamilyEvent {
  return {
    id,
    title,
    description: null,
    location: null,
    startsAt,
    endsAt: null,
    allDay: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  };
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

async function renderCalendar() {
  const { default: CalendarView } = await import("../src/pages/CalendarView");
  return mount(<CalendarView />);
}

beforeEach(() => {
  listMembers.mockResolvedValue([]);
  getCalendarSubscription.mockResolvedValue({ path: "/api/calendar/secret-token/mabigfam.ics" });
});

afterEach(() => {
  unmount();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("CalendarView", () => {
  it("shows an empty state when there are no upcoming events", async () => {
    listEvents.mockResolvedValue([]);
    const container = await renderCalendar();
    await settle();

    expect(container.textContent).toContain("Nothing planned yet");
  });

  it("splits events into upcoming and past sections", async () => {
    listEvents.mockResolvedValue([
      event("future", "Future reunion", "2099-06-01T00:00:00.000Z"),
      event("bygone", "Old reunion", "2000-06-01T00:00:00.000Z"),
    ]);
    const container = await renderCalendar();
    await settle();

    expect(container.textContent).toContain("Future reunion");
    expect(container.textContent).toContain("Old reunion");
    expect(container.textContent).toContain("Past");

    const upcomingSection = [...container.querySelectorAll("h3")]
      .find((h) => h.textContent === "Upcoming")!
      .closest("section")!;
    expect(upcomingSection.textContent).toContain("Future reunion");
    expect(upcomingSection.textContent).not.toContain("Old reunion");
  });

  it("shows the masked calendar subscription URL", async () => {
    listEvents.mockResolvedValue([]);
    const container = await renderCalendar();
    await settle();

    expect(getCalendarSubscription).toHaveBeenCalled();
    expect(container.textContent).not.toContain("secret-token");
    expect(container.textContent).toContain("••••••");
  });

  it("lists upcoming birthdays derived from members", async () => {
    listEvents.mockResolvedValue([]);
    listMembers.mockResolvedValue([member("a", "Kevin TANG", "1990-06-15T00:00:00.000Z")]);
    const container = await renderCalendar();
    await settle();

    expect(container.textContent).toContain("Next birthdays");
    expect(container.textContent).toContain("Kevin TANG");
  });

  it("asks for confirmation before deleting an event, and does nothing if declined", async () => {
    listEvents.mockResolvedValue([event("a", "Reunion", "2099-06-01T00:00:00.000Z")]);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const container = await renderCalendar();
    await settle();

    const deleteBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Delete")!;
    await click(deleteBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(deleteEvent).not.toHaveBeenCalled();
  });

  it("deletes an event once confirmed, and reloads", async () => {
    listEvents
      .mockResolvedValueOnce([event("a", "Reunion", "2099-06-01T00:00:00.000Z")])
      .mockResolvedValueOnce([]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    deleteEvent.mockResolvedValue(undefined);
    const container = await renderCalendar();
    await settle();

    const deleteBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Delete")!;
    await click(deleteBtn);
    await settle();

    expect(deleteEvent).toHaveBeenCalledWith("a");
    expect(listEvents).toHaveBeenCalledTimes(2);
  });

  it("opens the Add event modal", async () => {
    listEvents.mockResolvedValue([]);
    const container = await renderCalendar();
    await settle();

    const addBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "+ Add event")!;
    await click(addBtn);

    expect(container.querySelector("[role=dialog]")).toBeTruthy();
    expect(container.textContent).toContain("Add event");
  });
});
