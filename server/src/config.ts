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

  /**
   * Whether the session cookie is sent with the Secure flag, which browsers
   * enforce strictly: a Secure cookie set over plain HTTP is silently
   * *not stored at all* — login appears to succeed (the server responds
   * 200) but the browser just never keeps the cookie, so every subsequent
   * request looks signed-out. `http://localhost` is a browser-specified
   * exception (treated as a secure context), which is exactly why this can
   * pass local testing and then silently fail once reached by LAN IP or a
   * real hostname over HTTP.
   *
   * Defaults to requiring HTTPS whenever NODE_ENV=production, which is
   * correct once this sits behind a TLS-terminating reverse proxy. Set
   * COOKIE_SECURE=false to explicitly opt out for a production deployment
   * that intentionally serves plain HTTP — e.g. a home-LAN-only server. That
   * means the session cookie travels in cleartext, which is a reasonable
   * trade-off on a private trusted network but not one to make silently, so
   * it's a separate opt-in rather than being implied by any other setting.
   */
  secureCookies:
    process.env.COOKIE_SECURE === "false"
      ? false
      : process.env.COOKIE_SECURE === "true"
        ? true
        : process.env.NODE_ENV === "production",

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
   * The built frontend (web/dist). When this directory exists, the server
   * serves it itself — one process, one port, nothing else to run — which is
   * the deployment shape for a single-container/single-VM setup. In local
   * dev the frontend is instead served by Vite's own dev server (for hot
   * reload), so this only matters once `npm run build` has produced it.
   */
  webDistDir: path.resolve(process.env.WEB_DIST_DIR ?? path.join(process.cwd(), "..", "web", "dist")),

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
