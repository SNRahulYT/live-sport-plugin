/**
 * index.js — Nuvio Live Sports Plugin Entry Point
 *
 * Builds a single Express server that serves:
 *   - /manifest.json          → addon manifest (via SDK getRouter)
 *   - /catalog/tv/*.json      → match lists
 *   - /meta/tv/*.json         → match detail
 *   - /stream/tv/*.json       → stream URLs
 *   - /watch                  → HTML proxy page for embed streams
 *
 * CORS headers are explicitly set so Nuvio can reach the manifest
 * from any origin without a networkError_manifestLoadError.
 */

const express = require('express');
const cors    = require('cors');
const { getRouter } = require('stremio-addon-sdk');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { spawn } = require('child_process');
const path = require('path');

const { builder } = require('./manifest');
const { handleCatalog, handleMeta } = require('./catalog');
const { handleStream } = require('./streams');
const { PORT, BASE_URL } = require('./config');
const container = require('./container');

// ─── Spawn the Streamed.pk Resolver ───────────────────────────────────────────

const resolverPath = path.join(__dirname, '..', 'resolver', 'src', 'server.js');
console.log(`Starting Stream Resolver at ${resolverPath}...`);
const resolverProcess = spawn('node', [resolverPath], {
  stdio: 'inherit',
  env: { ...process.env, PORT: '3000', BASE_URL: BASE_URL }
});
resolverProcess.on('error', (err) => console.error('Resolver spawn error:', err));
resolverProcess.on('exit', (code, signal) => console.error(`[FATAL] Resolver process exited with code ${code} and signal ${signal}. Streams will not work until restarted.`));

// ─── Register Addon Handlers ──────────────────────────────────────────────────

builder.defineCatalogHandler(({ type, id, extra }) => handleCatalog(type, id, extra));
builder.defineMetaHandler(({ type, id })           => handleMeta(type, id));
builder.defineStreamHandler(({ type, id })         => handleStream(type, id));

// ─── Build Express App ────────────────────────────────────────────────────────

const app = express();

app.use(cors());

// Serve the web debugger UI and Configuration Page
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'configure.html'));
});

app.get('/configure', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'configure.html'));
});

// Mount the HLS Video Proxy (routes to the internal resolver on port 3000)
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:3000/api',
  changeOrigin: true,
  logLevel: 'debug',
  onError: (err, req, res) => {
    console.error('[Proxy Error] Failed to proxy /api request to internal resolver:', err.message);
    if (!res.headersSent) {
      res.status(502).send('Bad Gateway: Internal stream resolver is not responding.');
    }
  }
}));

// Mount the Stremio addon router
app.use(getRouter(builder.getInterface()));

// ─── /watch — Embed Proxy Page ────────────────────────────────────────────────

// When the user clicks a stream, Nuvio opens this URL in the browser.
// It serves a clean full-screen HTML page that wraps the embed in an iframe,
// bypassing the referrer/origin restrictions that the raw embed.st URLs have.
//
// Query params:
//   ?url=<encoded embed URL>     the stream embed to display
//   ?title=<encoded match title> shown in the page heading

