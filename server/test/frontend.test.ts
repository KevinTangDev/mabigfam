import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

/**
 * Covers registerFrontend() in app.ts — the code a single-container
 * deployment actually depends on to serve the built React app itself,
 * with no separate static server or reverse proxy.
 *
 * Isolated into its own file (fresh module registry via resetModules, not
 * just a different WEB_DIST_DIR value) because `config` is a module-level
 * singleton computed once from process.env at import time — the rest of the
 * suite runs with WEB_DIST_DIR pointed at a guaranteed-nonexistent path (see
 * vitest.config.ts) specifically so this feature stays off unless a test
 * means to turn it on.
 */

const INDEX_HTML = "<!doctype html><title>marker</title><div id=root></div>";
const APP_JS = "console.log('app bundle marker');";

let app: FastifyInstance;
let distDir: string;

beforeAll(async () => {
  distDir = fs.mkdtempSync(path.join(os.tmpdir(), "mabigfam-frontend-test-"));
  fs.mkdirSync(path.join(distDir, "assets"));
  fs.writeFileSync(path.join(distDir, "index.html"), INDEX_HTML);
  fs.writeFileSync(path.join(distDir, "assets", "app.js"), APP_JS);

  vi.stubEnv("WEB_DIST_DIR", distDir);
  vi.resetModules();

  const { buildApp } = await import("../src/app.js");
  app = await buildApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  fs.rmSync(distDir, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("serving the built frontend", () => {
  it("serves index.html at / without a session — the login page must load unauthenticated", async () => {
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("marker");
  });

  it("serves a nested static asset without a session", async () => {
    const res = await app.inject({ method: "GET", url: "/assets/app.js" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("app bundle marker");
  });

  it("falls back to index.html for a client-side route with no matching file", async () => {
    // React Router routes like /tree/:id exist only in the browser; the
    // server has no file for them and must still hand back the app shell.
    const res = await app.inject({ method: "GET", url: "/tree/some-member-id" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(INDEX_HTML);
  });

  it("still gates /api routes even though static serving is on", async () => {
    const res = await app.inject({ method: "GET", url: "/api/members" });
    expect(res.statusCode).toBe(401);
  });

  it("returns a plain JSON 404 for an unmatched /api route, not the app shell", async () => {
    // Authenticated, so this exercises the not-found path rather than the
    // auth gate — an unknown API route is a real 404, not a client route.
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { password: "test-password" },
    });
    const cookie = (login.cookies as { name: string; value: string }[]).find(
      (c) => c.name === "mabigfam_session",
    )!;

    const res = await app.inject({
      method: "GET",
      url: "/api/this-route-does-not-exist",
      headers: { cookie: `${cookie.name}=${cookie.value}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "Not found" });
  });

  it("still serves /api/health as public JSON", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});
