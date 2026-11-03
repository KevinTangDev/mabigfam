import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import MemberFormModal from "../components/MemberFormModal";
import Avatar from "../components/Avatar";
import ExportMenu from "../components/ExportMenu";
import Icon from "../components/icons";
import { Button, Chip, EmptyState, PageHeader, Skeleton, cardClass, inputClass, selectClass } from "../components/ui";
import { useI18n } from "../i18n/context";
import type { BaseKey } from "../i18n/config";
import { daysUntil } from "../lib/birthdays";
import { nextBirthday } from "../lib/calendarLinks";
import { buildRelationIndex, relationshipLabels } from "../lib/relationships";
import type { Relations } from "../lib/relationships";
import type { FamilyMember, TreeData } from "../types";

type SortKey = "name" | "nameZh" | "birthday" | "phone" | "createdAt" | "upcoming";
type SortDir = "asc" | "desc";
type Filter = "all" | "photo" | "phone";
type ViewMode = "cards" | "table";

// Secondary columns collapse below `sm` — on a phone a table row is avatar +
// name (with the details folded underneath) rather than a sideways scroll.
const COLUMNS: { key: SortKey; label: BaseKey; secondary?: boolean }[] = [
  { key: "name", label: "contacts.col.name" },
  { key: "nameZh", label: "contacts.col.nameZh", secondary: true },
  { key: "birthday", label: "contacts.col.birthday", secondary: true },
  { key: "phone", label: "contacts.col.phone", secondary: true },
];

const SORT_OPTIONS: { value: string; label: BaseKey }[] = [
  { value: "name:asc", label: "contacts.sort.nameAsc" },
  { value: "name:desc", label: "contacts.sort.nameDesc" },
  { value: "upcoming:asc", label: "contacts.sort.upcoming" },
  { value: "createdAt:desc", label: "contacts.sort.recent" },
];

const VIEW_KEY = "mabigfam-contacts-view";

function savedView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
}

function sortValue(m: FamilyMember, key: SortKey): string | number {
  if (key === "upcoming") {
    return m.birthday ? daysUntil(nextBirthday(m.birthday)) : Number.POSITIVE_INFINITY;
  }
  return m[key] ?? "";
}

function compare(a: FamilyMember, b: FamilyMember, key: SortKey): number {
  const x = sortValue(a, key);
  const y = sortValue(b, key);
  return typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
}

