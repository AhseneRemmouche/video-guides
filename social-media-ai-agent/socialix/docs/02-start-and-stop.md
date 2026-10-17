# 2. Daily start and stop

## Start

Open **two** PowerShell windows.

**Window 1: Socialix**

```powershell
docker start wsa-pg
cd C:\MLSCampus\social-media-ai-agent
$env:NODE_OPTIONS = "--use-system-ca"
pnpm start
```

Wait for `Ready`, then open **http://localhost:3100** and sign in with the email and password from
`C:\MLSCampus\social-media-ai-agent\.env` (`APP_LOGIN_EMAIL` and `APP_LOGIN_PASSWORD`).

**Window 2: the autopilot worker (this is what publishes)**

```powershell
cd C:\MLSCampus\wordpress-social-autopilot
$env:NODE_OPTIONS = "--use-system-ca"
npm run worker
```

You only need the worker when you want approved posts to go out. While it is stopped, approved posts
wait safely in the queue and are published as soon as it starts (late posts are sent right away).

> Want the autopilot's own dashboard too (to reconnect an account, for example)? Run `npm run dev`
> in a third window in the autopilot folder and open http://localhost:3000. Socialix uses port 3100,
> so both can run at the same time.

## Stop

Press **Ctrl+C** in each window. To also stop the database (frees memory):

```powershell
docker stop wsa-pg
```

## Low memory

This PC has limited RAM. If Socialix stops by itself, close other apps and start it again. The data
is in the database, so nothing is lost.
