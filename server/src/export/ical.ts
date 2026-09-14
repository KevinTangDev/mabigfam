import type { FamilyEvent, FamilyMember } from "@prisma/client";
import { escapeText, serializeLines } from "./fold.js";

/** RFC 5545 UTC date-time: 20260914T190000Z */
function utcStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/** RFC 5545 DATE value: 20260914 */
function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/**
 * SEQUENCE must increase every time an event is revised, and must fit in a
 * 32-bit int. Seconds-since-creation does both, where raw epoch seconds
 * would overflow in 2038.
 */
function sequenceFor(event: FamilyEvent): number {
  return Math.max(0, Math.floor((event.updatedAt.getTime() - event.createdAt.getTime()) / 1000));
}

function eventLines(event: FamilyEvent): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:event-${event.id}@mabigfam`,
    // DTSTAMP is the last-revision time, not "now": using now() would make
    // every poll look like a modification to subscribing clients.
    `DTSTAMP:${utcStamp(event.updatedAt)}`,
    `SEQUENCE:${sequenceFor(event)}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];

  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(event.startsAt)}`);
    // DTEND is *exclusive* for DATE values, so a one-day event ends the
    // following day. Getting this wrong makes every all-day event render a
    // day short (or vanish).
    const lastDay = event.endsAt ?? event.startsAt;
    lines.push(`DTEND;VALUE=DATE:${dateOnly(addDays(lastDay, 1))}`);
  } else {
    lines.push(`DTSTART:${utcStamp(event.startsAt)}`);
    lines.push(`DTEND:${utcStamp(event.endsAt ?? event.startsAt)}`);
  }

  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);

  lines.push("END:VEVENT");
  return lines;
}

/** A member's birthday as a yearly-recurring all-day event. */
function birthdayLines(member: FamilyMember): string[] {
  const birthday = member.birthday!;
  const displayName = member.nameZh ? `${member.name} (${member.nameZh})` : member.name;

  return [
    "BEGIN:VEVENT",
    `UID:birthday-${member.id}@mabigfam`,
    `DTSTAMP:${utcStamp(member.updatedAt)}`,
    `SUMMARY:${escapeText(`🎂 ${displayName}`)}`,
    `DTSTART;VALUE=DATE:${dateOnly(birthday)}`,
    `DTEND;VALUE=DATE:${dateOnly(addDays(birthday, 1))}`,
    "RRULE:FREQ=YEARLY",
    `DESCRIPTION:${escapeText(`Born ${birthday.toISOString().slice(0, 10)}`)}`,
    "TRANSP:TRANSPARENT", // shouldn't mark anyone busy
    "END:VEVENT",
  ];
}

export interface CalendarOptions {
  /** Shown as the calendar's name once subscribed. */
  name?: string;
  includeBirthdays?: boolean;
}

export function buildCalendar(
  events: FamilyEvent[],
  members: FamilyMember[],
  options: CalendarOptions = {},
): string {
  const { name = "MaBigFam", includeBirthdays = true } = options;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MaBigFam//Family Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    `NAME:${escapeText(name)}`,
    // Ask subscribers to re-poll twice a day. Without these, Google and
    // Apple fall back to their own (often much slower) refresh schedules.
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
  ];

  for (const event of events) {
    lines.push(...eventLines(event));
  }

  if (includeBirthdays) {
    for (const member of members) {
      if (member.birthday) lines.push(...birthdayLines(member));
    }
  }

  lines.push("END:VCALENDAR");

  return serializeLines(lines);
}

/** A single event, for a one-off .ics download. */
export function buildSingleEventCalendar(event: FamilyEvent): string {
  return serializeLines([
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MaBigFam//Family Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...eventLines(event),
    "END:VCALENDAR",
  ]);
}
