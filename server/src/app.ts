import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { authGate } from "./auth.js";
import { authRoutes } from "./routes/auth.js";
import { familyMemberRoutes } from "./routes/familyMembers.js";
import { parentChildRoutes } from "./routes/parentChild.js";
import { partnershipRoutes } from "./routes/partnerships.js";
import { treeRoutes } from "./routes/tree.js";
import { photoRoutes } from "./routes/photos.js";
import { exportRoutes } from "./routes/exports.js";
import { eventRoutes } from "./routes/events.js";
import { calendarRoutes } from "./routes/calendar.js";
import { backupRoutes } from "./routes/backup.js";

/**
 * Builds the fully wired app without listening, so tests can drive it through
 * `app.inject()` over the real routing and hook pipeline.
 */
export async function buildApp({ logger = true } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger });

  await app.register(cors, {
    origin: config.webOrigin,
    credentials: true, // required for the session cookie to travel
  });

  await app.register(cookie, { secret: config.sessionSecret });
  await app.register(multipart, { limits: { fileSize: config.maxPhotoBytes, files: 1 } });

  // global: false — this only guards individual routes that opt in via
  // `config: { rateLimit: ... }` (currently just login; see routes/auth.ts),
  // not every request.
  await app.register(rateLimit, { global: false });

  /*
   * Treat an empty body as "no body" instead of a parse error.
   *
   * Fastify's default JSON parser rejects a bodyless request that declares
   * application/json with FST_ERR_CTP_EMPTY_JSON_BODY (400). Browsers and
   * HTTP clients routinely set that header on DELETEs and bodyless POSTs, so
   * being strict here breaks every such call for reasons the caller can do
   * nothing about. (This is exactly what broke the UI's delete buttons and
   * sign-out.)
   */
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => {
      const text = typeof body === "string" ? body.trim() : "";
      if (text === "") return done(null, undefined);

      try {
        done(null, JSON.parse(text));
      } catch {
        done(Object.assign(new Error("Invalid JSON body"), { statusCode: 400 }));
      }
    },
  );

  // Deny-by-default gate. Registered before the routes so it covers all of
  // them, including the static photo files below.
  app.addHook("onRequest", authGate);

  // Uploaded photos, served only to authenticated callers by virtue of the
  // hook above and the /api prefix.
  await fs.mkdir(config.uploadDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: config.uploadDir,
    prefix: "/api/photos/",
    index: false,
    // Photos are immutable (a replacement gets a new filename), so they can
    // be cached hard by the browser.
    maxAge: "30d",
  });

  app.get("/api/health", async () => ({ status: "ok" }));

  await app.register(authRoutes);
  await app.register(familyMemberRoutes);
  await app.register(parentChildRoutes);
  await app.register(partnershipRoutes);
  await app.register(treeRoutes);
  await app.register(photoRoutes);
  await app.register(exportRoutes);
  await app.register(eventRoutes);
  await app.register(calendarRoutes);
  await app.register(backupRoutes);

  await registerFrontend(app);

  return app;
}

/**
 * Serves the built frontend (web/dist) when present, so a single process on
 * a single port is a complete deployment — no separate static file server or
 * reverse proxy required. Absent in local dev, where Vite's own dev server
 * serves the frontend instead (see web/vite.config.ts's proxy to this API).
 */
async function registerFrontend(app: FastifyInstance) {
  const hasFrontend = await fs
    .access(path.join(config.webDistDir, "index.html"))
    .then(() => true)
    .catch(() => false);

  if (!hasFrontend) return;

  await app.register(fastifyStatic, {
    root: config.webDistDir,
    prefix: "/",
    // The photo registration above already added reply.sendFile(); adding it
    // again here would throw "decorator has already been added".
    decorateReply: false,
  });

  // React Router does client-side routing (e.g. /tree/:id, /members/:id)
  // with no matching file on disk, so every one of those needs index.html
  // rather than a 404 — the SPA then reads the URL itself and renders the
  // right page. An unmatched /api/* route is a real 404, not a client route,
  // so it keeps the normal JSON response instead.
  app.setNotFoundHandler((request, reply) => {
    if (request.method !== "GET" || request.url.startsWith("/api/")) {
      return reply.status(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html", config.webDistDir);
  });
}
