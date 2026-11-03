import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useI18n } from "../i18n/context";
import Icon from "./icons";
import { Button, cardClass } from "./ui";

interface Props {
  onError: (message: string) => void;
}

/**
 * Shows the subscribable feed URL. Subscribing (rather than downloading) is
 * what makes new reunions and birthdays appear in everyone's calendar
 * automatically.
 */
export default function SubscribeCard({ onError }: Props) {
  const { t, rich, errorText } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .getCalendarSubscription()
      .then((s) => setUrl(`${window.location.origin}${s.path}`))
      .catch((err) => onError(errorText(err, "sub.loadFailed")));
    // onError is a setState function and stable; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard needs a secure context; reveal the URL so it can be
      // selected by hand instead.
      setRevealed(true);
      onError(t("sub.copyFailed"));
    }
  }

  return (
    <div className={`${cardClass} border-ctp-blue/25 bg-linear-to-br from-ctp-blue/10 via-ctp-mantle to-ctp-mantle p-4 sm:p-5`}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ctp-text">
        <Icon name="calendar" className="size-4 text-ctp-blue" />
        {t("sub.title")}
      </h3>
      <p className="mt-1 text-sm text-ctp-subtext0">
        {rich("sub.body")}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code
          className="min-w-0 flex-1 truncate rounded-xl border border-ctp-surface0 bg-ctp-crust/60
                     px-3 py-2 font-mono text-xs text-ctp-subtext1"
          title={revealed ? undefined : t("sub.hiddenTitle")}
        >
          {url ? (revealed ? url : url.replace(/\/api\/calendar\/[^/]+\//, "/api/calendar/••••••/")) : t("common.loading")}
        </code>

        <Button onClick={() => setRevealed((r) => !r)} disabled={!url}>
          {revealed ? t("common.hide") : t("common.reveal")}
        </Button>
        <Button variant="primary" onClick={copy} disabled={!url}>
          {copied ? t("common.copied") : t("common.copy")}
        </Button>
      </div>

      <p className="mt-3 text-xs text-ctp-peach">
        {t("sub.warning")}
      </p>
    </div>
  );
}
