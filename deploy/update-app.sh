#!/bin/bash
# Safe re-deploy after pulling new code.
# - Backs up the SQLite DB to data/backups/ before doing anything
# - Aborts if the build fails (PM2 keeps running the old version)
# - Restarts the app only after a successful build
#
# Run as your normal user:    bash ~/golfgvsunday/deploy/update-app.sh
set -e
APP="$HOME/golfgvsunday"
cd "$APP"

echo "═══ 1/4 · Backing up DB ════════════════════════════════════"
mkdir -p "$APP/data/backups"
TS=$(date +%Y%m%d-%H%M%S)
if [ -f "$APP/data/golfgvsunday.db" ]; then
  cp "$APP/data/golfgvsunday.db" "$APP/data/backups/golfgvsunday-$TS.db"
  echo "Saved: data/backups/golfgvsunday-$TS.db"
  # Keep only the 10 most recent backups
  ls -1t "$APP/data/backups"/*.db 2>/dev/null | tail -n +11 | xargs -r rm --
else
  echo "(no existing DB to back up — first deploy)"
fi

echo "═══ 2/4 · git pull ═════════════════════════════════════════"
git pull --ff-only

echo "═══ 3/4 · npm ci + build ══════════════════════════════════"
npm ci --omit=optional
npm run build

echo "═══ 4/4 · Restart PM2 ═════════════════════════════════════"
pm2 restart golfgv
pm2 save
pm2 logs golfgv --lines 20 --nostream
echo ""
echo "✅ Deploy complete · DB unchanged"
echo "   To list backups:   ls -lh ~/golfgvsunday/data/backups/"
echo "   To restore one:    pm2 stop golfgv && cp ~/golfgvsunday/data/backups/<file>.db ~/golfgvsunday/data/golfgvsunday.db && pm2 start golfgv"
