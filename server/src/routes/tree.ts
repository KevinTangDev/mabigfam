import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function treeRoutes(app: FastifyInstance) {
  // A single member with their parents, children and partners resolved.
  app.get<{ Params: { id: string } }>("/api/members/:id/relations", async (request, reply) => {
    const id = request.params.id;

    const member = await prisma.familyMember.findUnique({
      where: { id },
      include: {
        parentLinks: { include: { parent: true } }, // links where this member is the child
        childLinks: { include: { child: true } }, // links where this member is the parent
        // A partnership stores each pair once, so the member may be on either
        // side and both directions have to be read.
        partnershipsA: { include: { b: true } },
        partnershipsB: { include: { a: true } },
      },
    });

    if (!member) {
      return reply.status(404).send({ error: "Family member not found" });
    }

    const { parentLinks, childLinks, partnershipsA, partnershipsB, ...rest } = member;

    const partners = [
      ...partnershipsA.map((p) => ({
        partnershipId: p.id,
        status: p.status,
        since: p.since,
        member: p.b,
      })),
      ...partnershipsB.map((p) => ({
        partnershipId: p.id,
        status: p.status,
        since: p.since,
        member: p.a,
      })),
    ];

    return reply.send({
      ...rest,
      parents: parentLinks.map((l) => l.parent),
      children: childLinks.map((l) => l.child),
      partners,
    });
  });

  // Everything needed to render the whole tree client-side.
  app.get("/api/tree", async (_request, reply) => {
    const [members, links, partnerships] = await Promise.all([
      prisma.familyMember.findMany({ orderBy: { name: "asc" } }),
      prisma.parentChild.findMany(),
      prisma.partnership.findMany(),
    ]);

    return reply.send({ members, links, partnerships });
  });
}
