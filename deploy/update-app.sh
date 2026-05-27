#!/bin/bash
# Re-deploy after pulling new code (or after uploading new files).
# Run as `ubuntu` user:    bash update-app.sh
set -e
cd /home/ubuntu/golfgvsunday
npm ci --omit=optional
npm run build
pm2 restart golfgv
pm2 logs golfgv --lines 20 --nostream
echo "✅ App updated."
