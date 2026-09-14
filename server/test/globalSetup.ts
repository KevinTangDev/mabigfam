import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

/**
 * Creates a throwaway database for the test run and applies the real
 * migrations to it, so the integration tests exercise the actual schema
 * without ever touching the family's data.
 *
 * The datasource URL is hardcoded in schema.prisma rather than read from
 * env(), so the Prisma CLI would ignore a DATABASE_URL override and migrate
 * the real database instead. To make isolation airtight, the schema and its
 * migrations are copied to a temp directory with the URL rewritten, and the
 * CLI is pointed at that copy.
 */
export default function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mabigfam-test-"));
  const prismaDir = path.join(dir, "prisma");
  fs.mkdirSync(prismaDir, { recursive: true });

  const realPrismaDir = path.resolve(import.meta.dirname, "../../prisma");

  // Schema copy, pointed at a database inside the temp directory.
  const schemaSource = fs.readFileSync(path.join(realPrismaDir, "schema.prisma"), "utf8");
  const rewritten = schemaSource.replace(
    /url\s*=\s*"[^"]*"/,
    'url      = "file:./test.db"',
  );

  if (rewritten === schemaSource) {
    throw new Error(
      "Test setup could not rewrite the datasource URL in schema.prisma. " +
        "Refusing to run: migrations would be applied to the real database.",
    );
  }

  const schemaPath = path.join(prismaDir, "schema.prisma");
  fs.writeFileSync(schemaPath, rewritten);

  // `migrate deploy` resolves ./migrations relative to the schema.
  fs.cpSync(path.join(realPrismaDir, "migrations"), path.join(prismaDir, "migrations"), {
    recursive: true,
  });

  // Run Prisma's JS entrypoint under node rather than shelling out to the
  // `prisma` binary: spawning a .cmd shim on Windows fails with EINVAL
  // unless a shell is involved, and this avoids needing one.
  const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

  execFileSync(process.execPath, [prismaCli, "migrate", "deploy", "--schema", schemaPath], {
    stdio: "pipe",
  });

  // The client is pointed at the same file by absolute path, since the
  // server process runs with a different working directory.
  process.env.DATABASE_URL = `file:${path.join(prismaDir, "test.db")}`;
  process.env.UPLOAD_DIR = path.join(dir, "uploads");

  return () => {
    fs.rmSync(dir, { recursive: true, force: true });
  };
}
