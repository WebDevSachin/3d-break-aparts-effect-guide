#!/usr/bin/env bash
# ============================================================
# deploy-ftp.sh — mirror site/ to Hostinger over FTPS with lftp
#
#   HOSTINGER_FTP_HOST=ftp.example.com \
#   HOSTINGER_FTP_USER=u123456789.example \
#   HOSTINGER_FTP_PASS=… \
#   ./.claude/skills/deploy-hostinger/scripts/deploy-ftp.sh [--dry-run] [remote_dir]
#
# Or put the three variables in .env.deploy (gitignored) at the repo
# root. remote_dir defaults to public_html. --dry-run prints the
# transfer plan without changing anything on the server.
#
# Secrets never belong in the repo: this script reads them only from
# the environment / .env.deploy and never prints them.
# ============================================================
set -euo pipefail

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN="--dry-run"; shift; fi
REMOTE_DIR="${1:-public_html}"

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Optional untracked env file (repo root)
if [[ -f .env.deploy ]]; then
  # shellcheck disable=SC1091
  set -a; source .env.deploy; set +a
fi

: "${HOSTINGER_FTP_HOST:?set HOSTINGER_FTP_HOST (hPanel → Files → FTP Accounts)}"
: "${HOSTINGER_FTP_USER:?set HOSTINGER_FTP_USER}"
: "${HOSTINGER_FTP_PASS:?set HOSTINGER_FTP_PASS}"

if ! command -v lftp >/dev/null; then
  echo "✗ lftp is not installed (apt-get install lftp / brew install lftp)" >&2
  exit 1
fi

# Stage site/ plus the cache .htaccess so one mirror does the whole job
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
cp -r site/. "$STAGE/"
cp "$SKILL_DIR/assets/htaccess" "$STAGE/.htaccess"

echo "mirroring site/ → $HOSTINGER_FTP_HOST:$REMOTE_DIR ${DRY_RUN:+(dry run)}"
lftp -u "$HOSTINGER_FTP_USER","$HOSTINGER_FTP_PASS" "ftp://$HOSTINGER_FTP_HOST" <<EOF
set ftp:ssl-force true
set ssl:verify-certificate yes
mirror -R --delete --parallel=4 --verbose $DRY_RUN "$STAGE" "$REMOTE_DIR"
bye
EOF

echo "✓ done — now validate the live site (see SKILL.md 'After every deploy')"
