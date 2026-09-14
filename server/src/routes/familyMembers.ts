import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const memberInput = z.object({
  name: z.string().min(1, "name is required"),
  nameZh: z.string().min(1).optional().nullable(),
  birthday: z.string().datetime().optional().nullable(),
  phone: z.string().min(1).optional().nullable(),
  address: z.string().min(1).optional().nullable(),
  note: z.string().min(1).optional().nullable(),
  photoPath: z.string().min(1).optional().nullable(),
});

const memberUpdateInput = memberInput.partial();

function birthdayToDate(birthday: string | null | undefined) {
  return birthday === undefined ? undefined : birthday ? new Date(birthday) : null;
}

export async function familyMemberRoutes(app: FastifyInstance) {
  // List all members, optionally filtered by name (case-insensitive substring match).
  app.get("/api/members", async (request, reply) => {
    const query = z.object({ search: z.string().optional() }).parse(request.query);

    const members = await prisma.familyMember.findMany({
      where: query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { nameZh: { contains: query.search } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
    });

    return reply.send(members);
  });

  // Get a single member by id.
  app.get<{ Params: { id: string } }>("/api/members/:id", async (request, reply) => {
    const member = await prisma.familyMember.findUnique({
      where: { id: request.params.id },
    });

    if (!member) {
      return reply.status(404).send({ error: "Family member not found" });
    }

    return reply.send(member);
  });

  // Create a new member.
  app.post("/api/members", async (request, reply) => {
    const parsed = memberInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const member = await prisma.familyMember.create({
      data: { ...parsed.data, birthday: birthdayToDate(parsed.data.birthday) },
    });

    return reply.status(201).send(member);
  });

  // Update an existing member.
  app.patch<{ Params: { id: string } }>("/api/members/:id", async (request, reply) => {
    const parsed = memberUpdateInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const member = await prisma.familyMember.update({
        where: { id: request.params.id },
        data: { ...parsed.data, birthday: birthdayToDate(parsed.data.birthday) },
      });
      return reply.send(member);
    } catch {
      return reply.status(404).send({ error: "Family member not found" });
    }
  });

  // Delete a member (cascades to their ParentChild links).
  app.delete<{ Params: { id: string } }>("/api/members/:id", async (request, reply) => {
    try {
      await prisma.familyMember.delete({ where: { id: request.params.id } });
      return reply.status(204).send();
    } catch {
      return reply.status(404).send({ error: "Family member not found" });
    }
  });
}
