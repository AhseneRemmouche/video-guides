# 5. Install on a new Linux server

This guide puts Socialix and the WordPress Social Autopilot on one fresh **Ubuntu 24.04** server, reachable over
HTTPS, starting by themselves after a reboot. It takes about an hour. Commands are run on the server over SSH
unless a step says "on your Windows PC".

## What you end up with

```
                 Internet (HTTPS only, ports 80/443)
                              │
                         nginx + Let's Encrypt
                 ┌────────────┴─────────────┐
   socialix.example.com            autopilot.example.com
         │                                  │
   Socialix (systemd)              Autopilot web (Docker)
   127.0.0.1:3100                  127.0.0.1:3000
         │      spawns                      │
         │   MCP server (stdio)             │
         └──────────────┬───────────────────┘
                 Postgres (Docker) 127.0.0.1:5433
                        │
                 Autopilot worker (Docker) ──► LinkedIn, X, Instagram, Facebook…
```

- **Postgres, the autopilot web app and the worker** run with the autopilot's own `docker-compose.yml`.
- **Socialix** runs directly with Node, as a systemd service, because it reads the autopilot's `.env` file in place
  and starts its MCP server as a child process.
- Only nginx is reachable from the internet. Everything else listens on `127.0.0.1`.

Replace `socialix.example.com` and `autopilot.example.com` with your own (sub)domains everywhere below.

## 0. Before you start

| You need | Notes |
|---|---|
| An Ubuntu 24.04 server | 2 vCPU and **4 GB RAM** recommended (`next build` needs about 2 GB). With 2 GB RAM, add swap (step 2). 20 GB disk. |
| SSH access as a user with `sudo` | |
| Two DNS records | `socialix.example.com` and `autopilot.example.com`, both **A records pointing to the server's IP**. Create them first: HTTPS certificates need them. |
| The autopilot's `.env` from your PC | `C:\MLSCampus\wordpress-social-autopilot\.env`. Copy it over SSH only (never by email or chat). |
| Your social app settings | You will add the new HTTPS callback URLs in each platform's developer console (step 6). |

> **Secrets.** The autopilot's `.env` holds the Anthropic key, the database password and the token encryption key.
> Keep the **same `TOKEN_ENCRYPTION_KEY`** if you move your existing data: the social tokens in the database are
> encrypted with it and cannot be read with a different key.

## 1. Update the server and create the folders

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install git curl ca-certificates rsync
sudo timedatectl set-timezone UTC          # the apps store times in UTC; this keeps logs consistent
```

Create a system user that will own and run Socialix, and the two app folders:

```bash
sudo adduser --system --group --home /opt/social-media-ai-agent socialix
sudo mkdir -p /opt/wordpress-social-autopilot
sudo chown $USER:$USER /opt/wordpress-social-autopilot
```

| Word | Meaning |
|---|---|
| `--system --group` | a service account with its own group and no password; nobody logs in as it |
| `--home /opt/social-media-ai-agent` | its home folder is the app folder |

## 2. (Small servers) Add swap

Skip this if the server has 4 GB RAM or more (`free -h`).

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 3. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status
```

HTTP and HTTPS are opened in step 9, once nginx is installed.

> **Docker bypasses ufw.** A port that Docker publishes as `5433:5432` is open to the whole internet even when ufw
> blocks it. That is why step 5 publishes the database and the autopilot web app on `127.0.0.1` only.

## 4. Install Docker, Node.js 22 and pnpm

**Docker** (official repository):

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt -y install docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER      # log out and back in so this takes effect
```

**Node.js 22** (NodeSource) and **pnpm** (through Corepack, which ships with Node):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt -y install nodejs
sudo corepack enable
node --version        # v22.x
pnpm --version        # Corepack downloads pnpm the first time
```

## 5. Install the WordPress Social Autopilot (database, web app, worker)

Copy the autopilot project to the server. **On your Windows PC**, in PowerShell:

```powershell
cd C:\MLSCampus
tar --exclude=node_modules --exclude=.next --exclude=coverage -czf autopilot.tgz wordpress-social-autopilot
scp autopilot.tgz you@SERVER_IP:/tmp/
```

The archive includes the `.env` file. `scp` encrypts the transfer. Delete `autopilot.tgz` from your PC afterwards.

Back on the server:

```bash
tar -xzf /tmp/autopilot.tgz -C /opt && rm /tmp/autopilot.tgz
cd /opt/wordpress-social-autopilot
chmod 640 .env
nano .env
```

