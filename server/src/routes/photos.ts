import type { FastifyInstance } from "fastify";
import { ACTIVE_MEMBER, prisma } from "../db.js";
import { config } from "../config.js";
import { UnsupportedImageError, deletePhoto, savePhoto } from "../storage.js";

export async function photoRoutes(app: FastifyInstance) {
  // Upload (or replace) a member's photo. Multipart field name: "photo".
  app.post<{ Params: { id: string } }>("/api/members/:id/photo", async (request, reply) => {
    const member = await prisma.familyMember.findFirst({
      where: { id: request.params.id, ...ACTIVE_MEMBER },
    });
    if (!member) {
      return reply.status(404).send({ error: "Family member not found" });
    }

    const upload = await request.file({ limits: { fileSize: config.maxPhotoBytes } });
    if (!upload) {
      return reply.status(400).send({ error: "No photo uploaded" });
    }

    let buffer: Buffer;
    try {
      buffer = await upload.toBuffer();
    } catch {
      const limitMb = Math.round(config.maxPhotoBytes / (1024 * 1024));
      return reply.status(413).send({ error: `Photo is too large (limit ${limitMb}MB)` });
    }

    let key: string;
    try {
      key = await savePhoto(buffer);
    } catch (err) {
      if (err instanceof UnsupportedImageError) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }

    const updated = await prisma.familyMember.update({
      where: { id: member.id },
      data: { photoPath: key },
    });

    // Only remove the previous file once the new one is safely recorded.
    if (member.photoPath && member.photoPath !== key) {
      await deletePhoto(member.photoPath);
    }

    return reply.send(updated);
  });

  app.delete<{ Params: { id: string } }>("/api/members/:id/photo", async (request, reply) => {
    const member = await prisma.familyMember.findFirst({
      where: { id: request.params.id, ...ACTIVE_MEMBER },
    });
    if (!member) {
      return reply.status(404).send({ error: "Family member not found" });
    }

    if (member.photoPath) {
      await deletePhoto(member.photoPath);
    }

    const updated = await prisma.familyMember.update({
      where: { id: member.id },
      data: { photoPath: null },
    });

    return reply.send(updated);
  });
}
