# 🔴 Nuvio Live Sports Plugin

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

A **production-grade live sports streaming add-on** for [Nuvio](https://nuvio.tv) and [Stremio](https://www.stremio.com/). Browse and watch live football, basketball, motorsport, cricket, and more — directly from inside Nuvio.

This plugin is designed with enterprise-scale architecture. It acts as a powerful aggregator and resolver, utilizing Dependency Injection, Circuit Breakers, Smart Caching, and WebRTC P2P meshing to deliver a bulletproof streaming experience.

> **For personal / educational use only.**

---

## ✨ Enterprise Features (Phase 1, 2 & 3)

- 🏟️ **Multi-Source Aggregator** — Combines matches and streams from multiple top sources (Streamed.pk, StreamFree, BinTV, TimStreams) into a unified catalog.
- ⚡ **Background Cron Caching (Zero Latency)** — Uses SWR (Stale-While-Revalidate) caching with an internal background Cron Service. Catalogs load instantly without hammering provider APIs.
- 🛡️ **Opossum Circuit Breakers** — Every provider is isolated via Circuit Breakers. If a streaming site goes down, the addon instantly fails-over gracefully without hanging your Stremio client.
- 🧠 **Algorithmic Stream Scoring** — Streams aren't just listed; they are scored algorithmically. High-resolution direct `.m3u8` links are pushed to the top, while external web players are penalized. You always get the best stream first.
- 🌐 **WebRTC P2P Mesh Network** — Built into the Nuvio Web Player. When thousands of users watch the same match, their browsers connect via WebRTC to share video chunks. This prevents the provider's CDN from crashing and eliminates buffering.
- 🗣️ **Deep Language Parsing** — Natively extracts audio tracks from the M3U8 manifest (e.g. `[EN]`, `[ES]`) and displays the language tag directly in Stremio.
- 🔥 **Smart Trending Engine** — Automatically detects massive global events (e.g., Champions League, Super Bowl) via keyword analysis and forces them to the top of your `🔴 Live Now` catalog.
- ⚙️ **Custom User Personalization** — Features a beautiful local UI (`http://localhost:8080/configure`). Type in your favorite teams (e.g. "Arsenal", "Lakers") to generate a custom Stremio URL. Your teams will automatically populate the `⭐ Your Teams` row at the very top of your board.
- 🏗️ **Zero-Code YAML Scrapers** — Add new streaming sites in 5 minutes without writing JavaScript. Just create a `.yml` file in `src/providers/yaml/` using CSS selectors. Included is a CLI tool (`npm run generate:provider`) for instant scaffolding!

---

## 🏟️ Chronological Catalogs

Instead of scrolling endlessly, your Stremio Board is dynamically segmented:
- **⭐ Your Teams:** Matches featuring the teams you configured.
- **🔴 Live Now:** Events happening right now across the globe.
- **⏱️ Upcoming:** Scheduled events sorted by kickoff time.
- **⚽ By Sport:** Football, Cricket, Motorsport, Basketball, and more.

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
npm run dev
```

### Personalize & Install
1. Open your browser and go to **http://localhost:8080**
2. Type in your favorite teams (optional).
3. Click **Install Addon** to automatically inject your custom settings into Stremio.

---

## ☁️ Deploy to Render (Recommended — Public URL)

Deploying to Render gives you a **permanent public URL** like `https://nuvio-live-sports.onrender.com/manifest.json` that works on any device without running anything locally.

### Step 1 — Push code to GitHub
1. Create a **public** repository.
2. Link your local repo and push:
```bash
git remote add origin https://github.com/YOUR_USERNAME/nuvio-live-sports-plugin.git
git branch -M main
git push -u origin main
```

### Step 2 — Deploy on Render
1. Go to [render.com](https://render.com).
2. Click **"New +"** → **"Web Service"**.
3. Connect your GitHub repo.
4. Render detects `render.yaml` automatically — click **"Deploy"**.

### Step 3 — Install
1. Open Nuvio/Stremio → Settings → Addons.
2. Paste your Render manifest URL: `https://YOUR-APP-NAME.onrender.com/manifest.json`.

---

## 👨‍💻 Developer Guide: Adding a New Provider (No-Code)

You can add new streaming sites without writing any code by using our YAML engine.

1. Open your terminal in the project directory.
2. Run the scaffolding tool:
   ```bash
   npm run generate:provider KickoffStreams
   ```
3. Open the newly created `src/providers/yaml/kickoffstreams.yml` file.
4. Update the CSS selectors to match the target website. The engine handles all circuit breaking, caching, and streaming logic automatically!

---

## 📜 License

MIT — for personal and educational use only.
