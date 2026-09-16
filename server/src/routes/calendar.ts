import type { FastifyInstance } from "fastify";
import { ACTIVE_MEMBER, prisma } from "../db.js";
import { config } from "../config.js";
import { hasValidSession, verifyCalendarToken } from "../auth.js";
import { buildCalendar } from "../export/ical.js";

export async function calendarRoutes(app: FastifyInstance) {
  /**
   * The subscribable feed. Authenticated by the token in the path rather than
   * the session cookie, because Google/Apple Calendar fetch this
   * server-to-server and send no cookies.
   *
   * The trailing filename is what some clients use to name the calendar
   * before they read X-WR-CALNAME.
   */
  app.get<{ Params: { token: string } }>(
    "/api/calendar/:token/mabigfam.ics",
    async (request, reply) => {
      if (!verifyCalendarToken(request.params.token)) {
        // 404 rather than 401: don't hint that a valid token exists here.
        return reply.status(404).send({ error: "Not found" });
      }

      const [events, members] = await Promise.all([
        prisma.familyEvent.findMany({ orderBy: { startsAt: "asc" } }),
        prisma.familyMember.findMany({ where: { birthday: { not: null }, ...ACTIVE_MEMBER } }),
      ]);

      return reply
        .header("Content-Type", "text/calendar; charset=utf-8")
        // The URL is a bearer secret — keep it out of shared caches.
        .header("Cache-Control", "private, max-age=600")
        .send(buildCalendar(events, members));
    },
  );

  /**
   * Hands the signed-in web app its own feed URL to display. Session-gated
   * (not token-gated) so the secret is only shown to someone already in.
   */
  app.get("/api/calendar/subscription", async (request, reply) => {
    if (!hasValidSession(request)) {
      return reply.status(401).send({ error: "Not authenticated" });
    }

    return reply.send({
      path: `/api/calendar/${config.calendarFeedToken}/mabigfam.ics`,
    });
  });
}
