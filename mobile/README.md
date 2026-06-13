# GolfGV Mobile (Expo)

iOS + Android client for GolfGV. Connects to the same Azure backend as the web app.

## Run on your phone (~3 min)

### One-time setup on your laptop

```powershell
# Install Node 20+ if you don't have it
# Then install Expo CLI helper (global, optional)
npm install -g expo-cli   # not strictly required; npx is fine

# In the mobile folder:
cd C:\Claude\GolfBet\mobile
npm install
```

### One-time on your phone

- iPhone: App Store → install **Expo Go**
- Android: Play Store → install **Expo Go**

### Start dev server + scan QR

```powershell
cd C:\Claude\GolfBet\mobile
npm start
```

A QR code appears in the terminal. On your phone:
- iPhone: open the **Camera** app, point at the QR → tap the notification
- Android: open **Expo Go** → tap "Scan QR code" → scan it

The app loads on your phone in ~30 sec. Make any edit in your code and the app hot-reloads instantly.

## What's in Sprint 1 (this build)

- ✅ Home screen with recent-rounds list and "Join" button
- ✅ Settings screen (rename device)
- ✅ Theme: light/dark auto + native iOS/Android typography
- ✅ Talks to your existing Azure API (`https://golfgv-bchangsewok.azurewebsites.net`)
- ✅ Device ID auto-generated and persisted

Placeholders for later sprints:
- 🚧 Join — QR scan (Sprint 2)
- 🚧 Dashboard — live scoreboard (Sprint 4)
- 🚧 Score Entry — swipe-between-holes UI (Sprint 3)
- 🚧 Player Detail (Sprint 5)
- 🚧 Team Play view (Sprint 5)

## Distributing to friends (Sprint 6 plan)

Once the app is feature-complete, EAS Build + Internal Distribution will produce:
- **iOS** internal `.ipa` installable by up to 100 devices via TestFlight link
- **Android** `.apk` installable on any device via a download link

`eas build --platform all --profile preview` after `eas login`.

## Project layout

```
mobile/
├── package.json
├── app.json              # Expo config (API base URL, permissions, etc.)
├── eas.json              # Build profiles
├── tsconfig.json
├── babel.config.js
├── app/                  # Screens (file-based routing via expo-router)
│   ├── _layout.tsx
│   ├── index.tsx         # Home
│   ├── join.tsx          # (Sprint 2)
│   ├── settings.tsx
│   └── round/[code]/
│       └── index.tsx     # Round dashboard (Sprint 4)
├── lib/
│   ├── api.ts            # Fetch client → Azure backend
│   ├── device.ts         # Per-device UUID via AsyncStorage
│   ├── theme.ts          # Colors + spacing
│   └── types.ts          # Mirrors web app types
└── components/           # Shared (Sprint 3+)
```

## Updating the API base URL

If your Azure URL changes, edit `app.json`:

```json
"extra": {
  "apiBase": "https://YOUR-NEW-URL.azurewebsites.net"
}
```

Then restart the dev server.
