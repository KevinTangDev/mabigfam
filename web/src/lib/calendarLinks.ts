import type { FamilyEvent } from "../types";

function compact(iso: string): string {
  return `${iso.replace(/[-:]/g, "").split(".")[0]}Z`;
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

/**
 * "Add to Google Calendar" link. Google's `dates` range is end-exclusive for
 * all-day entries, same as iCalendar's DTEND.
 */
export function googleCalendarUrl(event: FamilyEvent): string {
  const start = event.startsAt;
  const end = event.endsAt ?? event.startsAt;

  const dates = event.allDay
    ? `${dateOnly(start)}/${dateOnly(addDays(end, 1))}`
    : `${compact(start)}/${compact(end)}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates,
  });

  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Next occurrence of a birthday, for sorting it among upcoming events. */
export function nextBirthday(birthday: string, now = new Date()): Date {
  const born = new Date(birthday);
  const candidate = new Date(
    Date.UTC(now.getUTCFullYear(), born.getUTCMonth(), born.getUTCDate()),
  );

  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  if (candidate < todayUtc) {
    candidate.setUTCFullYear(candidate.getUTCFullYear() + 1);
  }

  return candidate;
}

export function turningAge(birthday: string, occurrence: Date): number {
  return occurrence.getUTCFullYear() - new Date(birthday).getUTCFullYear();
}
