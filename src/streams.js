/**
 * streams.js — Stream Handler
 *
 * Handles requests for stream URLs for a specific match.
 * Nuvio calls this when the user selects a match and wants to watch it.
 *
 * Strategy (as chosen by the user):
 *  1. Try to extract a direct HLS (.m3u8) URL from the embed page → pass as
 *     stream.url so VLC / Nuvio's native player can play it
 *  2. Always also add an "Open in Browser" entry with stream.externalUrl
 *     pointing to the embed page — reliable fallback for all sources
 *
 * Stream priority order returned to Nuvio:
 *  1. HD + English (native HLS if extractable)
 *  2. HD + other language (native HLS if extractable)
 *  3. SD + English (native HLS if extractable)
 *  4. SD + other language (native HLS if extractable)
 *  5. "Open in Browser" entries (externalUrl) in same HD/language priority
 */

const fetch = require('node-fetch');
const { fetchStreams, findMatchById } = require('./api');

// ─── HLS URL Extraction ──────────────────────────────────────────────────────

/**
 * Patterns used to find an HLS manifest URL inside an embed page's HTML/JS.
 * We look for common variable names and URL patterns that video players use.
 */
const HLS_PATTERNS = [
  // Direct .m3u8 URL in quotes
  /["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*?)["'`]/g,
  // source: "url" patterns used by JWPlayer, Video.js etc.
  /file\s*:\s*["'`](https?:\/\/[^"'`\s]+)["'`]/g,
  /src\s*:\s*["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*?)["'`]/g,
];

/**
 * Attempt to fetch an embed page and extract a direct HLS stream URL from it.
 * Returns null if extraction fails or times out.
 *
 * @param {string} embedUrl  The embed page URL from Streamed.pk
 * @returns {Promise<string|null>}  Direct HLS URL, or null if not found
 */
async function extractHlsUrl(embedUrl) {
  if (!embedUrl) return null;

  try {
    const res = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://streamed.pk/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 6000,
    });

    if (!res.ok) return null;

    const html = await res.text();

    // Try each HLS pattern
    for (const pattern of HLS_PATTERNS) {
      pattern.lastIndex = 0; // reset regex state
      const match = pattern.exec(html);
      if (match && match[1]) {
        const url = match[1].trim();
        // Validate it looks like an HLS URL
        if (url.includes('.m3u8') || url.includes('playlist')) {
          console.log(`[Streams] Extracted HLS URL from embed: ${url.substring(0, 60)}…`);
          return url;
        }
      }
    }

    return null;
  } catch (err) {
    // Don't let HLS extraction failure break the whole stream handler
    console.warn(`[Streams] HLS extraction failed for ${embedUrl}: ${err.message}`);
    return null;
  }
}

// ─── Stream Sorting ──────────────────────────────────────────────────────────

/**
 * Sort streams: HD English first, then HD other, then SD English, then SD other.
 * @param {Object[]} streams  Streamed.pk stream objects
 * @returns {Object[]}
 */
function sortStreams(streams) {
  return [...streams].sort((a, b) => {
    const aScore = (a.hd ? 2 : 0) + (a.language?.toLowerCase() === 'english' ? 1 : 0);
    const bScore = (b.hd ? 2 : 0) + (b.language?.toLowerCase() === 'english' ? 1 : 0);
    return bScore - aScore; // descending — best first
  });
}

// ─── Stream Formatting ───────────────────────────────────────────────────────

/**
 * Format a source name for display (capitalize first letter).
 * @param {string} source  e.g. "alpha"
 * @returns {string}       e.g. "Alpha"
 */
function formatSource(source) {
  if (!source) return 'Unknown';
  return source.charAt(0).toUpperCase() + source.slice(1);
}

/**
 * Build a Stremio stream object for HLS (native) playback.
 * @param {Object} stream   Streamed.pk stream object
 * @param {string} hlsUrl   Extracted direct HLS URL
 * @returns {Object}
 */
function buildNativeStream(stream, hlsUrl) {
  const qualityBadge = stream.hd ? '🔵 HD' : '⚪ SD';
  const langFlag = stream.language || 'Unknown';
  const sourceName = formatSource(stream.source);

  return {
    name: `🔴 Live Sports\n${sourceName} · Stream ${stream.streamNo}`,
    title: `${qualityBadge} · ${langFlag} · Native Player`,
    url: hlsUrl,
    // Hint to Stremio/Nuvio that this is a live stream
    behaviorHints: {
      notWebReady: false,
      bingeGroup: null,
    },
  };
}

