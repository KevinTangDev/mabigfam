import { PrismaClient } from "@prisma/client";

/**
 * Single shared Prisma client for the whole server process.
 *
 * The datasource URL lives in schema.prisma, but DATABASE_URL overrides it
 * when set — that's what lets the test suite point at a throwaway SQLite file
 * instead of the real family database.
 */
const overrideUrl = process.env.DATABASE_URL;

// Two separate calls rather than a conditional options object: Prisma's
// `Subset` typing rejects a union of `{datasourceUrl}` and `{}`.
export const prisma = overrideUrl
  ? new PrismaClient({ datasourceUrl: overrideUrl })
  : new PrismaClient();

/**
 * The one definition of "not soft-deleted" — spread into a `where` clause
 * anywhere a route must only see active members (which is almost
 * everywhere: listing, resolving relations, exports, the calendar feed).
 * Centralized so every route agrees on what "active" means rather than each
 * hand-rolling `deletedAt: null` and risking one being missed.
 */
export const ACTIVE_MEMBER = { deletedAt: null } as const;