Change these lines in the autopilot's `.env` (the other values stay as they are):

| Setting | New value | Why |
|---|---|---|
| `APP_BASE_URL` | `https://autopilot.example.com` | OAuth callbacks and links now use the public HTTPS address |
| `NEXTAUTH_URL` | `https://autopilot.example.com` | the autopilot dashboard's sign-in |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | a user name and a **long random password**, letters and digits only so it fits in a URL: `openssl rand -hex 24` (add the lines; without them Docker uses `wsa`/`wsa`) | the database login. Postgres sets it only when the database is first created, so choose it before the first `docker compose up` |
| `POSTGRES_PORT` | `127.0.0.1:5433` | publish the database **on localhost only** (add the line if missing) |
| `WEB_PORT` | `127.0.0.1:3000` | publish the autopilot web app on localhost only; nginx serves it (add the line if missing) |
| `DATABASE_URL` | `postgresql://USER:PASSWORD@localhost:5433/wordpress_social_autopilot?schema=public` | the address **from the server itself**; Socialix uses this line. USER and PASSWORD are the `POSTGRES_USER` and `POSTGRES_PASSWORD` values above |

Inside Docker the web app and the worker do not use `DATABASE_URL` from the file: `docker-compose.yml` builds their
own address from the `POSTGRES_*` values.

Start the stack:

```bash
docker compose up -d --build
docker compose ps        # postgres "healthy", web and worker "running"
docker compose logs -f worker     # Ctrl+C to stop following
```

The `web` and `worker` containers apply the database migrations on start. The worker is what publishes approved
posts; `restart: unless-stopped` brings it back after a crash or reboot.

> **Run only one worker per database.** Once the server worker runs, stop `npm run worker` on your PC.

### 5b. (Optional) Move your existing data from the PC

Skip this for a fresh start (you will connect the social accounts again in the autopilot).

**On your Windows PC** (the database container is `wsa-pg`; USER is the user from your `DATABASE_URL`):

```powershell
docker exec wsa-pg pg_dump -U USER -Fc wordpress_social_autopilot > autopilot.dump
docker exec wsa-pg pg_dump -U USER -Fc social_media_ai_agent > socialix.dump
scp autopilot.dump socialix.dump you@SERVER_IP:/tmp/
```

On the server, after step 5 has started the stack once:

```bash
cd /opt/wordpress-social-autopilot
docker compose stop web worker
docker compose exec -T postgres pg_restore -U USER -d wordpress_social_autopilot --clean --if-exists < /tmp/autopilot.dump
docker compose exec -T postgres createdb -U USER social_media_ai_agent
docker compose exec -T postgres pg_restore -U USER -d social_media_ai_agent --no-owner < /tmp/socialix.dump
docker compose start web worker
rm /tmp/*.dump
```

`pnpm db:setup` in step 7 is still safe after a restore: it only creates what is missing.

## 6. Point the social apps at the new address

The autopilot's OAuth callbacks are `{APP_BASE_URL}/api/oauth/<slug>/callback`. In each platform's developer console,
add the new URL **exactly** (keep the old one until everything works):

- `https://autopilot.example.com/api/oauth/linkedin/callback`
- `https://autopilot.example.com/api/oauth/facebook/callback` and `.../instagram/callback` (same Meta app)
- `https://autopilot.example.com/api/oauth/x/callback`
- `https://autopilot.example.com/api/oauth/tiktok/callback`
- `https://autopilot.example.com/api/oauth/youtube/callback`
- the GitHub sign-in callback: `https://autopilot.example.com/api/auth/callback/github`

The full list of scopes and settings is in the autopilot's `docs/deployment.md`. If you moved the data with the same
`TOKEN_ENCRYPTION_KEY`, connected accounts keep working; reconnect any account that shows "token expired".

## 7. Install Socialix

**On your Windows PC:**

```powershell
cd C:\MLSCampus
tar --exclude=node_modules --exclude=.next --exclude=.env -czf socialix.tgz social-media-ai-agent
scp socialix.tgz you@SERVER_IP:/tmp/
```

This archive leaves out `.env`: the server gets its own login and session secret.

On the server:

