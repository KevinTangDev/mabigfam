import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { FamilyEvent, FamilyEventInput } from "../types";
import { Button, inputClass } from "./ui";

interface Props {
  title: string;
  initial?: FamilyEvent;
  onSubmit: (data: FamilyEventInput) => Promise<void>;
  onClose: () => void;
}

/**
 * <input type="datetime-local"> and type="date" both want local wall-clock
 * strings, while the API speaks ISO/UTC. These convert between the two.
 */
function toLocalInput(iso: string | null | undefined, allDay: boolean): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (allDay) return date.toISOString().slice(0, 10);

  // Shift into local time before slicing, or the picker shows UTC.
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromLocalInput(value: string, allDay: boolean): string | null {
  if (!value) return null;
  // An all-day date is stored at UTC midnight so it can't drift a day.
  return allDay ? new Date(`${value}T00:00:00Z`).toISOString() : new Date(value).toISOString();
}

export default function EventFormModal({ title, initial, onSubmit, onClose }: Props) {
  const [name, setName] = useState(initial?.title ?? "");
  const [allDay, setAllDay] = useState(initial?.allDay ?? false);
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.startsAt, initial?.allDay ?? false));
  const [endsAt, setEndsAt] = useState(toLocalInput(initial?.endsAt, initial?.allDay ?? false));
  const [location, setLocation] = useState(initial?.location ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Switching all-day changes the input granularity, so re-slice the values. */
  function switchAllDay(next: boolean) {
    setStartsAt((v) => (v ? (next ? v.slice(0, 10) : `${v.slice(0, 10)}T12:00`) : v));
    setEndsAt((v) => (v ? (next ? v.slice(0, 10) : `${v.slice(0, 10)}T13:00`) : v));
    setAllDay(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Title is required");
    if (!startsAt) return setError("Start date is required");

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title: name.trim(),
        startsAt: fromLocalInput(startsAt, allDay)!,
        endsAt: fromLocalInput(endsAt, allDay),
        location: location.trim() || null,
        description: description.trim() || null,
        allDay,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  const dateType = allDay ? "date" : "datetime-local";

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
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ctp-subtext0">Title *</span>
            <input
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              placeholder="Chinese New Year dinner"
              className={inputClass}
            />
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-ctp-subtext1">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => switchAllDay(e.target.checked)}
              className="size-4 accent-[var(--ctp-blue)]"
            />
            All day
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-ctp-subtext0">Starts *</span>
              <input
                type={dateType}
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-ctp-subtext0">
                {allDay ? "Last day" : "Ends"}
              </span>
              <input
                type={dateType}
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ctp-subtext0">Location</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ctp-subtext0">Notes</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
