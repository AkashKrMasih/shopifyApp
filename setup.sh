#!/usr/bin/env bash
#
# setup.sh - Install and prepare the Shopify Remix app on Ubuntu 24.04 (only).
#
# What it does:
#   1. Verifies the OS is Ubuntu 24.04
#   2. Installs system packages (git, curl, openssl, build tools)
#   3. Installs Node.js (>= 20.10, default: 22 LTS via NodeSource) if needed
#   4. Installs the Shopify CLI globally
#   5. Installs the project's dependencies (npm / yarn / pnpm, auto-detected)
#   6. Creates the Prisma/SQLite database (runs the "setup" script in package.json)
#   7. Optionally builds the app (--build)
#
# Usage:
#   ./setup.sh [--build] [--node-major N] [--help]
#
# Run it from the app's root folder (next to package.json). If package.json is
# not found, the script scaffolds a new app with `shopify app init` instead.

set -Eeuo pipefail

# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #
NODE_MAJOR="${NODE_MAJOR:-22}"        # Node.js major version to install if needed
MIN_NODE_MAJOR=20                     # Minimum supported: 20.10 (needed by Polaris v13+)
MIN_NODE_MINOR=10
TEMPLATE_URL="https://github.com/Shopify/shopify-app-template-remix"
DO_BUILD=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
if [[ -t 1 ]]; then
  C_BLUE=$'\033[1;34m'; C_GREEN=$'\033[1;32m'; C_YELLOW=$'\033[1;33m'; C_RED=$'\033[1;31m'; C_OFF=$'\033[0m'
else
  C_BLUE=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_OFF=""
fi

step() { printf '\n%s==>%s %s\n' "$C_BLUE" "$C_OFF" "$*"; }
ok()   { printf '%s ✓%s %s\n' "$C_GREEN" "$C_OFF" "$*"; }
warn() { printf '%s !%s %s\n' "$C_YELLOW" "$C_OFF" "$*" >&2; }
die()  { printf '%s ✗ ERROR:%s %s\n' "$C_RED" "$C_OFF" "$*" >&2; exit 1; }

trap 'die "Setup failed at line $LINENO. Fix the problem above and re-run ./setup.sh (it is safe to re-run)."' ERR

usage() {
  sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 0
}

have() { command -v "$1" >/dev/null 2>&1; }

# --------------------------------------------------------------------------- #
# Args
# --------------------------------------------------------------------------- #
while [[ $# -gt 0 ]]; do
  case "$1" in
    --build)      DO_BUILD=1 ;;
    --node-major) shift; NODE_MAJOR="${1:?--node-major needs a value}" ;;
    -h|--help)    usage ;;
    *)            die "Unknown option: $1 (try --help)" ;;
  esac
  shift
done

[[ "$NODE_MAJOR" =~ ^[0-9]+$ ]] || die "--node-major must be a number (got '$NODE_MAJOR')"

# --------------------------------------------------------------------------- #
# 1. Environment checks
# --------------------------------------------------------------------------- #
step "Checking environment"

[[ -r /etc/os-release ]] || die "Cannot read /etc/os-release. This script supports Ubuntu 24.04 only."
# shellcheck disable=SC1091
. /etc/os-release
if [[ "${ID:-}" != "ubuntu" || "${VERSION_ID:-}" != 24.* ]]; then
  die "This script supports Ubuntu 24.04 only (detected: ${PRETTY_NAME:-unknown})."
fi
ok "Ubuntu ${VERSION_ID} detected"

if [[ "$(uname -m)" != "x86_64" && "$(uname -m)" != "aarch64" ]]; then
  die "Unsupported CPU architecture: $(uname -m) (need x86_64 or aarch64)."
fi

if [[ $EUID -eq 0 ]]; then
  SUDO=""
  warn "Running as root. Project files will be owned by root; a normal user with sudo is recommended."
else
  have sudo || die "sudo is required (or run this script as root)."
  SUDO="sudo"
  ok "Requesting sudo access (you may be asked for your password)"
  sudo -v
fi

# --------------------------------------------------------------------------- #
# 2. System packages
# --------------------------------------------------------------------------- #
step "Installing system packages"

export DEBIAN_FRONTEND=noninteractive
$SUDO apt-get update -y
$SUDO apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg git openssl build-essential python3 xdg-utils
ok "System packages installed"

# --------------------------------------------------------------------------- #
# 3. Node.js
# --------------------------------------------------------------------------- #
node_is_ok() {
  have node && have npm || return 1
  local v major minor
  v="$(node -p 'process.versions.node')"
  major="${v%%.*}"; minor="${v#*.}"; minor="${minor%%.*}"
  if (( major > MIN_NODE_MAJOR )); then
    # Odd-numbered majors (21, 23, ...) are non-LTS; only accept even ones.
    (( major % 2 == 0 )) && return 0 || return 1
  fi
  (( major == MIN_NODE_MAJOR && minor >= MIN_NODE_MINOR ))
}

