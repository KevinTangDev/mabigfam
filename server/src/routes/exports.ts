import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { ACTIVE_MEMBER, prisma } from "../db.js";
import { readPhoto } from "../storage.js";
import { membersToCsv } from "../export/csv.js";
import { membersToVCards, memberToVCard, mimeToVCardType } from "../export/vcard.js";
import type { PhotoData } from "../export/vcard.js";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function asDownload(reply: FastifyReply, filename: string, contentType: string) {
  return reply
    .header("Content-Type", contentType)
    .header("Content-Disposition", `attachment; filename="${filename}"`)
    // These contain the whole family's details; never let a proxy keep a copy.
    .header("Cache-Control", "no-store");
}

/** Loads and base64-encodes photos for the members that have one. */
async function collectPhotos(
  members: { id: string; photoPath: string | null }[],
): Promise<Map<string, PhotoData>> {
  const photos = new Map<string, PhotoData>();

  await Promise.all(
    members.map(async (m) => {
      if (!m.photoPath) return;
      const file = await readPhoto(m.photoPath);
      if (!file) return; // file vanished — export the contact without a face
      photos.set(m.id, {
        base64: file.buffer.toString("base64"),
        type: mimeToVCardType(file.mime),
      });
    }),
  );

  return photos;
}

export async function exportRoutes(app: FastifyInstance) {
  // Spreadsheet-friendly export, with parent/child names resolved.
  app.get("/api/export/csv", async (_request, reply) => {
    const [members, links] = await Promise.all([
      prisma.familyMember.findMany({ where: ACTIVE_MEMBER, orderBy: { name: "asc" } }),
      prisma.parentChild.findMany({ where: { parent: ACTIVE_MEMBER, child: ACTIVE_MEMBER } }),
    ]);

    const nameById = new Map(members.map((m) => [m.id, m.name]));
    const parentNames = new Map<string, string[]>();
    const childNames = new Map<string, string[]>();

    for (const link of links) {
      const parentName = nameById.get(link.parentId);
      const childName = nameById.get(link.childId);
      if (parentName) {
        parentNames.set(link.childId, [...(parentNames.get(link.childId) ?? []), parentName]);
      }
      if (childName) {
        childNames.set(link.parentId, [...(childNames.get(link.parentId) ?? []), childName]);
      }
    }

    const csv = membersToCsv(members, { parentNames, childNames });

    return asDownload(reply, `mabigfam-${today()}.csv`, "text/csv; charset=utf-8").send(csv);
  });

  // Contacts export. A single .vcf holding many cards is what both iOS and
  // Android expect for a bulk import.
  app.get("/api/export/vcard", async (request, reply) => {
    const query = z
      .object({ photos: z.enum(["true", "false"]).optional() })
      .parse(request.query);
    const includePhotos = query.photos !== "false";

    const members = await prisma.familyMember.findMany({
      where: ACTIVE_MEMBER,
      orderBy: { name: "asc" },
    });
    const photos = includePhotos ? await collectPhotos(members) : new Map<string, PhotoData>();

    const vcf = membersToVCards(members, photos);

    return asDownload(reply, `mabigfam-${today()}.vcf`, "text/vcard; charset=utf-8").send(vcf);
  });

  // Single contact, for sharing one person.
  app.get<{ Params: { id: string } }>("/api/members/:id/vcard", async (request, reply) => {
    const member = await prisma.familyMember.findFirst({
      where: { id: request.params.id, ...ACTIVE_MEMBER },
    });
    if (!member) {
      return reply.status(404).send({ error: "Family member not found" });
    }

    const photos = await collectPhotos([member]);
    const vcf = memberToVCard(member, photos.get(member.id));

    const safeName = member.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    return asDownload(reply, `${safeName || "contact"}.vcf`, "text/vcard; charset=utf-8").send(vcf);
  });
}