/**
 * Build a Stremio stream object for browser playback (externalUrl).
 * @param {Object} stream  Streamed.pk stream object
 * @returns {Object}
 */
function buildBrowserStream(stream) {
  const qualityBadge = stream.hd ? '🔵 HD' : '⚪ SD';
  const langFlag = stream.language || 'Unknown';
  const sourceName = formatSource(stream.source);

  return {
    name: `🌐 Open in Browser\n${sourceName} · Stream ${stream.streamNo}`,
    title: `${qualityBadge} · ${langFlag} · Browser Player`,
    externalUrl: stream.embedUrl,
  };
}

// ─── Main Stream Handler ─────────────────────────────────────────────────────

/**
 * Handle a stream request from Nuvio/Stremio.
 * Called when the user selects a match and Nuvio wants the playable URLs.
 *
 * @param {string} type  Always "tv"
 * @param {string} id    Item ID, e.g. "sports-football-123"
 * @returns {Promise<{ streams: Object[] }>}
 */
async function handleStream(type, id) {
  console.log(`[Streams] Handling request: type=${type}, id=${id}`);

  // Strip the "sports-" prefix to recover the original Streamed.pk match ID
  const matchId = id.replace(/^sports-/, '');

  // Find the match to get its sources list
  const match = await findMatchById(matchId);

  if (!match) {
    console.warn(`[Streams] Match not found: ${matchId}`);
    return { streams: [] };
  }

  const sources = match.sources || [];

  if (sources.length === 0) {
    console.warn(`[Streams] No sources available for match: ${matchId}`);
    return {
      streams: [{
        name: '⚠️ No Streams',
        title: 'No streams are available for this match yet.\nCheck back closer to kick-off.',
        externalUrl: 'https://streamed.pk',
      }],
    };
  }

  console.log(`[Streams] Fetching streams from ${sources.length} source(s) for match ${matchId}…`);

  // Fetch streams from all sources in parallel
  const streamFetches = sources.map(async src => {
    const streams = await fetchStreams(src.source, src.id);
    // Tag each stream with its source name (API may not always include it)
    return (streams || []).map(s => ({ ...s, source: s.source || src.source }));
  });

  const streamArrays = await Promise.all(streamFetches);
  const allStreams = streamArrays.flat();

  if (allStreams.length === 0) {
    console.warn(`[Streams] All sources returned empty for match: ${matchId}`);
    return {
      streams: [{
        name: '⚠️ No Streams Available',
        title: 'All sources returned no streams.\nThis match may not be streaming yet.',
        externalUrl: 'https://streamed.pk',
      }],
    };
  }

  // Sort: HD English first
  const sorted = sortStreams(allStreams);

  console.log(`[Streams] Processing ${sorted.length} stream(s), attempting HLS extraction…`);

  // For each stream: attempt HLS extraction, then build both stream entries
  const stremioStreams = [];

  // Process streams — attempt HLS extraction for each
  // We use Promise.allSettled so one failure doesn't block the others
  const results = await Promise.allSettled(
    sorted.map(async stream => {
      const hlsUrl = await extractHlsUrl(stream.embedUrl);
      return { stream, hlsUrl };
    })
  );

  for (const result of results) {
    if (result.status === 'rejected') continue;

    const { stream, hlsUrl } = result.value;

    // 1. If we extracted a direct HLS URL → add a native player stream
    if (hlsUrl) {
      stremioStreams.push(buildNativeStream(stream, hlsUrl));
    }

    // 2. Always add a browser fallback entry (externalUrl)
    if (stream.embedUrl) {
      stremioStreams.push(buildBrowserStream(stream));
    }
  }

  // If we somehow ended up with nothing (all embedUrls were null, etc.)
  if (stremioStreams.length === 0) {
    return {
      streams: [{
        name: '⚠️ Streams Unavailable',
        title: 'Could not load stream URLs. Try again later.',
        externalUrl: 'https://streamed.pk',
      }],
    };
  }

  console.log(`[Streams] Returning ${stremioStreams.length} stream option(s) for match ${matchId}`);
  return { streams: stremioStreams };
}

module.exports = { handleStream };