step "Checking Node.js"

if node_is_ok; then
  ok "Node.js $(node -v) already installed - keeping it"
else
  if have node; then
    warn "Found Node.js $(node -v), but >= ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR} (even-numbered LTS) is required. Installing Node.js ${NODE_MAJOR}.x"
  else
    echo "Node.js not found. Installing Node.js ${NODE_MAJOR}.x from NodeSource"
  fi

  $SUDO install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | $SUDO gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  $SUDO chmod 0644 /etc/apt/keyrings/nodesource.gpg

  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
    | $SUDO tee /etc/apt/sources.list.d/nodesource.list >/dev/null

  # Make sure NodeSource wins over Ubuntu's older nodejs package.
  printf 'Package: nodejs\nPin: origin deb.nodesource.com\nPin-Priority: 600\n' \
    | $SUDO tee /etc/apt/preferences.d/nodesource >/dev/null

  $SUDO apt-get update -y
  $SUDO apt-get install -y nodejs
  hash -r

  node_is_ok || die "Node.js installation did not produce a usable version (got: $(node -v 2>/dev/null || echo none))."
  ok "Node.js $(node -v) and npm $(npm -v) installed"
fi

# --------------------------------------------------------------------------- #
# 4. Shopify CLI
# --------------------------------------------------------------------------- #
step "Installing Shopify CLI"

$SUDO npm install -g @shopify/cli@latest
hash -r
have shopify || die "Shopify CLI was installed but 'shopify' is not on PATH."
ok "Shopify CLI $(shopify version 2>/dev/null | tail -n1) installed"

# --------------------------------------------------------------------------- #
# 5. Project dependencies
# --------------------------------------------------------------------------- #
cd "$SCRIPT_DIR"

if [[ ! -f package.json ]]; then
  step "No package.json found in $SCRIPT_DIR"
  warn "Scaffolding a new app with the Shopify CLI (interactive; you will need to log in)."
  shopify app init --template="$TEMPLATE_URL"
  echo
  ok "App created. cd into the new folder and run: shopify app dev"
  exit 0
fi

step "Detecting package manager"

if   [[ -f pnpm-lock.yaml ]]; then PM="pnpm"
elif [[ -f yarn.lock      ]]; then PM="yarn"
else                               PM="npm"
fi
ok "Using ${PM}"

if [[ "$PM" != "npm" ]]; then
  if have corepack; then
    $SUDO corepack enable
  else
    $SUDO npm install -g "$PM"
  fi
  hash -r
fi

step "Installing project dependencies"

case "$PM" in
  npm)
    if [[ -f package-lock.json ]]; then npm ci; else npm install; fi ;;
  yarn)
    yarn install ;;
  pnpm)
    pnpm install --frozen-lockfile || pnpm install ;;
esac
ok "Dependencies installed"

run_script() {
  case "$PM" in
    npm)  npm run "$1" ;;
    yarn) yarn "$1" ;;
    pnpm) pnpm run "$1" ;;
  esac
}

has_script() {
  node -e 'const s=(require("./package.json").scripts)||{}; process.exit(s[process.argv[1]]?0:1)' "$1"
}

# --------------------------------------------------------------------------- #
# 6. Database (Prisma + SQLite)
# --------------------------------------------------------------------------- #
step "Setting up the database (Prisma)"

if has_script setup; then
  run_script setup
  ok "Database ready"
elif [[ -f prisma/schema.prisma ]]; then
  npx prisma generate
  npx prisma migrate deploy
  ok "Database ready"
else
  warn "No Prisma setup found - skipping"
fi

# --------------------------------------------------------------------------- #
# 7. Optional build
# --------------------------------------------------------------------------- #
if [[ $DO_BUILD -eq 1 ]]; then
  step "Building the app"
  run_script build
  ok "Build complete"
fi

# --------------------------------------------------------------------------- #
# Done
# --------------------------------------------------------------------------- #
cat <<EOF

${C_GREEN}Setup complete.${C_OFF}

Next steps:
  1. Start local development:
       shopify app dev
     The CLI will ask you to log in to your Shopify Partner account, link the
     app, create a tunnel, and provide the environment variables.

  2. On a headless server (no browser), the CLI prints a login URL and code -
     open that URL on any other device to finish authenticating.

  3. For production, set NODE_ENV=production and run:
       ${PM} run build
       ${PM} run start

Prerequisites you still need on the Shopify side:
  - A Shopify Partner account:  https://partners.shopify.com/signup
  - A development (test) store
EOF
