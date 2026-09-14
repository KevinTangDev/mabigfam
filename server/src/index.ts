import Fastify from "fastify";
import cors from "@fastify/cors";
import { familyMemberRoutes } from "./routes/familyMembers.js";
import { parentChildRoutes } from "./routes/parentChild.js";
import { treeRoutes } from "./routes/tree.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
});

app.get("/api/health", async () => ({ status: "ok" }));

await app.register(familyMemberRoutes);
await app.register(parentChildRoutes);
await app.register(treeRoutes);

const port = Number(process.env.PORT ?? 3001);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
