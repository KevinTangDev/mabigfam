import { describe, expect, it } from "vitest";
import { googleCalendarUrl, nextBirthday, turningAge } from "../src/lib/calendarLinks";
import type { FamilyEvent } from "../src/types";

function event(over: Partial<FamilyEvent> = {}): FamilyEvent {
  return {
    id: "e1",
    title: "Reunion",
    description: null,
    location: null,
    startsAt: "2027-07-10T18:00:00.000Z",
    endsAt: "2027-07-10T21:00:00.000Z",
    allDay: false,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

const params = (e: FamilyEvent) => new URL(googleCalendarUrl(e)).searchParams;

describe("googleCalendarUrl", () => {
  it("points at Google's event template", () => {
    const url = new URL(googleCalendarUrl(event()));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
  });

  it("passes timed events as UTC instants", () => {
    expect(params(event()).get("dates")).toBe("20270710T180000Z/20270710T210000Z");
  });

  it("uses an end-exclusive range for a single all-day event", () => {
    const dates = params(
      event({ allDay: true, startsAt: "2027-07-10T00:00:00.000Z", endsAt: null }),
    ).get("dates");
    expect(dates).toBe("20270710/20270711");
  });

  it("uses an end-exclusive range for a multi-day all-day event", () => {
    const dates = params(
      event({
        allDay: true,
        startsAt: "2027-07-10T00:00:00.000Z",
        endsAt: "2027-07-12T00:00:00.000Z",
      }),
    ).get("dates");
    expect(dates).toBe("20270710/20270713");
  });

  it("falls back to the start when there is no end", () => {
    expect(params(event({ endsAt: null })).get("dates")).toBe(
      "20270710T180000Z/20270710T180000Z",
    );
  });

  it("carries the title, notes and location", () => {
    const p = params(event({ title: "A & B", description: "Bring food", location: "Paris" }));
    expect(p.get("text")).toBe("A & B");
    expect(p.get("details")).toBe("Bring food");
    expect(p.get("location")).toBe("Paris");
  });

  it("omits notes and location when unset", () => {
    const p = params(event());
    expect(p.has("details")).toBe(false);
    expect(p.has("location")).toBe(false);
  });

  it("encodes characters that would otherwise break the query string", () => {
    const url = googleCalendarUrl(event({ title: "Tea & cake?", location: "a/b c" }));
    expect(url).not.toContain("Tea & cake?");
    expect(params(event({ title: "Tea & cake?" })).get("text")).toBe("Tea & cake?");
    expect(new URL(url).searchParams.get("location")).toBe("a/b c");
  });
});

describe("nextBirthday", () => {
  const born = "1988-03-25T00:00:00.000Z";

  it("stays in the current year when still ahead", () => {
    expect(nextBirthday(born, new Date("2026-01-10T00:00:00Z")).toISOString().slice(0, 10)).toBe(
      "2026-03-25",
    );
  });

  it("rolls to next year once passed", () => {
    expect(nextBirthday(born, new Date("2026-09-14T00:00:00Z")).toISOString().slice(0, 10)).toBe(
      "2027-03-25",
    );
  });

  it("counts today as today, not next year", () => {
    expect(nextBirthday(born, new Date("2026-03-25T23:00:00Z")).toISOString().slice(0, 10)).toBe(
      "2026-03-25",
    );
  });

  it("handles the day before and after the boundary", () => {
    expect(nextBirthday(born, new Date("2026-03-24T00:00:00Z")).toISOString().slice(0, 10)).toBe(
      "2026-03-25",
    );
    expect(nextBirthday(born, new Date("2026-03-26T00:00:00Z")).toISOString().slice(0, 10)).toBe(
      "2027-03-25",
    );
  });

  it("rolls a 29 February birthday to 1 March in a non-leap year", () => {
    expect(
      nextBirthday("2000-02-29T00:00:00.000Z", new Date("2026-01-01T00:00:00Z"))
        .toISOString()
        .slice(0, 10),
    ).toBe("2026-03-01");
  });

  it("keeps 29 February in a leap year", () => {
    expect(
      nextBirthday("2000-02-29T00:00:00.000Z", new Date("2028-01-01T00:00:00Z"))
        .toISOString()
        .slice(0, 10),
    ).toBe("2028-02-29");
  });

  it("handles a 1 January birthday late in the year", () => {
    expect(
      nextBirthday("1990-01-01T00:00:00.000Z", new Date("2026-12-31T00:00:00Z"))
        .toISOString()
        .slice(0, 10),
    ).toBe("2027-01-01");
  });
});

describe("turningAge", () => {
  it("counts years between birth and the occurrence", () => {
    expect(turningAge("1988-03-25T00:00:00.000Z", new Date("2027-03-25T00:00:00Z"))).toBe(39);
  });

  it("returns zero for the birth year itself", () => {
    expect(turningAge("2026-03-25T00:00:00.000Z", new Date("2026-03-25T00:00:00Z"))).toBe(0);
  });
});
