#!/bin/bash
# Azure App Service Linux startup command.
# Set this as your "Startup Command" in the Configuration blade, or via:
#   az webapp config set --startup-file "bash /home/site/wwwroot/startup.sh"
set -e
cd /home/site/wwwroot
# Ensure persistent data dir exists
mkdir -p /home/data
# Start the production server
PORT=8080 NODE_OPTIONS="--max-old-space-size=512" node node_modules/next/dist/bin/next start -p 8080
