# 4. Troubleshooting

| Problem | Cause and fix |
|---|---|
| `ECONNREFUSED ... 5433` when starting or during `pnpm db:setup` | The database is not running. Start Docker Desktop, then run `docker start wsa-pg`. |
| `EADDRINUSE ... 3100` | Socialix is already running, maybe in another window. Use that one, or stop it (command below). |
| Agents fail with a certificate error (`self-signed certificate in certificate chain`) | Norton inspects secure connections. Run `$env:NODE_OPTIONS = "--use-system-ca"` before `pnpm start`. |
| Agents fail with `401` or `authentication_error` | The `ANTHROPIC_API_KEY` in the autopilot's `.env` is missing or wrong. |
| Agents fail with `credit balance is too low` | Add credit in the Anthropic console. |
| "Wrong email or password" | Check `APP_LOGIN_EMAIL` and `APP_LOGIN_PASSWORD` in this project's `.env`. After changing them, restart Socialix. |
| Approved posts stay **Queued** | The autopilot worker is not running. Run `npm run worker` in the autopilot folder, then press **Refresh statuses**. |
| A post is **Failed** with a token message | The account's access has expired. Reconnect it on the autopilot's Connections page, then press **Approve** again. |
| Instagram or TikTok post refused because it needs an image | Add a public image URL: create the post yourself, or give the Creator a URL. |
| The Scheduler says a network is not connected | Connect it in the autopilot, then check the Accounts page. |
| Research says WordPress returned HTTP 403 | Your site's bot protection blocks automated reads of its REST API. Research still works with web search. To fix it, allow `/wp-json/wp/v2/posts` in the site's firewall. |
| The app stopped by itself | Usually low memory. Close other apps and start it again. No data is lost. |
| Pages look old after a code change | Run `pnpm build` again, then `pnpm start`. |

To stop whatever is using port 3100 (PowerShell):

```powershell
Get-NetTCPConnection -LocalPort 3100 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess }
```

## Useful commands

| Command | What it does |
|---|---|
| `pnpm mcp:check` | Lists your social accounts and the publishing tools. Posts nothing. |
| `pnpm db:setup` | Creates missing tables and login values. Safe to run again. |
| `pnpm typecheck` | Checks the code for type errors. |
| `pnpm exec tsx scripts/agent-check.ts analytics` | Makes one cheap Claude call, to test the key and the models. |
| `python scripts/e2e_test.py test-output` | Full browser test (23 checks, needs Playwright for Python). Stop the autopilot worker first: its one test post is scheduled for 2027 and cancelled at once. Makes two small Claude calls. |

## Where things are

| What | Where |
|---|---|
| Socialix settings and dashboard login | `C:\MLSCampus\social-media-ai-agent\.env` |
| Anthropic key, database login, WordPress URL | `C:\MLSCampus\wordpress-social-autopilot\.env` (read in place, never copied) |
| Socialix data | Database `social_media_ai_agent` in the `wsa-pg` container |
| Social accounts and tokens | The autopilot's database (encrypted) |
| Agent instructions | `src/lib/ai/agents.ts` |
| Agent tools | `src/lib/ai/tools.ts` |
| Publishing connector (MCP server) | `mcp/social-publisher/server.ts` |
