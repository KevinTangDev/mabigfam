import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import Avatar from "../components/Avatar";
import { Button, cardClass } from "../components/ui";
import type { FamilyMember } from "../types";

function formatDeletedAt(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TrashView() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setMembers(await api.listTrash());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the trash");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRestore(m: FamilyMember) {
    setBusyId(m.id);
    setError(null);
    try {
      await api.restoreMember(m.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePurge(m: FamilyMember) {
    if (
      !confirm(
        `Permanently delete ${m.name}? This cannot be undone — their data and photo are gone for good.`,
      )
    ) {
      return;
    }
    setBusyId(m.id);
    setError(null);
    try {
      await api.purgeMember(m.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not permanently delete");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Link to="/" className="text-sm text-ctp-subtext0 hover:text-ctp-text">
          ← Back to family
        </Link>
      </div>

      <h2 className="text-lg font-semibold text-ctp-text">Trash</h2>
      <p className="mt-1 text-sm text-ctp-subtext0">
        Deleted family members land here first. Restore brings someone back with all their
        relationships intact; permanently deleting removes them for good.
      </p>

      {error && <p className="mt-3 text-sm text-ctp-red">{error}</p>}

      <div className={`${cardClass} mt-4 overflow-hidden`}>
        {loading ? (
          <p className="p-6 text-sm text-ctp-subtext0">Loading...</p>
        ) : members.length === 0 ? (
          <p className="p-6 text-center text-sm text-ctp-subtext0">The trash is empty.</p>
        ) : (
          <ul className="divide-y divide-ctp-surface0">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 p-4">
                <Avatar member={m} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-ctp-text">{m.name}</div>
                  <div className="text-xs text-ctp-overlay1">
                    Deleted {formatDeletedAt(m.deletedAt)}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button onClick={() => handleRestore(m)} disabled={busyId === m.id}>
                    Restore
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => handlePurge(m)}
                    disabled={busyId === m.id}
                  >
                    Delete permanently
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
