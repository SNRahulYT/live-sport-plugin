/**
 * api.js — Streamed.pk API Client
 *
 * All communication with the Streamed.pk public REST API lives here.
 * Includes a simple in-memory TTL cache to avoid hammering the API on
 * every Nuvio catalog refresh, and a single-retry strategy on failure.
 *
 * Base URL: https://streamed.pk/api
 * Auth:     None required
 */

const fetch = require('node-fetch');

const BASE_URL = 'https://streamed.pk/api';

// ─── In-Memory TTL Cache ────────────────────────────────────────────────────

/**
 * Cache store: Map of cacheKey → { data, expiresAt }
 * Entries expire after their individual TTL in milliseconds.
 */
const cache = new Map();

/**
 * Retrieve a cached value if still valid, otherwise return null.
 * @param {string} key
 * @returns {any|null}
 */
function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Store a value in cache with a TTL.
 * @param {string} key
 * @param {any} data
 * @param {number} ttlMs  Time-to-live in milliseconds
 */
function cacheSet(key, data, ttlMs) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ─── TTL Constants ───────────────────────────────────────────────────────────

const TTL = {
  LIVE:    30  * 1000,  //  30 seconds  — live matches change frequently
  TODAY:    5  * 60 * 1000,  //  5 minutes  — today's schedule
  ALL:      5  * 60 * 1000,  //  5 minutes  — all upcoming matches
  SPORT:    2  * 60 * 1000,  //  2 minutes  — per-sport matches
  STREAMS: 30  * 1000,       //  30 seconds — stream availability
};

// ─── Core Fetch with Retry ───────────────────────────────────────────────────

/**
 * Fetch a JSON endpoint from Streamed.pk with a single retry on failure.
 * Returns [] on repeated failure so callers always get an array.
 *
 * @param {string} url      Full URL to fetch
 * @param {string} cacheKey Unique key for caching this response
 * @param {number} ttlMs    Cache TTL in milliseconds
 * @returns {Promise<any[]>}
 */
async function apiFetch(url, cacheKey, ttlMs) {
  // Return cached data if available
  const cached = cacheGet(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const attempt = async () => {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NuvioLiveSports/1.0' },
      timeout: 8000,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  };

  try {
    // First attempt
    const data = await attempt();
    cacheSet(cacheKey, data, ttlMs);
    return data;
  } catch (err) {
    console.warn(`[API] First attempt failed for ${url}: ${err.message}. Retrying in 1s…`);
    await new Promise(r => setTimeout(r, 1000));
    try {
      // Single retry
      const data = await attempt();
      cacheSet(cacheKey, data, ttlMs);
      return data;
    } catch (retryErr) {
      console.error(`[API] Retry also failed for ${url}: ${retryErr.message}. Returning [].`);
      return [];
    }
  }
}

// ─── Public API Methods ──────────────────────────────────────────────────────

/**
 * Get all currently live matches.
 * @returns {Promise<import('./types').APIMatch[]>}
 */
async function fetchLiveMatches() {
  return apiFetch(`${BASE_URL}/matches/live`, 'live', TTL.LIVE);
}

/**
 * Get all matches scheduled for today.
 * @returns {Promise<import('./types').APIMatch[]>}
 */
async function fetchTodayMatches() {
  return apiFetch(`${BASE_URL}/matches/all-today`, 'today', TTL.TODAY);
}

/**
 * Get all upcoming/available matches.
 * @returns {Promise<import('./types').APIMatch[]>}
 */
async function fetchAllMatches() {
  return apiFetch(`${BASE_URL}/matches/all`, 'all', TTL.ALL);
}

/**
 * Get live popular matches only.
 * @returns {Promise<import('./types').APIMatch[]>}
 */
async function fetchPopularMatches() {
  return apiFetch(`${BASE_URL}/matches/live/popular`, 'popular', TTL.LIVE);
}

/**
 * Get matches filtered by sport category.
 * @param {string} sport  e.g. "football", "basketball", "tennis"
 * @returns {Promise<import('./types').APIMatch[]>}
 */
async function fetchMatchesBySport(sport) {
  return apiFetch(`${BASE_URL}/matches/${sport}`, `sport-${sport}`, TTL.SPORT);
}

/**
 * Get stream links for a specific match source.
 * @param {string} source  e.g. "alpha", "bravo"
 * @param {string} id      Source-specific match ID
 * @returns {Promise<import('./types').Stream[]>}
 */
async function fetchStreams(source, id) {
  return apiFetch(`${BASE_URL}/stream/${source}/${id}`, `stream-${source}-${id}`, TTL.STREAMS);
}

/**
 * Find a specific match by its original Streamed.pk ID.
 * Searches live → today → all matches in that priority order.
 * Returns null if the match cannot be found.
 *
 * @param {string} matchId  Original Streamed.pk match ID
 * @returns {Promise<import('./types').APIMatch|null>}
 */
async function findMatchById(matchId) {
  // Search in order of most-likely-live first
  const searchSets = [
    () => fetchLiveMatches(),
    () => fetchTodayMatches(),
    () => fetchAllMatches(),
  ];

  for (const fetchSet of searchSets) {
    const matches = await fetchSet();
    const found = matches.find(m => m.id === matchId);
    if (found) return found;
  }

  return null;
}

/**
 * Build a full image URL for a badge path returned by the Streamed.pk API.
 * @param {string} badgePath  e.g. "man-utd-badge"
 * @returns {string}
 */
function getBadgeUrl(badgePath) {
  if (!badgePath) return null;
  // Some API responses already return full URLs
  if (badgePath.startsWith('http')) return badgePath;
  return `${BASE_URL}/images/badge/${badgePath}`;
}

/**
 * Build a full image URL for a poster path returned by the Streamed.pk API.
 * @param {string} posterPath  e.g. "football-poster"
 * @returns {string}
 */
function getPosterUrl(posterPath) {
  if (!posterPath) return null;
  if (posterPath.startsWith('http')) return posterPath;
  return `${BASE_URL}/images/poster/${posterPath}`;
}

module.exports = {
  fetchLiveMatches,
  fetchTodayMatches,
  fetchAllMatches,
  fetchPopularMatches,
  fetchMatchesBySport,
  fetchStreams,
  findMatchById,
  getBadgeUrl,
  getPosterUrl,
};
