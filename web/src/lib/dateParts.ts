import type { I18n, TFn } from "../i18n/config";
import type { FamilyEvent } from "../types";

/**
 * Month + day for a calendar tile. All-day events are stored at UTC midnight
 * so they must be read back in UTC (a local read would shift them a day west
 * of Greenwich); timed events are shown in the viewer's own zone.
 */
export function eventDayParts(
  event: Pick<FamilyEvent, "startsAt" | "allDay">,
  date: I18n["date"],
): { month: string; day: string } {
  const timeZone = event.allDay ? "UTC" : undefined;
  return {
    month: date(event.startsAt, { month: "short", timeZone }),
    day: date(event.startsAt, { day: "numeric", timeZone }),
  };
}

/** "today", "yesterday", "5 days ago", or a plain date once it's a month old. */
export function addedLabel(iso: string, i18n: Pick<I18n, "t" | "date">, now = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return i18n.t("added.today");
  if (days === 1) return i18n.t("added.yesterday");
  if (days < 30) return i18n.t("added.daysAgo", { count: days });
  return i18n.date(iso, { day: "numeric", month: "short", year: "numeric" });
}

export function greeting(t: TFn, now = new Date()): string {
  const h = now.getHours();
  return t(h < 12 ? "greeting.morning" : h < 18 ? "greeting.afternoon" : "greeting.evening");
}
