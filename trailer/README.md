# Scrap & Pressure — Remotion Trailer

2K gameplay trailer built from **real in-game captures** + text overlays.

## Specs

- **2560×1440** · **60 FPS** · **18s** (1080 frames)
- Footage: `public/footage/shot*.mp4` (captured from live game UI)
- Music: `public/sfx/track_part02_groove.ogg`

## Recapture footage

Vite must be running on `:5173`:

```bash
# from repo root
npm run trailer:capture
```

## Preview / render

```bash
cd trailer
npm run dev
npm run render
```
