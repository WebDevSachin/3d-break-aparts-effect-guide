---
name: deploy-hostinger
description: >-
  Deploy this repo's static site (site/) to Hostinger shared hosting and
  verify the live deployment. Use this skill whenever the user asks to
  deploy, publish, ship, host, "put the site live", "upload to Hostinger",
  set up auto-deployment, connect the repo to their hosting, or fix a broken
  live site on Hostinger — even if they don't say "Hostinger" but their
  hosting is known to be Hostinger. Covers hPanel Git auto-deploy (preferred),
  FTP mirror deploys, cache headers, and post-deploy validation.
---

# Deploy to Hostinger

This repo is a **static site with no build step** — everything the browser
needs is already in `site/`. Deploying means getting the *contents* of
`site/` into Hostinger's web root (`public_html`), nothing more. The two
supported paths are Git auto-deploy (set up once, then every push deploys)
and a scripted FTP mirror (works on any plan, good for one-off pushes).

**The one trap:** Hostinger deploys the *repo root* into `public_html` and
runs no build step, but this page lives in the `site/` subdirectory. Never
point Hostinger at the main branch — visitors would land on the README, and
~3 MB of `media/`, `docs/` and `artifact/` would be published twice. Both
paths below solve this.

## Before any deploy

1. Run the verification suite; deploy only on green:
   ```bash
   npm run serve &        # serves site/ on :4173
   npm install && CHROMIUM_PATH=${CHROMIUM_PATH:-} npm run verify
   ```
2. Confirm `site/main.js` `FRAME_COUNT` matches `ls site/assets/frames | wc -l`
   (a mismatched count 404s frames only in production, where the audit
   already caught them locally).

## Path A — hPanel Git auto-deploy (preferred, needs Premium/Business plan)

Hostinger pulls a branch and copies its **root** into the target directory
on every push. So publish a branch whose root *is* the site:

```bash
./.claude/skills/deploy-hostinger/scripts/make-deploy-branch.sh
```

This uses `git subtree split --prefix=site` to build/update a
`hostinger-deploy` branch containing only `site/`'s contents at its root
(plus the cache-header `.htaccess` from this skill's assets), and pushes it.
It's idempotent — rerun it after any change to `site/`.

Then, one-time setup in hPanel (walk the user through it — Claude cannot do
this part; it needs their Hostinger login):

1. hPanel → **Websites** → *(their domain)* → **Advanced → Git**
   (or search "Git" in the hPanel top bar).
2. **Connect with GitHub** (installs the Hostinger GitHub App; have them
   grant access to this repository), or paste the repo URL directly.
3. Branch: `hostinger-deploy` · Directory: `public_html` (leave empty for
   the domain root — it means the same thing).
4. Enable **auto-deployment** so the webhook fires on every push.

From then on, the deploy loop is just: edit → verify → run
`make-deploy-branch.sh` → Hostinger deploys automatically.

For the exact hPanel screens, webhook details, and troubleshooting (deploy
succeeded but old files persist, submodule errors, plan limits), read
`references/git-deploy.md`.

## Path B — FTP mirror (any plan, no hPanel setup)

```bash
export HOSTINGER_FTP_HOST=ftp.example.com     # or the server IP from hPanel → FTP Accounts
export HOSTINGER_FTP_USER=u123456789.example
export HOSTINGER_FTP_PASS=…                   # ask the user; never echo or commit it
./.claude/skills/deploy-hostinger/scripts/deploy-ftp.sh            # add --dry-run first
```

The script mirrors `site/` → `public_html` over FTPS with `lftp` (deleting
remote files that no longer exist locally, uploading only changed files) and
uploads the cache `.htaccess`. Credentials come from the environment or an
untracked `.env.deploy` file — the script refuses to run if the variables
are missing, and nothing secret ever belongs in the repo. `--dry-run` prints
the transfer plan without touching the server; always offer it first.

## After every deploy — validate the live site

Never report a deploy as done without checking it. `LIVE_URL=https://example.com`:

```bash
for p in "" styles.css main.js assets/img/poster.jpg assets/frames/frame_000.jpg assets/frames/frame_119.jpg; do
  printf '%-40s %s\n' "/$p" "$(curl -s -o /dev/null -w '%{http_code}' "$LIVE_URL/$p")"
done
```

All six must be `200`. Then, if Playwright is available, run the full audit
against production: `node scripts/verify.mjs "$LIVE_URL"` — it asserts zero
console errors, zero failed requests (this is what catches a missing frame
or font in production), no horizontal overflow, and a readable
reduced-motion page. If anything fails, diagnose before redeploying: a 404
on frames usually means the deploy branch is stale (rerun
`make-deploy-branch.sh`) or the FTP mirror ran against the wrong directory.

## Cache headers

`assets/htaccess` in this skill sets long-lived immutable caching for
`assets/frames/`, fonts and vendor JS (they're content-stable), and
no-cache for the HTML/CSS/JS entry files so edits show up immediately.
Both deploy paths install it as `public_html/.htaccess`. If the user
already has an `.htaccess` (redirects, PHP settings), merge — don't
overwrite.
