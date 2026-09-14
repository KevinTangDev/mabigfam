import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.js";

export const SESSION_COOKIE = "mabigfam_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/** Routes reachable without a session. Everything else under /api is gated. */
const PUBLIC_PATHS = new Set(["/api/health", "/api/auth/login", "/api/auth/session"]);

/**
 * The calendar feed can't use the session cookie (calendar clients fetch it
 * without one), so it authenticates itself with a secret token in the path.
 * The gate lets the prefix through and the route verifies the token.
 */
const TOKEN_AUTHENTICATED_PREFIX = "/api/calendar/";

/** Timing-safe comparison of the feed token. */
export function verifyCalendarToken(submitted: string): boolean {
  const a = crypto.createHash("sha256").update(submitted).digest();
  const b = crypto.createHash("sha256").update(config.calendarFeedToken).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Compares the submitted passphrase against the configured one without
 * leaking length or match position through timing. Both sides are hashed
 * first so the compared buffers are always the same length.
 */
export function verifyPassword(submitted: string): boolean {
  const a = crypto.createHash("sha256").update(submitted).digest();
  const b = crypto.createHash("sha256").update(config.familyPassword).digest();
  return crypto.timingSafeEqual(a, b);
}

export function issueSession(reply: FastifyReply) {
  reply.setCookie(SESSION_COOKIE, JSON.stringify({ at: Date.now() }), {
    path: "/",
    httpOnly: true, // not readable from JS, limits XSS impact
    sameSite: "lax",
    secure: config.isProduction, // HTTPS-only once deployed
    signed: true, // tamper-proof via SESSION_SECRET
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSession(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function hasValidSession(request: FastifyRequest): boolean {
  const raw = request.cookies[SESSION_COOKIE];
  if (!raw) return false;

  // An invalid signature means the cookie was tampered with or was signed
  // with a different SESSION_SECRET.
  const unsigned = request.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) return false;

  try {
    const { at } = JSON.parse(unsigned.value) as { at?: number };
    if (typeof at !== "number") return false;
    return Date.now() - at < SESSION_MAX_AGE_SECONDS * 1000;
  } catch {
    return false;
  }
}

/**
 * Global gate. Registered as an onRequest hook so it runs before any route
 * handler — including the static photo routes — and denies by default:
 * anything under /api that isn't explicitly public requires a session.
 */
export async function authGate(request: FastifyRequest, reply: FastifyReply) {
  const path = request.url.split("?")[0]!;

  if (PUBLIC_PATHS.has(path)) return;
  if (path.startsWith(TOKEN_AUTHENTICATED_PREFIX)) return; // route checks the token
  if (hasValidSession(request)) return;

  return reply.status(401).send({ error: "Not authenticated" });
}
