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

  /**
   * Max ACCEPTED upload size, in bytes — rejected outright above this, before
   * any resizing happens. A storage-abuse/DoS guard on the raw upload, not
   * the size photos end up stored at (see photoMaxDimension/photoQuality
   * below for that — a stored photo is typically far smaller than this).
   */
  maxPhotoBytes: Number(process.env.MAX_PHOTO_BYTES ?? 8 * 1024 * 1024),

  /**
   * Every accepted photo (JPEG/PNG/WebP) is resized to fit within this many
   * pixels on the longest side and re-encoded as JPEG before being written to
   * disk — see storage.ts. Nothing in this app displays a photo anywhere
   * near this large (avatars are tens of pixels, the detail page's is under
   * 100px), so this is generous headroom for retina displays and any future
   * larger use, while still cutting a typical 4000x3000 phone photo down
   * substantially for storage and load time.
   */
  photoMaxDimension: Number(process.env.PHOTO_MAX_DIMENSION ?? 2000),

  /** JPEG re-encode quality (0-100) applied to every stored photo. */
  photoQuality: Number(process.env.PHOTO_QUALITY ?? 82),

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

  /**
   * Login attempts are rate-limited per IP (see routes/auth.ts) to blunt
   * online guessing against the one shared family passphrase, which
   * otherwise has no lockout or backoff at all. Overridable because the
   * test suite's own login() helper is called in nearly every test file's
   * beforeEach against one shared app instance — globalSetup.ts raises this
   * far above what the real suite ever does in a minute so that ambient
   * usage never trips it, and the dedicated rate-limit test builds its own
   * app with a small value instead (see loginRateLimit.test.ts).
   */
  loginRateLimit: {
    max: Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 5),
    timeWindow: process.env.LOGIN_RATE_LIMIT_WINDOW ?? "1 minute",
  },
};
