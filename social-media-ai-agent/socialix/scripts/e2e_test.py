"""End-to-end test of Socialix in headless Chromium. Publishes nothing: the one post handed to the
autopilot is scheduled a year ahead and cancelled straight away (the autopilot worker must be stopped).
Reads the login from the app's .env without printing it. Usage: python scripts/e2e_test.py <out_dir>"""
import json, os, pathlib, re, subprocess, sys, time
from playwright.sync_api import sync_playwright

APP = pathlib.Path("C:/MLSCampus/social-media-ai-agent")
env = dict(re.findall(r"^([A-Z_]+)=(.*)$", (APP / ".env").read_text(encoding="utf-8"), re.M))
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
BASE = "http://localhost:3100"
TITLE = "SOCIALIX E2E TEST - not for publishing"
results = []

def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""), flush=True)

def verify():
    r = subprocess.run("pnpm exec tsx scripts/verify-post.ts \"%s\"" % TITLE, cwd=APP, shell=True, capture_output=True, text=True,
                       env={**os.environ, "NODE_OPTIONS": "--use-system-ca"}, timeout=120)
    line = [l for l in r.stdout.splitlines() if l.startswith("{")]
    return json.loads(line[-1]) if line else {"error": r.stderr[-400:]}

def card(page):
    return page.locator("section", has_text=TITLE).first

