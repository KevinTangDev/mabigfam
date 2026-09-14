import { describe, expect, it } from "vitest";
import type { FamilyEvent, FamilyMember } from "@prisma/client";
import { buildCalendar, buildSingleEventCalendar } from "../src/export/ical.js";

function event(over: Partial<FamilyEvent> = {}): FamilyEvent {
  return {
    id: "e1",
    title: "Reunion",
    description: null,
    location: null,
    startsAt: new Date("2027-07-10T18:00:00Z"),
    endsAt: new Date("2027-07-10T21:00:00Z"),
    allDay: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...over,
  };
}

function member(over: Partial<FamilyMember> = {}): FamilyMember {
  return {
    id: "m1",
    name: "Kevin TANG",
    nameZh: null,
    birthday: new Date("1988-03-25T00:00:00Z"),
    phone: null,
    address: null,
    note: null,
    photoPath: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...over,
  };
}

function unfold(ics: string): string[] {
  return ics.replace(/\r\n /g, "").split("\r\n").filter(Boolean);
}

describe("buildCalendar", () => {
  it("wraps the calendar with the required properties", () => {
    const lines = unfold(buildCalendar([], []));
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("CALSCALE:GREGORIAN");
    expect(lines.at(-1)).toBe("END:VCALENDAR");
  });

  it("names the calendar and advertises a refresh interval", () => {
    const lines = unfold(buildCalendar([], [], { name: "MaBigFam" }));
    expect(lines).toContain("X-WR-CALNAME:MaBigFam");
    expect(lines).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT12H");
    expect(lines).toContain("X-PUBLISHED-TTL:PT12H");
  });

  it("writes a timed event in UTC", () => {
    const lines = unfold(buildCalendar([event()], []));
    expect(lines).toContain("DTSTART:20270710T180000Z");
    expect(lines).toContain("DTEND:20270710T210000Z");
  });

  it("uses an exclusive DTEND for a single all-day event", () => {
    const lines = unfold(
      buildCalendar(
        [event({ allDay: true, startsAt: new Date("2027-07-10T00:00:00Z"), endsAt: null })],
        [],
      ),
    );
    expect(lines).toContain("DTSTART;VALUE=DATE:20270710");
    // One-day event: ends the next day, because DATE DTEND is exclusive.
    expect(lines).toContain("DTEND;VALUE=DATE:20270711");
  });

  it("uses an exclusive DTEND for a multi-day all-day event", () => {
    const lines = unfold(
      buildCalendar(
        [
          event({
            allDay: true,
            startsAt: new Date("2027-07-10T00:00:00Z"),
            endsAt: new Date("2027-07-12T00:00:00Z"),
          }),
        ],
        [],
      ),
    );
    expect(lines).toContain("DTSTART;VALUE=DATE:20270710");
    expect(lines).toContain("DTEND;VALUE=DATE:20270713");
  });

  it("falls back to the start when an event has no end", () => {
    const lines = unfold(buildCalendar([event({ endsAt: null })], []));
    expect(lines).toContain("DTEND:20270710T180000Z");
  });

  it("uses updatedAt for DTSTAMP rather than now, so polling isn't a change", () => {
    const ics = buildCalendar([event({ updatedAt: new Date("2026-05-06T07:08:09Z") })], []);
    expect(unfold(ics)).toContain("DTSTAMP:20260506T070809Z");
  });

  it("raises SEQUENCE when an event has been edited", () => {
    const untouched = unfold(buildCalendar([event()], []));
    expect(untouched).toContain("SEQUENCE:0");

    const edited = unfold(
      buildCalendar(
        [
          event({
            createdAt: new Date("2026-01-01T00:00:00Z"),
            updatedAt: new Date("2026-01-01T00:01:00Z"),
          }),
        ],
        [],
      ),
    );
    expect(edited).toContain("SEQUENCE:60");
  });

  it("keeps SEQUENCE non-negative even if timestamps are odd", () => {
    const lines = unfold(
      buildCalendar(
        [
          event({
            createdAt: new Date("2026-01-02T00:00:00Z"),
            updatedAt: new Date("2026-01-01T00:00:00Z"),
          }),
        ],
        [],
      ),
    );
    expect(lines).toContain("SEQUENCE:0");
  });

  it("escapes text in summary, description and location", () => {
    const lines = unfold(
      buildCalendar(
        [event({ title: "A;B", description: "one\ntwo", location: "x, y" })],
        [],
      ),
    );
    expect(lines).toContain("SUMMARY:A\\;B");
    expect(lines).toContain("DESCRIPTION:one\\ntwo");
    expect(lines).toContain("LOCATION:x\\, y");
  });

  it("emits stable per-event UIDs", () => {
    const lines = unfold(buildCalendar([event({ id: "xyz" })], []));
    expect(lines).toContain("UID:event-xyz@mabigfam");
  });

  it("adds birthdays as yearly all-day events that don't mark you busy", () => {
    const lines = unfold(buildCalendar([], [member({ id: "abc" })]));
    expect(lines).toContain("UID:birthday-abc@mabigfam");
    expect(lines).toContain("RRULE:FREQ=YEARLY");
    expect(lines).toContain("DTSTART;VALUE=DATE:19880325");
    expect(lines).toContain("DTEND;VALUE=DATE:19880326");
    expect(lines).toContain("TRANSP:TRANSPARENT");
  });

  it("includes the Chinese name in a birthday summary when present", () => {
    const lines = unfold(buildCalendar([], [member({ nameZh: "鄧凱文" })]));
    expect(lines).toContain("SUMMARY:🎂 Kevin TANG (鄧凱文)");
  });

  it("skips members with no birthday", () => {
    const ics = buildCalendar([], [member({ birthday: null })]);
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("can leave birthdays out entirely", () => {
    const ics = buildCalendar([], [member()], { includeBirthdays: false });
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("never exceeds 75 octets per line", () => {
    const ics = buildCalendar(
      [event({ title: "測".repeat(60), description: "x".repeat(300) })],
      [member()],
    );
    expect(ics).not.toContain("�");
    for (const line of ics.split("\r\n").filter(Boolean)) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
  });

  it("balances VEVENT blocks across events and birthdays", () => {
    const ics = buildCalendar([event({ id: "a" }), event({ id: "b" })], [member()]);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(3);
  });
});

describe("buildSingleEventCalendar", () => {
  it("wraps exactly one event", () => {
    const ics = buildSingleEventCalendar(event());
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("does not include birthdays", () => {
    expect(buildSingleEventCalendar(event())).not.toContain("RRULE");
  });
});
