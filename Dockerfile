# syntax=docker/dockerfile:1
#
# One image definition, three stages:
#   base    — Node + the OpenSSL that Prisma's query engine needs, and /data
#   build   — installs everything, generates the Prisma client, builds both
#             workspaces. Also what the one-shot `migrate` service runs, since
#             it carries the Prisma CLI (a devDependency, absent from runtime).
#   prod    — build minus devDependencies (an intermediate, never run).
#   runtime — the small image that actually serves the app, copied from prod.
#
# Debian (glibc), not Alpine: sharp and Prisma ship prebuilt binaries for it,
# so nothing is compiled during the build.

FROM node:24-bookworm-slim AS base

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# All state lives under /data (SQLite file + uploaded photos). Created and
# owned by the unprivileged `node` user here, so a fresh named volume mounted
# at /data inherits that ownership and both containers can write to it.
RUN mkdir -p /data/uploads && chown -R node:node /data

WORKDIR /app


FROM base AS build

# Manifests, the patch and the schema first, so the (slow) install layer is
# cached until one of them changes. `patches/` has to be present before
# `npm ci`: the root postinstall runs patch-package, which re-applies the
# relatives-tree fix.
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
COPY patches patches
COPY prisma prisma

RUN npm ci

# `npm ci` does not generate the Prisma client for this schema (it installs an
# empty skeleton), so typecheck/build would fail without this.
RUN npx prisma generate --schema prisma/schema.prisma

COPY . .
RUN npm run build


# Pruned separately so the build stage above keeps the Prisma CLI for migrate.
# The generated Prisma client lives in node_modules/.prisma, which npm leaves
# alone.
FROM build AS prod
RUN npm prune --omit=dev


FROM base AS runtime

ENV NODE_ENV=production \
    PORT=3001 \
    UPLOAD_DIR=/data/uploads \
    DATABASE_URL=file:/data/mabigfam.db \
    WEB_DIST_DIR=/app/web/dist

COPY --from=prod --chown=node:node /app /app

WORKDIR /app/server
USER node
EXPOSE 3001

# No curl in the slim image; Node 24 has fetch built in.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
