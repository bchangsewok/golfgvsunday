# Deploy local code to a Google Cloud VM — no git required.
# Bundles your project, uploads via gcloud, extracts on the VM, rebuilds, restarts PM2.
# Preserves the SQLite database (data/*.db is never touched).
#
# Usage:   .\deploy\deploy-from-pc.ps1
# First run prompts for VM name + zone; subsequent runs remember them.

param(
  [string]$VM   = $env:GOLFGV_VM,
  [string]$Zone = $env:GOLFGV_ZONE
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  Write-Host "❌ gcloud not found. Install with:  winget install --id Google.CloudSDK" -ForegroundColor Red
  exit 1
}

if (-not $VM) {
  Write-Host "First-time setup — enter VM name (e.g. golfgv):" -ForegroundColor Cyan
  $VM = Read-Host
  [Environment]::SetEnvironmentVariable("GOLFGV_VM", $VM, "User")
}
if (-not $Zone) {
  Write-Host "Enter zone (e.g. us-central1-a):" -ForegroundColor Cyan
  $Zone = Read-Host
  [Environment]::SetEnvironmentVariable("GOLFGV_ZONE", $Zone, "User")
}

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Tar = "$env:TEMP\golfgv-deploy.tgz"

Write-Host ""
Write-Host "═══ 1/4 · Bundling project (excluding node_modules, .next, data, etc.) ═══" -ForegroundColor Cyan
Push-Location $ProjectRoot
try {
  if (Test-Path $Tar) { Remove-Item $Tar -Force }
  # Bundle the CONTENTS of the project (not the folder itself) so it extracts cleanly into ~/golfgvsunday
  tar --exclude=node_modules --exclude=.next --exclude=.git --exclude=Revisions --exclude="data/backups" --exclude="data/*.db" --exclude="data/*.db-shm" --exclude="data/*.db-wal" --exclude=".claude" -czf $Tar .
  if ($LASTEXITCODE -ne 0) { throw "tar failed" }
  $size = [math]::Round((Get-Item $Tar).Length / 1KB, 1)
  Write-Host "Bundle: $Tar ($size KB)" -ForegroundColor Green
} finally { Pop-Location }

Write-Host ""
Write-Host "═══ 2/4 · Uploading to VM $VM ($Zone) ═══" -ForegroundColor Cyan
gcloud compute scp --zone="$Zone" $Tar ${VM}:/tmp/golfgv-deploy.tgz
if ($LASTEXITCODE -ne 0) { throw "scp upload failed" }

Write-Host ""
Write-Host "═══ 3/4 · Deploying on VM (backup DB → extract → build → restart) ═══" -ForegroundColor Cyan

# Heredoc-style remote script: backup DB, extract over current files, rebuild, restart.
$RemoteScript = @'
set -e
APP=~/golfgvsunday
TS=$(date +%Y%m%d-%H%M%S)

# 1. Backup existing DB (kept under data/backups/, max 10)
mkdir -p $APP/data/backups
if [ -f $APP/data/golfgvsunday.db ]; then
  cp $APP/data/golfgvsunday.db $APP/data/backups/golfgvsunday-$TS.db
  echo "✓ DB backed up to data/backups/golfgvsunday-$TS.db"
  ls -1t $APP/data/backups/*.db 2>/dev/null | tail -n +11 | xargs -r rm --
fi

# 2. Ensure target dir exists, then extract over it (doesn't touch data/*.db because tar didn't include them)
mkdir -p $APP
tar -xzf /tmp/golfgv-deploy.tgz -C $APP
echo "✓ Code extracted"

# 3. Rebuild and restart
cd $APP
export NODE_OPTIONS="--max-old-space-size=768"
npm ci --omit=optional
npm run build
pm2 restart golfgv || (PORT=3000 pm2 start npm --name golfgv -- start && pm2 save)
echo "✅ Deploy complete"
pm2 status golfgv
'@

gcloud compute ssh --zone="$Zone" $VM --command "$RemoteScript"
if ($LASTEXITCODE -ne 0) { throw "remote deploy failed — DB backup is safe at ~/golfgvsunday/data/backups/" }

Write-Host ""
Write-Host "═══ 4/4 · Cleanup ═══" -ForegroundColor Cyan
Remove-Item $Tar -Force
$ExternalIP = (gcloud compute instances describe $VM --zone="$Zone" --format="value(networkInterfaces[0].accessConfigs[0].natIP)") 2>$null
Write-Host ""
Write-Host "✅ Deployed!" -ForegroundColor Green
if ($ExternalIP) { Write-Host "   App: http://$ExternalIP" -ForegroundColor Green }
