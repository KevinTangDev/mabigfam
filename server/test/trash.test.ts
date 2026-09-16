import sharp from "sharp";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMember, getApp, login, resetDatabase } from "./helpers.js";
import { savePhoto, readPhoto } from "../src/storage.js";

let cookie: string;
/** A genuinely valid, sharp-decodable 1x1 JPEG — savePhoto now actually
 *  decodes and re-encodes uploads (see storage.ts's resizeToJpeg), so a
 *  fixture with only a plausible-looking magic-byte header isn't enough
 *  here the way it is for the rejection-path tests in storage.test.ts. */
let JPEG_BYTES: Buffer;

beforeAll(async () => {
  JPEG_BYTES = await sharp({
    create: { width: 1, height: 1, channels: 3, background: { r: 200, g: 50, b: 50 } },
  })
    .jpeg()
    .toBuffer();
});

beforeEach(async () => {
  await resetDatabase();
  cookie = await login();
});

describe("soft delete (Trash)", () => {
  it("hides a deleted member from GET, but not from the trash list", async () => {
    const app = await getApp();
    const m = await createMember(cookie, "Kevin");

    expect(
      (await app.inject({ method: "DELETE", url: `/api/members/${m.id}`, headers: { cookie } }))
        .statusCode,
    ).toBe(204);

    expect(
      (await app.inject({ method: "GET", url: `/api/members/${m.id}`, headers: { cookie } }))
        .statusCode,
    ).toBe(404);

    const trash = await app.inject({ method: "GET", url: "/api/members/trash", headers: { cookie } });
    expect(trash.json().map((x: { id: string }) => x.id)).toContain(m.id);
  });

  it("disappears from the active list and /api/tree, but the trash list is separate", async () => {
    const app = await getApp();
    const kept = await createMember(cookie, "Kept");
    const trashed = await createMember(cookie, "Trashed");
    await app.inject({ method: "DELETE", url: `/api/members/${trashed.id}`, headers: { cookie } });

    const list = await app.inject({ method: "GET", url: "/api/members", headers: { cookie } });
    const ids = list.json().map((x: { id: string }) => x.id);
    expect(ids).toContain(kept.id);
    expect(ids).not.toContain(trashed.id);

    const tree = await app.inject({ method: "GET", url: "/api/tree", headers: { cookie } });
    const treeIds = tree.json().members.map((x: { id: string }) => x.id);
    expect(treeIds).toContain(kept.id);
    expect(treeIds).not.toContain(trashed.id);
  });

  it("cannot be deleted twice (already-trashed member 404s on delete)", async () => {
    const app = await getApp();
    const m = await createMember(cookie, "Kevin");
    await app.inject({ method: "DELETE", url: `/api/members/${m.id}`, headers: { cookie } });

    const second = await app.inject({
      method: "DELETE",
      url: `/api/members/${m.id}`,
      headers: { cookie },
    });
    expect(second.statusCode).toBe(404);
  });

  it("cannot be edited, have its photo changed, or be linked to while trashed", async () => {
    const app = await getApp();
    const m = await createMember(cookie, "Kevin");
    const other = await createMember(cookie, "Mou");
    await app.inject({ method: "DELETE", url: `/api/members/${m.id}`, headers: { cookie } });

    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/members/${m.id}`,
          headers: { cookie },
          payload: { phone: "12345" },
        })
      ).statusCode,
    ).toBe(404);

    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/members/${m.id}/photo`,
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(404);

    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/links",
          headers: { cookie },
          payload: { parentId: m.id, childId: other.id },
        })
      ).statusCode,
    ).toBe(404);

    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/partnerships",
          headers: { cookie },
          payload: { memberIds: [m.id, other.id] },
        })
      ).statusCode,
    ).toBe(404);
  });

  describe("restore", () => {
    it("brings a trashed member back into every list", async () => {
      const app = await getApp();
      const m = await createMember(cookie, "Kevin");
      await app.inject({ method: "DELETE", url: `/api/members/${m.id}`, headers: { cookie } });

      const restore = await app.inject({
        method: "POST",
        url: `/api/members/${m.id}/restore`,
        headers: { cookie },
      });
      expect(restore.statusCode).toBe(200);
      expect(restore.json().deletedAt).toBeNull();

      expect(
        (await app.inject({ method: "GET", url: `/api/members/${m.id}`, headers: { cookie } }))
          .statusCode,
      ).toBe(200);

      const trash = await app.inject({ method: "GET", url: "/api/members/trash", headers: { cookie } });
      expect(trash.json().map((x: { id: string }) => x.id)).not.toContain(m.id);
    });

    it("404s restoring something that was never trashed", async () => {
      const app = await getApp();
      const m = await createMember(cookie, "Kevin");
      const res = await app.inject({
        method: "POST",
        url: `/api/members/${m.id}/restore`,
        headers: { cookie },
      });
      expect(res.statusCode).toBe(404);
    });

    it("preserves parent/child links and partnerships across a delete+restore cycle", async () => {
      const app = await getApp();
      const parent = await createMember(cookie, "Hung");
      const kid = await createMember(cookie, "Kevin");
      const spouse = await createMember(cookie, "Mou");

      await app.inject({
        method: "POST",
        url: "/api/links",
        headers: { cookie },
        payload: { parentId: parent.id, childId: kid.id },
      });
      await app.inject({
        method: "POST",
        url: "/api/partnerships",
        headers: { cookie },
        payload: { memberIds: [parent.id, spouse.id] },
      });

      // Trash the middle member (the one with both a parent and a partner)
      // and restore them — everything should come back exactly as it was,
      // since links/partnerships were never touched.
      await app.inject({ method: "DELETE", url: `/api/members/${parent.id}`, headers: { cookie } });
      await app.inject({
        method: "POST",
        url: `/api/members/${parent.id}/restore`,
        headers: { cookie },
      });

      const relations = await app.inject({
        method: "GET",
        url: `/api/members/${parent.id}/relations`,
        headers: { cookie },
      });
      const body = relations.json();
      expect(body.children.map((c: { id: string }) => c.id)).toEqual([kid.id]);
      expect(body.partners.map((p: { member: { id: string } }) => p.member.id)).toEqual([
        spouse.id,
      ]);
    });

    it("does not touch the photo file", async () => {
      const app = await getApp();
      const key = await savePhoto(JPEG_BYTES);
      const m = await createMember(cookie, "Kevin", { photoPath: key });

      await app.inject({ method: "DELETE", url: `/api/members/${m.id}`, headers: { cookie } });
      expect(await readPhoto(key)).not.toBeNull();

      await app.inject({ method: "POST", url: `/api/members/${m.id}/restore`, headers: { cookie } });
      expect(await readPhoto(key)).not.toBeNull();
    });
  });

  describe("purge", () => {
    it("404s purging an active (not-yet-trashed) member — must trash first", async () => {
      const app = await getApp();
      const m = await createMember(cookie, "Kevin");
      const res = await app.inject({
        method: "DELETE",
        url: `/api/members/${m.id}/purge`,
        headers: { cookie },
      });
      expect(res.statusCode).toBe(404);
    });

    it("permanently removes a trashed member and deletes their photo file", async () => {
      const app = await getApp();
      const key = await savePhoto(JPEG_BYTES);
      const m = await createMember(cookie, "Kevin", { photoPath: key });
      await app.inject({ method: "DELETE", url: `/api/members/${m.id}`, headers: { cookie } });

      const purge = await app.inject({
        method: "DELETE",
        url: `/api/members/${m.id}/purge`,
        headers: { cookie },
      });
      expect(purge.statusCode).toBe(204);

      expect(await readPhoto(key)).toBeNull();

      const trash = await app.inject({ method: "GET", url: "/api/members/trash", headers: { cookie } });
      expect(trash.json().map((x: { id: string }) => x.id)).not.toContain(m.id);

      // Restoring a purged member is impossible — the row is really gone.
      const restore = await app.inject({
        method: "POST",
        url: `/api/members/${m.id}/restore`,
        headers: { cookie },
      });
      expect(restore.statusCode).toBe(404);
    });

    it("cascades to remove links and partnerships on purge, just like the old hard delete", async () => {
      const app = await getApp();
      const parent = await createMember(cookie, "Hung");
      const kid = await createMember(cookie, "Kevin");
      await app.inject({
        method: "POST",
        url: "/api/links",
        headers: { cookie },
        payload: { parentId: parent.id, childId: kid.id },
      });

      await app.inject({ method: "DELETE", url: `/api/members/${parent.id}`, headers: { cookie } });
      await app.inject({
        method: "DELETE",
        url: `/api/members/${parent.id}/purge`,
        headers: { cookie },
      });

      const links = await app.inject({ method: "GET", url: "/api/links", headers: { cookie } });
      expect(links.json()).toHaveLength(0);
    });
  });

  describe("exports and calendar exclude trashed members", () => {
    it("CSV export omits a trashed member", async () => {
      const app = await getApp();
      const kept = await createMember(cookie, "Kept");
      const trashed = await createMember(cookie, "ZzzTrashedUnique");
      await app.inject({ method: "DELETE", url: `/api/members/${trashed.id}`, headers: { cookie } });

      const csv = await app.inject({ method: "GET", url: "/api/export/csv", headers: { cookie } });
      expect(csv.body).toContain("Kept");
      expect(csv.body).not.toContain("ZzzTrashedUnique");
    });

    it("the calendar feed omits a trashed member's birthday, keeps an active one's", async () => {
      const app = await getApp();
      const kept = await createMember(cookie, "ZzzKeptBirthday", {
        birthday: "1990-01-01T00:00:00.000Z",
      });
      const trashed = await createMember(cookie, "ZzzTrashedBirthday", {
        birthday: "1985-05-05T00:00:00.000Z",
      });
      await app.inject({ method: "DELETE", url: `/api/members/${trashed.id}`, headers: { cookie } });

      const token = "test-calendar-token";
      const feed = await app.inject({ method: "GET", url: `/api/calendar/${token}/mabigfam.ics` });
      expect(feed.body).toContain(kept.name);
      expect(feed.body).not.toContain("ZzzTrashedBirthday");
    });
  });
});
