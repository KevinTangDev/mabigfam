import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, downloadFile } from "../api/client";
import MemberFormModal from "../components/MemberFormModal";
import PhotoUploader from "../components/PhotoUploader";
import Avatar from "../components/Avatar";
import { Button, cardClass, inputClass } from "../components/ui";
import type { FamilyMember, MemberRelations, ParentChildLink } from "../types";

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [member, setMember] = useState<MemberRelations | null>(null);
  const [links, setLinks] = useState<ParentChildLink[]>([]);
  const [allMembers, setAllMembers] = useState<FamilyMember[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [newParentId, setNewParentId] = useState("");
  const [newChildId, setNewChildId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    const [relations, allLinks, members] = await Promise.all([
      api.getMemberRelations(id),
      api.listLinks(),
      api.listMembers(),
    ]);
    setMember(relations);
    setLinks(allLinks);
    setAllMembers(members);
  }

  useEffect(() => {
    load();
  }, [id]);

  if (!member) return <p className="text-sm text-ctp-subtext0">Loading...</p>;

  const pickableParents = allMembers.filter(
    (m) => m.id !== member.id && !member.parents.some((p) => p.id === m.id),
  );
  const pickableChildren = allMembers.filter(
    (m) => m.id !== member.id && !member.children.some((c) => c.id === m.id),
  );

  function linkIdFor(parentId: string, childId: string) {
    return links.find((l) => l.parentId === parentId && l.childId === childId)?.id;
  }

  async function addLink(parentId: string, childId: string, reset: () => void) {
    setError(null);
    try {
      await api.createLink(parentId, childId);
      reset();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add link");
    }
  }

  async function removeLink(parentId: string, childId: string) {
    const linkId = linkIdFor(parentId, childId);
    if (!linkId) return;
    await api.deleteLink(linkId);
    load();
  }

  async function handleDeleteMember() {
    if (!id || !member) return;
    if (!confirm(`Delete ${member.name}? This also removes their parent/child links.`)) return;
    await api.deleteMember(id);
    navigate("/");
  }

  const details: { label: string; value: string | null }[] = [
    { label: "Birthday", value: member.birthday ? member.birthday.slice(0, 10) : null },
    { label: "Phone", value: member.phone },
    { label: "Address", value: member.address },
    { label: "Note", value: member.note },
  ];

  function RelationSection({
    heading,
    people,
    pickable,
    placeholder,
    value,
    onValueChange,
    onAdd,
    onRemove,
  }: {
    heading: string;
    people: FamilyMember[];
    pickable: FamilyMember[];
    placeholder: string;
    value: string;
    onValueChange: (v: string) => void;
    onAdd: () => void;
    onRemove: (personId: string) => void;
  }) {
    return (
      <section className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold text-ctp-text">{heading}</h3>

        <ul className="mt-2 divide-y divide-ctp-surface0">
          {people.map((p) => (
            <li key={p.id} className="group flex items-center gap-3 py-2">
              <Avatar member={p} size={30} />
              <button
                onClick={() => navigate(`/members/${p.id}`)}
                className="cursor-pointer text-sm font-medium text-ctp-blue hover:underline"
              >
                {p.name}
              </button>
              <Button
                variant="danger"
                onClick={() => onRemove(p.id)}
                className="ml-auto opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
              >
                Remove
              </Button>
            </li>
          ))}
          {people.length === 0 && (
            <li className="py-2 text-sm text-ctp-subtext0">None linked yet</li>
          )}
        </ul>

        <div className="mt-3 flex gap-2">
          <select
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            className={`${inputClass} flex-1`}
          >
            <option value="">{placeholder}</option>
            {pickable.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <Button onClick={onAdd} disabled={!value}>
            Add
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-3 -ml-3">
        ← Back
      </Button>

      <div className={`${cardClass} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-ctp-text">
              {member.name}
              {member.nameZh && (
                <span className="ml-2 text-base font-normal text-ctp-subtext0">
                  {member.nameZh}
                </span>
              )}
            </h2>
          </div>
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
              <dd className={d.value ? "text-ctp-text" : "text-ctp-overlay0"}>
                {d.value ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {error && <p className="mt-3 text-sm text-ctp-red">{error}</p>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <RelationSection
          heading="Parents"
          people={member.parents}
          pickable={pickableParents}
          placeholder="Add someone as parent..."
          value={newParentId}
          onValueChange={setNewParentId}
          onAdd={() => addLink(newParentId, member.id, () => setNewParentId(""))}
          onRemove={(personId) => removeLink(personId, member.id)}
        />
        <RelationSection
          heading="Children"
          people={member.children}
          pickable={pickableChildren}
          placeholder="Add someone as child..."
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
