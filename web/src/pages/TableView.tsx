import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import MemberFormModal from "../components/MemberFormModal";
import Avatar from "../components/Avatar";
import type { FamilyMember } from "../types";

type SortKey = "name" | "nameZh" | "birthday" | "phone";
type SortDir = "asc" | "desc";

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

    const sorted = [...rows].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = av.localeCompare(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
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
    if (!confirm(`Delete ${name}? This also removes their parent/child links.`)) return;
    await api.deleteMember(id);
    load();
  }

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div>
      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Filter by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={() => setShowCreate(true)}>+ Add member</button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="member-table">
          <thead>
            <tr>
              <th className="avatar-cell"></th>
              <th onClick={() => toggleSort("name")}>Name{sortIndicator("name")}</th>
              <th onClick={() => toggleSort("nameZh")}>Chinese name{sortIndicator("nameZh")}</th>
              <th onClick={() => toggleSort("birthday")}>Birthday{sortIndicator("birthday")}</th>
              <th onClick={() => toggleSort("phone")}>Phone{sortIndicator("phone")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="clickable-row" onClick={() => navigate(`/members/${m.id}`)}>
                <td className="avatar-cell">
                  <Avatar member={m} size={32} />
                </td>
                <td>{m.name}</td>
                <td>{m.nameZh ?? "—"}</td>
                <td>{m.birthday ? m.birthday.slice(0, 10) : "—"}</td>
                <td>{m.phone ?? "—"}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button className="link-button danger" onClick={() => handleDelete(m.id, m.name)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-cell">
                  No family members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

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
