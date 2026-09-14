import Fastify from "fastify";
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
import { treeRoutes } from "./routes/tree.js";
import { photoRoutes } from "./routes/photos.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: config.webOrigin,
  credentials: true, // required for the session cookie to travel
});

await app.register(cookie, { secret: config.sessionSecret });
await app.register(multipart, { limits: { fileSize: config.maxPhotoBytes, files: 1 } });

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
  // Photos are immutable (a replacement gets a new filename), so they can be
  // cached hard by the browser.
  maxAge: "30d",
});

app.get("/api/health", async () => ({ status: "ok" }));

await app.register(authRoutes);
await app.register(familyMemberRoutes);
await app.register(parentChildRoutes);
await app.register(treeRoutes);
await app.register(photoRoutes);

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
