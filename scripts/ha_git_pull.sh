#!/bin/bash

CONFIG_DIR="${CONFIG_DIR:-/config}"

cd "$CONFIG_DIR" || exit 1

PROJECT_NAME="${PROJECT_NAME:-Home Energy Manager}"
PROJECT_SLUG="${PROJECT_SLUG:-home_energy_manager}"
TOKEN_FILE="${TOKEN_FILE:-$CONFIG_DIR/.github_pat}"
LOG_DIR="${LOG_DIR:-$CONFIG_DIR/www/ha-git}"
LOG="${LOG:-$LOG_DIR/${PROJECT_SLUG}_git_last.txt}"
SCRIPT_BUILD="${SCRIPT_BUILD:-2026-07-16.01}"
REPO_URL="${REPO_URL:-github.com/icpiot/home-energy-manager.git}"
REPO_DIR="${REPO_DIR:-$CONFIG_DIR/repos/home-energy-manager}"
BRANCH="${GIT_BRANCH:-main}"
DEPLOY_MANIFEST="${DEPLOY_MANIFEST:-$REPO_DIR/scripts/ha_deploy.manifest}"
FETCH_ATTEMPTS="${FETCH_ATTEMPTS:-3}"
FETCH_RETRY_DELAY_SECONDS="${FETCH_RETRY_DELAY_SECONDS:-5}"

mkdir -p "$LOG_DIR"

resolve_source_path() {
  local source_path="$1"
  if [[ "$source_path" = /* ]]; then
    printf '%s\n' "$source_path"
  else
    printf '%s\n' "$REPO_DIR/$source_path"
  fi
}

copy_deploy_entry() {
  local source_spec="$1"
  local dest_path="$2"
  local mode="${3:-}"
  local source_path
  source_path="$(resolve_source_path "$source_spec")"

  if [ ! -e "$source_path" ]; then
    echo "ERROR: Missing deploy source: $source_path"
    exit 1
  fi

  if [ "$mode" = "tree" ] || { [ -z "$mode" ] && [ -d "$source_path" ]; }; then
    mkdir -p "$dest_path"
    cp -a "$source_path/." "$dest_path/"
  else
    mkdir -p "$(dirname "$dest_path")"
    cp -f "$source_path" "$dest_path"
  fi

  echo "  $source_path -> $dest_path"
}

deploy_repo_to_ha() {
  echo ""
  echo "Deploying project assets into Home Assistant..."

  if [ ! -f "$DEPLOY_MANIFEST" ]; then
    echo "ERROR: Deploy manifest missing: $DEPLOY_MANIFEST"
    exit 1
  fi

  echo "Manifest: $DEPLOY_MANIFEST"
  echo ""
  echo "Deployed files:"

  while IFS='|' read -r source_spec dest_path mode; do
    case "$source_spec" in
      ""|\#*) continue ;;
    esac
    copy_deploy_entry "$source_spec" "$dest_path" "$mode"
  done < "$DEPLOY_MANIFEST"
}

fetch_with_retry() {
  local attempt=1

  while [ "$attempt" -le "$FETCH_ATTEMPTS" ]; do
    if git -C "$REPO_DIR" fetch "$AUTH_REMOTE" "$BRANCH"; then
      return 0
    fi

    if [ "$attempt" -ge "$FETCH_ATTEMPTS" ]; then
      break
    fi

    echo "Fetch attempt $attempt/$FETCH_ATTEMPTS failed. Retrying in ${FETCH_RETRY_DELAY_SECONDS}s..."
    sleep "$FETCH_RETRY_DELAY_SECONDS"
    attempt=$((attempt + 1))
  done

  echo "ERROR: Unable to fetch $BRANCH after $FETCH_ATTEMPTS attempts."
  return 1
}

{
  echo "=============================="
  echo "$PROJECT_NAME Git Pull"
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

  echo "Checking tracked files..."
  if [ -n "$(git -C "$REPO_DIR" status --porcelain --untracked-files=no)" ]; then
    echo "ERROR: Tracked files have local changes. Pull cancelled."
    echo ""
    git -C "$REPO_DIR" status --short --untracked-files=no
    exit 1
  fi

  echo "No tracked file changes found. Untracked files are ignored."
  echo ""
  echo "Fetching via HTTPS token..."
  fetch_with_retry || exit 1

  echo "Checking out target branch..."
  git -C "$REPO_DIR" checkout -B "$BRANCH" FETCH_HEAD || exit 1

  LOCAL=$(git -C "$REPO_DIR" rev-parse HEAD)
  REMOTE=$(git -C "$REPO_DIR" rev-parse FETCH_HEAD)

  echo "Local:  $LOCAL"
  echo "Remote: $REMOTE"
  echo ""

  if [ "$LOCAL" != "$REMOTE" ]; then
    echo "Incoming commits:"
    git -C "$REPO_DIR" log --oneline HEAD..FETCH_HEAD
    echo ""
  else
    echo "Already up to date."
  fi

  deploy_repo_to_ha
  echo "Finished: $(date '+%Y-%m-%d %H:%M:%S %Z')"
} > "$LOG" 2>&1

cat "$LOG"
