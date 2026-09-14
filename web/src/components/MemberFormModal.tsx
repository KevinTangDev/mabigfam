import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { FamilyMember, FamilyMemberInput } from "../types";
import { Button, inputClass } from "./ui";

interface Props {
  title: string;
  initial?: FamilyMember;
  onSubmit: (data: FamilyMemberInput) => Promise<void>;
  onClose: () => void;
}

/** Converts an ISO datetime to the yyyy-mm-dd shape <input type="date"> wants. */
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

  // Escape closes the dialog, matching the backdrop click.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  const fields = [
    { label: "Name *", value: name, set: setName, autoFocus: true },
    { label: "Chinese name", value: nameZh, set: setNameZh },
    { label: "Birthday", value: birthday, set: setBirthday, type: "date" },
    { label: "Phone", value: phone, set: setPhone, type: "tel" },
    { label: "Address", value: address, set: setAddress },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ctp-crust/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border
                   border-ctp-surface1 bg-ctp-base p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-ctp-text">{title}</h2>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          {fields.map((f) => (
            <label key={f.label} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-ctp-subtext0">{f.label}</span>
              <input
                type={f.type ?? "text"}
                value={f.value}
                autoFocus={f.autoFocus}
                onChange={(e) => f.set(e.target.value)}
                className={inputClass}
              />
            </label>
          ))}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ctp-subtext0">Note</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className={`${inputClass} resize-y`}
            />
          </label>

          {error && <p className="text-sm text-ctp-red">{error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
