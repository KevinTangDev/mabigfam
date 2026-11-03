import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, downloadFile } from "../api/client";
import EventFormModal from "../components/EventFormModal";
import SubscribeCard from "../components/SubscribeCard";
import Icon from "../components/icons";
import Avatar from "../components/Avatar";
import CountdownChip from "../components/CountdownChip";
import { Button, PageHeader, Skeleton, cardClass } from "../components/ui";
import { useI18n } from "../i18n/context";
import type { I18n } from "../i18n/config";
import { upcomingBirthdays } from "../lib/birthdays";
import { googleCalendarUrl } from "../lib/calendarLinks";
import { eventDayParts } from "../lib/dateParts";
import type { FamilyEvent, FamilyMember } from "../types";

function formatWhen(event: FamilyEvent, date: I18n["date"]): string {
  const start = new Date(event.startsAt);

  if (event.allDay) {
    const opts: Intl.DateTimeFormatOptions = {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    };
    const startText = date(start, opts);
    if (!event.endsAt || event.endsAt === event.startsAt) return startText;
    return `${startText} → ${date(event.endsAt, opts)}`;
  }

  const startText = date(start, {
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
  const endText = date(end, {
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
  const { t, date, errorText } = useI18n();
  const { month, day } = eventDayParts(event, date);

  return (
    <li className={`${cardClass} group flex flex-wrap items-start gap-x-4 gap-y-3 p-4`}>
      <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-ctp-blue/12 text-ctp-blue">
        <span className="text-[10px] leading-none font-bold tracking-wide uppercase">{month}</span>
        <span className="font-display text-xl leading-tight font-semibold">{day}</span>
      </span>

      <div className="min-w-0 flex-1 basis-48">
        <h3 className="font-semibold text-ctp-text">{event.title}</h3>
        <p className="mt-0.5 text-sm font-medium text-ctp-blue">{formatWhen(event, date)}</p>
        {event.location && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ctp-subtext1">
            <Icon name="pin" className="size-3.5 text-ctp-overlay1" />
            {event.location}
          </p>
        )}
        {event.description && (
          <p className="mt-1 whitespace-pre-wrap text-sm text-ctp-subtext0">{event.description}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <a
          href={googleCalendarUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-xl border border-ctp-surface1 bg-ctp-mantle
                     px-3.5 py-2 text-sm font-semibold text-ctp-text shadow-sm transition
                     hover:bg-ctp-surface0 pointer-coarse:min-h-11"
        >
          {t("cal.google")}
        </a>
        <Button
          onClick={() =>
            downloadFile(`/events/${event.id}/ics`, `${event.title}.ics`).catch((err) =>
              onError(errorText(err, "cal.downloadFailed")),
            )
          }
          title={t("cal.icsTitle")}
        >
          {t("cal.ics")}
        </Button>
        <Button variant="ghost" onClick={onEdit}>
          {t("common.edit")}
        </Button>
        <Button
          variant="danger"
          onClick={onDelete}
          className="opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
        >
          {t("common.delete")}
        </Button>
      </div>
    </li>
  );
}

export default function CalendarView() {
  const { t, date, errorText } = useI18n();
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  // The dashboard's "Plan an event" shortcut lands here with ?new=1.
  const [showCreate, setShowCreate] = useState(searchParams.get("new") === "1");
  const [editing, setEditing] = useState<FamilyEvent | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [eventList, memberList] = await Promise.all([api.listEvents(), api.listMembers()]);
      setEvents(eventList);
      setMembers(memberList);
      setError(null);
    } catch (err) {
      setError(errorText(err, "cal.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // load() only reads errorText, which changes with the language and shouldn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const birthdays = useMemo(() => upcomingBirthdays(members).slice(0, 5), [members]);

  function closeCreate() {
    setShowCreate(false);
    if (searchParams.has("new")) setSearchParams({}, { replace: true });
  }

  async function handleDelete(event: FamilyEvent) {
    if (!confirm(t("cal.confirmDelete", { title: event.title }))) return;
    await api.deleteEvent(event.id);
    load();
  }

  return (
    <div>
      <PageHeader
        title={t("cal.title")}
        subtitle={t("cal.subtitle")}
        actions={
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <Icon name="plus" />
            {t("cal.add")}
          </Button>
        }
      />

      <SubscribeCard onError={setError} />

      {error && <p className="mt-3 text-sm text-ctp-red">{error}</p>}

      {loading ? (
        <div className="mt-6 space-y-3" aria-busy="true">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <>
          <section className="mt-8">
            <h3 className="mb-3 text-xs font-bold tracking-wide text-ctp-subtext0 uppercase">{t("cal.upcoming")}</h3>
            {upcoming.length === 0 ? (
              <div className={`${cardClass} flex flex-col items-center px-6 py-10 text-center`}>
                <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-ctp-blue/12 text-ctp-blue">
                  <Icon name="calendar" className="size-6" />
                </span>
                <p className="text-sm text-ctp-subtext0">{t("cal.empty")}</p>
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
            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold tracking-wide text-ctp-subtext0 uppercase">{t("cal.nextBirthdays")}</h3>
                <Link to="/birthdays" className="text-sm font-semibold text-brand hover:text-brand-strong">
                  {t("common.seeAll")}
                </Link>
              </div>
              <ul className={`${cardClass} divide-y divide-ctp-surface0/70 p-1`}>
                {birthdays.map(({ member, date: birthdayDate, daysAway, turning }) => (
                  <li key={member.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <Avatar member={member} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ctp-text">{member.name}</span>
                      <span className="block text-xs text-ctp-subtext0">
                        {date(birthdayDate, { day: "numeric", month: "short", timeZone: "UTC" })}
                        {" · "}
                        {t("birthday.turns", { age: turning })}
                      </span>
                    </span>
                    <CountdownChip days={daysAway} />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ctp-overlay1">
                {t("cal.birthdaysNote")}
              </p>
            </section>
          )}

          {past.length > 0 && (
            <section className="mt-8">
              <h3 className="mb-3 text-xs font-bold tracking-wide text-ctp-subtext0 uppercase">{t("cal.past")}</h3>
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
          title={t("cal.addTitle")}
          onClose={closeCreate}
          onSubmit={async (data) => {
            await api.createEvent(data);
            closeCreate();
            load();
          }}
        />
      )}

      {editing && (
        <EventFormModal
          title={t("cal.editTitle")}
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
