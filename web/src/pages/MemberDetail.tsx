import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import MemberFormModal from "../components/MemberFormModal";
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

  if (!member) return <p>Loading...</p>;

  const pickableParents = allMembers.filter(
    (m) => m.id !== member.id && !member.parents.some((p) => p.id === m.id),
  );
  const pickableChildren = allMembers.filter(
    (m) => m.id !== member.id && !member.children.some((c) => c.id === m.id),
  );

  function linkIdFor(parentId: string, childId: string) {
    return links.find((l) => l.parentId === parentId && l.childId === childId)?.id;
  }

  async function addParent() {
    if (!newParentId || !id) return;
    setError(null);
    try {
      await api.createLink(newParentId, id);
      setNewParentId("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add parent");
    }
  }

  async function addChild() {
    if (!newChildId || !id) return;
    setError(null);
    try {
      await api.createLink(id, newChildId);
      setNewChildId("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add child");
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

  return (
    <div className="detail">
      <button className="link-button" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="detail-header">
        <h2>
          {member.name} {member.nameZh && <span className="muted">({member.nameZh})</span>}
        </h2>
        <div>
          <button onClick={() => setShowEdit(true)}>Edit</button>
          <button className="danger" onClick={handleDeleteMember}>
            Delete
          </button>
        </div>
      </div>

      <dl className="detail-fields">
        <dt>Birthday</dt>
        <dd>{member.birthday ? member.birthday.slice(0, 10) : "—"}</dd>
        <dt>Phone</dt>
        <dd>{member.phone ?? "—"}</dd>
        <dt>Address</dt>
        <dd>{member.address ?? "—"}</dd>
        <dt>Note</dt>
        <dd>{member.note ?? "—"}</dd>
      </dl>

      {error && <p className="form-error">{error}</p>}

      <section>
        <h3>Parents</h3>
        <ul className="relation-list">
          {member.parents.map((p) => (
            <li key={p.id}>
              <a onClick={() => navigate(`/members/${p.id}`)}>{p.name}</a>
              <button className="link-button danger" onClick={() => removeLink(p.id, member.id)}>
                Remove
              </button>
            </li>
          ))}
          {member.parents.length === 0 && <li className="muted">No parents linked</li>}
        </ul>
        <div className="add-relation">
          <select value={newParentId} onChange={(e) => setNewParentId(e.target.value)}>
            <option value="">Add existing member as parent...</option>
            {pickableParents.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button onClick={addParent} disabled={!newParentId}>
            Add
          </button>
        </div>
      </section>

      <section>
        <h3>Children</h3>
        <ul className="relation-list">
          {member.children.map((c) => (
            <li key={c.id}>
              <a onClick={() => navigate(`/members/${c.id}`)}>{c.name}</a>
              <button className="link-button danger" onClick={() => removeLink(member.id, c.id)}>
                Remove
              </button>
            </li>
          ))}
          {member.children.length === 0 && <li className="muted">No children linked</li>}
        </ul>
        <div className="add-relation">
          <select value={newChildId} onChange={(e) => setNewChildId(e.target.value)}>
            <option value="">Add existing member as child...</option>
            {pickableChildren.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button onClick={addChild} disabled={!newChildId}>
            Add
          </button>
        </div>
      </section>

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
