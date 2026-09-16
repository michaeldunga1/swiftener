#!/usr/bin/env bash
# Replace ~/swiftener on the VPS with this fullstack blog (apex https://swiftener.com).
# Usage: ./deploy.sh <server_ip> <ssh_user>
# Example: ./deploy.sh 169.58.8.196 dunga

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <server_ip> <ssh_user>"
  echo "Example: $0 169.58.8.196 dunga"
  echo ""
  echo "Deploys to ~/swiftener (replaces that directory). Nginx should proxy swiftener.com → port 3000."
  exit 1
fi

SERVER_IP=$1
USERNAME=$2
REMOTE_DIR="/home/$USERNAME/swiftener"
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Replacing $REMOTE_DIR on $USERNAME@$SERVER_IP with $ROOT"
echo ""

ssh "$USERNAME@$SERVER_IP" "mkdir -p $REMOTE_DIR/data"

rsync -avz --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude .env \
  --exclude data \
  "$ROOT/" "$USERNAME@$SERVER_IP:$REMOTE_DIR/"

ssh "$USERNAME@$SERVER_IP" bash -s <<'REMOTE'
set -euo pipefail
REMOTE_DIR="${HOME}/swiftener"
cd "$REMOTE_DIR"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env — set JWT_SECRET and FRONTEND_URL=https://swiftener.com on the server."
fi

npm install --omit=dev

# Retire old platform PM2 apps (previous monorepo layout).
for app in swiftener swiftener-blog swiftener-audio swiftener-image swiftener-pdf swiftener-video swiftener-math swiftener-users swiftener-admin; do
  pm2 delete "$app" >/dev/null 2>&1 || true
done

pm2 start ecosystem.config.cjs --env production
pm2 save

curl -sf http://127.0.0.1:3000/api/health
echo ""
curl -sf http://127.0.0.1:3000/healthz >/dev/null && echo "healthz OK"
echo "Deploy complete — https://swiftener.com (via nginx → :3000)"
REMOTE
