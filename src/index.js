/**
 * index.js — Nuvio Live Sports Plugin Entry Point
 *
 * Uses the stremio-addon-sdk's getRouter() to mount the addon onto a
 * custom Express server, so we can also serve a /watch proxy page.
 *
 * The /watch page is the key fix for embed URLs:
 *   - embed.st URLs have referrer/origin restrictions
 *   - When opened raw they may fail in Nuvio's webview / browser
 *   - Instead, externalUrl points to OUR /watch?url=... page
 *   - Our page embeds the stream in a clean full-screen iframe
 *   - This sidesteps the referrer restrictions reliably
 *
 * Install in Nuvio:
 *   1. Deploy to Render (see README) → get your public URL
 *   2. In Nuvio → Settings → Addons → paste:
 *      https://your-app.onrender.com/manifest.json
 */

const express = require('express');
const { addonBuilder, getRouter } = require('stremio-addon-sdk');

const { builder }       = require('./manifest');
const { handleCatalog, handleMeta } = require('./catalog');
const { handleStream }  = require('./streams');
const { PORT, BASE_URL } = require('./config');

// ─── Register Addon Handlers ──────────────────────────────────────────────────

// Catalog: Nuvio browses a sport category row
builder.defineCatalogHandler(({ type, id, extra }) => {
  return handleCatalog(type, id, extra);
});

// Meta: Nuvio shows the match detail / info screen
builder.defineMetaHandler(({ type, id }) => {
  return handleMeta(type, id);
});

// Stream: Nuvio wants playable URLs for a match
builder.defineStreamHandler(({ type, id }) => {
  return handleStream(type, id);
});

// ─── Build the Express App ────────────────────────────────────────────────────

const app = express();

// Mount the stremio-addon-sdk router (handles /manifest.json, /catalog/*, /stream/*, etc.)
app.use(getRouter(builder.getInterface()));

// ─── /watch — Embed Proxy Page ────────────────────────────────────────────────
//
// Serves a full-screen HTML page that wraps an embed URL in an iframe.
// This is what externalUrl points to for every stream entry.
//
// Query params:
//   ?url=<encoded embed URL>     — the stream embed URL to display
//   ?title=<encoded match title> — shown in the page <title> and header

app.get('/watch', (req, res) => {
  const embedUrl = req.query.url;
  const title    = req.query.title || 'Live Sports';

  if (!embedUrl) {
    return res.status(400).send('Missing ?url parameter');
  }

  // Security: only allow http/https URLs
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

  // Serve the HTML proxy page
  // CSP is deliberately relaxed for iframes so the embed can load its own scripts
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <!-- Tell the embed page we're coming from streamed.pk so it doesn't block us -->
  <meta name="referrer" content="no-referrer-when-downgrade">
  <title>🔴 ${safeTitle} | Live Sports</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    html, body {
      width: 100%;
      height: 100%;
      background: #000;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    /* Top bar shown briefly then hidden */
    #topbar {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 10;
      background: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%);
      padding: 12px 20px;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: fadeOut 1s ease 4s forwards;
    }

    #topbar .dot {
      width: 10px; height: 10px;
      background: #f44;
      border-radius: 50%;
      animation: pulse 1s infinite;
      flex-shrink: 0;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.2); }
    }
    @keyframes fadeOut {
      to { opacity: 0; pointer-events: none; }
    }

    /* The embed iframe — full screen */
    #player {
      position: fixed;
      top: 0; left: 0;
      width: 100vw;
      height: 100vh;
      border: none;
      display: block;
      background: #000;
    }

    /* Loading overlay shown while iframe loads */
    #loader {
      position: fixed;
      inset: 0;
      background: #000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      color: #fff;
      z-index: 5;
      transition: opacity 0.5s ease;
    }
    #loader.hidden { opacity: 0; pointer-events: none; }

    #loader .spinner {
      width: 48px; height: 48px;
      border: 4px solid rgba(255,255,255,0.15);
      border-top-color: #f44;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    #loader p { font-size: 15px; opacity: 0.7; }
    #loader .stream-title { font-size: 18px; font-weight: 600; text-align: center; padding: 0 24px; }
  </style>
</head>
<body>

  <!-- Loading overlay -->
  <div id="loader">
    <div class="spinner"></div>
    <p class="stream-title">🔴 ${safeTitle}</p>
    <p>Loading stream…</p>
  </div>

  <!-- Top bar with match title -->
  <div id="topbar">
    <span class="dot"></span>
    <span>${safeTitle}</span>
  </div>

  <!-- The actual stream embed -->
  <iframe
    id="player"
    src="${safeUrl}"
    allowfullscreen
    allow="autoplay; encrypted-media; fullscreen; picture-in-picture; accelerometer; gyroscope"
    scrolling="no"
    loading="eager"
  ></iframe>

  <script>
    // Hide the loader once the iframe signals it has loaded.
    // We also auto-hide after 6s as a fallback (iframe load events
    // may not fire for cross-origin frames).
    const loader = document.getElementById('loader');
    const player = document.getElementById('player');

    function hideLoader() {
      loader.classList.add('hidden');
    }

    player.addEventListener('load', hideLoader);
    setTimeout(hideLoader, 6000); // fallback
  </script>

</body>
</html>`);
});

// ─── Start the Server ─────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║          🔴 Nuvio Live Sports Plugin                 ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Listening on port : ${String(PORT).padEnd(31)}║`);
  console.log(`║  Public base URL   : ${BASE_URL.padEnd(31)}║`);
  console.log('║                                                      ║');
  console.log('║  📋 Manifest URL for Nuvio:                          ║');
  console.log(`║  ${(BASE_URL + '/manifest.json').padEnd(52)}║`);
  console.log('║                                                      ║');
  console.log('║  💡 Nuvio → Settings → Addons → paste URL above     ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  console.log('📡 Data: https://streamed.pk');
  console.log('🎬 Watch proxy: ' + BASE_URL + '/watch?url=...');
  console.log('🔄 Cache: live=30s | today=5min | sport=2min');
  console.log('');
});
