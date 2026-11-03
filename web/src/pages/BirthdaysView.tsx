import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import Avatar from "../components/Avatar";
import CountdownChip from "../components/CountdownChip";
import Icon from "../components/icons";
import { EmptyState, PageHeader, Skeleton, cardClass } from "../components/ui";
import { upcomingBirthdays } from "../lib/birthdays";
import type { UpcomingBirthday } from "../lib/birthdays";
import type { FamilyMember } from "../types";

type Mode = "list" | "calendar";

const CARD_TINTS = [
  "from-brand/20 via-ctp-mantle to-ctp-mantle border-brand/25",
  "from-ctp-pink/20 via-ctp-mantle to-ctp-mantle border-ctp-pink/25",
  "from-ctp-yellow/20 via-ctp-mantle to-ctp-mantle border-ctp-yellow/30",
];

const longDate = (d: Date) =>
  d.toLocaleDateString(undefined, { day: "numeric", month: "long", timeZone: "UTC" });

function FeaturedCard({ b, index }: { b: UpcomingBirthday; index: number }) {
  const today = b.daysAway === 0;
  return (
    <Link
      to={`/members/${b.member.id}`}
      className={`rise-in group relative overflow-hidden rounded-3xl border bg-linear-to-br p-5 shadow-card transition
                  hover:-translate-y-0.5 hover:shadow-pop ${CARD_TINTS[index % CARD_TINTS.length]}`}
      style={{ "--delay": `${index * 70}ms` } as React.CSSProperties}
    >
      <div className="flex items-start gap-4">
        <Avatar member={b.member} size={68} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-ctp-text">{b.member.name}</p>
          {b.member.nameZh && <p className="truncate text-sm text-ctp-subtext0">{b.member.nameZh}</p>}
          <p className="mt-1 text-sm text-ctp-subtext1">{longDate(b.date)}</p>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-4xl leading-none font-semibold text-ctp-text">{b.turning}</p>
          <p className="mt-1 text-xs font-semibold tracking-wide text-ctp-subtext0 uppercase">
            {today ? "years today" : "turning"}
          </p>
        </div>
        <CountdownChip days={b.daysAway} />
      </div>
    </Link>
  );
}

