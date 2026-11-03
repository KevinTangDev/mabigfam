import type { FamilyEvent } from "../types";

/**
 * Month + day for a calendar tile. All-day events are stored at UTC midnight
 * so they must be read back in UTC (a local read would shift them a day west
 * of Greenwich); timed events are shown in the viewer's own zone.
 */
export function eventDayParts(event: Pick<FamilyEvent, "startsAt" | "allDay">): {
  month: string;
  day: string;
} {
  const d = new Date(event.startsAt);
  const timeZone = event.allDay ? "UTC" : undefined;
  return {
    month: d.toLocaleDateString(undefined, { month: "short", timeZone }),
    day: d.toLocaleDateString(undefined, { day: "numeric", timeZone }),
  };
}

/** "today", "yesterday", "5 days ago", or a plain date once it's a month old. */
export function addedLabel(iso: string, now = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
