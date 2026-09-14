import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db.js";

export const TEST_PASSWORD = "test-password";

let app: FastifyInstance | null = null;

export async function getApp(): Promise<FastifyInstance> {
  if (!app) app = await buildApp({ logger: false });
  await app.ready();
  return app;
}

/** Logs in and returns the session cookie header for subsequent requests. */
export async function login(): Promise<string> {
  const instance = await getApp();

  const res = await instance.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { password: TEST_PASSWORD },
  });

  const cookies = res.cookies as { name: string; value: string }[];
  const session = cookies.find((c) => c.name === "mabigfam_session");
  if (!session) throw new Error(`Login did not set a session cookie (status ${res.statusCode})`);

  return `${session.name}=${session.value}`;
}

/** Wipes all tables between tests. Cascades handle the dependent rows. */
export async function resetDatabase(): Promise<void> {
  await prisma.partnership.deleteMany();
  await prisma.parentChild.deleteMany();
  await prisma.familyEvent.deleteMany();
  await prisma.familyMember.deleteMany();
}

export async function createMember(cookie: string, name: string, extra: object = {}) {
  const instance = await getApp();
  const res = await instance.inject({
    method: "POST",
    url: "/api/members",
    headers: { cookie },
    payload: { name, ...extra },
  });

  if (res.statusCode !== 201) {
    throw new Error(`createMember failed: ${res.statusCode} ${res.body}`);
  }

  return res.json() as { id: string; name: string };
}
