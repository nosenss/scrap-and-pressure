# Scrap & Pressure

Industrial rogue-lite compactor game for the browser. Pack scrap tight, press hard, draft upgrades, and climb the Top-10.

## Play

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Build (itch.io zip)

```bash
npm run zip:itch
```

## Promo assets

```bash
npm run promo:capture   # needs Vite on :5173 + Playwright Chromium
```

## Trailer (Remotion)

```bash
npm run trailer:capture # real-game footage into trailer/public/footage
cd trailer && npm install && npm run dev
cd trailer && npm run render
```

## Analytics

Copy `public/analytics.config.example.json` → `public/analytics.config.json` and fill your own keys. The real config is gitignored.

## License

All rights reserved unless otherwise noted. Source published for transparency / learning — ask before redistributing assets commercially.
