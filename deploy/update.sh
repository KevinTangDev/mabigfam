#!/usr/bin/env bash
# Updates a running mabigfam deployment to the latest commit on the current
# branch: pulls, reinstalls (also reapplies patches/ via postinstall),
# applies any new Prisma migrations, rebuilds, and restarts the service.
#
# Run as the app's own user (see docs/deploy-proxmox.md), from the repo root:
#   ./deploy/update.sh
#
# Restarting the service needs sudo; everything else runs as the current
# user. If your systemd service has a different name, override it:
#   SERVICE=myservice ./deploy/update.sh

set -euo pipefail

SERVICE="${SERVICE:-mabigfam}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Pulling latest changes"
git pull --ff-only

echo "==> Installing dependencies (also reapplies patches/ via postinstall)"
npm install

echo "==> Applying any new database migrations"
npx prisma migrate deploy --schema=prisma/schema.prisma

echo "==> Building server and web"
npm run build

echo "==> Restarting the $SERVICE service"
sudo systemctl restart "$SERVICE"

echo "==> Done. Recent logs:"
sudo journalctl -u "$SERVICE" -n 20 --no-pager