function digits(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

function ContactCard({
  member,
  relations,
  onDelete,
}: {
  member: FamilyMember;
  relations: Relations | undefined;
  onDelete: () => void;
}) {
  const { t, date } = useI18n();
  const labels = relations ? relationshipLabels(relations, t).slice(0, 2) : [];

  return (
    <li
      className={`${cardClass} group relative p-4 transition duration-200 hover:-translate-y-0.5
                  hover:border-brand/40 hover:shadow-pop`}
    >
      {/* Stretched link: the whole card opens the profile, while the action
          row below sits above it (relative z-10) so its buttons stay clickable. */}
      <Link
        to={`/members/${member.id}`}
        className="flex items-center gap-3.5 rounded-xl outline-none after:absolute after:inset-0 after:rounded-2xl
                   focus-visible:after:ring-2 focus-visible:after:ring-brand"
      >
        <Avatar member={member} size={56} />
        <span className="min-w-0">
          <span className="block truncate text-base font-semibold text-ctp-text">{member.name}</span>
          {member.nameZh && <span className="block truncate text-sm text-ctp-subtext0">{member.nameZh}</span>}
          {member.birthday && (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-ctp-overlay1">
              <Icon name="cake" className="size-3.5" />
              {date(member.birthday, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
            </span>
          )}
        </span>
      </Link>

      {labels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {labels.map((label) => (
            <Chip key={label}>{label}</Chip>
          ))}
        </div>
      )}

      <div className="relative z-10 mt-3 flex items-center gap-1.5 border-t border-ctp-surface0 pt-3">
        {member.phone ? (
          <>
            <a
              href={`tel:${digits(member.phone)}`}
              aria-label={t("contacts.callAria", { name: member.name })}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-ctp-green/12 px-3 text-xs font-semibold
                         text-ctp-green transition hover:bg-ctp-green/20 pointer-coarse:min-h-11"
            >
              <Icon name="phone" className="size-3.5" />
              {t("contacts.call")}
            </a>
            <a
              href={`sms:${digits(member.phone)}`}
              aria-label={t("contacts.messageAria", { name: member.name })}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-ctp-blue/12 px-3 text-xs font-semibold
                         text-ctp-blue transition hover:bg-ctp-blue/20 pointer-coarse:min-h-11"
            >
              <Icon name="message" className="size-3.5" />
              {t("contacts.message")}
            </a>
          </>
        ) : (
          <span className="text-xs text-ctp-overlay1">{t("contacts.noPhone")}</span>
        )}
        <button
          onClick={onDelete}
          aria-label={t("contacts.deleteAria", { name: member.name })}
          title={t("contacts.deleteTitle")}
          className="ml-auto inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-ctp-overlay1
                     transition hover:bg-ctp-red/10 hover:text-ctp-red pointer-coarse:size-11"
        >
          <Icon name="trash" />
        </button>
      </div>
    </li>
  );
}

export default function ContactsView() {
  const { t, errorText } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tree, setTree] = useState<TreeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [view, setView] = useState<ViewMode>(savedView);
  // The dashboard's "Add a member" shortcut lands here with ?new=1.
  const [showCreate, setShowCreate] = useState(searchParams.get("new") === "1");

  async function load() {
    try {
      setTree(await api.getTree());
      setError(null);
    } catch (err) {
      setError(errorText(err, "contacts.loadFailed"));
    }
  }

  useEffect(() => {
    load();
    // load() only reads errorText, which changes with the language and shouldn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const members = useMemo(() => tree?.members ?? [], [tree]);
  const relationsOf = useMemo(() => (tree ? buildRelationIndex(tree) : null), [tree]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = members.filter((m) => {
      if (filter === "photo" && !m.photoPath) return false;
      if (filter === "phone" && !m.phone) return false;
      if (!q) return true;
      return [m.name, m.nameZh, m.phone, m.address].some((v) => (v ?? "").toLowerCase().includes(q));
    });

    return [...rows].sort((a, b) => {
      const cmp = compare(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [members, search, filter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function chooseView(next: ViewMode) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Not remembering the choice is fine.
    }
  }

  function closeCreate() {
    setShowCreate(false);
    if (searchParams.has("new")) setSearchParams({}, { replace: true });
  }

  async function handleDelete(id: string, name: string) {
    // A soft delete — moves them to the Trash rather than losing anything,
    // so this confirm is a light misclick guard, not a warning about
    // irreversible loss.
    if (!confirm(t("contacts.confirmTrash", { name }))) return;
    await api.deleteMember(id);
    load();
  }

  const sortSelectValue = `${sortKey}:${sortDir}`;
  const loading = !tree && !error;
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: t("contacts.filter.everyone"), count: members.length },
    { id: "photo", label: t("contacts.filter.photo"), count: members.filter((m) => m.photoPath).length },
    { id: "phone", label: t("contacts.filter.phone"), count: members.filter((m) => m.phone).length },
  ];

  return (
    <div>
      <PageHeader
        title={t("contacts.title")}
        subtitle={
          tree ? t("contacts.count", { shown: filtered.length, total: members.length, count: members.length }) : t("common.loading")
        }
        actions={
          <>
            <Link
              to="/trash"
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold
                         text-ctp-subtext0 transition hover:bg-ctp-surface0 hover:text-ctp-text
                         pointer-coarse:min-h-11"
            >
              <Icon name="trash" />
              {t("contacts.trash")}
            </Link>
            <ExportMenu />
            <Button variant="primary" onClick={() => setShowCreate(true)}>
              <Icon name="plus" />
              {t("contacts.add")}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 flex-1 basis-56 sm:max-w-sm">
          <Icon
            name="search"
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ctp-overlay1"
          />
          <input
            type="search"
            aria-label={t("contacts.filterAria")}
            placeholder={t("contacts.filterPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-10`}
          />
        </div>

        <select
          aria-label={t("contacts.sortAria")}
          value={sortSelectValue}
          onChange={(e) => {
            const [key, dir] = e.target.value.split(":") as [SortKey, SortDir];
            setSortKey(key);
            setSortDir(dir);
          }}
          className={selectClass}
        >
          {SORT_OPTIONS.every((o) => o.value !== sortSelectValue) && (
            <option value={sortSelectValue}>{t("contacts.sort.column")}</option>
          )}
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.label)}
            </option>
          ))}
        </select>

        <div
          role="group"
          aria-label={t("contacts.viewAria")}
          className="ml-auto inline-flex rounded-xl border border-ctp-surface1 bg-ctp-mantle p-0.5"
        >
          {(
            [
              ["cards", "grid", "contacts.viewCards", "contacts.viewCardsAria"],
              ["table", "list", "contacts.viewTable", "contacts.viewTableAria"],
            ] as const
          ).map(([mode, icon, label, ariaLabel]) => (
            <button
              key={mode}
              onClick={() => chooseView(mode)}
              aria-pressed={view === mode}
              aria-label={t(ariaLabel)}
              className={
                "inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-sm font-semibold transition " +
                "pointer-coarse:min-h-10 " +
                (view === mode ? "bg-brand/12 text-brand" : "text-ctp-subtext0 hover:text-ctp-text")
              }
            >
              <Icon name={icon} />
              <span className="hidden sm:inline">{t(label)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label={t("contacts.filtersAria")}>
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={
              "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition " +
              "pointer-coarse:min-h-10 " +
              (filter === f.id
                ? "border-brand bg-brand text-on-brand shadow-sm"
                : "border-ctp-surface1 bg-ctp-mantle text-ctp-subtext1 hover:border-ctp-surface2")
            }
          >
            {f.label}
            <span className={filter === f.id ? "opacity-80" : "text-ctp-overlay1"}>{f.count}</span>
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-ctp-red">{error}</p>}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={cardClass}>
          {members.length === 0 ? (
            <EmptyState
              icon="users"
              title={t("contacts.empty.title")}
              action={
                <Button variant="primary" onClick={() => setShowCreate(true)}>
                  <Icon name="plus" />
                  {t("contacts.empty.addFirst")}
                </Button>
              }
            >
              {t("contacts.empty.body")}
            </EmptyState>
          ) : (
            <EmptyState icon="search" title={t("contacts.noMatch.title")}>
              {t("contacts.noMatch.body")}
            </EmptyState>
          )}
        </div>
      ) : view === "cards" ? (
        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {filtered.map((m) => (
            <ContactCard
              key={m.id}
              member={m}
              relations={relationsOf?.(m.id)}
              onDelete={() => handleDelete(m.id, m.name)}
            />
          ))}
        </ul>
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ctp-surface0 bg-ctp-crust/50">
                <th className="w-14" />
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    aria-sort={sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                    onClick={() => toggleSort(col.key)}
                    className={
                      "cursor-pointer select-none px-3 py-3 text-left text-xs font-semibold " +
                      "tracking-wide text-ctp-subtext0 uppercase transition hover:text-ctp-text" +
                      (col.secondary ? " hidden sm:table-cell" : "")
                    }
                  >
                    {t(col.label)}
                    {sortKey === col.key && (
                      <Icon
                        name={sortDir === "asc" ? "chevronUp" : "chevronDown"}
                        className="ml-1 inline size-3.5 text-brand"
                      />
                    )}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => navigate(`/members/${m.id}`)}
                  className="group cursor-pointer border-b border-ctp-surface0/70 transition
                             last:border-0 hover:bg-ctp-surface0/50"
                >
                  <td className="py-2.5 pl-3">
                    <Avatar member={m} size={36} />
                  </td>
                  <td className="px-3 py-2.5 font-semibold">
                    {/* A real link so the row is reachable by keyboard; the row's own
                        onClick covers the rest of the click target for mouse/touch. */}
                    <Link
                      to={`/members/${m.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-brand"
                    >
                      {m.name}
                    </Link>
                    <span className="block text-xs font-normal text-ctp-subtext0 sm:hidden">
                      {[m.nameZh, m.birthday?.slice(0, 10), m.phone].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td className="hidden px-3 py-2.5 text-ctp-subtext1 sm:table-cell">{m.nameZh ?? "—"}</td>
                  <td className="hidden px-3 py-2.5 text-ctp-subtext1 sm:table-cell">
                    {m.birthday ? m.birthday.slice(0, 10) : "—"}
                  </td>
                  <td className="hidden px-3 py-2.5 text-ctp-subtext1 sm:table-cell">{m.phone ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    {/* Hover-reveal only where there's a hover; touch screens always show it. */}
                    <Button
                      variant="danger"
                      onClick={() => handleDelete(m.id, m.name)}
                      aria-label={t("contacts.deleteAria", { name: m.name })}
                      className="opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100
                                 pointer-coarse:opacity-100"
                    >
                      <Icon name="trash" />
                      <span className="max-sm:sr-only">{t("common.delete")}</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <MemberFormModal
          title={t("contacts.addTitle")}
          onClose={closeCreate}
          onSubmit={async (data) => {
            await api.createMember(data);
            closeCreate();
            load();
          }}
        />
      )}
    </div>
  );
}
