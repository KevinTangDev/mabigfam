import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, downloadFile } from "../api/client";
import Avatar from "../components/Avatar";
import CountdownChip from "../components/CountdownChip";
import Icon from "../components/icons";
import type { IconName } from "../components/icons";
import MemberFormModal from "../components/MemberFormModal";
import PhotoUploader from "../components/PhotoUploader";
import RelationSection from "../components/RelationSection";
import { Button, Chip, Skeleton, cardClass, selectClass } from "../components/ui";
import { useI18n } from "../i18n/context";
import type { BaseKey } from "../i18n/config";
import { daysUntil } from "../lib/birthdays";
import { nextBirthday, turningAge } from "../lib/calendarLinks";
import { buildRelationIndex, relationshipLabels } from "../lib/relationships";
import type {
  FamilyMember,
  MemberRelations,
  ParentChildLink,
  PartnershipStatus,
} from "../types";

const STATUS_KEYS: Record<PartnershipStatus, BaseKey> = {
  married: "status.married",
  partner: "status.partner",
  divorced: "status.divorced",
};

const digits = (phone: string) => phone.replace(/[^\d+]/g, "");

/** A big, thumb-sized action tile (Call / Message / Directions / Save). */
function ActionTile({
  icon,
  label,
  tint,
  href,
  external,
  onClick,
}: {
  icon: IconName;
  label: string;
  tint: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
}) {
  const base =
    "flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-2xl border border-ctp-surface0 " +
    "bg-ctp-mantle px-2 py-2.5 text-xs font-semibold text-ctp-text shadow-sm transition duration-150 ";
  const lift = "cursor-pointer hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-card";
  const inner = (
    <>
      <span className={`flex size-9 items-center justify-center rounded-xl ${tint}`}>
        <Icon name={icon} className="size-[18px]" />
      </span>
      {label}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={base + lift}
      >
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button onClick={onClick} className={base + lift}>
        {inner}
      </button>
    );
  }
  return (
    <span aria-disabled="true" className={base + "opacity-45"}>
      {inner}
    </span>
  );
}

