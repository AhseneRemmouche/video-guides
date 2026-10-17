# Socialix documentation

Socialix is a dashboard where a team of five Claude agents researches, writes and schedules social
media posts for you. Approved posts are published by your **WordPress Social Autopilot**, which already
holds your connected social accounts.

| Guide | Read it when |
|---|---|
| [1. Setup](01-setup.md) | Installing Socialix for the first time, or on a new computer |
| [2. Daily start and stop](02-start-and-stop.md) | Every time you want to use the app |
| [3. User guide](03-user-guide.md) | Learning the pages and the everyday workflow |
| [4. Troubleshooting](04-troubleshooting.md) | Something does not work |

## How the pieces fit together

```
 You ──► Socialix dashboard (http://localhost:3100)
            │  Master Agent ─► Research ─► Creator ─► Scheduler      (Claude, via your Anthropic key)
            │
            │  posts wait for your Approve
            ▼
         Social Publisher MCP server (inside Socialix)
            │  puts the approved post in the autopilot's publishing queue
            ▼
         WordPress Social Autopilot database (Docker container wsa-pg)
            │
            ▼
         Autopilot worker (npm run worker) ─► LinkedIn, X, Instagram, Facebook...
```

Three programs are involved:

1. **The database** (Docker container `wsa-pg`). Both apps store their data in it.
2. **Socialix** (this project). It plans and writes posts and waits for your approval.
3. **The autopilot worker.** It actually publishes. If it is not running, approved posts wait in
   the queue and go out when it starts.

## Safety in one paragraph

Nothing is published until you press **Approve** on a post, unless you switch on auto-publish in
Settings. Socialix never sees your social media passwords or tokens: they stay in the autopilot.
The Anthropic API key is read from the autopilot's `.env` file and never copied.
