# 🔴 Nuvio Live Sports Plugin

A **live sports streaming add-on** for [Nuvio](https://nuvio.tv) powered by the [Streamed.pk](https://streamed.pk) public API. Browse and watch live football, basketball, tennis, cricket, and more — directly from inside Nuvio.

> **For personal / educational use only.**

---

## ✨ Features

- 🔴 **Live Now** — matches currently streaming
- 📅 **Today's Matches** — all matches scheduled for today
- ⭐ **Popular** — featured / trending matches
- ⚽ **14 sport categories** — Football, Basketball, Tennis, Cricket, MMA & more
- 🔵 **HD-first** — HD streams are prioritized over SD
- 🇬🇧 **English-first** — English streams listed before other languages
- 🎥 **Dual stream delivery:**
  - **Native Player** — extracts direct HLS (`.m3u8`) URLs when possible (plays inside Nuvio / VLC)
  - **Open in Browser** — always available as a fallback (opens the web player in your browser)
- ⚡ **Smart caching** — live data cached 30s, today's matches 5min — no API hammering
- 🛡️ **Graceful errors** — retries once on failure, shows friendly messages instead of crashing

---

## 🏟️ Supported Sports

| Catalog | Sport |
|---------|-------|
| 🔴 Live Now | All sports, currently live |
| 📅 Today's Matches | All sports, today |
| ⭐ Popular | Trending / featured matches |
| ⚽ Football | Soccer / Football |
| 🏀 Basketball | NBA, EuroLeague, etc. |
| 🏈 American Football | NFL, College |
| ⚾ Baseball | MLB etc. |
| 🏒 Ice Hockey | NHL etc. |
| 🎾 Tennis | ATP, WTA, Grand Slams |
| 🏏 Cricket | IPL, Test, ODI |
| 🏎️ Motor Sports | F1, MotoGP |
| 🥊 Fighting / MMA | UFC, Boxing |
| ⛳ Golf | PGA Tour etc. |
| 🏉 Rugby | Premiership, Super Rugby |

---

## 🚀 Installation & Setup

### Prerequisites

- [Node.js](https://nodejs.org/) **v16 or later**
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [Nuvio](https://nuvio.tv) installed on your device

### Step 1 — Clone / Download

```bash
git clone https://github.com/your-username/nuvio-live-sports-plugin.git
cd nuvio-live-sports-plugin
```

Or just download and extract the ZIP.

### Step 2 — Install Dependencies

```bash
npm install
```

### Step 3 — Start the Server

```bash
npm start
```

You should see:

```
╔══════════════════════════════════════════════════════╗
║          🔴 Nuvio Live Sports Plugin                 ║
╠══════════════════════════════════════════════════════╣
║  Server running on port: 7000                        ║
║                                                      ║
║  📋 Manifest URL (copy this into Nuvio):             ║
║  http://localhost:7000/manifest.json                 ║
║                                                      ║
║  💡 Nuvio → Settings → Addons → paste URL above     ║
╚══════════════════════════════════════════════════════╝
```

The server must stay running for the add-on to work.

### Step 4 — Add to Nuvio

1. Open **Nuvio**
2. Go to **Settings → Addons** (or **Content & Discovery → Addons**)
3. Paste the manifest URL:
   ```
   http://localhost:7000/manifest.json
   ```
4. Click **Install** / **Add**
5. Browse to the **Discover** tab — you'll see all sport catalogs listed!

---

## ⚙️ Configuration

Copy `.env.example` to `.env` and edit if needed:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `7000` | Port the addon server listens on |

If you change the port, update your manifest URL in Nuvio accordingly.

---

## 🎥 How Streams Work

When you click a match, the plugin returns **two types of stream entries**:

### 1. 🎥 Native Player (HLS)
- The plugin tries to extract a direct `.m3u8` HLS stream URL from the embed page
- If successful, this stream plays **inside Nuvio's native player** or any HLS-capable player like **VLC**
- Labeled: `Alpha · Stream 1` / `🔵 HD · English · Native Player`

### 2. 🌐 Open in Browser
- Always available as a reliable fallback
- Opens the stream's embed page in your **system browser** (web player)
- Labeled: `🌐 Open in Browser` / `🔵 HD · English · Browser Player`

**Stream priority order:** HD English → HD other language → SD English → SD other language

### Playing in VLC
If a Native Player (HLS) stream appears:
1. Click it — Nuvio may open VLC automatically if it's set as the default player for `.m3u8` files
2. Alternatively, right-click the stream in Nuvio → "Open with external player" → VLC

---

## 🔧 Development

Run with auto-restart on file changes (Node 18+):

```bash
npm run dev
```

### Verify the API endpoints directly

```bash
# Check the manifest
curl http://localhost:7000/manifest.json

# Check the live catalog
curl "http://localhost:7000/catalog/tv/live.json"

# Check a sport catalog
curl "http://localhost:7000/catalog/tv/football.json"

# Check streams for a specific match (replace MATCH_ID with a real one)
curl "http://localhost:7000/stream/tv/sports-MATCH_ID.json"
```

---

## ⚠️ Known Limitations

| Limitation | Details |
|------------|---------|
| **HLS extraction is best-effort** | Not all embed pages expose `.m3u8` URLs in their source. When extraction fails, only the "Open in Browser" option appears. |
| **Browser player may have ads** | The embed pages from Streamed.pk are third-party web players and may contain ads. |
| **Local server required** | The plugin needs to be running on your machine while you use Nuvio. It's not a hosted service. |
| **Stream availability** | Streams go live close to match start time. Matches listed as "upcoming" may show no streams yet. |
| **API rate limits** | Streamed.pk currently has no rate limits, but this may change. The built-in caching minimizes requests. |

---

## 📡 Data Source

All sports data is provided by **[Streamed.pk](https://streamed.pk)** — a free, public REST API with no authentication required.

- API Base URL: `https://streamed.pk/api`
- Documentation: `https://streamed.pk/docs`

---

## 📁 Project Structure

```
nuvio-live-sports-plugin/
├── package.json          # Dependencies & npm scripts
├── .env.example          # Environment variable template
├── README.md             # This file
└── src/
    ├── index.js          # Entry point — starts the addon server
    ├── manifest.js       # Stremio/Nuvio addon manifest & catalog definitions
    ├── catalog.js        # Catalog & meta handlers (match lists & details)
    ├── streams.js        # Stream handler (HLS extraction + browser fallback)
    └── api.js            # Streamed.pk API client with caching & retry
```

---

## 📜 License

MIT — for personal and educational use only.
