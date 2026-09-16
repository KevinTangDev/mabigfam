import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import MemberFormModal from "../components/MemberFormModal";
import Avatar from "../components/Avatar";
import ExportMenu from "../components/ExportMenu";
import { Button, cardClass, inputClass } from "../components/ui";
import type { FamilyMember } from "../types";

type SortKey = "name" | "nameZh" | "birthday" | "phone";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "nameZh", label: "Chinese name" },
  { key: "birthday", label: "Birthday" },
  { key: "phone", label: "Phone" },
];

export default function TableView() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.listMembers();
      setMembers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = members;
    if (q) {
      rows = rows.filter(
        (m) => m.name.toLowerCase().includes(q) || (m.nameZh ?? "").toLowerCase().includes(q),
      );
    }

    return [...rows].sort((a, b) => {
      const cmp = (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [members, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function handleDelete(id: string, name: string) {
    // A soft delete — moves them to the Trash rather than losing anything,
    // so this confirm is a light misclick guard, not a warning about
    // irreversible loss.
    if (!confirm(`Move ${name} to Trash? You can restore them anytime.`)) return;
    await api.deleteMember(id);
    load();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          placeholder="Filter by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} max-w-xs`}
        />
        <span className="text-sm text-ctp-subtext0">
          {filtered.length} {filtered.length === 1 ? "member" : "members"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/trash"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-ctp-subtext0
                       transition hover:bg-ctp-surface0 hover:text-ctp-text"
          >
            Trash
          </Link>
          <ExportMenu />
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            + Add member
          </Button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-ctp-red">{error}</p>}

      <div className={`${cardClass} overflow-hidden`}>
        {loading ? (
          <p className="p-6 text-sm text-ctp-subtext0">Loading...</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ctp-surface0 bg-ctp-crust/40">
                <th className="w-14" />
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="cursor-pointer select-none px-3 py-2.5 text-left text-xs font-semibold
                               tracking-wide text-ctp-subtext0 uppercase transition hover:text-ctp-text"
                  >
                    {col.label}
                    <span className="ml-1 text-ctp-blue">
                      {sortKey === col.key ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </span>
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
                  className="group cursor-pointer border-b border-ctp-surface0/60 transition
                             last:border-0 hover:bg-ctp-surface0/50"
                >
                  <td className="py-2 pl-3">
                    <Avatar member={m} size={34} />
                  </td>
                  <td className="px-3 py-2 font-medium">{m.name}</td>
                  <td className="px-3 py-2 text-ctp-subtext1">{m.nameZh ?? "—"}</td>
                  <td className="px-3 py-2 text-ctp-subtext1">
                    {m.birthday ? m.birthday.slice(0, 10) : "—"}
                  </td>
                  <td className="px-3 py-2 text-ctp-subtext1">{m.phone ?? "—"}</td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="danger"
                      onClick={() => handleDelete(m.id, m.name)}
                      className="opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-ctp-subtext0">
                    {members.length === 0
                      ? "No family members yet — add the first one."
                      : "No members match that filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <MemberFormModal
          title="Add family member"
          onClose={() => setShowCreate(false)}
          onSubmit={async (data) => {
            await api.createMember(data);
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}
