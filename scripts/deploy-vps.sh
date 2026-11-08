#!/usr/bin/env bash
# Builds Next.js locally and ships the standalone output to the VPS (too small to run `next build` itself).
# Usage: bash scripts/deploy-vps.sh [ssh-host]   (default host alias: stardoom; stack lives in /opt/stardoom/deploy)
# Skip the local build with SKIP_BUILD=1 when .next/standalone is already fresh.
set -euo pipefail
HOST="${1:-stardoom}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cd "$ROOT"

if [ "${SKIP_BUILD:-}" != "1" ]; then
  rm -rf .next
  NEXT_TELEMETRY_DISABLED=1 npx next build
fi

echo "== packing"
P="$STAGE/prebuilt"
mkdir -p "$P/app/.next"
cp -r .next/standalone/. "$P/app/"
rm -rf "$P/app/desktop" "$P/app/marketing" "$P/app/storage" "$P/app/public" "$P/app/node_modules/@prisma" "$P/app/node_modules/.prisma"
cp -r .next/static "$P/app/.next/static"
cp -r public prisma scripts contracts "$P/app/"
cp -r node_modules/@prisma node_modules/.prisma "$P/app/node_modules/"
find "$P/app/node_modules" \( -name "*windows*.dll.node" -o -name "*darwin*.node" -o -name "*.exe" \) -delete
# A Windows/macOS build bakes its own absolute root into these files; inside the image the app lives at /app.
node -e '
const fs = require("fs");
const root = process.argv[1], files = process.argv.slice(2);
const forms = [root, root.replace(/\\/g, "/"), JSON.stringify(root).slice(1, -1)];
for (const f of files) {
  let t = fs.readFileSync(f, "utf8");
  for (const s of forms) t = t.split(s).join("/app");
  fs.writeFileSync(f, t);
}' "$(node -p 'process.cwd()')" "$P/app/server.js" "$P/app/.next/required-server-files.json"
cp deploy/Dockerfile.prebuilt deploy/docker-compose.prebuilt.yml "$P/"
tar -czf "$STAGE/prebuilt.tgz" -C "$STAGE" prebuilt

echo "== uploading"
scp -q "$STAGE/prebuilt.tgz" "$HOST:/opt/stardoom/prebuilt.tgz"
ssh "$HOST" 'set -e
cd /opt/stardoom && rm -rf deploy/prebuilt && tar -xzf prebuilt.tgz -C deploy && rm prebuilt.tgz
cd deploy && mv -f prebuilt/Dockerfile.prebuilt prebuilt/docker-compose.prebuilt.yml .
docker build -q -t stardoom-app:latest -f Dockerfile.prebuilt prebuilt
rm -rf prebuilt
docker compose -f docker-compose.yml -f docker-compose.prebuilt.yml up -d app
docker image prune -f >/dev/null
for i in $(seq 1 30); do
  if docker compose logs --since 2m app 2>&1 | grep -q "Ready in"; then echo "== app ready"; exit 0; fi
  sleep 3
done
docker compose logs --tail 40 app; exit 1'