```bash
sudo tar -xzf /tmp/socialix.tgz -C /opt && rm /tmp/socialix.tgz
sudo chown -R socialix:socialix /opt/social-media-ai-agent

# Socialix reads the autopilot's .env in place: let its group read that one file
sudo chgrp socialix /opt/wordpress-social-autopilot/.env
sudo chmod 640 /opt/wordpress-social-autopilot/.env
```

Create Socialix's settings file and install the packages, as the `socialix` user:

```bash
cd /opt/social-media-ai-agent
sudo -u socialix cp .env.example .env
sudo -u socialix nano .env
```

| Setting | Value on the server |
|---|---|
| `AUTOPILOT_DIR` | `/opt/wordpress-social-autopilot` |
| `APP_DATABASE_NAME` | `social_media_ai_agent` |
| `APP_LOGIN_EMAIL` | your email |
| `APP_LOGIN_PASSWORD` | leave empty to generate one, or set a long password |
| `SESSION_SECRET` | leave empty (generated) |

Then:

```bash
sudo -u socialix -H bash -c 'cd /opt/social-media-ai-agent && pnpm install --frozen-lockfile'
sudo -u socialix -H bash -c 'cd /opt/social-media-ai-agent && pnpm db:setup'
sudo -u socialix -H bash -c 'cd /opt/social-media-ai-agent && pnpm mcp:check'
sudo -u socialix -H bash -c 'cd /opt/social-media-ai-agent && pnpm build'
```

| Command | What it does |
|---|---|
| `pnpm install --frozen-lockfile` | installs exactly the versions in `pnpm-lock.yaml`. Keep the dev dependencies: Socialix starts its MCP server with `tsx` at run time. |
| `pnpm db:setup` | creates the `social_media_ai_agent` database and tables next to the autopilot's, and writes the login into `.env` (never printed) |
| `pnpm mcp:check` | lists your social accounts through the MCP server. Posts nothing. |
| `pnpm build` | the production build (`.next/`) |

> No `NODE_OPTIONS=--use-system-ca` here: that was only needed on the Windows PC because of Norton.

Optional: one cheap Claude call to test the key and the models:

```bash
sudo -u socialix -H bash -c 'cd /opt/social-media-ai-agent && pnpm exec tsx scripts/agent-check.ts analytics'
```

## 8. Run Socialix as a service

Create `/etc/systemd/system/socialix.service`:

```bash
sudo nano /etc/systemd/system/socialix.service
```

```ini
[Unit]
Description=Socialix - AI social media team
After=network-online.target docker.service
Wants=network-online.target

[Service]
User=socialix
Group=socialix
WorkingDirectory=/opt/social-media-ai-agent
Environment=NODE_ENV=production
Environment=NEXT_TELEMETRY_DISABLED=1
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -p 3100 -H 127.0.0.1
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

| Line | Why |
|---|---|
| `WorkingDirectory` | Socialix reads `.env` and starts `mcp/social-publisher/server.ts` relative to this folder |
| `NODE_ENV=production` | also makes the login cookie `Secure`, so it only travels over HTTPS (step 9) |
| `-H 127.0.0.1` | listen on localhost only; nginx is the only way in |
| `Restart=always` | start again after a crash |

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now socialix
systemctl status socialix
curl -I http://127.0.0.1:3100/signin      # HTTP/1.1 200 OK
journalctl -u socialix -f                  # live logs; Ctrl+C to stop
```

## 9. nginx and HTTPS

```bash
sudo apt -y install nginx certbot python3-certbot-nginx
sudo ufw allow 'Nginx Full'
sudo nano /etc/nginx/sites-available/socialix
```

```nginx
limit_req_zone $binary_remote_addr zone=socialix_login:10m rate=10r/m;

server {
    listen 80;
    server_name socialix.example.com;

    # slow down password guessing on the sign-in page
    location = /signin {
        limit_req zone=socialix_login burst=5 nodelay;
        proxy_pass http://127.0.0.1:3100;
        include /etc/nginx/proxy_params;
    }

    location / {
        proxy_pass http://127.0.0.1:3100;
        include /etc/nginx/proxy_params;
        proxy_read_timeout 120s;
    }
}

server {
    listen 80;
    server_name autopilot.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        include /etc/nginx/proxy_params;
        proxy_read_timeout 120s;
    }
}
```

`proxy_params` (shipped with nginx on Ubuntu) passes the original host, client IP and protocol to the apps.

```bash
sudo ln -s /etc/nginx/sites-available/socialix /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d socialix.example.com -d autopilot.example.com
```

