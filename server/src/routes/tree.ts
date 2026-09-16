import type { FastifyInstance } from "fastify";
import { ACTIVE_MEMBER, prisma } from "../db.js";

export async function treeRoutes(app: FastifyInstance) {
  // A single active member with their active parents, children and partners
  // resolved. A trashed relative simply doesn't appear — restoring them
  // brings the link back into view automatically, since the underlying
  // ParentChild/Partnership rows were never touched.
  app.get<{ Params: { id: string } }>("/api/members/:id/relations", async (request, reply) => {
    const id = request.params.id;

    const member = await prisma.familyMember.findFirst({
      where: { id, ...ACTIVE_MEMBER },
      include: {
        parentLinks: { where: { parent: ACTIVE_MEMBER }, include: { parent: true } },
        childLinks: { where: { child: ACTIVE_MEMBER }, include: { child: true } },
        // A partnership stores each pair once, so the member may be on either
        // side and both directions have to be read.
        partnershipsA: { where: { b: ACTIVE_MEMBER }, include: { b: true } },
        partnershipsB: { where: { a: ACTIVE_MEMBER }, include: { a: true } },
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

  // Everything needed to render the whole tree client-side — active members only.
  app.get("/api/tree", async (_request, reply) => {
    const [members, links, partnerships] = await Promise.all([
      prisma.familyMember.findMany({ where: ACTIVE_MEMBER, orderBy: { name: "asc" } }),
      prisma.parentChild.findMany({ where: { parent: ACTIVE_MEMBER, child: ACTIVE_MEMBER } }),
      prisma.partnership.findMany({ where: { a: ACTIVE_MEMBER, b: ACTIVE_MEMBER } }),
    ]);

    return reply.send({ members, links, partnerships });
  });
}
