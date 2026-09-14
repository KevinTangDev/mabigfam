import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createMember, getApp, login, resetDatabase, TEST_PASSWORD } from "./helpers.js";
import { prisma } from "../src/db.js";

let cookie: string;

beforeEach(async () => {
  await resetDatabase();
  cookie = await login();
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe("auth gate", () => {
  it("allows health without a session", async () => {
    const app = await getApp();
    expect((await app.inject({ method: "GET", url: "/api/health" })).statusCode).toBe(200);
  });

  it("rejects data routes without a session", async () => {
    const app = await getApp();
    for (const url of ["/api/members", "/api/events", "/api/tree", "/api/export/csv"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode, url).toBe(401);
    }
  });

  it("rejects a wrong password", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { password: "not-it" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a tampered session cookie", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/members",
      headers: { cookie: "mabigfam_session=tampered" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("accepts the right password and then allows data routes", async () => {
    const app = await getApp();
    expect(
      (await app.inject({ method: "GET", url: "/api/members", headers: { cookie } })).statusCode,
    ).toBe(200);
    expect(TEST_PASSWORD).toBe("test-password");
  });
});

/**
 * Regression guard for the bug where the web client sent
 * `Content-Type: application/json` on bodyless requests, which Fastify
 * rejects with FST_ERR_CTP_EMPTY_JSON_BODY (400). That silently broke every
 * delete action and sign-out in the UI.
 */
describe("bodyless requests declaring a JSON content type", () => {
  it("logs out without a body", async () => {
    const app = await getApp();
    const res = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
    expect(res.statusCode).toBe(200);
  });

  it("deletes a member, a link, a partnership and an event", async () => {
    const app = await getApp();
    const parent = await createMember(cookie, "Parent");
    const child = await createMember(cookie, "Child");
    const spouse = await createMember(cookie, "Spouse");

    const link = (
      await app.inject({
        method: "POST",
        url: "/api/links",
        headers: { cookie },
        payload: { parentId: parent.id, childId: child.id },
      })
    ).json();

    const partnership = (
      await app.inject({
        method: "POST",
        url: "/api/partnerships",
        headers: { cookie },
        payload: { memberIds: [parent.id, spouse.id] },
      })
    ).json();

    const event = (
      await app.inject({
        method: "POST",
        url: "/api/events",
        headers: { cookie },
        payload: { title: "Party", startsAt: "2027-01-01T10:00:00.000Z" },
      })
    ).json();

    // No payload, but the browser sets this header on every fetch by default.
    const jsonNoBody = { cookie, "content-type": "application/json" };

    const deletions = [
      `/api/links/${link.id}`,
      `/api/partnerships/${partnership.id}`,
      `/api/events/${event.id}`,
      `/api/members/${child.id}`,
    ];

    for (const url of deletions) {
      const res = await app.inject({ method: "DELETE", url, headers: jsonNoBody });
      expect(res.statusCode, `${url} -> ${res.body}`).toBe(204);
    }
  });
});

describe("members", () => {
  it("requires a name", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/members",
      headers: { cookie },
      payload: { name: "" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("creates, reads, updates and deletes", async () => {
    const app = await getApp();
    const created = await createMember(cookie, "Kevin TANG", { nameZh: "鄧凱文" });

    const read = await app.inject({
      method: "GET",
      url: `/api/members/${created.id}`,
      headers: { cookie },
    });
    expect(read.json().nameZh).toBe("鄧凱文");

    const updated = await app.inject({
      method: "PATCH",
      url: `/api/members/${created.id}`,
      headers: { cookie },
      payload: { phone: "12345" },
    });
    expect(updated.json().phone).toBe("12345");

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/members/${created.id}`,
      headers: { cookie },
    });
    expect(deleted.statusCode).toBe(204);

    const gone = await app.inject({
      method: "GET",
      url: `/api/members/${created.id}`,
      headers: { cookie },
    });
    expect(gone.statusCode).toBe(404);
  });

  it("filters by name and by Chinese name", async () => {
    const app = await getApp();
    await createMember(cookie, "Kevin TANG", { nameZh: "鄧凱文" });
    await createMember(cookie, "Mou TANG");

    const byName = await app.inject({
      method: "GET",
      url: "/api/members?search=kevin",
      headers: { cookie },
    });
    expect(byName.json()).toHaveLength(1);

    const byZh = await app.inject({
      method: "GET",
      url: "/api/members?search=鄧",
      headers: { cookie },
    });
    expect(byZh.json()).toHaveLength(1);
  });

  it("404s for an unknown id", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/members/nope",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("parent/child links", () => {
  it("rejects self-parenting", async () => {
    const app = await getApp();
    const m = await createMember(cookie, "Solo");

    const res = await app.inject({
      method: "POST",
      url: "/api/links",
      headers: { cookie },
      payload: { parentId: m.id, childId: m.id },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a duplicate link", async () => {
    const app = await getApp();
    const parent = await createMember(cookie, "P");
    const child = await createMember(cookie, "C");
    const payload = { parentId: parent.id, childId: child.id };

    expect((await app.inject({ method: "POST", url: "/api/links", headers: { cookie }, payload })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: "/api/links", headers: { cookie }, payload })).statusCode).toBe(409);
  });

  it("rejects a link that would create a cycle", async () => {
    const app = await getApp();
    const a = await createMember(cookie, "A");
    const b = await createMember(cookie, "B");
    const c = await createMember(cookie, "C");

    await app.inject({ method: "POST", url: "/api/links", headers: { cookie }, payload: { parentId: a.id, childId: b.id } });
    await app.inject({ method: "POST", url: "/api/links", headers: { cookie }, payload: { parentId: b.id, childId: c.id } });

    // C is a descendant of A, so making C a parent of A closes the loop.
    const res = await app.inject({
      method: "POST",
      url: "/api/links",
      headers: { cookie },
      payload: { parentId: c.id, childId: a.id },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/cycle/i);
  });

  it("404s when a member does not exist", async () => {
    const app = await getApp();
    const m = await createMember(cookie, "Real");
    const res = await app.inject({
      method: "POST",
      url: "/api/links",
      headers: { cookie },
      payload: { parentId: m.id, childId: "ghost" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("removes a link without touching the members", async () => {
    const app = await getApp();
    const parent = await createMember(cookie, "P");
    const child = await createMember(cookie, "C");

    const link = (
      await app.inject({
        method: "POST",
        url: "/api/links",
        headers: { cookie },
        payload: { parentId: parent.id, childId: child.id },
      })
    ).json();

    expect(
      (await app.inject({ method: "DELETE", url: `/api/links/${link.id}`, headers: { cookie } }))
        .statusCode,
    ).toBe(204);

    const relations = await app.inject({
      method: "GET",
      url: `/api/members/${child.id}/relations`,
      headers: { cookie },
    });
    expect(relations.json().parents).toHaveLength(0);

    // Both members survive.
    expect((await app.inject({ method: "GET", url: "/api/members", headers: { cookie } })).json()).toHaveLength(2);
  });

  it("deletes links when a member is deleted", async () => {
    const app = await getApp();
    const parent = await createMember(cookie, "P");
    const child = await createMember(cookie, "C");
    await app.inject({ method: "POST", url: "/api/links", headers: { cookie }, payload: { parentId: parent.id, childId: child.id } });

    await app.inject({ method: "DELETE", url: `/api/members/${parent.id}`, headers: { cookie } });

    const links = await app.inject({ method: "GET", url: "/api/links", headers: { cookie } });
    expect(links.json()).toHaveLength(0);
  });
});

describe("partnerships", () => {
  it("stores the pair in canonical order regardless of argument order", async () => {
    const app = await getApp();
    const a = await createMember(cookie, "A");
    const b = await createMember(cookie, "B");

    const created = (
      await app.inject({
        method: "POST",
        url: "/api/partnerships",
        headers: { cookie },
        // Deliberately passed in the "wrong" order.
        payload: { memberIds: [b.id, a.id] },
      })
    ).json();

    const [smaller, larger] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
    expect(created.aId).toBe(smaller);
    expect(created.bId).toBe(larger);
  });

  it("rejects the same pair added the other way round", async () => {
    const app = await getApp();
    const a = await createMember(cookie, "A");
    const b = await createMember(cookie, "B");

    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/partnerships",
          headers: { cookie },
          payload: { memberIds: [a.id, b.id] },
        })
      ).statusCode,
    ).toBe(201);

    const mirrored = await app.inject({
      method: "POST",
      url: "/api/partnerships",
      headers: { cookie },
      payload: { memberIds: [b.id, a.id] },
    });
    expect(mirrored.statusCode).toBe(409);
  });

  it("rejects partnering with oneself", async () => {
    const app = await getApp();
    const a = await createMember(cookie, "A");
    const res = await app.inject({
      method: "POST",
      url: "/api/partnerships",
      headers: { cookie },
      payload: { memberIds: [a.id, a.id] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects partnering a parent with their own child", async () => {
    const app = await getApp();
    const parent = await createMember(cookie, "Parent");
    const child = await createMember(cookie, "Child");
    await app.inject({ method: "POST", url: "/api/links", headers: { cookie }, payload: { parentId: parent.id, childId: child.id } });

    const res = await app.inject({
      method: "POST",
      url: "/api/partnerships",
      headers: { cookie },
      payload: { memberIds: [parent.id, child.id] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects an unknown status", async () => {
    const app = await getApp();
    const a = await createMember(cookie, "A");
    const b = await createMember(cookie, "B");
    const res = await app.inject({
      method: "POST",
      url: "/api/partnerships",
      headers: { cookie },
      payload: { memberIds: [a.id, b.id], status: "its-complicated" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("defaults to married and can be changed to divorced", async () => {
    const app = await getApp();
    const a = await createMember(cookie, "A");
    const b = await createMember(cookie, "B");

    const created = (
      await app.inject({
        method: "POST",
        url: "/api/partnerships",
        headers: { cookie },
        payload: { memberIds: [a.id, b.id] },
      })
    ).json();
    expect(created.status).toBe("married");

    const updated = await app.inject({
      method: "PATCH",
      url: `/api/partnerships/${created.id}`,
      headers: { cookie },
      payload: { status: "divorced" },
    });
    expect(updated.json().status).toBe("divorced");
  });

  it("surfaces the partner from both sides of the relation", async () => {
    const app = await getApp();
    const a = await createMember(cookie, "A");
    const b = await createMember(cookie, "B");
    await app.inject({
      method: "POST",
      url: "/api/partnerships",
      headers: { cookie },
      payload: { memberIds: [a.id, b.id], status: "partner" },
    });

    for (const [self, other] of [
      [a, b],
      [b, a],
    ]) {
      const res = await app.inject({
        method: "GET",
        url: `/api/members/${self.id}/relations`,
        headers: { cookie },
      });
      const partners = res.json().partners;
      expect(partners, `from ${self.name}`).toHaveLength(1);
      expect(partners[0].member.id).toBe(other.id);
      expect(partners[0].status).toBe("partner");
    }
  });

  it("disappears when either member is deleted", async () => {
    const app = await getApp();
    const a = await createMember(cookie, "A");
    const b = await createMember(cookie, "B");
    await app.inject({
      method: "POST",
      url: "/api/partnerships",
      headers: { cookie },
      payload: { memberIds: [a.id, b.id] },
    });

    await app.inject({ method: "DELETE", url: `/api/members/${b.id}`, headers: { cookie } });

    const remaining = await app.inject({
      method: "GET",
      url: "/api/partnerships",
      headers: { cookie },
    });
    expect(remaining.json()).toHaveLength(0);
  });

  it("includes partnerships in the tree payload", async () => {
    const app = await getApp();
    const a = await createMember(cookie, "A");
    const b = await createMember(cookie, "B");
    await app.inject({
      method: "POST",
      url: "/api/partnerships",
      headers: { cookie },
      payload: { memberIds: [a.id, b.id] },
    });

    const tree = (await app.inject({ method: "GET", url: "/api/tree", headers: { cookie } })).json();
    expect(tree.partnerships).toHaveLength(1);
    expect(tree.members).toHaveLength(2);
  });
});

describe("events", () => {
  it("rejects an end before the start", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/events",
      headers: { cookie },
      payload: {
        title: "Backwards",
        startsAt: "2027-05-05T10:00:00.000Z",
        endsAt: "2027-05-04T10:00:00.000Z",
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects an end before the start on update too", async () => {
    const app = await getApp();
    const created = (
      await app.inject({
        method: "POST",
        url: "/api/events",
        headers: { cookie },
        payload: { title: "Fine", startsAt: "2027-05-05T10:00:00.000Z" },
      })
    ).json();

    const res = await app.inject({
      method: "PATCH",
      url: `/api/events/${created.id}`,
      headers: { cookie },
      payload: { endsAt: "2027-05-04T10:00:00.000Z" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("requires a title", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/events",
      headers: { cookie },
      payload: { title: "", startsAt: "2027-05-05T10:00:00.000Z" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("calendar feed", () => {
  const token = "test-calendar-token";

  it("serves the feed with the right token and no session cookie", async () => {
    const app = await getApp();
    const res = await app.inject({ method: "GET", url: `/api/calendar/${token}/mabigfam.ics` });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/calendar");
    expect(res.body).toContain("BEGIN:VCALENDAR");
  });

  it("404s for a wrong token", async () => {
    const app = await getApp();
    const res = await app.inject({ method: "GET", url: "/api/calendar/wrong-token/mabigfam.ics" });
    expect(res.statusCode).toBe(404);
  });

  it("keeps the feed out of shared caches", async () => {
    const app = await getApp();
    const res = await app.inject({ method: "GET", url: `/api/calendar/${token}/mabigfam.ics` });
    expect(res.headers["cache-control"]).toContain("private");
  });

  it("only reveals the subscription URL to a signed-in caller", async () => {
    const app = await getApp();
    expect(
      (await app.inject({ method: "GET", url: "/api/calendar/subscription" })).statusCode,
    ).toBe(401);

    const res = await app.inject({
      method: "GET",
      url: "/api/calendar/subscription",
      headers: { cookie },
    });
    expect(res.json().path).toContain(token);
  });

  it("includes created events and member birthdays", async () => {
    const app = await getApp();
    await createMember(cookie, "Birthday Person", { birthday: "1988-03-25T00:00:00.000Z" });
    await app.inject({
      method: "POST",
      url: "/api/events",
      headers: { cookie },
      payload: { title: "Reunion", startsAt: "2027-07-10T18:00:00.000Z" },
    });

    const res = await app.inject({ method: "GET", url: `/api/calendar/${token}/mabigfam.ics` });
    expect(res.body).toContain("SUMMARY:Reunion");
    expect(res.body).toContain("RRULE:FREQ=YEARLY");
  });
});

describe("exports", () => {
  it("sends CSV with a BOM and no-store", async () => {
    const app = await getApp();
    await createMember(cookie, "Kevin TANG", { nameZh: "鄧凱文" });

    const res = await app.inject({ method: "GET", url: "/api/export/csv", headers: { cookie } });
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["content-disposition"]).toContain(".csv");
    expect(res.body.startsWith("﻿")).toBe(true);
    expect(res.body).toContain("鄧凱文");
  });

  it("sends a vCard per member", async () => {
    const app = await getApp();
    await createMember(cookie, "A");
    await createMember(cookie, "B");

    const res = await app.inject({ method: "GET", url: "/api/export/vcard", headers: { cookie } });
    expect(res.headers["content-type"]).toContain("text/vcard");
    expect(res.body.match(/BEGIN:VCARD/g)).toHaveLength(2);
  });

  it("404s a single vCard for an unknown member", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/members/ghost/vcard",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
  });
});
