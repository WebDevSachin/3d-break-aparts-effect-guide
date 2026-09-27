#!/usr/bin/env bash
# ============================================================
# make-deploy-branch.sh — publish site/ as the hostinger-deploy branch
#
# Hostinger's Git deployment copies a branch's ROOT into public_html
# with no build step, but this repo keeps the page in site/. This
# script builds (or updates) a branch whose root IS site/'s contents,
# adds the cache .htaccess, and pushes it.
#
#   ./.claude/skills/deploy-hostinger/scripts/make-deploy-branch.sh [--no-push] [branch] [remote]
#
# Defaults: branch=hostinger-deploy, remote=origin. Idempotent —
# rerun after every change to site/ (or wire it into CI).
# --no-push builds the local branch only (useful for inspecting it).
# ============================================================
set -euo pipefail

PUSH=1
if [[ "${1:-}" == "--no-push" ]]; then PUSH=0; shift; fi
BRANCH="${1:-hostinger-deploy}"
REMOTE="${2:-origin}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"

cd "$REPO_ROOT"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "✗ working tree not clean — commit or stash first, so the deploy" >&2
  echo "  branch is built from a state that actually exists in history" >&2
  exit 1
fi

# subtree split turns site/'s history into a standalone tree with
# site/'s contents at the root — exactly the shape Hostinger deploys
SPLIT_SHA=$(git subtree split --prefix=site HEAD)
echo "site/ split → $SPLIT_SHA"

# Layer the cache .htaccess on top of the split (it lives in the skill,
# not in site/, so local dev servers never see Apache directives)
WORKTREE=$(mktemp -d)
cleanup() { git worktree remove --force "$WORKTREE" 2>/dev/null || true; rm -rf "$WORKTREE"; }
trap cleanup EXIT

git worktree add --detach "$WORKTREE" "$SPLIT_SHA" >/dev/null
cp "$SKILL_DIR/assets/htaccess" "$WORKTREE/.htaccess"
(
  cd "$WORKTREE"
  git add .htaccess
  if git diff --cached --quiet; then
    DEPLOY_SHA="$SPLIT_SHA"
  else
    DEPLOY_SHA=$(git commit-tree "$(git write-tree)" -p "$SPLIT_SHA" \
      -m "Add Hostinger cache headers (.htaccess)")
  fi
  echo "$DEPLOY_SHA" > "$WORKTREE/.deploy-sha"
)
DEPLOY_SHA=$(cat "$WORKTREE/.deploy-sha")

git branch -f "$BRANCH" "$DEPLOY_SHA"
echo "branch $BRANCH → $DEPLOY_SHA"

# Deploy branches are rebuilt from scratch each run, so their history
# rewrites by design; force-with-lease keeps that honest.
if [[ "$PUSH" == "1" ]]; then
  git push --force-with-lease "$REMOTE" "$BRANCH:$BRANCH"
  echo "✓ pushed $BRANCH to $REMOTE — Hostinger will auto-deploy if the webhook is connected"
else
  echo "✓ built local branch $BRANCH (—no push). Inspect with: git ls-tree --name-only $BRANCH"
fi
