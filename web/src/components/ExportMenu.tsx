import { useEffect, useRef, useState } from "react";
import { downloadFile } from "../api/client";
import { useI18n } from "../i18n/context";
import type { BaseKey } from "../i18n/config";
import Icon from "./icons";
import { Button, cardClass } from "./ui";

const OPTIONS: { label: BaseKey; hint: BaseKey; path: string; file: string }[] = [
  {
    label: "export.csv",
    hint: "export.csvHint",
    path: "/export/csv",
    file: "mabigfam.csv",
  },
  {
    label: "export.vcard",
    hint: "export.vcardHint",
    path: "/export/vcard",
    file: "mabigfam.vcf",
  },
  {
    label: "export.vcardLite",
    hint: "export.vcardLiteHint",
    path: "/export/vcard?photos=false",
    file: "mabigfam.vcf",
  },
  {
    label: "export.backup",
    hint: "export.backupHint",
    path: "/backup",
    file: "mabigfam-backup.zip",
  },
];

export default function ExportMenu() {
  const { t, errorText } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;

    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function run(path: string, file: string) {
    setBusy(path);
    setError(null);
    try {
      await downloadFile(path, file);
      setOpen(false);
    } catch (err) {
      setError(errorText(err, "export.failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <Button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <Icon name="download" />
        {t("export.button")}
        <Icon name="chevronDown" className="size-3.5" />
      </Button>

      {open && (
        <div
          role="menu"
          className={`${cardClass} absolute right-0 z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] overflow-hidden p-1 shadow-lg`}
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt.path}
              role="menuitem"
              disabled={busy !== null}
              onClick={() => run(opt.path, opt.file)}
              className="w-full cursor-pointer rounded-lg px-3 py-2 text-left transition
                         hover:bg-ctp-surface0 disabled:opacity-50"
            >
              <div className="text-sm font-medium text-ctp-text">
                {busy === opt.path ? t("export.preparing") : t(opt.label)}
              </div>
              <div className="text-xs text-ctp-subtext0">{t(opt.hint)}</div>
            </button>
          ))}

          {error && <p className="px-3 py-2 text-xs text-ctp-red">{error}</p>}
        </div>
      )}
    </div>
  );
}
