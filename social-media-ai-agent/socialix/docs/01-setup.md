# 1. Setup (one time)

This takes about 10 minutes. Follow the steps in order. The commands are for **PowerShell** on Windows.

## What you need first

| Requirement | How to check |
|---|---|
| Node.js 22 or later | `node --version` |
| pnpm | `pnpm --version` (install with `npm install -g pnpm`) |
| Docker Desktop, running | `docker --version` |
| The WordPress Social Autopilot installed in `C:\MLSCampus\wordpress-social-autopilot`, with your social accounts connected | Its **Connections** page shows them as connected |
| An Anthropic API key in the autopilot's `.env` (`ANTHROPIC_API_KEY=...`) | Open the file and check the line exists. Do not share it. |

## Step 1: Start the database

The autopilot's Postgres database runs in Docker. Start it:

```powershell
docker start wsa-pg
```

Check it is running (the status should say `Up`):

```powershell
docker ps --filter name=wsa-pg
```

## Step 2: Install Socialix

```powershell
cd C:\MLSCampus\social-media-ai-agent
pnpm install
```

## Step 3: Create the settings file

```powershell
Copy-Item .env.example .env
notepad .env
```

In Notepad, check these lines and save:

| Setting | What to put |
|---|---|
| `AUTOPILOT_DIR` | The autopilot folder, `C:/MLSCampus/wordpress-social-autopilot` (forward slashes) |
| `APP_DATABASE_NAME` | Leave `social_media_ai_agent` |
| `APP_LOGIN_EMAIL` | The email you want to sign in with |
| `APP_LOGIN_PASSWORD` | Leave empty to get a generated password, or type your own |
| `SESSION_SECRET` | Leave empty (generated for you) |
| `MODEL_SMART` / `MODEL_FAST` | Leave `claude-sonnet-5-5` and `claude-haiku-5-5` |

This file holds **no API keys**. The Anthropic key, the database login and the WordPress site address
are read from the autopilot's `.env` while the app runs.

## Step 4: Create the database tables and your login

```powershell
pnpm db:setup
```

You should see:

```
created database social_media_ai_agent      (or: already exists)
tables ready
generated APP_LOGIN_PASSWORD in .env        (only if you left it empty)
generated SESSION_SECRET in .env
```

Your password is now in `.env`, on the `APP_LOGIN_PASSWORD=` line. It is not printed on screen.
Running this command again is safe; it never deletes data.

## Step 5: Check the connection to your social accounts

```powershell
$env:NODE_OPTIONS = "--use-system-ca"
pnpm mcp:check
```

This lists the publishing tools and your social accounts with their status (`CONNECTED`,
`TOKEN_EXPIRED`...). It posts nothing. If an account you need is not `CONNECTED`, reconnect it on the
autopilot's **Connections** page.

> **Why `NODE_OPTIONS=--use-system-ca`?** Norton (or another antivirus that inspects secure
> connections) replaces website certificates with its own. This setting tells Node to trust the
> certificates Windows trusts. Without it, calls to Claude fail with a certificate error.

## Step 6: Build the app

```powershell
pnpm build
```

It ends with a list of pages and no errors. Rebuild after every code change.

Setup is done. Go to [2. Daily start and stop](02-start-and-stop.md).
