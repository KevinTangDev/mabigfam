import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { buildSingleEventCalendar } from "../export/ical.js";

const eventInput = z.object({
  title: z.string().min(1, "title is required"),
  description: z.string().min(1).optional().nullable(),
  location: z.string().min(1).optional().nullable(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().nullable(),
  allDay: z.boolean().optional(),
});

const eventUpdateInput = eventInput.partial();

function toDate(value: string | null | undefined) {
  return value === undefined ? undefined : value ? new Date(value) : null;
}

/** endsAt before startsAt would produce a negative-length calendar entry. */
function endsBeforeStart(startsAt?: Date | null, endsAt?: Date | null): boolean {
  return !!startsAt && !!endsAt && endsAt.getTime() < startsAt.getTime();
}

export async function eventRoutes(app: FastifyInstance) {
  app.get("/api/events", async (_request, reply) => {
    const events = await prisma.familyEvent.findMany({ orderBy: { startsAt: "asc" } });
    return reply.send(events);
  });

  app.get<{ Params: { id: string } }>("/api/events/:id", async (request, reply) => {
    const event = await prisma.familyEvent.findUnique({ where: { id: request.params.id } });
    if (!event) return reply.status(404).send({ error: "Event not found" });
    return reply.send(event);
  });

  app.post("/api/events", async (request, reply) => {
    const parsed = eventInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const startsAt = new Date(parsed.data.startsAt);
    const endsAt = toDate(parsed.data.endsAt) ?? null;

    if (endsBeforeStart(startsAt, endsAt)) {
      return reply.status(400).send({ error: "The end must be after the start" });
    }

    const event = await prisma.familyEvent.create({
      data: { ...parsed.data, startsAt, endsAt },
    });

    return reply.status(201).send(event);
  });

  app.patch<{ Params: { id: string } }>("/api/events/:id", async (request, reply) => {
    const parsed = eventUpdateInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.familyEvent.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.status(404).send({ error: "Event not found" });

    const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : existing.startsAt;
    const endsAt =
      parsed.data.endsAt === undefined ? existing.endsAt : toDate(parsed.data.endsAt);

    if (endsBeforeStart(startsAt, endsAt)) {
      return reply.status(400).send({ error: "The end must be after the start" });
    }

    const event = await prisma.familyEvent.update({
      where: { id: request.params.id },
      data: { ...parsed.data, startsAt, endsAt },
    });

    return reply.send(event);
  });

  app.delete<{ Params: { id: string } }>("/api/events/:id", async (request, reply) => {
    try {
      await prisma.familyEvent.delete({ where: { id: request.params.id } });
      return reply.status(204).send();
    } catch {
      return reply.status(404).send({ error: "Event not found" });
    }
  });

  // One-off download, for adding a single event to a calendar app.
  app.get<{ Params: { id: string } }>("/api/events/:id/ics", async (request, reply) => {
    const event = await prisma.familyEvent.findUnique({ where: { id: request.params.id } });
    if (!event) return reply.status(404).send({ error: "Event not found" });

    const safeName = event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

    return reply
      .header("Content-Type", "text/calendar; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${safeName || "event"}.ics"`)
      .send(buildSingleEventCalendar(event));
  });
}
