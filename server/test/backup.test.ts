import AdmZip from "adm-zip";
import sharp from "sharp";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMember, getApp, login, resetDatabase } from "./helpers.js";
import { savePhoto } from "../src/storage.js";

let cookie: string;
let JPEG_BYTES: Buffer;

beforeAll(async () => {
  JPEG_BYTES = await sharp({
    create: { width: 1, height: 1, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .jpeg()
    .toBuffer();
});

beforeEach(async () => {
  await resetDatabase();
  cookie = await login();
});

describe("GET /api/backup", () => {
  it("requires a session", async () => {
    const app = await getApp();
    const res = await app.inject({ method: "GET", url: "/api/backup" });
    expect(res.statusCode).toBe(401);
  });

  it("returns a zip with the database and every photo file", async () => {
    const app = await getApp();
    const key = await savePhoto(JPEG_BYTES);
    await createMember(cookie, "Kevin", { photoPath: key });

    const res = await app.inject({ method: "GET", url: "/api/backup", headers: { cookie } });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/zip");
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="mabigfam-backup-.*\.zip"/);

    const zip = new AdmZip(res.rawPayload);
    const names = zip.getEntries().map((e) => e.entryName);
    expect(names).toContain("mabigfam.db");
    expect(names).toContain(`uploads/${key}`);
  });

  it("the bundled database actually contains the family data, not an empty snapshot", async () => {
    const app = await getApp();
    await createMember(cookie, "ZzzBackupUniqueName");

    const res = await app.inject({ method: "GET", url: "/api/backup", headers: { cookie } });
    const zip = new AdmZip(res.rawPayload);
    const db = zip.getEntry("mabigfam.db")!.getData();

    // A real check would open it with sqlite; a raw byte-contains check on
    // the row's own name is enough to confirm this isn't an empty/garbage
    // file without pulling in another dependency just for the test.
    expect(db.includes("ZzzBackupUniqueName")).toBe(true);
  });

  it("includes a trashed member's data too — this is a disaster-recovery snapshot, not a user export", async () => {
    const app = await getApp();
    const m = await createMember(cookie, "ZzzTrashedBackupName");
    await app.inject({ method: "DELETE", url: `/api/members/${m.id}`, headers: { cookie } });

    const res = await app.inject({ method: "GET", url: "/api/backup", headers: { cookie } });
    const zip = new AdmZip(res.rawPayload);
    const db = zip.getEntry("mabigfam.db")!.getData();

    expect(db.includes("ZzzTrashedBackupName")).toBe(true);
  });
});
