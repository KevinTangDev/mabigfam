import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fs from "node:fs/promises";
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

  return app;
}
