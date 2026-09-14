import { FormEvent, useState } from "react";
import type { FamilyMember, FamilyMemberInput } from "../types";

interface Props {
  title: string;
  initial?: FamilyMember;
  onSubmit: (data: FamilyMemberInput) => Promise<void>;
  onClose: () => void;
}

// Converts an ISO datetime string to the yyyy-mm-dd shape <input type="date"> expects.
function toDateInputValue(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

export default function MemberFormModal({ title, initial, onSubmit, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [nameZh, setNameZh] = useState(initial?.nameZh ?? "");
  const [birthday, setBirthday] = useState(toDateInputValue(initial?.birthday));
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        nameZh: nameZh.trim() || null,
        birthday: birthday ? new Date(birthday).toISOString() : null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        note: note.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Name *
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label>
            Chinese name
            <input value={nameZh} onChange={(e) => setNameZh(e.target.value)} />
          </label>
          <label>
            Birthday
            <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
          </label>
          <label>
            Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label>
            Address
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <label>
            Note
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
