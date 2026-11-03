import { describe, expect, it } from "vitest";
import { createI18n } from "../src/i18n/config";
import { countdownLabel, daysUntil, upcomingBirthdays } from "../src/lib/birthdays";
import type { FamilyMember } from "../src/types";

const NOW = new Date("2026-06-10T15:00:00Z");

function person(id: string, name: string, birthday: string | null): FamilyMember {
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

describe("countdownLabel", () => {
  it.each([
    [0, "Today"],
    [1, "Tomorrow"],
    [5, "In 5 days"],
    [60, "In 60 days"],
    [90, "In 3 months"],
  ])("%i days -> %s", (days, label) => {
    expect(countdownLabel(days, createI18n("en").t)).toBe(label);
  });
});

describe("upcomingBirthdays", () => {
  it("sorts soonest first, counting today as 0 days and rolling past ones to next year", () => {
    const list = upcomingBirthdays(
      [
        person("a", "Past", "1990-06-01T00:00:00.000Z"),
        person("b", "Today", "1985-06-10T00:00:00.000Z"),
        person("c", "Soon", "2000-06-12T00:00:00.000Z"),
        person("d", "None", null),
      ],
      NOW,
    );

    expect(list.map((b) => [b.member.name, b.daysAway])).toEqual([
      ["Today", 0],
      ["Soon", 2],
      ["Past", 356],
    ]);
    expect(list[0]!.turning).toBe(41);
  });

  it("daysUntil ignores the time of day", () => {
    expect(daysUntil(new Date("2026-06-11T00:00:00Z"), new Date("2026-06-10T23:59:00Z"))).toBe(1);
  });
});
