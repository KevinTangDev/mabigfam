import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useI18n } from "../i18n/context";
import Avatar from "../components/Avatar";
import { Button, EmptyState, PageHeader, Skeleton, cardClass } from "../components/ui";
import Icon from "../components/icons";
import type { FamilyMember } from "../types";

export default function TrashView() {
  const { t, date, errorText } = useI18n();
  const formatDeletedAt = (iso: string | null) =>
    iso
      ? date(iso, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "";

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
      setError(errorText(err, "trash.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // load() only reads errorText, which changes with the language and shouldn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRestore(m: FamilyMember) {
    setBusyId(m.id);
    setError(null);
    try {
      await api.restoreMember(m.id);
      await load();
    } catch (err) {
      setError(errorText(err, "trash.restoreFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function handlePurge(m: FamilyMember) {
    if (!confirm(t("trash.confirmPurge", { name: m.name }))) return;
    setBusyId(m.id);
    setError(null);
    try {
      await api.purgeMember(m.id);
      await load();
    } catch (err) {
      setError(errorText(err, "trash.purgeFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <Link
        to="/contacts"
        className="mb-3 -ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-semibold text-ctp-subtext0 hover:text-ctp-text"
      >
        <Icon name="arrowLeft" />
        {t("trash.back")}
      </Link>

      <PageHeader
        title={t("trash.title")}
        subtitle={t("trash.subtitle")}
      />

      {error && <p className="mb-3 text-sm text-ctp-red">{error}</p>}

      <div className={`${cardClass} overflow-hidden`}>
        {loading ? (
          <div className="space-y-2 p-4" aria-busy="true">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : members.length === 0 ? (
          <EmptyState icon="trash" title={t("trash.empty.title")}>
            {t("trash.empty.body")}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-ctp-surface0">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-3 p-4">
                <Avatar member={m} size={44} />
                <div className="min-w-0 flex-1 basis-40">
                  <div className="truncate font-semibold text-ctp-text">{m.name}</div>
                  <div className="text-xs text-ctp-subtext0">{t("trash.deletedAt", { date: formatDeletedAt(m.deletedAt) })}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button onClick={() => handleRestore(m)} disabled={busyId === m.id}>
                    {t("common.restore")}
                  </Button>
                  <Button variant="danger" onClick={() => handlePurge(m)} disabled={busyId === m.id}>
                    {t("trash.deletePermanently")}
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
