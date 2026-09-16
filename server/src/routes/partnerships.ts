import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ACTIVE_MEMBER, prisma } from "../db.js";

export const PARTNERSHIP_STATUSES = ["married", "partner", "divorced"] as const;

const partnershipInput = z.object({
  memberIds: z.tuple([z.string().min(1), z.string().min(1)]),
  status: z.enum(PARTNERSHIP_STATUSES).optional(),
  since: z.string().datetime().optional().nullable(),
});

const partnershipUpdateInput = z.object({
  status: z.enum(PARTNERSHIP_STATUSES).optional(),
  since: z.string().datetime().optional().nullable(),
});

/**
 * Partnerships are symmetric, so (X,Y) and (Y,X) must be the same row.
 * Sorting the pair gives one canonical form, which lets the unique index do
 * the duplicate rejection instead of hand-written checks.
 */
export function canonicalPair(first: string, second: string): [string, string] {
  return first < second ? [first, second] : [second, first];
}

export async function partnershipRoutes(app: FastifyInstance) {
  app.get("/api/partnerships", async (_request, reply) => {
    const partnerships = await prisma.partnership.findMany({
      where: { a: ACTIVE_MEMBER, b: ACTIVE_MEMBER },
    });
    return reply.send(partnerships);
  });

  app.post("/api/partnerships", async (request, reply) => {
    const parsed = partnershipInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const [first, second] = parsed.data.memberIds;

    if (first === second) {
      return reply.status(400).send({ error: "A member cannot be their own partner" });
    }

    const [aId, bId] = canonicalPair(first, second);

    const found = await prisma.familyMember.findMany({
      where: { id: { in: [aId, bId] }, ...ACTIVE_MEMBER },
    });
    if (found.length !== 2) {
      return reply.status(404).send({ error: "One or both members not found" });
    }

    // A partner who is also an ancestor or descendant is almost certainly a
    // mis-click, and it would make the tree layout nonsensical.
    if (await isDirectlyRelated(aId, bId)) {
      return reply
        .status(400)
        .send({ error: "Those two are already linked as parent and child" });
    }

    try {
      const partnership = await prisma.partnership.create({
        data: {
          aId,
          bId,
          status: parsed.data.status ?? "married",
          since: parsed.data.since ? new Date(parsed.data.since) : null,
        },
      });
      return reply.status(201).send(partnership);
    } catch {
      return reply.status(409).send({ error: "These two are already partners" });
    }
  });

  app.patch<{ Params: { id: string } }>("/api/partnerships/:id", async (request, reply) => {
    const parsed = partnershipUpdateInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const partnership = await prisma.partnership.update({
        where: { id: request.params.id },
        data: {
          ...parsed.data,
          since:
            parsed.data.since === undefined
              ? undefined
              : parsed.data.since
                ? new Date(parsed.data.since)
                : null,
        },
      });
      return reply.send(partnership);
    } catch {
      return reply.status(404).send({ error: "Partnership not found" });
    }
  });

  app.delete<{ Params: { id: string } }>("/api/partnerships/:id", async (request, reply) => {
    try {
      await prisma.partnership.delete({ where: { id: request.params.id } });
      return reply.status(204).send();
    } catch {
      return reply.status(404).send({ error: "Partnership not found" });
    }
  });
}

/** True if the two members are directly parent/child in either direction. */
async function isDirectlyRelated(x: string, y: string): Promise<boolean> {
  const link = await prisma.parentChild.findFirst({
    where: {
      OR: [
        { parentId: x, childId: y },
        { parentId: y, childId: x },
      ],
    },
  });
  return link !== null;
}
