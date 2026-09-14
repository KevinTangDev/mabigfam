import { useEffect, useMemo, useState } from "react";
import { api, downloadFile } from "../api/client";
import EventFormModal from "../components/EventFormModal";
import SubscribeCard from "../components/SubscribeCard";
import { Button, cardClass } from "../components/ui";
import { googleCalendarUrl, nextBirthday, turningAge } from "../lib/calendarLinks";
import type { FamilyEvent, FamilyMember } from "../types";

function formatWhen(event: FamilyEvent): string {
  const start = new Date(event.startsAt);

  if (event.allDay) {
    const opts: Intl.DateTimeFormatOptions = {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    };
    const startText = start.toLocaleDateString(undefined, opts);
    if (!event.endsAt || event.endsAt === event.startsAt) return startText;
    return `${startText} → ${new Date(event.endsAt).toLocaleDateString(undefined, opts)}`;
  }

  const startText = start.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!event.endsAt || event.endsAt === event.startsAt) return startText;

  const end = new Date(event.endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  const endText = end.toLocaleString(undefined, {
    ...(sameDay ? {} : { day: "numeric", month: "short" }),
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${startText} → ${endText}`;
}

function EventCard({
  event,
  onEdit,
  onDelete,
  onError,
}: {
  event: FamilyEvent;
  onEdit: () => void;
  onDelete: () => void;
  onError: (message: string) => void;
}) {
  return (
    <li className={`${cardClass} group flex flex-wrap items-start gap-3 p-4`}>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-ctp-text">{event.title}</h3>
        <p className="mt-0.5 text-sm text-ctp-blue">{formatWhen(event)}</p>
        {event.location && (
          <p className="mt-1 text-sm text-ctp-subtext1">📍 {event.location}</p>
        )}
        {event.description && (
          <p className="mt-1 whitespace-pre-wrap text-sm text-ctp-subtext0">
            {event.description}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <a
          href={googleCalendarUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border border-ctp-surface1 bg-ctp-surface0
                     px-3 py-1.5 text-sm font-medium text-ctp-text transition hover:bg-ctp-surface1"
        >
          Google
        </a>
        <Button
          onClick={() =>
            downloadFile(`/events/${event.id}/ics`, `${event.title}.ics`).catch((err) =>
              onError(err instanceof Error ? err.message : "Download failed"),
            )
          }
          title="Download .ics (Apple Calendar, Outlook)"
        >
          .ics
        </Button>
        <Button variant="ghost" onClick={onEdit}>
          Edit
        </Button>
        <Button
          variant="danger"
          onClick={onDelete}
          className="opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
        >
          Delete
        </Button>
      </div>
    </li>
  );
}

export default function CalendarView() {
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<FamilyEvent | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [eventList, memberList] = await Promise.all([api.listEvents(), api.listMembers()]);
      setEvents(eventList);
      setMembers(memberList);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    // An event counts as upcoming until its end (or its start, if open-ended).
    const endOf = (e: FamilyEvent) => new Date(e.endsAt ?? e.startsAt).getTime();
    return {
      upcoming: events.filter((e) => endOf(e) >= now),
      past: events.filter((e) => endOf(e) < now).reverse(),
    };
  }, [events]);

  const birthdays = useMemo(() => {
    return members
      .filter((m) => m.birthday)
      .map((m) => {
        const occurrence = nextBirthday(m.birthday!);
        return { member: m, occurrence, age: turningAge(m.birthday!, occurrence) };
      })
      .sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime())
      .slice(0, 5);
  }, [members]);

  async function handleDelete(event: FamilyEvent) {
    if (!confirm(`Delete "${event.title}"?`)) return;
    await api.deleteEvent(event.id);
    load();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-ctp-text">Family calendar</h2>
        <Button variant="primary" onClick={() => setShowCreate(true)} className="ml-auto">
          + Add event
        </Button>
      </div>

      <SubscribeCard onError={setError} />

      {error && <p className="mt-3 text-sm text-ctp-red">{error}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-ctp-subtext0">Loading...</p>
      ) : (
        <>
          <section className="mt-6">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-ctp-subtext0 uppercase">
              Upcoming
            </h3>
            {upcoming.length === 0 ? (
              <div className={`${cardClass} p-6 text-center text-sm text-ctp-subtext0`}>
                Nothing planned yet. Add a reunion or an important date.
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {upcoming.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onEdit={() => setEditing(event)}
                    onDelete={() => handleDelete(event)}
                    onError={setError}
                  />
                ))}
              </ul>
            )}
          </section>

          {birthdays.length > 0 && (
            <section className="mt-6">
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-ctp-subtext0 uppercase">
                Next birthdays
              </h3>
              <ul className={`${cardClass} divide-y divide-ctp-surface0`}>
                {birthdays.map(({ member, occurrence, age }) => (
                  <li key={member.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span aria-hidden="true">🎂</span>
                    <span className="font-medium text-ctp-text">{member.name}</span>
                    {member.nameZh && (
                      <span className="text-ctp-subtext0">{member.nameZh}</span>
                    )}
                    <span className="ml-auto text-ctp-subtext1">
                      {occurrence.toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        timeZone: "UTC",
                      })}
                      <span className="ml-2 text-ctp-overlay1">turns {age}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-ctp-overlay1">
                Birthdays come from each member's profile and are included in the calendar feed
                automatically.
              </p>
            </section>
          )}

          {past.length > 0 && (
            <section className="mt-6">
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-ctp-subtext0 uppercase">
                Past
              </h3>
              <ul className="flex flex-col gap-3 opacity-70">
                {past.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onEdit={() => setEditing(event)}
                    onDelete={() => handleDelete(event)}
                    onError={setError}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {showCreate && (
        <EventFormModal
          title="Add event"
          onClose={() => setShowCreate(false)}
          onSubmit={async (data) => {
            await api.createEvent(data);
            setShowCreate(false);
            load();
          }}
        />
      )}

      {editing && (
        <EventFormModal
          title="Edit event"
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (data) => {
            await api.updateEvent(editing.id, data);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
