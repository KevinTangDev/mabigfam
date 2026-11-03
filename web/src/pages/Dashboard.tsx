import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import Avatar from "../components/Avatar";
import CountdownChip from "../components/CountdownChip";
import Icon from "../components/icons";
import type { IconName } from "../components/icons";
import { Button, Chip, EmptyState, Skeleton, cardClass } from "../components/ui";
import { upcomingBirthdays } from "../lib/birthdays";
import { addedLabel, eventDayParts, greeting } from "../lib/dateParts";
import { generationCount, generationMap } from "../lib/generations";
import type { FamilyEvent, TreeData } from "../types";

function Section({
  title,
  to,
  linkLabel,
  children,
  delay = 0,
}: {
  title: string;
  to?: string;
  linkLabel?: string;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <section className={`${cardClass} rise-in p-4 sm:p-5`} style={{ "--delay": `${delay}ms` } as React.CSSProperties}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-ctp-text">{title}</h3>
        {to && (
          <Link
            to={to}
            className="inline-flex items-center gap-1 rounded-lg text-sm font-semibold text-brand hover:text-brand-strong"
          >
            {linkLabel ?? "See all"}
            <Icon name="chevronRight" className="size-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function StatTile({
  icon,
  value,
  label,
  tint,
  delay,
}: {
  icon: IconName;
  value: ReactNode;
  label: string;
  tint: string;
  delay: number;
}) {
  return (
    <div
      className={`${cardClass} rise-in flex items-center gap-3 p-4`}
      style={{ "--delay": `${delay}ms` } as React.CSSProperties}
    >
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tint}`}>
        <Icon name={icon} className="size-5" />
      </span>
      <div className="min-w-0">
        <div className="font-display text-2xl leading-none font-semibold text-ctp-text">{value}</div>
        <div className="mt-1 text-xs leading-tight font-medium text-ctp-subtext0">{label}</div>
      </div>
    </div>
  );
}

const SHORTCUTS: { to: string; icon: IconName; label: string; hint: string; tint: string }[] = [
  { to: "/contacts?new=1", icon: "plus", label: "Add a member", hint: "Grow the family", tint: "bg-brand/12 text-brand" },
  { to: "/tree", icon: "tree", label: "Open the tree", hint: "Explore relatives", tint: "bg-ctp-green/15 text-ctp-green" },
  { to: "/calendar?new=1", icon: "calendar", label: "Plan an event", hint: "Reunions & dates", tint: "bg-ctp-blue/15 text-ctp-blue" },
  { to: "/game", icon: "game", label: "Play the game", hint: "Who's this?", tint: "bg-ctp-pink/15 text-ctp-pink" },
];

export default function Dashboard() {
  const [tree, setTree] = useState<TreeData | null>(null);
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getTree(), api.listEvents()])
      .then(([t, e]) => {
        setTree(t);
        setEvents(e);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load the dashboard"));
  }, []);

  const view = useMemo(() => {
    if (!tree) return null;
    const ids = tree.members.map((m) => m.id);
    const generations = generationMap(ids, tree.links, tree.partnerships);

    const rows = new Map<number, typeof tree.members>();
    for (const m of tree.members) {
      const g = generations.get(m.id) ?? 0;
      rows.set(g, [...(rows.get(g) ?? []), m]);
    }

    const now = Date.now();
    return {
      birthdays: upcomingBirthdays(tree.members),
      generationCount: generationCount(generations),
      couples: tree.partnerships.filter((p) => p.status !== "divorced").length,
      photos: tree.members.filter((m) => m.photoPath).length,
      ladder: [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, people]) => people),
      recent: [...tree.members]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 4),
      events: events
        .filter((e) => new Date(e.endsAt ?? e.startsAt).getTime() >= now)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .slice(0, 3),
    };
  }, [tree, events]);

  if (error) return <p className="text-sm text-ctp-red">{error}</p>;

  if (!tree || !view) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-36" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (tree.members.length === 0) {
    return (
      <div className={cardClass}>
        <EmptyState
          icon="sparkles"
          title="Welcome to MaBigFam"
          action={
            <Link to="/contacts?new=1">
              <Button variant="primary">
                <Icon name="plus" />
                Add the first family member
              </Button>
            </Link>
          }
        >
          This is your family's home. Start by adding a person — then link parents, children and
          partners to grow the tree.
        </EmptyState>
      </div>
    );
  }

  const today = view.birthdays.filter((b) => b.daysAway === 0);
  const next = view.birthdays.slice(0, 4);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Hero */}
      <section className="rise-in relative overflow-hidden rounded-3xl border border-brand/20 bg-linear-to-br from-brand/15 via-ctp-mantle to-ctp-mantle p-5 shadow-card sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-brand/10 blur-3xl"
        />
        <p className="text-sm font-semibold text-brand">{greeting()}</p>
        <h2 className="mt-1 max-w-xl text-3xl leading-tight font-semibold text-ctp-text sm:text-4xl">
          Your family, all in one place.
        </h2>
        <p className="mt-2 max-w-md text-sm text-ctp-subtext0">
          {view.birthdays[0] && view.birthdays[0].daysAway > 0
            ? `Next up: ${view.birthdays[0].member.name}'s birthday — ${view.birthdays[0].daysAway === 1 ? "tomorrow" : `in ${view.birthdays[0].daysAway} days`}.`
            : "Here's what's happening with the people you love."}
        </p>

        {today.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {today.map(({ member, turning }) => (
              <Link
                key={member.id}
                to={`/members/${member.id}`}
                className="inline-flex items-center gap-2.5 rounded-2xl border border-brand/25 bg-ctp-mantle/80 py-1.5 pr-4 pl-1.5 shadow-sm backdrop-blur transition hover:border-brand/50"
              >
                <Avatar member={member} size={34} />
                <span className="text-sm font-semibold text-ctp-text">
                  It's {member.name.split(" ")[0]}'s birthday — {turning} today!
                </span>
                <Icon name="sparkles" className="size-4 text-brand" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="users" value={tree.members.length} label="Family members" tint="bg-brand/12 text-brand" delay={60} />
        <StatTile icon="tree" value={view.generationCount} label={view.generationCount === 1 ? "Generation" : "Generations"} tint="bg-ctp-green/15 text-ctp-green" delay={110} />
        <StatTile icon="heart" value={view.couples} label={view.couples === 1 ? "Couple" : "Couples"} tint="bg-ctp-pink/15 text-ctp-pink" delay={160} />
        <StatTile icon="camera" value={`${view.photos}/${tree.members.length}`} label="With a photo" tint="bg-ctp-blue/15 text-ctp-blue" delay={210} />
      </div>

      {/* Shortcuts */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SHORTCUTS.map((s, i) => (
          <Link
            key={s.to}
            to={s.to}
            className={`${cardClass} rise-in group flex items-center gap-3 p-3.5 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-pop`}
            style={{ "--delay": `${260 + i * 50}ms` } as React.CSSProperties}
          >
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${s.tint}`}>
              <Icon name={s.icon} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm leading-tight font-semibold text-ctp-text">{s.label}</span>
              <span className="block text-xs leading-tight text-ctp-subtext0">{s.hint}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-5">
        <div className="space-y-4 sm:space-y-5 lg:col-span-3">
          <Section title="Upcoming birthdays" to="/birthdays" delay={300}>
            {next.length === 0 ? (
              <p className="py-4 text-center text-sm text-ctp-subtext0">
                Add birthdays to member profiles and they'll show up here.
              </p>
            ) : (
              <ul className="-mx-2 divide-y divide-ctp-surface0/70">
                {next.map(({ member, date, daysAway, turning }) => (
                  <li key={member.id}>
                    <Link
                      to={`/members/${member.id}`}
                      className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-ctp-surface0/60"
                    >
                      <Avatar member={member} size={44} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ctp-text">
                          {member.name}
                        </span>
                        <span className="block text-xs text-ctp-subtext0">
                          {date.toLocaleDateString(undefined, { day: "numeric", month: "long", timeZone: "UTC" })}
                          {" · turns "}
                          {turning}
                        </span>
                      </span>
                      <CountdownChip days={daysAway} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Coming up" to="/calendar" delay={350}>
            {view.events.length === 0 ? (
              <p className="py-4 text-center text-sm text-ctp-subtext0">
                Nothing planned yet.{" "}
                <Link to="/calendar?new=1" className="font-semibold text-brand">
                  Add a reunion
                </Link>
              </p>
            ) : (
              <ul className="space-y-2.5">
                {view.events.map((event) => {
                  const { month, day } = eventDayParts(event);
                  return (
                    <li key={event.id} className="flex items-center gap-3">
                      <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-ctp-blue/12 text-ctp-blue">
                        <span className="text-[10px] leading-none font-bold tracking-wide uppercase">{month}</span>
                        <span className="font-display text-lg leading-tight font-semibold">{day}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ctp-text">{event.title}</span>
                        {event.location && (
                          <span className="flex items-center gap-1 truncate text-xs text-ctp-subtext0">
                            <Icon name="pin" className="size-3" />
                            {event.location}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-4 sm:space-y-5 lg:col-span-2">
          <Section title="Family tree" to="/tree" linkLabel="Open" delay={320}>
            <Link to="/tree" className="block rounded-xl transition hover:bg-ctp-surface0/40" aria-label="Open the family tree">
              <ol className="relative space-y-3 py-1">
                {view.ladder.slice(0, 5).map((people, i) => {
                  const shown = people.slice(0, 6);
                  const more = people.length - shown.length;
                  return (
                    <li key={i} className="flex items-center gap-3">
                      <span className="w-14 shrink-0 text-[11px] font-semibold tracking-wide text-ctp-overlay1 uppercase">
                        Gen {i + 1}
                      </span>
                      <span className="flex items-center -space-x-1.5">
                        {shown.map((m) => (
                          <Avatar key={m.id} member={m} size={34} />
                        ))}
                        {more > 0 && (
                          <span className="z-10 flex size-[34px] items-center justify-center rounded-full bg-ctp-surface0 text-xs font-semibold text-ctp-subtext1 ring-2 ring-ctp-mantle">
                            +{more}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
              {view.ladder.length > 5 && (
                <p className="mt-2 text-xs text-ctp-overlay1">+ {view.ladder.length - 5} more generations</p>
              )}
            </Link>
          </Section>

          <Section title="Recently added" to="/contacts" linkLabel="All contacts" delay={370}>
            <ul className="-mx-2">
              {view.recent.map((m) => (
                <li key={m.id}>
                  <Link
                    to={`/members/${m.id}`}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-ctp-surface0/60"
                  >
                    <Avatar member={m} size={36} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ctp-text">{m.name}</span>
                    <Chip>{addedLabel(m.createdAt)}</Chip>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
