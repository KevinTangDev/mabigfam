import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ACTIVE_MEMBER, prisma } from "../db.js";
import { deletePhoto } from "../storage.js";

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
  // List all active members, optionally filtered by name (case-insensitive substring match).
  app.get("/api/members", async (request, reply) => {
    const query = z.object({ search: z.string().optional() }).parse(request.query);

    const members = await prisma.familyMember.findMany({
      where: {
        ...ACTIVE_MEMBER,
        ...(query.search
          ? { OR: [{ name: { contains: query.search } }, { nameZh: { contains: query.search } }] }
          : {}),
      },
      orderBy: { name: "asc" },
    });

    return reply.send(members);
  });

  // Members currently in the trash, most recently deleted first.
  app.get("/api/members/trash", async (_request, reply) => {
    const members = await prisma.familyMember.findMany({
      where: { NOT: ACTIVE_MEMBER },
      orderBy: { deletedAt: "desc" },
    });

    return reply.send(members);
  });

  // Get a single active member by id.
  app.get<{ Params: { id: string } }>("/api/members/:id", async (request, reply) => {
    const member = await prisma.familyMember.findFirst({
      where: { id: request.params.id, ...ACTIVE_MEMBER },
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

  // Update an active member. (A trashed member can't be edited — restore it first.)
  app.patch<{ Params: { id: string } }>("/api/members/:id", async (request, reply) => {
    const parsed = memberUpdateInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.familyMember.findFirst({
      where: { id: request.params.id, ...ACTIVE_MEMBER },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Family member not found" });
    }

    const member = await prisma.familyMember.update({
      where: { id: request.params.id },
      data: { ...parsed.data, birthday: birthdayToDate(parsed.data.birthday) },
    });
    return reply.send(member);
  });

  /**
   * Move a member to the trash. This is *not* a real delete — the row, its
   * ParentChild links, its Partnership rows and its photo file are all left
   * untouched, so Restore can bring everything back exactly as it was.
   * Every other route filters trashed members out via ACTIVE_MEMBER, so they
   * simply stop appearing anywhere (lists, tree, exports, the calendar feed)
   * without their relationships being lost.
   */
  app.delete<{ Params: { id: string } }>("/api/members/:id", async (request, reply) => {
    const existing = await prisma.familyMember.findFirst({
      where: { id: request.params.id, ...ACTIVE_MEMBER },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Family member not found" });
    }

    await prisma.familyMember.update({
      where: { id: request.params.id },
      data: { deletedAt: new Date() },
    });

    return reply.status(204).send();
  });

  // Bring a trashed member back. Their links/partnerships were never
  // touched, so they reappear with all relationships intact.
  app.post<{ Params: { id: string } }>("/api/members/:id/restore", async (request, reply) => {
    const existing = await prisma.familyMember.findFirst({
      where: { id: request.params.id, NOT: ACTIVE_MEMBER },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Trashed member not found" });
    }

    const member = await prisma.familyMember.update({
      where: { id: request.params.id },
      data: { deletedAt: null },
    });

    return reply.send(member);
  });

  /**
   * Permanently remove a member — the real, irreversible delete. Only
   * reachable for a member already in the trash (must Delete, then Purge),
   * which is the deliberate two-step gate: there is no direct way to
   * permanently remove an active member by mistake.
   *
   * A real Prisma delete here, so the schema's onDelete: Cascade actually
   * fires and removes their ParentChild/Partnership rows too.
   */
  app.delete<{ Params: { id: string } }>("/api/members/:id/purge", async (request, reply) => {
    const existing = await prisma.familyMember.findFirst({
      where: { id: request.params.id, NOT: ACTIVE_MEMBER },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Trashed member not found" });
    }

    await prisma.familyMember.delete({ where: { id: request.params.id } });

    if (existing.photoPath) {
      await deletePhoto(existing.photoPath);
    }

    return reply.status(204).send();
  });
}
