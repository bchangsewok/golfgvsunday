# Builds an Azure App Service ZIP for upload via "Advanced Tools" (Kudu).
# The ZIP contains only source files; Azure runs `npm install` + `npm run build` on the server
# (because .deployment sets SCM_DO_BUILD_DURING_DEPLOYMENT=true).
#
# Usage:   .\deploy\build-azure-zip.ps1
# Output:  C:\Claude\GolfBet\deploy\deploy.zip

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Out = Join-Path $PSScriptRoot "deploy.zip"
$StageDir = Join-Path $env:TEMP "golfgv-stage-$(Get-Random)"

Write-Host "═══ Staging source files ═══" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $StageDir | Out-Null

# What goes in the ZIP (everything App Service needs to run + build the app)
$includeDirs = @("app", "lib", "components", "public", "scripts", "supabase")
$includeFiles = @(
  "package.json", "package-lock.json",
  "next.config.mjs", "next-env.d.ts",
  "tsconfig.json", "tailwind.config.ts", "postcss.config.js",
  "startup.sh", ".deployment",
  "README.md"
)

foreach ($d in $includeDirs) {
  $src = Join-Path $ProjectRoot $d
  if (Test-Path $src) {
    Copy-Item -Recurse $src $StageDir
    Write-Host "  + $d/" -ForegroundColor Gray
  }
}
foreach ($f in $includeFiles) {
  $src = Join-Path $ProjectRoot $f
  if (Test-Path $src) {
    Copy-Item $src $StageDir
    Write-Host "  + $f" -ForegroundColor Gray
  }
}

# Ensure no data/, node_modules/, .next/, Revisions/ snuck in
Get-ChildItem $StageDir -Recurse -Directory -Force `
  | Where-Object { $_.Name -in @("node_modules", ".next", "data", "Revisions", ".git", ".claude") } `
  | ForEach-Object { Remove-Item -Recurse -Force $_.FullName }

Write-Host ""
Write-Host "═══ Creating ZIP ═══" -ForegroundColor Cyan
if (Test-Path $Out) { Remove-Item $Out -Force }
# PowerShell's built-in ZIP — works on any modern Windows
Compress-Archive -Path "$StageDir\*" -DestinationPath $Out -CompressionLevel Optimal -Force

$size = [math]::Round((Get-Item $Out).Length / 1KB, 1)
$fileCount = (Get-ChildItem $StageDir -Recurse -File).Count
Remove-Item -Recurse -Force $StageDir

Write-Host ""
Write-Host "✅ Built: $Out" -ForegroundColor Green
Write-Host "   Files : $fileCount" -ForegroundColor Gray
Write-Host "   Size  : $size KB" -ForegroundColor Gray
Write-Host ""
Write-Host "Next: open Azure Portal → your Web App → Advanced Tools → Go" -ForegroundColor Cyan
Write-Host "      then visit  https://<your-app>.scm.azurewebsites.net/ZipDeployUI" -ForegroundColor Cyan
Write-Host "      and drag deploy.zip onto the page."  -ForegroundColor Cyan