Certbot gets the certificates, adds the HTTPS server blocks, redirects HTTP to HTTPS and renews automatically
(`systemctl list-timers | grep certbot`).

Open **https://socialix.example.com**, sign in with the email and password from
`/opt/social-media-ai-agent/.env` (`sudo grep APP_LOGIN /opt/social-media-ai-agent/.env`; never paste it anywhere).

> **Sign-in loops back to the sign-in page?** You opened the site over plain HTTP. The cookie is `Secure` in
> production, so the browser drops it without HTTPS. Use the `https://` address.

## 10. Check everything

- [ ] `https://socialix.example.com` signs in; the Accounts page lists your networks.
- [ ] `https://autopilot.example.com` opens the autopilot dashboard.
- [ ] `docker compose ps` (in `/opt/wordpress-social-autopilot`): postgres healthy, web and worker running.
- [ ] Brief the Analytics Agent ("Give me a status report") on the AI Agent page: it answers.
- [ ] From another computer, `nc -zv SERVER_IP 5433` and `nc -zv SERVER_IP 3100` **fail** (closed).
- [ ] `sudo reboot`, wait a minute: both sites come back by themselves.

## 11. Backups

Both databases live in the Docker volume. A nightly dump, kept 14 days:

```bash
sudo mkdir -p /var/backups/socialix
sudo nano /etc/cron.daily/socialix-backup
```

```bash
#!/bin/sh
set -e
cd /opt/wordpress-social-autopilot
D=$(date +%F)
for DB in wordpress_social_autopilot social_media_ai_agent; do
  docker compose exec -T postgres pg_dump -U USER -Fc "$DB" > /var/backups/socialix/$DB-$D.dump
done
find /var/backups/socialix -name '*.dump' -mtime +14 -delete
```

```bash
sudo chmod 700 /etc/cron.daily/socialix-backup
sudo /etc/cron.daily/socialix-backup && ls -lh /var/backups/socialix
```

Replace USER with your `POSTGRES_USER`. Also keep a copy of both `.env` files somewhere safe (a password manager):
without `TOKEN_ENCRYPTION_KEY` a database backup cannot decrypt the social tokens. Copy the dumps off the server
regularly.

## 12. Updating

**Socialix** (after changing the code on your PC):

```powershell
# on your PC
cd C:\MLSCampus
tar --exclude=node_modules --exclude=.next --exclude=.env -czf socialix.tgz social-media-ai-agent
scp socialix.tgz you@SERVER_IP:/tmp/
```

```bash
# on the server
sudo tar -xzf /tmp/socialix.tgz -C /opt && rm /tmp/socialix.tgz      # .env on the server is kept
sudo chown -R socialix:socialix /opt/social-media-ai-agent
sudo -u socialix -H bash -c 'cd /opt/social-media-ai-agent && pnpm install --frozen-lockfile && pnpm db:setup && pnpm build'
sudo systemctl restart socialix
```

**Autopilot:** copy the new code the same way (keep its server `.env`), then
`docker compose up -d --build` in `/opt/wordpress-social-autopilot`.

## 13. Troubleshooting on the server

| Symptom | Check |
|---|---|
| `systemctl status socialix` shows "failed" | `journalctl -u socialix -n 50`. "Missing ANTHROPIC_API_KEY (expected in …/.env)": wrong `AUTOPILOT_DIR`, or the `socialix` user cannot read the autopilot's `.env` (step 7 `chgrp`/`chmod`). |
| `ECONNREFUSED 127.0.0.1:5433` | the database container is down: `docker compose ps`, `docker compose up -d`. Check `POSTGRES_PORT=127.0.0.1:5433` and the port in `DATABASE_URL`. |
| `pnpm build` killed / "JavaScript heap out of memory" | not enough RAM: add swap (step 2), stop other services during the build. |
| 502 Bad Gateway in the browser | Socialix or the autopilot web app is not running on its port: `curl -I http://127.0.0.1:3100/signin`, `docker compose ps`. |
| Approved posts stay "Queued" | the worker: `docker compose logs --tail 100 worker`. |
| A post fails with a token error | reconnect the account in the autopilot (step 6 callbacks must be registered). |
| Agents answer "credit balance is too low" or 401 | the Anthropic key in the autopilot's `.env`. After editing it: `sudo systemctl restart socialix`. |
| Changed `.env` but nothing happens | Socialix reads `.env` at start: `sudo systemctl restart socialix`. |
