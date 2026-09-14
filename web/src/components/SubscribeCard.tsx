import { useEffect, useState } from "react";
import { api } from "../api/client";
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
  const [url, setUrl] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .getCalendarSubscription()
      .then((s) => setUrl(`${window.location.origin}${s.path}`))
      .catch((err) => onError(err instanceof Error ? err.message : "Could not load feed URL"));
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
      onError("Couldn't copy automatically — select the URL and copy it manually.");
    }
  }

  return (
    <div className={`${cardClass} p-4`}>
      <h3 className="text-sm font-semibold text-ctp-text">Subscribe in Google or Apple Calendar</h3>
      <p className="mt-1 text-sm text-ctp-subtext0">
        Subscribe once and every new event and birthday shows up automatically. In Google Calendar
        use <em>Other calendars → From URL</em>; on iPhone use{" "}
        <em>Settings → Calendar → Accounts → Add Subscribed Calendar</em>.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code
          className="min-w-0 flex-1 truncate rounded-lg border border-ctp-surface0 bg-ctp-crust/50
                     px-3 py-2 font-mono text-xs text-ctp-subtext1"
          title={revealed ? undefined : "Hidden — this URL is a secret"}
        >
          {url ? (revealed ? url : url.replace(/\/api\/calendar\/[^/]+\//, "/api/calendar/••••••/")) : "Loading..."}
        </code>

        <Button onClick={() => setRevealed((r) => !r)} disabled={!url}>
          {revealed ? "Hide" : "Reveal"}
        </Button>
        <Button variant="primary" onClick={copy} disabled={!url}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      <p className="mt-2 text-xs text-ctp-peach">
        Treat this URL like a password — anyone who has it can read the family's events without
        signing in.
      </p>
    </div>
  );
}