app.get('/watch', (req, res) => {
  const embedUrl = req.query.url;
  const title    = req.query.title || 'Live Sports';

  if (!embedUrl) {
    return res.status(400).send('Missing ?url parameter');
  }

  // Validate — only allow http/https URLs
  let safeUrl;
  try {
    const parsed = new URL(decodeURIComponent(embedUrl));
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).send('Invalid URL protocol');
    }
    safeUrl = parsed.toString();
  } catch {
    return res.status(400).send('Invalid URL');
  }

  const safeTitle = String(title)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <meta name="referrer" content="no-referrer">
  <title>\uD83D\uDD34 ${safeTitle} | Live Sports</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

    #topbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 10;
      background: linear-gradient(to bottom, rgba(0,0,0,0.85), transparent);
      padding: 12px 20px; color: #fff; font-size: 14px; font-weight: 600;
      display: flex; align-items: center; gap: 10px;
      animation: fadeOut 1s ease 4s forwards;
    }
    #topbar .dot {
      width: 10px; height: 10px; background: #f44;
      border-radius: 50%; flex-shrink: 0;
      animation: pulse 1s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.5; transform: scale(1.3); }
    }
    @keyframes fadeOut { to { opacity: 0; pointer-events: none; } }

    #player {
      position: fixed; top: 0; left: 0;
      width: 100vw; height: 100vh;
      border: none; display: block; background: #000;
    }

    #video-player {
      position: fixed; top: 0; left: 0;
      width: 100vw; height: 100vh;
      border: none; display: none; background: #000;
    }
    #loader {
      position: fixed; inset: 0; background: #111;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 20px; color: #fff; z-index: 5;
      transition: opacity 0.6s ease;
    }
    #loader.hidden { opacity: 0; pointer-events: none; }
    #loader .spinner {
      width: 48px; height: 48px;
      border: 4px solid rgba(255,255,255,0.15);
      border-top-color: #f44; border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #loader .match { font-size: 18px; font-weight: 600; text-align: center; padding: 0 24px; }
    #loader .hint  { font-size: 13px; opacity: 0.5; }
    
    #p2p-status {
      position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.7); color: #0f0;
      padding: 5px 10px; border-radius: 4px; font-size: 12px; font-family: monospace; z-index: 20;
      display: none;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/p2p-media-loader-core@latest/build/p2p-media-loader-core.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/p2p-media-loader-hlsjs@latest/build/p2p-media-loader-hlsjs.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
</head>
<body>
  <div id="loader">
    <div class="spinner"></div>
    <p class="match">\uD83D\uDD34 ${safeTitle}</p>
    <p class="hint">Loading stream\u2026</p>
  </div>

  <div id="topbar">
    <span class="dot"></span>
    <span>${safeTitle}</span>
  </div>

  <div id="p2p-status">P2P Active: 0 Peers</div>

  <iframe
    id="player"
    allowfullscreen
    allow="autoplay; encrypted-media; fullscreen; picture-in-picture; accelerometer; gyroscope"
    scrolling="no"
    loading="eager"
    sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-popups"
  ></iframe>

  <video id="video-player" controls autoplay playsinline></video>

  <script>
    const loader = document.getElementById('loader');
    const iframe = document.getElementById('player');
    const video = document.getElementById('video-player');
    const p2pStatus = document.getElementById('p2p-status');
    const targetUrl = "${safeUrl}";
    const isM3u8 = targetUrl.includes('.m3u8');

    if (isM3u8) {
      iframe.style.display = 'none';
      video.style.display = 'block';
      p2pStatus.style.display = 'block';

      if (p2pml.hlsjs.Engine.isSupported()) {
        const engine = new p2pml.hlsjs.Engine();
        
        engine.on('peer_connect', () => {
           p2pStatus.innerText = 'P2P Active: ' + engine.getSettings().swarmId + ' peers connected';
        });

        const hls = new Hls({
          liveSyncDurationCount: 7,
          loader: engine.createLoaderClass()
        });

        p2pml.hlsjs.initHlsJsPlayer(hls);
        hls.loadSource(targetUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(e => console.log('Autoplay blocked'));
          loader.classList.add('hidden');
        });
      } else if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(targetUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play();
          loader.classList.add('hidden');
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = targetUrl;
        video.addEventListener('loadedmetadata', () => {
          video.play();
          loader.classList.add('hidden');
        });
      }
    } else {
      video.style.display = 'none';
      iframe.src = targetUrl;
      iframe.addEventListener('load', () => loader.classList.add('hidden'));
      setTimeout(() => loader.classList.add('hidden'), 6000);
    }
  </script>
</body>
</html>`);
});

// ─── Health Check ─────────────────────────────────────────────────────────────
// Render pings this to confirm the service is alive

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'nuvio-live-sports' }));

// ─── Start Server ─────────────────────────────────────────────────────────────

container.resolve('cronService').start();

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║          🔴 Nuvio Live Sports Plugin                 ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Port       : ${String(PORT).padEnd(39)}║`);
  console.log(`║  Public URL : ${BASE_URL.padEnd(39)}║`);
  console.log('║                                                      ║');
  console.log('║  📋 Paste into Nuvio → Settings → Addons:           ║');
  console.log(`║  ${(BASE_URL + '/manifest.json').padEnd(52)}║`);
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
});
