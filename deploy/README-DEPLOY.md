# Deploying GolfGVSunday to Oracle Cloud (Always-Free)

End result: a public URL like `http://132.226.45.67/` that you and your friends can hit from anywhere — phones included. **$0/month forever.**

Total time: **~30 minutes** the first time.

---

## Part A — Create the VM (10 min, in Oracle Console)

You should already be signed in at https://cloud.oracle.com after sign-up.

### 1. Generate an SSH key (Windows PowerShell, one-time)

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\oracle-golfgv" -C "golfgv"
# Press Enter twice for no passphrase (or pick one if you want)
type "$env:USERPROFILE\.ssh\oracle-golfgv.pub"   # ← copy this whole line
```

You'll paste the `.pub` content into the Oracle UI in a moment.

### 2. Create an Ampere A1 (ARM) instance

In Oracle Cloud Console:

1. Top-left menu → **Compute** → **Instances**
2. **Create instance**
3. Name: `golfgv`
4. **Image and shape** → "Change shape" →
   - **Shape series**: Ampere (Arm)
   - **Shape**: VM.Standard.A1.Flex
   - OCPUs: **2** · Memory: **6 GB** (well within free tier — you can go to 4/24)
5. **Image**: keep Oracle Linux *or* switch to **Canonical Ubuntu 22.04** (recommended — easier)
6. **Networking**: keep defaults (creates VCN + subnet)
7. **Add SSH keys** → "Paste public keys" → paste the `oracle-golfgv.pub` content
8. **Create** → wait 1-2 min for it to provision
9. Once running, copy the **Public IP Address** from the instance page

### 3. Open ports 80 + 3000 in the VCN's Security List

By default Oracle's network blocks everything but SSH. Open HTTP:

1. On the instance page → click the **VNIC** → **Subnet** → **Security Lists** → default security list
2. **Add Ingress Rules** → add **two** rules:
   - Source CIDR `0.0.0.0/0` · IP Protocol `TCP` · Destination Port Range `80`
   - Source CIDR `0.0.0.0/0` · IP Protocol `TCP` · Destination Port Range `3000`
3. Save

---

## Part B — Get your code onto the VM (5 min)

### Option 1 — via SCP from Windows (no GitHub needed)

From PowerShell in `C:\Claude\GolfBet`:

```powershell
$IP = "PASTE_PUBLIC_IP_HERE"
$KEY = "$env:USERPROFILE\.ssh\oracle-golfgv"

# Make a local tarball excluding bulky dirs
$tar = "$env:TEMP\golfgv.tgz"
tar --exclude=node_modules --exclude=.next --exclude=.git --exclude=Revisions -czf $tar -C C:\Claude GolfBet

# Copy it up
scp -i $KEY $tar ubuntu@${IP}:/tmp/golfgv.tgz

# SSH in and extract
ssh -i $KEY ubuntu@${IP} "mkdir -p ~/golfgvsunday && tar -xzf /tmp/golfgv.tgz -C ~ --strip-components=1 -C ~/golfgvsunday && ls ~/golfgvsunday"
```

### Option 2 — via Git (better for ongoing updates)

```powershell
# On your PC, push to a GitHub repo first
cd C:\Claude\GolfBet
git init
git add -A
git commit -m "Initial deploy"
# Create empty repo on github.com first, then:
git remote add origin https://github.com/YOUR_USER/golfgvsunday.git
git branch -M main
git push -u origin main
```

Then on the VM:
```bash
git clone https://github.com/YOUR_USER/golfgvsunday.git ~/golfgvsunday
```

---

## Part C — Install runtime + run app (5 min)

SSH in and execute the setup script:

```powershell
$IP = "PASTE_PUBLIC_IP_HERE"
$KEY = "$env:USERPROFILE\.ssh\oracle-golfgv"
ssh -i $KEY ubuntu@${IP}
```

Now you're on the VM. Run:

```bash
cd ~/golfgvsunday
bash deploy/setup-vm.sh
```

It installs Node 20, PM2, builds the app, starts it under PM2, opens local firewall, and forwards port 80 → 3000.

When it finishes you'll see:
```
✅ DONE.  App is at:
   http://132.226.45.67       (forwarded to :3000)
```

Open that URL on your phone over 4G to confirm it works. Friends use the same URL.

---

## Part D — Updates later

After making changes on your PC:

```powershell
# Re-upload the code (Option 1)
$tar = "$env:TEMP\golfgv.tgz"
tar --exclude=node_modules --exclude=.next --exclude=.git --exclude=Revisions -czf $tar -C C:\Claude GolfBet
scp -i $KEY $tar ubuntu@${IP}:/tmp/golfgv.tgz
ssh -i $KEY ubuntu@${IP} "tar -xzf /tmp/golfgv.tgz -C ~ --strip-components=1 -C ~/golfgvsunday && bash ~/golfgvsunday/deploy/update-app.sh"
```

Or with git:
```bash
ssh -i $KEY ubuntu@${IP}
cd ~/golfgvsunday && git pull && bash deploy/update-app.sh
```

---

## Optional — Nicer URL

### Free subdomain via Cloudflare (5 min)

If you have any domain (even a free one like `.tk` or `.eu.org`), or use **DuckDNS** (`yourname.duckdns.org`, free):

1. DuckDNS: sign in with GitHub → create subdomain → point it at your Oracle public IP
2. Friends now visit `golfgv.duckdns.org` instead of the raw IP

### HTTPS via Caddy (5 min, requires a domain)

```bash
sudo apt install -y caddy
echo "yourdomain.com { reverse_proxy localhost:3000 }" | sudo tee /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy auto-fetches a Let's Encrypt cert. Done.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ssh: connection refused` | Wait 1-2 min after creating VM. Check public IP is right. |
| `Permission denied (publickey)` | Wrong key. Verify with `ssh -i $KEY -v ubuntu@$IP` |
| Page loads on `:3000` but not on `:80` | Check Oracle Security List has port 80 open. Check iptables: `sudo iptables -t nat -L PREROUTING` |
| `npm install` is slow | Normal on Ampere 2-OCPU (first time only). Take ~3 min. |
| `better-sqlite3` errors | `cd ~/golfgvsunday && rm -rf node_modules && npm ci` (rebuilds for ARM) |
| App crashes | `pm2 logs golfgv` |
| Reboot — does the app come back? | Yes. PM2 + systemd were set up by the script. |

## Useful commands on the VM

```bash
pm2 status                  # see running app
pm2 logs golfgv             # tail logs
pm2 restart golfgv          # restart after manual config change
sqlite3 ~/golfgvsunday/data/golfgvsunday.db  # inspect DB
df -h ~                     # check disk usage
```
