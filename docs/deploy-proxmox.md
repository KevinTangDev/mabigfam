# Deploying to a Proxmox LXC container (home LAN)

This walks through running mabigfam on your mini PC as a Debian LXC
container, reachable from your home network at `http://<container-ip>:3001`.
No domain, no port forwarding, no TLS certificate — none of that is needed
for a LAN-only deployment, which is what this guide sets up.

**Trade-off worth knowing going in:** without HTTPS, traffic between your
devices and the container (including the session cookie and, briefly, the
family password at login) travels in cleartext on your LAN. That's a
reasonable trade-off on a private trusted home network, but it's why this
guide is explicitly for LAN-only use — see the README's Deployment section
if you later want this reachable from outside your home (it needs a domain
and TLS, which is a materially different, higher-exposure setup: auth here
is one shared family password, not per-person accounts).

## 1. Create the container

From the Proxmox shell (or Datacenter → your node → shell in the web UI):

```bash
# Grab a Debian 12 template if you don't already have one.
pveam update
pveam available | grep debian-12
pveam download local debian-12-standard_12.7-1_amd64.tar.zst   # filename may differ — use what `pveam available` showed

# Pick any unused container ID.
pvesh get /cluster/nextid

pct create 200 local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst \
  --hostname mabigfam \
  --cores 2 \
  --memory 2048 \
  --swap 512 \
  --rootfs local-lvm:8 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --unprivileged 1 \
  --onboot 1

pct start 200
```

Adjust as needed:
- `200` — whatever ID `pvesh get /cluster/nextid` gave you.
- `local-lvm` — your storage pool for container disks (Datacenter → Storage
  in the web UI shows what you have).
- `vmbr0` — your LAN bridge, if it's named differently.
- 2 cores / 2GB RAM / 8GB disk is comfortable headroom (`npm install` and
  the TypeScript/Vite build are the heaviest moments); the app itself is
  light once running. Trim later via the web UI if you want to reclaim
  resources — Proxmox containers resize live.

`ip=dhcp` is simplest to start. Once it's up, set a DHCP reservation for it
on your router (or pass a static `ip=192.168.1.50/24,gw=192.168.1.1` above
instead) so the address doesn't change later.

## 2. Base setup inside the container

```bash
pct enter 200
```

Now inside the container, as root:

```bash
apt update && apt upgrade -y
apt install -y curl git ca-certificates

# Node.js 20 LTS — the app needs 20.12+ (uses process.loadEnvFile()).
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version   # confirm v20.x or later

# A dedicated, unprivileged user to run the app as — never run it as root.
useradd --system --create-home --home-dir /opt/mabigfam --shell /usr/sbin/nologin mabigfam
```

## 3. Get the app and set its secrets

Switch to the app's own user for everything from here:

```bash
su - mabigfam -s /bin/bash
```

```bash
cd /opt/mabigfam
git clone https://github.com/KevinTangDev/mabigfam.git .

npm install       # also runs postinstall → patches relatives-tree, see README
```

Create the secrets file:

```bash
cp server/.env.example server/.env
```

Generate a session secret and edit the file (`nano server/.env` or similar):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set in `server/.env`:

```bash
FAMILY_PASSWORD=<pick something your family can remember>
SESSION_SECRET=<the random string you just generated>
NODE_ENV=production
COOKIE_SECURE=false
```

**`COOKIE_SECURE=false` is not optional here** — this is a plain-HTTP
deployment, and `NODE_ENV=production` alone makes the session cookie
`Secure`-only, which browsers enforce strictly: login would appear to
succeed (the server answers 200) but the browser silently refuses to store
the cookie, so every request after that looks signed-out. See the README's
Deployment section for the full explanation. Testing against `http://localhost`
specifically won't catch this — browsers treat `localhost` as an exception —
so if you sanity-check the deployed app, do it from another device on your
LAN using the container's real IP, the way your family actually will.

## 4. Build and do a first manual run

Still as the `mabigfam` user:

```bash
cd /opt/mabigfam
npx prisma migrate deploy --schema=prisma/schema.prisma
npm run build
```

Start it by hand once, to confirm it actually works before wiring up
systemd:

```bash
node server/dist/index.js
```

You should see a "Server listening at ..." line naming the container's LAN
IP. From another device on your network, open `http://<that-ip>:3001` —
you should get the MaBigFam login screen. Sign in, confirm the app loads and
a reload keeps you signed in (that reload is the real test of the cookie
issue above). `Ctrl+C` to stop it once confirmed.

## 5. Run it as a service

Back as root (`exit` to leave the `mabigfam` user shell):

```bash
cp /opt/mabigfam/deploy/mabigfam.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now mabigfam
systemctl status mabigfam
```

If it's not `active (running)`, check `journalctl -u mabigfam -e` — the
service file has a note on what to check first if it's the optional
sandboxing directives causing trouble rather than the app itself.

The app now starts on container boot and restarts automatically if it
crashes.

## Updating later

```bash
su - mabigfam -s /bin/bash
cd /opt/mabigfam
./deploy/update.sh
```

Pulls the latest commit, reinstalls (reapplying `patches/`), applies any new
database migrations, rebuilds, and restarts the service. The restart step
needs `sudo`, so either run this as a user with sudo access or run that one
line (`sudo systemctl restart mabigfam`) as root yourself afterward.

## Backups

Two things are irreplaceable here: `prisma/mabigfam.db` (everyone's data)
and `server/uploads/` (their photos). Everything else (`node_modules`, built
`dist` folders) is disposable and gets regenerated by `npm install` /
`npm run build`.

The easy option: Proxmox's own container backups (Datacenter → Backup, or
right-click the container → Backup) capture the whole container, those two
directories included. Schedule one — weekly is a reasonable starting point
for a family archive that changes slowly.

If you want a lighter, more frequent backup of just the irreplaceable parts
without a full container snapshot, copy those two paths off-container on a
schedule (cron + `rsync`/`scp` to another machine, or a Proxmox storage
snapshot of just the container's disk) — whichever fits how you already
back up the rest of your homelab.

## What doesn't work in this setup

The calendar page's **subscribe** feature (auto-updating events in Google or
Apple Calendar) needs Google's and Apple's own servers to fetch a URL from
this container — which means it needs to be reachable from the public
internet, not just your LAN. Everything else works fully on LAN-only,
including per-event `.ics` download and "Add to Google Calendar" (those are
initiated from your own browser, not fetched by Google's servers). If you
want the subscribe feature later, that's the "public internet with a domain
+ HTTPS" path in the README's Deployment section — a bigger step up in
exposure, worth doing deliberately rather than by default.
