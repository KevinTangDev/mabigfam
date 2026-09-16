import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, downloadFile } from "../api/client";
import MemberFormModal from "../components/MemberFormModal";
import PhotoUploader from "../components/PhotoUploader";
import RelationSection from "../components/RelationSection";
import { Button, cardClass, inputClass } from "../components/ui";
import type {
  FamilyMember,
  MemberRelations,
  ParentChildLink,
  PartnershipStatus,
} from "../types";

const STATUS_LABELS: Record<PartnershipStatus, string> = {
  married: "Married",
  partner: "Partner",
  divorced: "Divorced",
};

export default function MemberDetail() {
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

  if (!member) return <p className="text-sm text-ctp-subtext0">Loading...</p>;

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
      setError(err instanceof Error ? err.message : "Could not add link");
    }
  }

  async function removeLink(parentId: string, childId: string) {
    const linkId = links.find((l) => l.parentId === parentId && l.childId === childId)?.id;
    if (!linkId) {
      setError("Couldn't find that link — try reloading the page.");
      return;
    }

    setError(null);
    try {
      await api.deleteLink(linkId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove link");
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
      setError(err instanceof Error ? err.message : "Could not add partner");
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
      setError(err instanceof Error ? err.message : "Could not remove partner");
    }
  }

  async function handleDeleteMember() {
    if (!id || !member) return;
    // A soft delete — moves them to the Trash rather than losing anything.
    if (!confirm(`Move ${member.name} to Trash? You can restore them anytime.`)) return;

    try {
      await api.deleteMember(id);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete member");
    }
  }

  const details: { label: string; value: string | null }[] = [
    { label: "Birthday", value: member.birthday ? member.birthday.slice(0, 10) : null },
    { label: "Phone", value: member.phone },
    { label: "Address", value: member.address },
    { label: "Note", value: member.note },
  ];

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-3 -ml-3">
        ← Back
      </Button>

      <div className={`${cardClass} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-ctp-text">
            {member.name}
            {member.nameZh && (
              <span className="ml-2 text-base font-normal text-ctp-subtext0">{member.nameZh}</span>
            )}
          </h2>
          <div className="flex gap-2">
            <Button
              onClick={() =>
                downloadFile(`/members/${member.id}/vcard`, `${member.name}.vcf`).catch((err) =>
                  setError(err instanceof Error ? err.message : "Download failed"),
                )
              }
              title="Download as a phone contact"
            >
              Save contact
            </Button>
            <Button onClick={() => setShowEdit(true)}>Edit</Button>
            <Button variant="danger" onClick={handleDeleteMember}>
              Delete
            </Button>
          </div>
        </div>

        <div className="mt-5">
          <PhotoUploader
            member={member}
            onChange={(updated) => setMember({ ...member, ...updated })}
          />
        </div>

        <dl className="mt-6 grid grid-cols-[minmax(5rem,7rem)_1fr] gap-y-2 text-sm">
          {details.map((d) => (
            <div key={d.label} className="contents">
              <dt className="text-ctp-subtext0">{d.label}</dt>
              <dd className={d.value ? "text-ctp-text" : "text-ctp-overlay0"}>{d.value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </div>

      {error && <p className="mt-3 text-sm text-ctp-red">{error}</p>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <RelationSection
          heading="Partners"
          entries={member.partners.map((p) => ({
            member: p.member,
            badge: STATUS_LABELS[p.status],
          }))}
          pickable={pickablePartners}
          placeholder="Add a partner..."
          emptyText="No partner recorded"
          value={newPartnerId}
          onValueChange={setNewPartnerId}
          onAdd={addPartner}
          onRemove={removePartner}
          extraControl={
            <select
              value={newPartnerStatus}
              onChange={(e) => setNewPartnerStatus(e.target.value as PartnershipStatus)}
              className={`${inputClass} w-auto`}
              aria-label="Relationship type"
            >
              {(Object.keys(STATUS_LABELS) as PartnershipStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          }
        />

        <RelationSection
          heading="Parents"
          entries={member.parents.map((m) => ({ member: m }))}
          pickable={pickableParents}
          placeholder="Add someone as parent..."
          emptyText="No parents linked yet"
          value={newParentId}
          onValueChange={setNewParentId}
          onAdd={() => addLink(newParentId, member.id, () => setNewParentId(""))}
          onRemove={(personId) => removeLink(personId, member.id)}
        />

        <RelationSection
          heading="Children"
          entries={member.children.map((m) => ({ member: m }))}
          pickable={pickableChildren}
          placeholder="Add someone as child..."
          emptyText="No children linked yet"
          value={newChildId}
          onValueChange={setNewChildId}
          onAdd={() => addLink(member.id, newChildId, () => setNewChildId(""))}
          onRemove={(personId) => removeLink(member.id, personId)}
        />
      </div>

      {showEdit && (
        <MemberFormModal
          title="Edit family member"
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
