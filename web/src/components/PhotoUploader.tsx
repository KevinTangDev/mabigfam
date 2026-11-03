import { useRef, useState } from "react";
import { api } from "../api/client";
import { useI18n } from "../i18n/context";
import Avatar from "./Avatar";
import Icon from "./icons";
import type { FamilyMember } from "../types";

interface Props {
  member: FamilyMember;
  onChange: (updated: FamilyMember) => void;
}

export default function PhotoUploader({ member, onChange }: Props) {
  const { t, errorText } = useI18n();
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
      setError(errorText(err, "photo.uploadFailed"));
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
      setError(errorText(err, "photo.removeFailed"));
    } finally {
      setBusy(false);
    }
  }

  const label = member.photoPath ? t("photo.replace") : t("photo.add");

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <Avatar member={member} size={104} />
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {/* The camera badge is the one control: add when empty, replace when set. */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={label}
          title={label}
          className="absolute -right-1 -bottom-1 flex size-9 cursor-pointer items-center justify-center rounded-full
                     bg-brand text-on-brand shadow-card ring-4 ring-ctp-mantle transition hover:bg-brand-strong
                     disabled:cursor-wait disabled:opacity-60 pointer-coarse:size-11"
        >
          <Icon name="camera" className="size-4" />
        </button>
      </div>
      {busy && <p className="text-xs text-ctp-subtext0">{t("photo.working")}</p>}
      {member.photoPath && !busy && (
        <button
          type="button"
          onClick={handleRemove}
          className="cursor-pointer text-xs font-semibold text-ctp-subtext0 transition hover:text-ctp-red"
        >
          {t("photo.remove")}
        </button>
      )}
      {error && <p className="max-w-40 text-center text-xs text-ctp-red">{error}</p>}
    </div>
  );
}
