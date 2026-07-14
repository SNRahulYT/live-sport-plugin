/**
 * api.js — iptv-org Sports Channel API Client
 *
 * Fetches and parses the free, public sports M3U playlist from iptv-org.
 * All streams are direct HLS (.m3u8) URLs — no embeds, no browser needed.
 * Plays natively inside Nuvio's built-in player.
 *
 * Data sources:
 *   Channels (metadata + logos): https://iptv-org.github.io/api/channels.json
 *   Streams  (m3u8 URLs):        https://iptv-org.github.io/api/streams.json
 *   Sports M3U playlist:         https://iptv-org.github.io/iptv/categories/sports.m3u
 *
 * We use the M3U playlist as the primary source because it already combines
 * channel metadata + stream URLs in one file, making parsing very simple.
 */

const fetch = require('node-fetch');

// ─── Source URLs ─────────────────────────────────────────────────────────────

const SPORTS_M3U_URL = 'https://iptv-org.github.io/iptv/categories/sports.m3u';

// Cache TTL: refresh sports list every 6 hours (it changes infrequently)
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// ─── In-Memory Cache ──────────────────────────────────────────────────────────

let cachedChannels = null;
let cacheTimestamp = 0;

// ─── M3U Parser ───────────────────────────────────────────────────────────────

/**
 * Parse an M3U playlist string into an array of channel objects.
 * Each channel has: { id, name, logo, groupTitle, url, userAgent }
 *
 * M3U format example:
 *   #EXTINF:-1 tvg-id="ESPN.us" tvg-logo="https://..." group-title="Sports",ESPN (720p)
 *   https://example.com/stream.m3u8
 *
 * @param {string} m3uText  Raw M3U playlist text
 * @returns {Object[]}
 */
function parseM3U(m3uText) {
  const channels = [];
  const lines = m3uText.split('\n').map(l => l.trim()).filter(Boolean);

  let currentMeta = null;
  let currentUserAgent = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('#EXTINF')) {
      // Parse the EXTINF metadata line
      // Extract tvg-id
      const idMatch   = line.match(/tvg-id="([^"]+)"/);
      // Extract tvg-logo
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      // Extract group-title
      const groupMatch = line.match(/group-title="([^"]+)"/);
      // Channel name is after the last comma
      const nameMatch = line.match(/,(.+)$/);

      currentMeta = {
        id:         idMatch   ? idMatch[1]   : '',
        logo:       logoMatch ? logoMatch[1] : null,
        group:      groupMatch ? groupMatch[1] : 'Sports',
        name:       nameMatch ? nameMatch[1].trim() : 'Unknown Channel',
        userAgent:  null,
      };
      currentUserAgent = null;

    } else if (line.startsWith('#EXTVLCOPT:http-user-agent=')) {
      // Some streams require a specific User-Agent header
      currentUserAgent = line.replace('#EXTVLCOPT:http-user-agent=', '').trim();

    } else if (line.startsWith('http') && currentMeta) {
      // This is the actual stream URL
      channels.push({
        ...currentMeta,
        userAgent: currentUserAgent || null,
        url: line,
      });
      currentMeta = null;
      currentUserAgent = null;

    } else if (line.startsWith('#')) {
      // Other comment lines — ignore
    }
  }

  return channels;
}

// ─── Fetch & Cache ────────────────────────────────────────────────────────────

/**
 * Fetch the iptv-org sports M3U playlist, parse it, and cache the result.
 * Returns the cached version if it's still fresh (within CACHE_TTL_MS).
 *
 * @returns {Promise<Object[]>}  Array of parsed channel objects
 */
async function fetchSportsChannels() {
  const now = Date.now();

  // Return cache if still valid
  if (cachedChannels && (now - cacheTimestamp) < CACHE_TTL_MS) {
    console.log(`[API] Returning ${cachedChannels.length} cached channels`);
    return cachedChannels;
  }

  console.log('[API] Fetching fresh sports channel list from iptv-org...');

  const attempt = async () => {
    const res = await fetch(SPORTS_M3U_URL, {
      headers: { 'User-Agent': 'NuvioLiveSports/2.0' },
      timeout: 15000,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return parseM3U(text);
  };

  try {
    const channels = await attempt();
    cachedChannels = channels;
    cacheTimestamp = now;
    console.log(`[API] Loaded ${channels.length} sports channels`);
    return channels;
  } catch (err) {
    console.warn(`[API] Fetch failed: ${err.message}. Retrying in 2s...`);
    await new Promise(r => setTimeout(r, 2000));
    try {
      const channels = await attempt();
      cachedChannels = channels;
      cacheTimestamp = now;
      console.log(`[API] Loaded ${channels.length} sports channels (retry)`);
      return channels;
    } catch (retryErr) {
      console.error(`[API] Retry failed: ${retryErr.message}`);
      // Return stale cache if available rather than empty
      if (cachedChannels) {
        console.warn('[API] Returning stale cache as fallback');
        return cachedChannels;
      }
      return [];
    }
  }
}

/**
 * Get all sports channels.
 * @returns {Promise<Object[]>}
 */
async function getAllChannels() {
  return fetchSportsChannels();
}

/**
 * Search channels by name (case-insensitive).
 * @param {string} query
 * @returns {Promise<Object[]>}
 */
async function searchChannels(query) {
  const channels = await fetchSportsChannels();
  const q = query.toLowerCase();
  return channels.filter(ch => ch.name.toLowerCase().includes(q));
}

/**
 * Get a single channel by its sanitized ID.
 * @param {string} channelId
 * @returns {Promise<Object|null>}
 */
async function getChannelById(channelId) {
  const channels = await fetchSportsChannels();
  return channels.find(ch => sanitizeId(ch) === channelId) || null;
}

/**
 * Create a safe, unique ID for a channel to use in Nuvio item IDs.
 * Replaces non-alphanumeric chars with hyphens.
 * @param {Object} channel
 * @returns {string}
 */
function sanitizeId(channel) {
  // Use tvg-id if available, otherwise derive from name
  const base = channel.id || channel.name;
  return base.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

module.exports = { getAllChannels, searchChannels, getChannelById, sanitizeId };
