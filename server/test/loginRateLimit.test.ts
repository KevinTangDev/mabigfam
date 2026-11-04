import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

/**
 * The shared ambient app used by every other test file (helpers.ts's
 * getApp()) has its rate limit raised effectively to infinity by
 * globalSetup.ts, because its login() helper is called from nearly every
 * file's beforeEach — hundreds of logins from the same inject() address
 * well within a minute. This file builds its own app with a small limit
 * instead (same isolation pattern as cookieSecurity.test.ts and
 * frontend.test.ts: config bakes in process.env at import time, so a fresh
 * module registry is required to see a different value).
 */

async function buildLimitedApp(trustProxy = ""): Promise<FastifyInstance> {
  vi.stubEnv("TRUST_PROXY", trustProxy);
  vi.stubEnv("LOGIN_RATE_LIMIT_MAX", "3");
  vi.stubEnv("LOGIN_RATE_LIMIT_WINDOW", "1 minute");
  vi.resetModules();

  const { buildApp } = await import("../src/app.js");
  const app = await buildApp({ logger: false });
  await app.ready();
  return app;
}

function attemptLogin(app: FastifyInstance, password: string) {
  return app.inject({ method: "POST", url: "/api/auth/login", payload: { password } });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("login rate limiting", () => {
  it("allows attempts up to the configured max", async () => {
    const app = await buildLimitedApp();

    for (let i = 0; i < 3; i++) {
      const res = await attemptLogin(app, "wrong-password");
      expect(res.statusCode).toBe(401); // wrong password, but not yet rate-limited
    }

    await app.close();
  });

  it("429s once the max is exceeded, and still 429s a correct password", async () => {
    const app = await buildLimitedApp();

    for (let i = 0; i < 3; i++) {
      await attemptLogin(app, "wrong-password");
    }

    const blocked = await attemptLogin(app, "wrong-password");
    expect(blocked.statusCode).toBe(429);

    // Even the real password doesn't get through once the IP is capped —
    // otherwise the limit would only ever block failed attempts, not a
    // fast automated guesser that eventually finds it.
    const correctButBlocked = await attemptLogin(app, "test-password");
    expect(correctButBlocked.statusCode).toBe(429);

    await app.close();
  });

  it("only limits the login route, not the rest of the API", async () => {
    const app = await buildLimitedApp();

    for (let i = 0; i < 5; i++) {
      await attemptLogin(app, "wrong-password");
    }

    const health = await app.inject({ method: "GET", url: "/api/health" });
    expect(health.statusCode).toBe(200);

    await app.close();
  });
});

/**
 * Behind a tunnel or reverse proxy every request arrives from the proxy's own
 * address, so without TRUST_PROXY the login limit is one bucket shared by the
 * whole family (one typo locks everybody out). With it, the limit follows the
 * real client in X-Forwarded-For. Without it the header must be ignored, or
 * anyone could forge a fresh IP to skip the limit.
 */
describe("login rate limiting behind a proxy", () => {
  const from = (app: FastifyInstance, ip: string, password = "wrong-password") =>
    app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { "x-forwarded-for": ip },
      payload: { password },
    });

  it("ignores X-Forwarded-For by default, so a forged address gets no fresh budget", async () => {
    const app = await buildLimitedApp();

    for (let i = 0; i < 3; i++) await from(app, "203.0.113.1");
    expect((await from(app, "203.0.113.1")).statusCode).toBe(429);
    expect((await from(app, "198.51.100.7")).statusCode).toBe(429);

    await app.close();
  });

  it("with TRUST_PROXY=true, each forwarded client has its own budget", async () => {
    const app = await buildLimitedApp("true");

    for (let i = 0; i < 3; i++) await from(app, "203.0.113.1");
    expect((await from(app, "203.0.113.1")).statusCode).toBe(429); // the typist is capped...
    const other = await from(app, "198.51.100.7", "test-password");
    expect(other.statusCode).toBe(200); // ...but a relative elsewhere can still sign in

    await app.close();
  });
});