function InfoCard({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return (
    <div className={`${cardClass} flex gap-3.5 p-4`}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ctp-surface0 text-ctp-subtext1">
        <Icon name={icon} />
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-semibold tracking-wide text-ctp-subtext0 uppercase">{label}</dt>
        <dd className="mt-0.5 text-sm break-words text-ctp-text">{children}</dd>
      </div>
    </div>
  );
}

export default function MemberDetail() {
  const { t, date, errorText } = useI18n();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [member, setMember] = useState<MemberRelations | null>(null);
  const [links, setLinks] = useState<ParentChildLink[]>([]);
  const [allMembers, setAllMembers] = useState<FamilyMember[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [newParentId, setNewParentId] = useState("");
  const [newChildId, setNewChildId] = useState("");
  const [newPartnerId, setNewPartnerId] = useState("");
  const [newPartnerStatus, setNewPartnerStatus] = useState<PartnershipStatus>("married");
  const [error, setError] = useState<string | null>(null);

  // Reused as a refetch helper after every mutation below, not just on
  // mount — wrapped in useCallback (keyed on `id`) so the mount effect's
  // dependency on it is accurate rather than re-running every render.
  const load = useCallback(async () => {
    if (!id) return;
    const [relations, allLinks, members] = await Promise.all([
      api.getMemberRelations(id),
      api.listLinks(),
      api.listMembers(),
    ]);
    setMember(relations);
    setLinks(allLinks);
    setAllMembers(members);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Alphabetical neighbours, for the previous / next contact arrows.
  const neighbours = useMemo(() => {
    const sorted = [...allMembers].sort((a, b) => a.name.localeCompare(b.name));
    const at = sorted.findIndex((m) => m.id === id);
    return at < 0
      ? { prev: undefined, next: undefined }
      : { prev: sorted[at - 1], next: sorted[at + 1] };
  }, [allMembers, id]);

  const siblings = useMemo(() => {
    if (!member) return [];
    return buildRelationIndex({ members: allMembers, links, partnerships: [] })(member.id).siblings;
  }, [member, allMembers, links]);

  if (!member) {
    return (
      <div className="mx-auto max-w-4xl space-y-4" aria-busy="true">
        <Skeleton className="h-56" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  const excluded = new Set([
    member.id,
    ...member.parents.map((p) => p.id),
    ...member.children.map((c) => c.id),
    ...member.partners.map((p) => p.member.id),
  ]);

  const pickableParents = allMembers.filter(
    (m) => m.id !== member.id && !member.parents.some((p) => p.id === m.id),
  );
  const pickableChildren = allMembers.filter(
    (m) => m.id !== member.id && !member.children.some((c) => c.id === m.id),
  );
  const pickablePartners = allMembers.filter((m) => !excluded.has(m.id));

  async function addLink(parentId: string, childId: string, reset: () => void) {
    setError(null);
    try {
      await api.createLink(parentId, childId);
      reset();
      await load();
    } catch (err) {
      setError(errorText(err, "detail.err.addLink"));
    }
  }

  async function removeLink(parentId: string, childId: string) {
    const linkId = links.find((l) => l.parentId === parentId && l.childId === childId)?.id;
    if (!linkId) {
      setError(t("detail.err.linkNotFound"));
      return;
    }

    setError(null);
    try {
      await api.deleteLink(linkId);
      await load();
    } catch (err) {
      setError(errorText(err, "detail.err.removeLink"));
    }
  }

  async function addPartner() {
    if (!newPartnerId || !member) return;
    setError(null);
    try {
      await api.createPartnership([member.id, newPartnerId], newPartnerStatus);
      setNewPartnerId("");
      await load();
    } catch (err) {
      setError(errorText(err, "detail.err.addPartner"));
    }
  }

  async function removePartner(partnerMemberId: string) {
    const partnership = member?.partners.find((p) => p.member.id === partnerMemberId);
    if (!partnership) return;

    setError(null);
    try {
      await api.deletePartnership(partnership.partnershipId);
      await load();
    } catch (err) {
      setError(errorText(err, "detail.err.removePartner"));
    }
  }

  async function handleDeleteMember() {
    if (!id || !member) return;
    // A soft delete — moves them to the Trash rather than losing anything.
    if (!confirm(t("detail.confirmTrash", { name: member.name }))) return;

    try {
      await api.deleteMember(id);
      navigate("/contacts");
    } catch (err) {
      setError(errorText(err, "detail.err.delete"));
    }
  }

  const labels = relationshipLabels(
    {
      parents: member.parents,
      children: member.children,
      siblings,
      partners: member.partners.map((p) => ({ member: p.member, status: p.status })),
    },
    t,
  );

  const occurrence = member.birthday ? nextBirthday(member.birthday) : null;
  const daysAway = occurrence ? daysUntil(occurrence) : null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => navigate(-1)} className="-ml-3">
          <Icon name="arrowLeft" />
          {t("common.back")}
        </Button>

        <nav aria-label={t("detail.otherContacts")} className="flex items-center gap-1">
          {neighbours.prev ? (
            <Link
              to={`/members/${neighbours.prev.id}`}
              title={t("detail.previousTitle", { name: neighbours.prev.name })}
              aria-label={t("detail.previous", { name: neighbours.prev.name })}
              className="inline-flex size-10 items-center justify-center rounded-xl text-ctp-subtext0 transition hover:bg-ctp-surface0 hover:text-ctp-text"
            >
              <Icon name="chevronLeft" className="size-5" />
            </Link>
          ) : (
            <span className="size-10" />
          )}
          {neighbours.next && (
            <Link
              to={`/members/${neighbours.next.id}`}
              title={t("detail.nextTitle", { name: neighbours.next.name })}
              aria-label={t("detail.next", { name: neighbours.next.name })}
              className="inline-flex size-10 items-center justify-center rounded-xl text-ctp-subtext0 transition hover:bg-ctp-surface0 hover:text-ctp-text"
            >
              <Icon name="chevronRight" className="size-5" />
            </Link>
          )}
        </nav>
      </div>

      <section className={`${cardClass} overflow-hidden`}>
        <div className="h-24 bg-linear-to-br from-brand/30 via-ctp-pink/20 to-ctp-yellow/20 sm:h-28" />

        <div className="px-5 pb-5 sm:px-7 sm:pb-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
            {/* Only the avatar overlaps the banner; the name starts below it. */}
            <div className="-mt-14 shrink-0 sm:-mt-12">
              <PhotoUploader
                member={member}
                onChange={(updated) => setMember({ ...member, ...updated })}
              />
            </div>

            <div className="min-w-0 flex-1 text-center sm:pt-4 sm:text-left">
              <h2 className="text-3xl leading-tight font-semibold text-ctp-text">{member.name}</h2>
              {member.nameZh && <p className="mt-0.5 text-lg text-ctp-subtext0">{member.nameZh}</p>}
              {labels.length > 0 && (
                <div className="mt-2.5 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                  {labels.map((label) => (
                    <Chip key={label}>{label}</Chip>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 sm:pt-4">
              <Button onClick={() => setShowEdit(true)}>
                <Icon name="edit" />
                {t("common.edit")}
              </Button>
              <Button variant="danger" onClick={handleDeleteMember}>
                <Icon name="trash" />
                {t("common.delete")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-4 gap-2.5 sm:gap-3">
        <ActionTile
          icon="phone"
          label={t("detail.call")}
          tint="bg-ctp-green/15 text-ctp-green"
          href={member.phone ? `tel:${digits(member.phone)}` : undefined}
        />
        <ActionTile
          icon="message"
          label={t("detail.message")}
          tint="bg-ctp-blue/15 text-ctp-blue"
          href={member.phone ? `sms:${digits(member.phone)}` : undefined}
        />
        <ActionTile
          icon="pin"
          label={t("detail.directions")}
          tint="bg-ctp-peach/15 text-ctp-peach"
          external
          href={
            member.address
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(member.address)}`
              : undefined
          }
        />
        <ActionTile
          icon="download"
          label={t("detail.save")}
          tint="bg-ctp-mauve/15 text-ctp-mauve"
          onClick={() =>
            downloadFile(`/members/${member.id}/vcard`, `${member.name}.vcf`).catch((err) =>
              setError(errorText(err, "error.downloadFailed")),
            )
          }
        />
      </div>

      {error && <p className="mt-3 text-sm text-ctp-red">{error}</p>}

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoCard icon="cake" label={t("detail.birthday")}>
          {member.birthday && occurrence && daysAway !== null ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                {date(member.birthday, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
              </span>
              <span className="text-ctp-subtext0">{t("birthday.turns", { age: turningAge(member.birthday, occurrence) })}</span>
              <CountdownChip days={daysAway} />
            </span>
          ) : (
            <span className="text-ctp-overlay1">{t("common.notAddedYet")}</span>
          )}
        </InfoCard>
        <InfoCard icon="phone" label={t("detail.phone")}>
          {member.phone ?? <span className="text-ctp-overlay1">{t("common.notAddedYet")}</span>}
        </InfoCard>
        <InfoCard icon="pin" label={t("detail.address")}>
          {member.address ?? <span className="text-ctp-overlay1">{t("common.notAddedYet")}</span>}
        </InfoCard>
        <InfoCard icon="edit" label={t("detail.note")}>
          {member.note ? (
            <span className="whitespace-pre-wrap">{member.note}</span>
          ) : (
            <span className="text-ctp-overlay1">{t("common.nothingYet")}</span>
          )}
        </InfoCard>
      </dl>

      <h3 className="mt-8 mb-3 text-lg font-semibold text-ctp-text">{t("detail.family")}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <RelationSection
          heading={t("detail.partners")}
          entries={member.partners.map((p) => ({
            member: p.member,
            badge: t(STATUS_KEYS[p.status]),
          }))}
          pickable={pickablePartners}
          placeholder={t("detail.addPartner")}
          emptyText={t("detail.noPartner")}
          value={newPartnerId}
          onValueChange={setNewPartnerId}
          onAdd={addPartner}
          onRemove={removePartner}
          extraControl={
            <select
              value={newPartnerStatus}
              onChange={(e) => setNewPartnerStatus(e.target.value as PartnershipStatus)}
              className={selectClass}
              aria-label={t("detail.relationshipType")}
            >
              {(Object.keys(STATUS_KEYS) as PartnershipStatus[]).map((s) => (
                <option key={s} value={s}>
                  {t(STATUS_KEYS[s])}
                </option>
              ))}
            </select>
          }
        />

        <RelationSection
          heading={t("detail.parents")}
          entries={member.parents.map((m) => ({ member: m }))}
          pickable={pickableParents}
          placeholder={t("detail.addParent")}
          emptyText={t("detail.noParents")}
          value={newParentId}
          onValueChange={setNewParentId}
          onAdd={() => addLink(newParentId, member.id, () => setNewParentId(""))}
          onRemove={(personId) => removeLink(personId, member.id)}
        />

        <RelationSection
          heading={t("detail.children")}
          entries={member.children.map((m) => ({ member: m }))}
          pickable={pickableChildren}
          placeholder={t("detail.addChild")}
          emptyText={t("detail.noChildren")}
          value={newChildId}
          onValueChange={setNewChildId}
          onAdd={() => addLink(member.id, newChildId, () => setNewChildId(""))}
          onRemove={(personId) => removeLink(member.id, personId)}
        />

        {siblings.length > 0 && (
          <section className={`${cardClass} p-4 sm:p-5`}>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-ctp-text">{t("detail.siblings")}</h3>
              <Chip>{siblings.length}</Chip>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {siblings.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/members/${s.id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-ctp-surface1 bg-ctp-base py-1 pr-3.5 pl-1 text-sm font-semibold text-ctp-text transition hover:border-brand/50"
                  >
                    <Avatar member={s} size={28} />
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ctp-overlay1">{t("detail.siblingsNote")}</p>
          </section>
        )}
      </div>

      {showEdit && (
        <MemberFormModal
          title={t("detail.editTitle")}
          initial={member}
          onClose={() => setShowEdit(false)}
          onSubmit={async (data) => {
            if (!id) return;
            await api.updateMember(id, data);
            setShowEdit(false);
            load();
          }}
        />
      )}
    </div>
  );
}
