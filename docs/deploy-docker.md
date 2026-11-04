# Deploying with Docker Compose (Proxmox VM, public HTTPS via Cloudflare Tunnel)

This runs mabigfam as a small Docker Compose project inside a Proxmox VM and
makes it reachable from anywhere over HTTPS — for relatives outside your home,
and so Google Calendar can subscribe to the `.ics` feed (Google fetches it from
its own servers, so a LAN address can't work).

If you only want it on your home network, the simpler
[LXC + systemd guide](deploy-proxmox.md) still works, or see
[LAN-only with Docker](#lan-only-with-docker) at the end.

```
relatives ──HTTPS──▶ Cloudflare ◀──outbound tunnel── cloudflared ─▶ app (Node, :3001) ─▶ /data volume
                                     (your home router opens no ports)        ▲             SQLite + photos
                                                                      migrate runs first, then exits
```

Why Docker here: the app depends on native pieces (`sharp`, Prisma's query
engine, a patched `relatives-tree`) that are easy to break with a different
Node version or distro. The image pins all of it, an update is one command,
and a rollback is "build the previous commit".

## What you need

- A Proxmox host with a free VM's worth of room: **2 vCPU, 2 GB RAM, 20 GB disk**.
- A **Cloudflare account** with a domain on it (about $10/year for the domain;
  the tunnel itself is free). No domain? See [Tailscale Funnel](#no-domain-tailscale-funnel).

## 1. Create the VM

In the Proxmox web UI, create a VM from the Debian 12 ("bookworm") netinst ISO:
2 vCPU, 2 GB RAM, 20 GB disk. Tick **QEMU Guest Agent** on the System tab, and
under **Options** turn on **Start at boot**. In the installer pick only
"SSH server" and "standard system utilities". Then, inside the VM:

```bash
apt update && apt upgrade -y
apt install -y qemu-guest-agent git unattended-upgrades
```

## 2. Install Docker Engine

Docker's own instructions for Debian (see docs.docker.com/engine/install/debian
if these have changed):

```bash
apt install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Optionally let your normal user run Docker (`usermod -aG docker <you>`, then log
out and in).

## 3. Get the app and its settings

```bash
git clone https://github.com/KevinTangDev/mabigfam.git
cd mabigfam
cp deploy/docker.env.example .env
chmod 600 .env
```

Edit `.env`:

- `FAMILY_PASSWORD` — the app is on the internet, so make it long: four or five
  random words. (Login is also rate-limited, but a long password is the real defence.)
- `SESSION_SECRET` — `openssl rand -hex 32`
- `WEB_ORIGIN` — e.g. `https://family.example.com`

`.env` holds secrets. It is git-ignored; never commit it or paste it anywhere.

## 4. Create the Cloudflare Tunnel

In the Cloudflare dashboard: **Zero Trust → Networks → Tunnels → Create a
tunnel → Cloudflared**.

1. Name it (e.g. `mabigfam`). On the install screen, copy only the **token**
   and put it in `.env` as `TUNNEL_TOKEN=`. You do *not* install cloudflared
   yourself — compose runs it.
2. **Public hostname**: choose your domain and a subdomain (`family`), service
   type **HTTP**, URL **`app:3001`**. (`app` is the compose service name; it
   resolves inside the compose network.)

## 5. Start it

```bash
docker compose up -d --build
docker compose ps          # app should become "healthy"
docker compose logs -f app
```

Open `https://family.example.com` and sign in. Add a member and upload a photo
to check everything works end to end.

## Updating and rolling back

```bash
git pull
docker compose up -d --build     # migrate runs first, and is safe to repeat
docker compose pull cloudflared  # now and then: the tunnel client gets security updates
```

To roll back, `git checkout <previous commit>` and run the same `up -d --build`.
Code rolls back cleanly; **a migration that has already run does not**, so take
a backup (below) before updating across schema changes.

## Backups

Everything is in the `mabigfam-data` Docker volume (the SQLite file and the photos).

- **VM level (recommended):** in Proxmox, **Datacenter → Backup**, schedule a
  nightly `vzdump` of the VM in *snapshot* mode, and copy the backups to
  another disk or machine — a backup on the same mini PC doesn't survive the mini PC.
- **From the app:** *Contacts → Export → Full backup (.zip)* downloads the
  database plus every photo (trashed members included). Do this now and then
  and keep the file somewhere else.
- **Manual volume copy**, safest with the app stopped for a moment:

  ```bash
  docker compose stop app
  docker run --rm -v mabigfam_mabigfam-data:/data -v "$PWD":/backup debian:bookworm-slim \
    tar czf /backup/mabigfam-data-$(date +%F).tar.gz -C /data .
  docker compose start app
  ```

  To restore, stop `app` and extract the archive back into the volume the same way.

## Calendar subscriptions

On the Calendar page, copy the feed URL and add it in Google Calendar
(*Other calendars → From URL*) or on iPhone. It now works because the URL is
public HTTPS. The URL contains a secret token and is not behind the login, so
treat it like a password; if it leaks, set `CALENDAR_FEED_TOKEN` in `.env` to a
new value and `docker compose up -d` — old subscriptions stop working.

## Security notes

- **No inbound ports.** The tunnel is outbound-only. The `app` container
  publishes no port, so it is reachable *only* through the tunnel — which is
  also what makes `TRUST_PROXY=true` safe (see below).
- **`TRUST_PROXY`** makes the login rate limit see each visitor's real IP
  (from `X-Forwarded-For`). Without it, everyone would share the tunnel's IP:
  one person's typos would lock the whole family out, and a stranger could do
  it deliberately. If you ever publish the app's port directly, set
  `TRUST_PROXY=false`, or anyone could forge the header to skip the limit.
- **One shared password** is still the only login, so anyone who has it can
  edit or delete anything. Want a second lock? Put **Cloudflare Access** in
  front of the site (free for small groups; relatives sign in with an emailed
  code) and add a *Bypass* policy for the path `/api/calendar/*`, so Google can
  still fetch the feed. It adds a step for relatives, so it's optional.
- Keep the VM patched (`unattended-upgrades` above) and rebuild now and then
  (`git pull && docker compose build --pull && docker compose up -d`) to pick up
  Node and OS security fixes.

## Troubleshooting

- **`docker compose up` says a variable is not set** — fill in `.env`
  (`FAMILY_PASSWORD`, `SESSION_SECRET`, `TUNNEL_TOKEN`). Remove `COMPOSE_PROFILES`
  and `TUNNEL_TOKEN` if you aren't using the tunnel.
- **`migrate` fails** — `docker compose logs migrate`. A "permission denied"
  on `/data` means the volume isn't owned by the app user; fix it once with
  `docker run --rm -v mabigfam_mabigfam-data:/data debian:bookworm-slim chown -R 1000:1000 /data`.
- **Cloudflare shows a 502 (bad gateway)** — the tunnel is up but can't reach the
  app: check the public hostname's service URL is exactly `http://app:3001`, and
  that `docker compose ps` shows `app` healthy.
- **Locked out of login** — wait a minute (5 attempts per minute per visitor), or
  `docker compose restart app` to clear the counters.
- **Health check** — `docker compose exec app node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>r.text()).then(console.log)"`

## LAN-only with Docker

No tunnel, no domain: remove `COMPOSE_PROFILES` and `TUNNEL_TOKEN` from `.env`,
set `TRUST_PROXY=false` and `COOKIE_SECURE=false` (plain HTTP — a `Secure`
cookie is silently dropped over HTTP, which looks like login "not sticking"),
and uncomment the `ports:` lines in `compose.yaml`. Then reach it at
`http://<vm-ip>:3001`. Google Calendar can't subscribe in this setup; iPhone on the
same network can.

## No domain? Tailscale Funnel

Instead of Cloudflare, Tailscale Funnel can expose the app publicly at a
`https://<machine>.<tailnet>.ts.net` address: install Tailscale in the VM, publish
the port as in the LAN-only section but bound to localhost
(`127.0.0.1:3001:3001`), and run `tailscale funnel 3001`. Funnel has bandwidth limits
and a fixed hostname, which is fine for a family app. Check that two different
visitors really get separate login limits (mistype the password six times from
one network, then sign in from another); if they share one, Funnel isn't
forwarding client addresses, so raise `LOGIN_RATE_LIMIT_MAX` (say 30) in `compose.yaml`'s
`app` environment so one typo can't lock the whole family out, and lean on a long password.
