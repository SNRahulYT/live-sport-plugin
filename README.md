# 🔴 Nuvio Live Sports Plugin

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-2.1.0-brightgreen.svg)](#)

## 📖 Description
A production-grade live sports streaming add-on for [Nuvio](https://nuvio.tv) and [Stremio](https://www.stremio.com/). It serves as a powerful multi-source aggregator that provides native live sports streams (Football, Basketball, Motorsport, Cricket, and more) inside your client, utilizing an advanced internal stream resolver to bypass CORS restrictions.

## ✨ Key Features
- **🏟️ Multi-Source Aggregator:** Combines matches and streams from multiple sources (StreamFree, Streamed.pk, BinTV, TimStreams, SportyHunter, NTV, iptv-org) into a unified catalog.
- **⚡ Background Cron Caching:** Uses Stale-While-Revalidate (SWR) caching with an internal background Cron Service to ensure instant loading without hammering provider APIs.
- **🛡️ Opossum Circuit Breakers:** Provider requests are isolated via circuit breakers to instantly fail-over if a streaming site goes down.
- **🧠 Algorithmic Stream Scoring:** Prioritizes high-resolution direct `.m3u8` links over external web players.
- **🌐 Built-in Stream Resolver:** Spawns a secondary proxy process (`resolver`) to bypass CORS and referrer restrictions natively.
- **📡 WebRTC P2P Mesh Network:** Integrates P2P sharing in the fallback Web Player (`/watch`) to handle massive concurrent traffic dynamically.
- **⚙️ Dynamic Configuration:** Features a beautiful local configuration page to curate your favorite sports and teams.
- **🏗️ Zero-Code YAML Scrapers:** Add new streaming sources instantly using CSS selectors in YAML.

## 📸 Screenshots
*(Screenshots not found in project - place your screenshots here)*
- Dashboard Configuration: `[Placeholder for configure.html screenshot]`
- Stremio Catalog View: `[Placeholder for Stremio Board screenshot]`

## 🌍 Demo / Live Link
*Not found in project.* (Can be self-hosted or deployed via Render).

## 🛠️ Tech Stack
- **Runtime:** [Node.js](https://nodejs.org/) (v22+)
- **Framework:** [Express.js](https://expressjs.com/)
- **Scraping & DOM:** [Cheerio](https://cheerio.js.org/), [Happy DOM](https://github.com/capricorn86/happy-dom)
- **Dependency Injection:** [Awilix](https://github.com/jeffijoe/awilix)
- **Resilience:** [Opossum](https://nodeshift.dev/opossum/) (Circuit Breakers)
- **Addon SDK:** [stremio-addon-sdk](https://github.com/Stremio/stremio-addon-sdk)
- **Proxying:** http-proxy-middleware
- **Testing:** Jest

## 📂 Folder Structure
- `src/` — Main application logic.
  - `src/domain/` — Data entities (`MatchEntity`, `StreamEntity`).
  - `src/providers/` — Stream scrapers (JS and YAML-based).
  - `src/services/` — Core business logic (`CacheService`, `CronService`, `CircuitBreakerService`, etc.).
  - `src/index.js` — The Express server and addon entry point.
- `public/` — Static assets, containing the configuration UI (`configure.html`).
- `resolver/` — Internal proxy server spawned as a child process to bypass stream CORS restrictions.
- `scripts/` — CLI tools, such as `generate-provider.js` for scaffolding YAML providers.
- `test/` — Unit tests.
- `render.yaml` — Deployment configuration for Render.com.

## 🚀 Installation

### Prerequisites
- Node.js (v22 or higher)
- npm

### Local Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/nuvio-live-sports-plugin.git
   cd nuvio-live-sports-plugin
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the addon in development mode:
   ```bash
   npm run dev
   ```
   *(Or use `npm start` for production).*

## 🔐 Environment Variables
You can customize the addon via environment variables. See `.env.example` in the root:
```env
# Port the addon server will listen on (default 7000 if not specified)
PORT=7000
```
*(The internal resolver will automatically pick a port or use `RESOLVER_PORT`)*.

## 🎮 Usage Instructions
1. Run the project locally (`npm start`).
2. Open your browser and navigate to `http://localhost:7000` (or your configured `PORT`).
3. Use the **Nuvio Sports Premium Setup** page to select your preferred sports and input your favorite teams.
4. Click **INSTALL ADDON** to generate your personalized `manifest.json` link and open it in Nuvio/Stremio.

## 📡 API Documentation
*Not found in project.* (This project is an addon that exposes a standard Stremio Addon manifest, not a general-purpose public API).

## 🎛️ Configuration Options
Through the local `/configure` UI, you can append a base64/URI-encoded configuration object to the addon URL:
- **sports:** Comma-separated list of enabled sports categories (e.g., `football,basketball,cricket`). Defaults to `all`.
- **teams:** Comma-separated list of favorite teams (e.g., `Arsenal,Lakers`). These populate the "⭐ Your Teams" catalog.

## ☁️ Build and Deployment Instructions
This project is configured for one-click deployment on **Render.com**.
1. Push your repository to GitHub.
2. Sign in to Render and create a new **Web Service**.
3. Link your repository.
4. Render will automatically detect the `render.yaml` blueprint and deploy the application (installing dependencies and starting both the main server and resolver).
5. Copy the generated Render URL (e.g., `https://your-app.onrender.com/manifest.json`) into Nuvio/Stremio.

## 🏗️ Architecture Overview
The plugin leverages a highly modular **Dependency Injection** container (`Awilix`).
1. **Frontend Proxy:** An Express server (`src/index.js`) handles Stremio catalog, meta, and stream requests. It also dynamically rewrites URLs to ensure remote hosting compatibility.
2. **Cron Cache Service:** Instead of scraping on-demand, a background cron job periodically fetches and merges events from multiple APIs (StreamFree, Streamed.pk, BinTV, etc.), storing them in memory.
3. **Internal Resolver:** The main process spawns a child `node` process (`resolver/src/server.js`) that acts as a reverse proxy for HLS chunks (`/api/hls`).
4. **Resilient Scraping:** Stream resolution requests are wrapped in `Opossum` circuit breakers to prevent cascading failures if a third-party site is unresponsive.

## ⚙️ How the project works internally

1. **Catalog Construction:** A background Cron job periodically fetches and merges events from multiple APIs (StreamFree, Streamed.pk, BinTV, etc.), storing them in memory. Fuzzy matching prevents duplicate events.
2. **Extracting the Embed:** When you click a match, the add-on scrapes the original sports site to find the hidden video embed link.
3. **Decrypting the `.m3u8`:** Streaming sites encrypt or hide their actual video source. The add-on runs a decryption process on that embedded link's HTML/JS to reverse-engineer and extract the raw `.m3u8` playlist file.
4. **The CORS Problem:** If we gave that raw `.m3u8` link directly to Nuvio, it would fail. The stream provider checks the `Referer` and `Origin` headers to ensure the video is only played on their web player.
5. **The Internal Proxy (The Magic):** To bypass this (and bypass any ISP blocks), the add-on spawns its own internal Proxy process (`resolver`). Instead of giving Nuvio the original video link, it gives Nuvio a link to *your deployed server*.
6. **Downloading the Video Chunks:** When Nuvio asks your server for the stream, your server secretly reaches out to the original site. It attaches the exact fake `Referer` and `Origin` headers needed to spoof their security, intercepts the individual video chunks (`.ts` segments), and passes them directly back to Nuvio natively in real-time.
7. **Render Keep-Alive Automation:** If deployed on Render's free tier, the application automatically detects its `RENDER_EXTERNAL_URL` and uses a background cron job to ping itself every 14 minutes. This guarantees the server never goes to sleep and remains blazing fast 24/7 without needing external tools like UptimeRobot!

## ⚠️ Known Limitations
- **In-Memory Cache:** All matches are stored in memory. A server restart momentarily clears the catalog until the next cron cycle.
- **Third-Party Dependency:** Scrapers are dependent on external site DOM structures. If a provider updates their layout, their scraper (or YAML file) must be updated.
- **Resource Usage:** Spawning a child process for the resolver might hit memory limits on very constrained free-tier hosts if heavily utilized.

## 🔮 Future Improvements
- Persistent storage (Redis/SQLite) for match cache to survive restarts.
- Auto-updating mechanism for YAML provider schemas via a central repository.
- More robust fuzzy-matching for team names across different languages.
- Expanded localization and multi-language audio track detection.

## 🤝 Contributing Guidelines
Contributions are welcome!
1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Ensure you write or update unit tests (`npm run test`).
4. To add new stream providers easily, use the CLI: `npm run generate:provider ProviderName`.
5. Commit your changes and push.
6. Open a Pull Request.

## 📄 License
This project is licensed under the [MIT License](https://opensource.org/licenses/MIT) - for educational and personal use only.

## 🙌 Acknowledgements
- [Stremio Addon SDK](https://github.com/Stremio/stremio-addon-sdk) for the foundational architecture.
- Source APIs and aggregators: StreamFree, Streamed.pk, BinTV, TimStreams, iptv-org.
- [Opossum](https://nodeshift.dev/opossum/) for making circuit breaking effortless.
