import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { clearSession, hasValidSession, issueSession, verifyPassword } from "../auth.js";
import { config } from "../config.js";

const loginInput = z.object({ password: z.string().min(1) });

export async function authRoutes(app: FastifyInstance) {
  // Whether the current caller already has a valid session. The web app calls
  // this on load to decide between the login screen and the app.
  app.get("/api/auth/session", async (request, reply) => {
    return reply.send({ authenticated: hasValidSession(request) });
  });

  app.post(
    "/api/auth/login",
    // Per-IP cap on top of the timing-safe compare — the one shared family
    // passphrase otherwise has no lockout or backoff at all, so nothing
    // stops fast online guessing.
    { config: { rateLimit: config.loginRateLimit } },
    async (request, reply) => {
      const parsed = loginInput.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Password is required" });
      }

      if (!verifyPassword(parsed.data.password)) {
        request.log.warn({ ip: request.ip }, "failed login attempt");
        // Deliberately vague: don't confirm whether a passphrase is close.
        return reply.status(401).send({ error: "Incorrect password" });
      }

      issueSession(reply);
      return reply.send({ authenticated: true });
    },
  );

  app.post("/api/auth/logout", async (_request, reply) => {
    clearSession(reply);
    return reply.send({ authenticated: false });
  });
}
