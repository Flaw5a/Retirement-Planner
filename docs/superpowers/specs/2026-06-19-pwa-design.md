# PWA: Installable iPhone App

**Date:** 2026-06-19
**Status:** Approved

## Context

The retirement planner is live on Vercel as a web app. The goal is to make it installable on an iPhone home screen so it opens full-screen like a native app and works offline after the first visit. No App Store, no Apple Developer account required.

## Approach

Use `vite-plugin-pwa` to auto-generate a service worker (offline caching) and web app manifest at build time. Add Apple-specific meta tags to `index.html` to enable proper home screen installation on iOS.

## Changes

### 1. New dependency

```
vite-plugin-pwa  (devDependency)
```

### 2. `vite.config.js` — add PWA plugin

```js
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Retirement Cash Flow Planner',
        short_name: 'Retirement',
        description: 'UK household retirement cash flow planner',
        theme_color: '#111D35',
        background_color: '#F4F6FA',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [],
      },
    }),
  ],
  test: { environment: 'node' },
})
```

`registerType: 'autoUpdate'` means when a new version is deployed to Vercel, the service worker updates automatically — users always get the latest version without needing to clear cache.

### 3. `index.html` — Apple meta tags

Add inside `<head>`:

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Retirement" />
<meta name="theme-color" content="#111D35" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

`black-translucent` status bar lets the dark navy header extend edge-to-edge on modern iPhones.

### 4. App icons — `public/`

Three PNG files generated from a single SVG source using `@vite-pwa/assets-generator`:
- `public/apple-touch-icon.png` — 180×180, used by iOS home screen
- `public/pwa-192x192.png` — 192×192, used by Android/Chrome
- `public/pwa-512x512.png` — 512×512, used for splash screens

Source file: `public/icon.svg`
Icon design: dark navy background (`#111D35`), gold `£` symbol (`#B8952A`) centred — matching the app's existing header aesthetic.

Generation command (run once, outputs committed to `public/`):
```
npx @vite-pwa/assets-generator --preset minimal public/icon.svg
```

The SVG and generated PNGs are committed; generation does not run at build time.

## User installation flow (iPhone)

1. Visit the Vercel URL in **Safari**
2. Tap the **Share** button (box with arrow)
3. Tap **"Add to Home Screen"**
4. Tap **Add** — icon appears on home screen
5. Tap to open — full-screen, no browser bar, works offline

## Verification

- [ ] `npm run build` completes without errors; `dist/` contains `sw.js` and `manifest.webmanifest`
- [ ] Push to GitHub → Vercel re-deploys successfully
- [ ] Visit live URL on iPhone in Safari → Share → "Add to Home Screen" is available
- [ ] Installed app opens full-screen with no browser chrome
- [ ] Enable Airplane Mode → open app → all 5 tabs load from cache
- [ ] Deploy a change → app auto-updates within one reload
