import crypto from "node:crypto";
import path from "node:path";

// Load server/.env if present. Node's built-in loader (20.12+) keeps this
// dependency-free; a missing file is fine, the checks below are what matter.
try {
  process.loadEnvFile();
} catch {
  // No .env file — fall back to whatever is already in the environment.
}

/**
 * This app holds family PII (addresses, phone numbers, photos of children),
 * so it must never boot in an unauthenticated state by accident. Missing
 * secrets are a hard startup failure rather than a silently open server.
 */
function required(name: string, minLength: number): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is not set. Copy server/.env.example to server/.env and set it. ` +
        `Refusing to start: without it the API would be readable by anyone who can reach it.`,
    );
  }

  if (value.length < minLength) {
    throw new Error(`${name} must be at least ${minLength} characters long.`);
  }

  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  isProduction: process.env.NODE_ENV === "production",

  /** Shared passphrase the whole family uses to sign in. */
  familyPassword: required("FAMILY_PASSWORD", 8),
  /** HMAC key used to sign the session cookie. */
  sessionSecret: required("SESSION_SECRET", 32),

  /**
   * Where uploaded photos are written. Local disk by default; see
   * storage.ts for the single place to swap in object storage (S3/R2) when
   * deploying somewhere with an ephemeral filesystem.
   */
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads")),

  /** Max accepted photo upload size, in bytes. */
  maxPhotoBytes: Number(process.env.MAX_PHOTO_BYTES ?? 8 * 1024 * 1024),

  /**
   * Secret embedded in the calendar feed URL.
   *
   * Google Calendar and Apple Calendar fetch a subscribed .ics feed
   * server-to-server, with no cookies, so the feed cannot sit behind the
   * session gate — the URL itself has to carry the credential. This is the
   * same "private iCal address" pattern Google uses.
   *
   * Derived from SESSION_SECRET so there's nothing extra to configure, but
   * settable on its own so the feed can be rotated (invalidating old
   * subscriptions) without signing everyone out.
   */
  calendarFeedToken:
    process.env.CALENDAR_FEED_TOKEN ??
    crypto.createHmac("sha256", required("SESSION_SECRET", 32)).update("calendar-feed").digest("hex").slice(0, 32),
};