function BirthdayRow({ b }: { b: UpcomingBirthday }) {
  return (
    <li>
      <Link
        to={`/members/${b.member.id}`}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-ctp-surface0/60"
      >
        <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-ctp-surface0 text-ctp-subtext1">
          <span className="text-[10px] leading-none font-bold tracking-wide uppercase">
            {b.date.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" })}
          </span>
          <span className="font-display text-base leading-tight font-semibold">{b.date.getUTCDate()}</span>
        </span>
        <Avatar member={b.member} size={36} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ctp-text">{b.member.name}</span>
          <span className="block text-xs text-ctp-subtext0">turns {b.turning}</span>
        </span>
        <CountdownChip days={b.daysAway} />
      </Link>
    </li>
  );
}

/** A month grid with each day's birthday people shown as avatars. */
function BirthdayCalendar({ members }: { members: FamilyMember[] }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const { year, month } = cursor;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first: getDay() is 0 for Sunday, so shift it.
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const leapYear = new Date(year, 1, 29).getMonth() === 1;

  const byDay = useMemo(() => {
    const map = new Map<number, FamilyMember[]>();
    for (const m of members) {
      if (!m.birthday) continue;
      const born = new Date(m.birthday);
      let day = born.getUTCDate();
      let bornMonth = born.getUTCMonth();
      // A 29 February birthday is celebrated on 1 March in non-leap years,
      // matching how the rest of the app rolls it forward.
      if (bornMonth === 1 && day === 29 && !leapYear) {
        bornMonth = 2;
        day = 1;
      }
      if (bornMonth === month) map.set(day, [...(map.get(day) ?? []), m]);
    }
    return map;
  }, [members, month, leapYear]);

  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  // 2024-01-01 was a Monday, so these come out Monday-first in the user's locale.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: "short" }),
  );
  const isToday = (day: number) =>
    day === now.getDate() && month === now.getMonth() && year === now.getFullYear();

  const shift = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const monthPeople = [...byDay.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div>
      <div className={`${cardClass} p-3 sm:p-5`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold text-ctp-text">{monthLabel}</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })}
              className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand hover:bg-brand/10"
            >
              Today
            </button>
            {(
              [
                [-1, "chevronLeft", "Previous month"],
                [1, "chevronRight", "Next month"],
              ] as const
            ).map(([delta, icon, label]) => (
              <button
                key={label}
                onClick={() => shift(delta)}
                aria-label={label}
                className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-ctp-subtext1 hover:bg-ctp-surface0 pointer-coarse:size-11"
              >
                <Icon name={icon} />
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdays.map((w) => (
            <div key={w} className="pb-1 text-[11px] font-semibold tracking-wide text-ctp-overlay1 uppercase">
              {w}
            </div>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const people = byDay.get(day) ?? [];
            return (
              <div
                key={day}
                className={
                  "flex min-h-14 flex-col items-center gap-1 rounded-xl p-1 text-xs font-semibold sm:min-h-20 " +
                  (isToday(day)
                    ? "bg-brand/12 text-brand ring-1 ring-brand/40"
                    : people.length > 0
                      ? "bg-ctp-surface0/60 text-ctp-text"
                      : "text-ctp-subtext0")
                }
              >
                <span>{day}</span>
                <span className="flex flex-wrap items-center justify-center -space-x-1.5">
                  {people.slice(0, 2).map((m) => (
                    <Link key={m.id} to={`/members/${m.id}`} title={m.name} aria-label={`${m.name}'s birthday`}>
                      <Avatar member={m} size={24} />
                    </Link>
                  ))}
                  {people.length > 2 && <span className="pl-2 text-[10px]">+{people.length - 2}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`${cardClass} mt-4 p-2`}>
        {monthPeople.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-ctp-subtext0">No birthdays in {monthLabel}.</p>
        ) : (
          <ul>
            {monthPeople.flatMap(([day, people]) =>
              people.map((m) => (
                <li key={m.id}>
                  <Link
                    to={`/members/${m.id}`}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-ctp-surface0/60"
                  >
                    <span className="w-8 text-center font-display text-lg font-semibold text-ctp-subtext1">{day}</span>
                    <Avatar member={m} size={36} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ctp-text">{m.name}</span>
                    <span className="text-xs text-ctp-subtext0">
                      turns {year - new Date(m.birthday!).getUTCFullYear()}
                    </span>
                  </Link>
                </li>
              )),
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function BirthdaysView() {
  const [members, setMembers] = useState<FamilyMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("list");

  useEffect(() => {
    api
      .listMembers()
      .then(setMembers)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load birthdays"));
  }, []);

  const upcoming = useMemo(() => upcomingBirthdays(members ?? []), [members]);
  const featured = upcoming.slice(0, 3);
  const rest = upcoming.slice(3);
  const missing = (members?.length ?? 0) - upcoming.length;

  // Group the remainder by month, in the order they actually come up.
  const groups = useMemo(() => {
    const out: { label: string; items: UpcomingBirthday[] }[] = [];
    for (const b of rest) {
      const label = b.date.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(b);
      else out.push({ label, items: [b] });
    }
    return out;
  }, [rest]);

  return (
    <div>
      <PageHeader
        title="Birthdays"
        subtitle={members ? `${upcoming.length} on file` : "Loading..."}
        actions={
          <div role="group" aria-label="View" className="inline-flex rounded-xl border border-ctp-surface1 bg-ctp-mantle p-0.5">
            {(
              [
                ["list", "list", "List"],
                ["calendar", "calendar", "Calendar"],
              ] as const
            ).map(([value, icon, label]) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-sm font-semibold transition pointer-coarse:min-h-10 " +
                  (mode === value ? "bg-brand/12 text-brand" : "text-ctp-subtext0 hover:text-ctp-text")
                }
              >
                <Icon name={icon} />
                {label}
              </button>
            ))}
          </div>
        }
      />

      {error && <p className="text-sm text-ctp-red">{error}</p>}

      {!members && !error && (
        <div className="grid gap-4 sm:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}

      {members && upcoming.length === 0 && (
        <div className={cardClass}>
          <EmptyState
            icon="cake"
            title="No birthdays yet"
            action={
              <Link to="/contacts" className="text-sm font-semibold text-brand">
                Open contacts
              </Link>
            }
          >
            Add a birthday to anyone's profile and it will appear here, with a countdown.
          </EmptyState>
        </div>
      )}

      {members && upcoming.length > 0 && mode === "list" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((b, i) => (
              <FeaturedCard key={b.member.id} b={b} index={i} />
            ))}
          </div>

          {groups.map((g) => (
            <section key={g.label} className="mt-7">
              <h3 className="mb-2 px-1 text-xs font-bold tracking-wide text-ctp-subtext0 uppercase">{g.label}</h3>
              <ul className={`${cardClass} divide-y divide-ctp-surface0/70 p-1`}>
                {g.items.map((b) => (
                  <BirthdayRow key={b.member.id} b={b} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {members && upcoming.length > 0 && mode === "calendar" && <BirthdayCalendar members={members} />}

      {members && missing > 0 && upcoming.length > 0 && (
        <p className="mt-6 text-center text-xs text-ctp-overlay1">
          {missing} {missing === 1 ? "person has" : "people have"} no birthday on file yet.
        </p>
      )}
    </div>
  );
}
