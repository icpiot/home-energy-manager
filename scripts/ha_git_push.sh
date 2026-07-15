#!/bin/bash

cd /config || exit 1

PROJECT_NAME="${PROJECT_NAME:-Home Energy Manager}"
PROJECT_SLUG="${PROJECT_SLUG:-home_energy_manager}"
TOKEN_FILE="${TOKEN_FILE:-/config/.github_pat}"
LOG_DIR="${LOG_DIR:-/config/www/ha-git}"
LOG="${LOG:-$LOG_DIR/${PROJECT_SLUG}_git_last.txt}"
SCRIPT_BUILD="${SCRIPT_BUILD:-2026-07-15.02}"
REPO_URL="${REPO_URL:-github.com/icpiot/home-energy-manager.git}"
REPO_DIR="${REPO_DIR:-/config/repos/home-energy-manager}"
BRANCH="${GIT_BRANCH:-main}"

mkdir -p "$LOG_DIR"

{
  echo "=============================="
  echo "$PROJECT_NAME Git Push"
  echo "Started: $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "Repo: $REPO_DIR"
  echo "Branch: $BRANCH"
  echo "Script Build: $SCRIPT_BUILD"
  echo "Auth: HTTPS token file"
  echo "Mode: current branch"
  echo "Log: $LOG"
  echo "=============================="
  echo ""

  if [ ! -d "$REPO_DIR/.git" ]; then
    echo "ERROR: repo clone not found: $REPO_DIR"
    exit 1
  fi

  if [ ! -f "$TOKEN_FILE" ]; then
    echo "ERROR: Token file missing: $TOKEN_FILE"
    exit 1
  fi

  TOKEN=$(tr -d '[:space:]' < "$TOKEN_FILE")
  if [ -z "$TOKEN" ]; then
    echo "ERROR: Token file is empty."
    exit 1
  fi

  AUTH_REMOTE="https://icpiot:${TOKEN}@${REPO_URL}"

  echo "Fetching remote branch..."
  git -C "$REPO_DIR" fetch "$AUTH_REMOTE" "$BRANCH" || exit 1

  echo "Checking out target branch..."
  git -C "$REPO_DIR" checkout -B "$BRANCH" FETCH_HEAD || exit 1

  LOCAL=$(git -C "$REPO_DIR" rev-parse HEAD)
  REMOTE=$(git -C "$REPO_DIR" rev-parse FETCH_HEAD)

  echo "Local:  $LOCAL"
  echo "Remote: $REMOTE"
  echo ""

  if [ "$LOCAL" != "$REMOTE" ]; then
    echo "ERROR: Local branch is not aligned with remote branch."
    echo "Run Git Pull first before pushing."
    exit 1
  fi

  echo "Checking for changes..."
  CHANGES=$(git -C "$REPO_DIR" status --porcelain)

  if [ -z "$CHANGES" ]; then
    echo "Nothing to commit. Working tree clean."
    exit 0
  fi

  echo "Changes found:"
  git -C "$REPO_DIR" status --short
  echo ""
  echo "Staging the full repository tree..."

  git -C "$REPO_DIR" add -A

  echo ""
  echo "Staged changes:"
  git -C "$REPO_DIR" diff --cached --name-status
  echo ""

  if [ -z "$(git -C "$REPO_DIR" diff --cached --name-only)" ]; then
    echo "No changes were staged. Push cancelled."
    exit 1
  fi

  MSG="$PROJECT_NAME repo sync $(date '+%Y-%m-%d %H:%M:%S %Z')"

  echo "Committing: $MSG"
  git -C "$REPO_DIR" commit -m "$MSG" || exit 1

  echo ""
  echo "Pushing to remote branch $BRANCH..."
  git -C "$REPO_DIR" push "$AUTH_REMOTE" "$BRANCH" || exit 1

  echo ""
  echo "Push complete."
  echo "Finished: $(date '+%Y-%m-%d %H:%M:%S %Z')"
} > "$LOG" 2>&1

cat "$LOG"
