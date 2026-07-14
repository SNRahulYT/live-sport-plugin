/**
 * index.js — Nuvio Live Sports Plugin Entry Point
 *
 * Bootstraps the Stremio addon server using stremio-addon-sdk.
 * Registers catalog, meta, and stream handlers, then starts the HTTP server.
 *
 * Install in Nuvio:
 *   1. Run: npm start
 *   2. Note the manifest URL printed to the console (e.g. http://localhost:7000/manifest.json)
 *   3. In Nuvio → Settings → Addons → paste the manifest URL → Install
 */

const { builder }       = require('./manifest');
const { handleCatalog, handleMeta } = require('./catalog');
const { handleStream }  = require('./streams');

// ─── Catalog Handler ─────────────────────────────────────────────────────────
// Called when Nuvio displays a catalog row (e.g. "Live Now", "Football")

builder.defineCatalogHandler(({ type, id, extra }) => {
  return handleCatalog(type, id, extra);
});

// ─── Meta Handler ────────────────────────────────────────────────────────────
// Called when Nuvio shows the detail/info screen for a specific match

builder.defineMetaHandler(({ type, id }) => {
  return handleMeta(type, id);
});

// ─── Stream Handler ──────────────────────────────────────────────────────────
// Called when the user clicks "Watch" on a match — returns playable stream URLs

builder.defineStreamHandler(({ type, id }) => {
  return handleStream(type, id);
});

// ─── Start the Server ────────────────────────────────────────────────────────

const PORT = process.env.PORT || 7000;

// serveHTTP() starts an Express server and returns a Promise
const addonInterface = builder.getInterface();

// Use the SDK's built-in serve function
const { serveHTTP } = require('stremio-addon-sdk');

serveHTTP(addonInterface, { port: PORT })
  .then(({ url }) => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║          🔴 Nuvio Live Sports Plugin                 ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  Server running on port: ${String(PORT).padEnd(27)}║`);
    console.log('║                                                      ║');
    console.log('║  📋 Manifest URL (copy this into Nuvio):             ║');
    console.log(`║  http://localhost:${PORT}/manifest.json${' '.repeat(Math.max(0, 32 - String(PORT).length))}║`);
    console.log('║                                                      ║');
    console.log('║  💡 Nuvio → Settings → Addons → paste URL above     ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📡 Streaming data from: https://streamed.pk');
    console.log('🔄 Live cache: 30s | Today cache: 5min | Sport cache: 2min');
    console.log('');
    console.log('Press Ctrl+C to stop the server.');
  })
  .catch(err => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });
