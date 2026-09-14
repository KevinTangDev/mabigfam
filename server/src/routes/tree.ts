import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function treeRoutes(app: FastifyInstance) {
  // A single member with their parents and children resolved (one level up/down).
  app.get<{ Params: { id: string } }>("/api/members/:id/relations", async (request, reply) => {
    const member = await prisma.familyMember.findUnique({
      where: { id: request.params.id },
      include: {
        parentLinks: { include: { parent: true } }, // links where this member is the child
        childLinks: { include: { child: true } }, // links where this member is the parent
      },
    });

    if (!member) {
      return reply.status(404).send({ error: "Family member not found" });
    }

    const { parentLinks, childLinks, ...rest } = member;

    return reply.send({
      ...rest,
      parents: parentLinks.map((l) => l.parent),
      children: childLinks.map((l) => l.child),
    });
  });

  // Everything needed to render the whole tree client-side: all members plus all links.
  app.get("/api/tree", async (_request, reply) => {
    const [members, links] = await Promise.all([
      prisma.familyMember.findMany({ orderBy: { name: "asc" } }),
      prisma.parentChild.findMany(),
    ]);

    return reply.send({ members, links });
  });
}
