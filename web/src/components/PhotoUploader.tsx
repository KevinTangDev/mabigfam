import { useRef, useState } from "react";
import { api } from "../api/client";
import Avatar from "./Avatar";
import { Button } from "./ui";
import type { FamilyMember } from "../types";

interface Props {
  member: FamilyMember;
  onChange: (updated: FamilyMember) => void;
}

export default function PhotoUploader({ member, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await api.uploadPhoto(member.id, file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      // Allow re-picking the same file after a failure.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);
    try {
      onChange(await api.deletePhoto(member.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove photo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar member={member} size={88} />

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? "Working..." : member.photoPath ? "Replace photo" : "Add photo"}
        </Button>
        {member.photoPath && (
          <Button type="button" variant="danger" onClick={handleRemove} disabled={busy}>
            Remove
          </Button>
        )}
        {error && <p className="basis-full text-sm text-ctp-red">{error}</p>}
      </div>
    </div>
  );
}
