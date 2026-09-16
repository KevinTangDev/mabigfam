import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ZipArchive } from "archiver";
import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { prisma } from "../db.js";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function backupRoutes(app: FastifyInstance) {
  // A self-service alternative to the SSH/Proxmox-snapshot backup already
  // documented in docs/deploy-proxmox.md — everything needed to restore the
  // whole app (database + photo files) in one download, for whoever wants a
  // copy without shell access to the server.
  //
  // Deliberately not filtered by ACTIVE_MEMBER: this is a disaster-recovery
  // snapshot, not a user-facing export, so it includes trashed members too —
  // restoring from it should put things back exactly as they were.
  app.get("/api/backup", async (_request, reply) => {
    // A raw copy of the live .db file could race a concurrent writer and
    // capture a torn, unreadable file. VACUUM INTO instead asks SQLite
    // itself for one consistent, self-contained snapshot.
    const snapshotPath = path.join(os.tmpdir(), `mabigfam-backup-${crypto.randomUUID()}.db`);
    await prisma.$executeRaw`VACUUM INTO ${snapshotPath}`;

    try {
      reply
        .header("Content-Type", "application/zip")
        .header("Content-Disposition", `attachment; filename="mabigfam-backup-${today()}.zip"`)
        // Contains the whole family's data; never let a proxy keep a copy.
        .header("Cache-Control", "no-store");

      const archive = new ZipArchive({ zlib: { level: 9 } });
      reply.send(archive);

      archive.file(snapshotPath, { name: "mabigfam.db" });

      const hasUploads = await fs
        .access(config.uploadDir)
        .then(() => true)
        .catch(() => false);
      if (hasUploads) archive.directory(config.uploadDir, "uploads");

      await archive.finalize();
    } finally {
      await fs.rm(snapshotPath, { force: true });
    }

    return reply;
  });
}
