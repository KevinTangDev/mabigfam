import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ACTIVE_MEMBER, prisma } from "../db.js";

const linkInput = z.object({
  parentId: z.string().min(1),
  childId: z.string().min(1),
});

export async function parentChildRoutes(app: FastifyInstance) {
  // Links between two active members (handy for building the full tree client-side).
  app.get("/api/links", async (_request, reply) => {
    const links = await prisma.parentChild.findMany({
      where: { parent: ACTIVE_MEMBER, child: ACTIVE_MEMBER },
    });
    return reply.send(links);
  });

  // Create a parent -> child link between two active members.
  app.post("/api/links", async (request, reply) => {
    const parsed = linkInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { parentId, childId } = parsed.data;

    if (parentId === childId) {
      return reply.status(400).send({ error: "A member cannot be their own parent" });
    }

    const [parent, child] = await Promise.all([
      prisma.familyMember.findFirst({ where: { id: parentId, ...ACTIVE_MEMBER } }),
      prisma.familyMember.findFirst({ where: { id: childId, ...ACTIVE_MEMBER } }),
    ]);

    if (!parent || !child) {
      return reply.status(404).send({ error: "Parent or child member not found" });
    }

    // Prevent creating a cycle (e.g. linking an ancestor as a descendant's child).
    if (await isDescendant(childId, parentId)) {
      return reply.status(400).send({ error: "This link would create a cycle in the family tree" });
    }

    try {
      const link = await prisma.parentChild.create({ data: { parentId, childId } });
      return reply.status(201).send(link);
    } catch {
      return reply.status(409).send({ error: "This parent/child link already exists" });
    }
  });

  // Remove a link by its id.
  app.delete<{ Params: { id: string } }>("/api/links/:id", async (request, reply) => {
    try {
      await prisma.parentChild.delete({ where: { id: request.params.id } });
      return reply.status(204).send();
    } catch {
      return reply.status(404).send({ error: "Link not found" });
    }
  });
}

// Returns true if `candidateAncestorId` is already a descendant of `startId`
// (i.e. adding startId -> candidateAncestorId would create a cycle).
async function isDescendant(startId: string, candidateAncestorId: string): Promise<boolean> {
  const visited = new Set<string>();
  const queue = [startId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (currentId === candidateAncestorId) return true;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const childLinks = await prisma.parentChild.findMany({
      where: { parentId: currentId },
      select: { childId: true },
    });
    queue.push(...childLinks.map((l) => l.childId));
  }

  return false;
}
