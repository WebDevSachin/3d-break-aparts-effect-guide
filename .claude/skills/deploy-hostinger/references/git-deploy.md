# Hostinger Git deployment — details & troubleshooting

Read this when setting up hPanel Git deploy for the first time, or when a
deploy "succeeded" in hPanel but the live site looks wrong.

## Where it lives

hPanel → **Websites** → *(domain)* → **Advanced → Git** — or type "Git" in
the hPanel search bar. Git deployment requires a **Premium or Business**
shared-hosting plan (all VPS plans have it via SSH instead).

## Setup, step by step

1. **Connect the repository.**
   - *GitHub:* click **Connect with GitHub**. A popup installs the
     Hostinger GitHub App; the user chooses which repositories it may read.
     Private repos work through the App without deploy keys.
   - *Other hosts / plain URL:* paste the HTTPS or SSH clone URL. For
     private repos over SSH, hPanel shows a public key to add to the repo's
     deploy keys.
2. **Branch:** `hostinger-deploy` — the branch built by
   `scripts/make-deploy-branch.sh`, whose root is the site itself. Never the
   default branch (its root is the README and repo scaffolding).
3. **Directory:** empty or `public_html` for the main domain; a subfolder
   (e.g. `public_html/demo`) to publish under a path; the subdomain's
   directory for a subdomain.
4. **Auto-deployment:** enable it. Hostinger registers a webhook; every push
   to the branch triggers a pull-and-copy. There is **no build step** — the
   branch's files are copied as-is (which is exactly right for this repo).

## The deploy loop after setup

```bash
# from the repo root, after editing site/ and passing npm run verify
./.claude/skills/deploy-hostinger/scripts/make-deploy-branch.sh
```

The script re-splits `site/`, layers the cache `.htaccess`, and
force-with-lease pushes `hostinger-deploy`. The webhook does the rest.
In hPanel's Git screen, **Deployment log** shows each run.

## Troubleshooting

| Symptom | Likely cause → fix |
|---|---|
| Live site shows the README or a file listing | The *default* branch was connected. Reconnect with branch `hostinger-deploy`. |
| Old frames / assets persist after deploy | Hostinger's copy doesn't delete removed files in every plan generation. Delete stale files via hPanel File Manager once, or switch to the FTP mirror (`deploy-ftp.sh`), which does `--delete`. Also check browser cache — entry files are `no-cache` but a pre-`.htaccess` visit may have cached them. |
| Webhook fires but deployment log is empty | The GitHub App lost access to the repo (org transfer, permission revoked). Re-run **Connect with GitHub** and re-grant. |
| `hostinger-deploy` push rejected | Someone (or CI) rebuilt the branch from another machine. `git fetch` then rerun the script — it force-with-lease pushes a freshly rebuilt branch, so no work is ever lost (the branch is derived, never edited by hand). |
| Mixed-content or CSP errors only in production | The site is HTTP on Hostinger but assets load fine locally. Enable the free SSL in hPanel (Websites → Security → SSL) and force HTTPS. |

## Verifying a deploy

Same as SKILL.md's "After every deploy": six `curl` status checks
(`/`, `styles.css`, `main.js`, poster, first and last frame), then the full
Playwright audit against the live URL:

```bash
node scripts/verify.mjs "https://example.com"
```
