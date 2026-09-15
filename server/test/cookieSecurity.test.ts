import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

/**
 * Regression coverage for a real deployment bug: a `Secure` cookie set over
 * plain HTTP is silently *not stored* by the browser — login looks like it
 * succeeds (the server responds 200) but the session never actually sticks,
 * because the browser just drops the cookie. `http://localhost` is exempted
 * by browsers (treated as a secure context), which is exactly why this can
 * pass local testing and then fail once reached by LAN IP or hostname —
 * caught here by asserting the actual Set-Cookie header rather than relying
 * on a real browser's storage behavior, which vitest can't observe.
 *
 * Isolated per test (fresh module registry) because `config` bakes in
 * process.env at import time — same reasoning as frontend.test.ts.
 */

async function loginAndGetSetCookieHeader(): Promise<string> {
  vi.resetModules();
  const { buildApp } = await import("../src/app.js");
  const app: FastifyInstance = await buildApp({ logger: false });
  await app.ready();

  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { password: "test-password" },
  });

  const header = res.headers["set-cookie"];
  await app.close();

  return Array.isArray(header) ? header.join("; ") : (header ?? "");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("session cookie Secure flag", () => {
  it("is NOT set in local dev (NODE_ENV unset, COOKIE_SECURE unset)", async () => {
    vi.stubEnv("NODE_ENV", "");
    vi.stubEnv("COOKIE_SECURE", "");
    const cookie = await loginAndGetSetCookieHeader();
    expect(cookie.toLowerCase()).not.toContain("secure");
  });

  it("defaults to Secure once NODE_ENV=production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SECURE", "");
    const cookie = await loginAndGetSetCookieHeader();
    expect(cookie).toContain("Secure");
  });

  it("can be explicitly disabled for a plain-HTTP production deployment (COOKIE_SECURE=false)", async () => {
    // This is the actual LAN-deployment case: NODE_ENV=production for
    // everything else it affects, but no TLS, so the cookie must not be
    // Secure or the browser will never store it.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SECURE", "false");
    const cookie = await loginAndGetSetCookieHeader();
    expect(cookie.toLowerCase()).not.toContain("secure");
  });

  it("can be explicitly enabled outside production (COOKIE_SECURE=true)", async () => {
    vi.stubEnv("NODE_ENV", "");
    vi.stubEnv("COOKIE_SECURE", "true");
    const cookie = await loginAndGetSetCookieHeader();
    expect(cookie).toContain("Secure");
  });
});
