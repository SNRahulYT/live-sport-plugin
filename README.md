# 🔴 Nuvio Live Sports Plugin

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

A **live sports streaming add-on** for [Nuvio](https://nuvio.tv) and [Stremio](https://www.stremio.com/). Browse and watch live football, basketball, motorsport, cricket, and more — directly from inside Nuvio.

This plugin acts as a powerful aggregator and resolver, pulling matches from multiple sources and extracting direct, high-quality native HLS streams.

> **For personal / educational use only.**

---

## ✨ Features

- 🏟️ **Multi-Source Aggregator** — Combines matches and streams from multiple top sources (Streamed.pk, StreamFree, BinTV, TimStreams) into a unified catalog.
- 🎯 **Smart Deduplication & Sorting** — Intelligently merges duplicate events across sources and sorts the catalog to show **Live** and **Popular** matches first.
- 🔍 **Deep Search** — Built-in search functionality to find specific matches, teams, or leagues instantly.
- 🎥 **Dual Stream Delivery:**
  - **Native HLS Player** — Includes a built-in cryptographic resolver that cracks tokens for sources like Streamed.pk and StreamFree to extract direct `.m3u8` URLs. This allows seamless playback inside Nuvio's native player or VLC.
  - **Web Player Fallback** — For unsupported third-party embeds, the plugin provides a clean, ad-free full-screen web player wrapper (`/watch` endpoint) that opens directly in your browser.
- 🚦 **Priority Stream Sorting** — Best streams are always at the top (Streamed.pk > StreamFree > TimStreams > BinTV Direct > BinTV External).
- ⚡ **High Performance Caching** — In-memory caching (5 mins) prevents API hammering and ensures instant catalog loads.

---

## 🏟️ Supported Sports Catalogs

| Catalog | Description |
|---------|-------------|
| ⚽ Football | Soccer matches from top leagues |
| 🏏 Cricket | International and domestic cricket |
| 🏎️ Motorsport | F1, MotoGP, Racing |
| 🏀 Basketball | NBA, EuroLeague, etc. |
| 🏈 American Football | NFL, College Football |
| 🏉 Rugby | Premiership, Super Rugby |
| 📡 Other Sports | Tennis, Baseball, Hockey, MMA/Boxing, Golf, Darts, etc. |

---

## ☁️ Deploy to Render (Recommended — Public URL)

Deploying to Render gives you a **permanent public URL** like `https://nuvio-live-sports.onrender.com/manifest.json` that works on any device without running anything locally.

### Step 1 — Push code to GitHub

1. Go to [github.com/new](https://github.com/new) and create a new **public** repository (e.g., `nuvio-live-sports-plugin`).
2. Copy the remote URL shown.
3. Link your local repo and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/nuvio-live-sports-plugin.git
git branch -M main
git push -u origin main
```

### Step 2 — Deploy on Render

1. Go to [render.com](https://render.com) → Sign up free (GitHub login works).
2. Click **"New +"** → **"Web Service"**.
3. Connect your GitHub repo.
4. Render detects `render.yaml` automatically — just click **"Deploy"**.
5. Wait ~2 minutes for the first deploy to finish.

### Step 3 — Add to Nuvio / Stremio

1. Open **Nuvio** → **Settings → Addons**.
2. Paste your Render manifest URL:
   ```
   https://YOUR-APP-NAME.onrender.com/manifest.json
   ```
3. Click **Install** — done! 🎉

> [!NOTE]
> **Free tier cold starts:** Render's free tier spins down after 15 minutes of inactivity. The first request after idle may take ~30 seconds to wake up.

---

## 🚀 Local Installation & Setup

### Prerequisites

- [Node.js](https://nodejs.org/) **v22 or later**
- [npm](https://www.npmjs.com/)
- [Nuvio](https://nuvio.tv) or Stremio installed.

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/nuvio-live-sports-plugin.git
cd nuvio-live-sports-plugin
npm install
npm start
```

You should see:

```
╔══════════════════════════════════════════════════════╗
║          🔴 Nuvio Live Sports Plugin                 ║
╠══════════════════════════════════════════════════════╣
║  Port       : 7000                                   ║
║  Public URL : http://localhost:7000                  ║
║                                                      ║
║  📋 Paste into Nuvio → Settings → Addons:           ║
║  http://localhost:7000/manifest.json                 ║
╚══════════════════════════════════════════════════════╝
```

The server must stay running for the add-on to work locally.

---

## 📁 Project Architecture

The codebase is split into two main components:

1. **Main Plugin Server (`src/`)** — Port `7000`
   - Express server providing the Stremio Addon SDK manifest (`manifest.js`).
   - `api.js`: Aggregates all external sources (StreamFree, Streamed.pk, BinTV, TimStreams), standardizes categories, merges duplicate events, and caches results.
   - `catalog.js`: Handles catalog rendering, smart sorting, and search filtering.
   - `streams.js`: Maps sources to available streams, applies priority sorting, and directs streams to either the native HLS proxy or the Web Player fallback.
   - `/watch`: A custom HTML proxy page that safely embeds third-party web players in a clean, ad-free iframe bypassing referer restrictions.

2. **Internal Resolver (`resolver/src/`)** — Port `3000`
   - A specialized background service spawned automatically by `index.js`.
   - Reverse-engineers and cracks the cryptographic tokens used by `embed.st` (Streamed.pk) and handles proxying for `StreamFree`.
   - Proxies the final `.m3u8` HLS streams back to the main server, allowing native playback without a browser.

---

## ⚠️ Known Limitations

| Limitation | Details |
|------------|---------|
| **Native HLS availability** | Supported for Streamed.pk, StreamFree, and direct BinTV links. Some sources (TimStreams, BinTV embeds) use proprietary DRM/encryption and will fallback to the Web Player. |
| **Stream availability** | Streams usually go live 10-15 minutes before the match start time. |
| **Render Sleep** | Free Render instances sleep when inactive. We recommend using a service like UptimeRobot if you want it awake 24/7. |

---

## 📜 License

MIT — for personal and educational use only.