def ask(page, campaign, agent, text, timeout=300):
    page.goto(BASE + "/dashboard/ai-agent"); page.wait_for_load_state("networkidle")
    page.locator("button", has_text=agent.capitalize() + " Agent").first.click()
    before = page.evaluate(f"fetch('/api/agents/state?campaignId={campaign}&agent={agent}').then(r => r.json())")
    n = sum(1 for m in before["messages"] if m["role"] == "assistant")
    page.fill("input[placeholder^='Tell the']", text)
    page.click("button[aria-label=Send]")
    start = time.time()
    while time.time() - start < timeout:
        time.sleep(4)
        st = page.evaluate(f"fetch('/api/agents/state?campaignId={campaign}&agent={agent}').then(r => r.json())")
        replies = [m for m in st["messages"] if m["role"] == "assistant"]
        if not st["thinking"] and len(replies) > n:
            return replies[-1]["content"], time.time() - start
    return None, time.time() - start

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("response", lambda r: errors.append(f"HTTP {r.status} {r.url}") if r.status >= 500 else None)

    # --- Authentication
    page.goto(BASE + "/dashboard"); page.wait_for_load_state("networkidle")
    check("signed-out visitor is sent to the sign-in page", "/signin" in page.url, page.url)
    page.fill("input[name=email]", env["APP_LOGIN_EMAIL"]); page.fill("input[name=password]", "wrong-password")
    page.click("button:has-text('Sign in')"); page.wait_for_url("**/signin?error=*", timeout=15000)
    check("wrong password is refused", page.get_by_text("Wrong email or password").count() > 0, page.url)
    page.fill("input[name=email]", env["APP_LOGIN_EMAIL"]); page.fill("input[name=password]", env["APP_LOGIN_PASSWORD"])
    page.click("button:has-text('Sign in')"); page.wait_for_url("**/dashboard**", timeout=15000)
    check("correct login opens the dashboard", "/dashboard" in page.url, page.url)
    # A fresh browser has no campaign cookie (the app falls back to the newest campaign), so read the id
    # from the AI Agent page's own state request.
    with page.expect_request(lambda r: "/api/agents/state?campaignId=" in r.url, timeout=15000) as req:
        page.goto(BASE + "/dashboard/ai-agent")
    campaign = re.search(r"campaignId=([^&]+)", req.value.url).group(1)
    check("a campaign is selected", bool(campaign))

    # --- Every page renders
    expected = {"": "Overview", "ai-agent": "AI Agents", "posts": "Posts", "calendar": "Calendar", "analytics": "Analytics",
                "accounts": "Accounts", "settings": "Settings", "campaigns/new": "campaign"}
    for path, heading in expected.items():
        resp = page.goto(f"{BASE}/dashboard/{path}"); page.wait_for_load_state("networkidle")
        body = page.inner_text("body")
        check(f"page /dashboard/{path} loads", resp.status == 200 and heading.lower() in body.lower() and "Application error" not in body, f"HTTP {resp.status}")
    page.goto(BASE + "/dashboard/accounts"); page.wait_for_load_state("networkidle")
    check("accounts page reads connections through MCP", "LinkedIn" in page.inner_text("body") and "connected" in page.inner_text("body").lower())
    page.goto(BASE + "/dashboard/calendar?week=1"); page.wait_for_load_state("networkidle")
    check("calendar moves to next week", "posts" in page.inner_text("body"))

    # --- Post lifecycle: create -> approve (queued in autopilot) -> cancel -> delete
    page.goto(BASE + "/dashboard/posts"); page.wait_for_load_state("networkidle")
    page.select_option("select[name=platform]", "LINKEDIN")
    page.fill("input[name=title]", TITLE)
    page.fill("textarea[name=body]", "Automated test post. It is scheduled a year ahead and cancelled immediately.")
    page.fill("input[name=hashtags]", "#test")
    page.fill("input[name=scheduledAt]", "2027-10-16T10:00")
    page.click("form:has(textarea[name=body]) button:has-text('Save')"); page.wait_for_load_state("networkidle"); page.wait_for_timeout(1000)
    check("manual post is created as awaiting approval", card(page).count() and "Awaiting approval" in card(page).inner_text())
    page.screenshot(path=str(out / "e2e-created.png"), full_page=True)

    card(page).locator("button", has_text="Approve").click(); page.wait_for_load_state("networkidle"); page.wait_for_timeout(2500)
    page.reload(); page.wait_for_load_state("networkidle")
    check("approve hands the post to the autopilot (queued)", "Queued" in card(page).inner_text())
    v = verify()
    check("autopilot has the post queued for 2027", v.get("handedOff") and v.get("autopilot") and "QUEUED" in v["autopilot"] and "2027-10-16" in v["autopilot"], (v.get("autopilot") or str(v))[:200])

    card(page).locator("button", has_text="Cancel").click(); page.wait_for_load_state("networkidle"); page.wait_for_timeout(2500)
    page.reload(); page.wait_for_load_state("networkidle")
    check("cancel marks the post cancelled", "Cancelled" in card(page).inner_text())
    v = verify()
    check("autopilot job is no longer queued", v.get("autopilot") and "QUEUED" not in v["autopilot"], (v.get("autopilot") or str(v))[:200])

    card(page).locator("button", has_text="Delete").click(); page.wait_for_load_state("networkidle"); page.wait_for_timeout(1500)
    page.reload(); page.wait_for_load_state("networkidle")
    check("delete removes the post", card(page).count() == 0 and not verify().get("found"))

    # --- Agents (real Claude calls)
    reply, secs = ask(page, campaign, "analytics", "Give me a two-sentence status report on this campaign's posts.")
    check("Analytics Agent answers", bool(reply), f"{secs:.0f}s: {(reply or '')[:160]!r}")
    reply, secs = ask(page, campaign, "creator",
                      "Write one X post (no research needed) inviting small business owners to try one AI tool this week. Title it 'E2E creator test'. Save it as a draft.")
    page.goto(BASE + "/dashboard/posts?tab=drafts"); page.wait_for_load_state("networkidle")
    draft = page.locator("section", has_text="E2E creator test").first
    check("Creator Agent saves a draft within the X limit", bool(reply) and draft.count() > 0, f"{secs:.0f}s: {(reply or '')[:200]!r}")
    page.screenshot(path=str(out / "e2e-creator-draft.png"), full_page=True)
    if draft.count():
        draft.locator("button", has_text="Delete").click(); page.wait_for_load_state("networkidle")

    check("no server errors or console errors", not errors, "; ".join(errors[:5]))
    b.close()

passed = sum(ok for _, ok, _ in results)
print(f"\n{passed}/{len(results)} checks passed")
