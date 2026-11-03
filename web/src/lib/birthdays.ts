import { nextBirthday, turningAge } from "./calendarLinks";
import type { TFn } from "../i18n/config";
import type { FamilyMember } from "../types";

export interface UpcomingBirthday {
  member: FamilyMember;
  /** The coming occurrence, at UTC midnight. */
  date: Date;
  daysAway: number;
  /** The age they reach on that date. */
  turning: number;
}

const DAY_MS = 86_400_000;

/** Whole calendar days from today to `date`; both are compared as UTC dates. */
export function daysUntil(date: Date, now = new Date()): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((date.getTime() - today) / DAY_MS);
}

export function countdownLabel(days: number, t: TFn): string {
  if (days <= 0) return t("countdown.today");
  if (days === 1) return t("countdown.tomorrow");
  if (days <= 60) return t("countdown.days", { count: days });
  return t("countdown.months", { count: Math.round(days / 30) });
}

/** Everyone with a birthday on file, soonest first. */
export function upcomingBirthdays(
  members: readonly FamilyMember[],
  now = new Date(),
): UpcomingBirthday[] {
  return members
    .filter((m) => m.birthday)
    .map((member) => {
      const date = nextBirthday(member.birthday!, now);
      return { member, date, daysAway: daysUntil(date, now), turning: turningAge(member.birthday!, date) };
    })
    .sort((a, b) => a.daysAway - b.daysAway || a.member.name.localeCompare(b.member.name));
}
