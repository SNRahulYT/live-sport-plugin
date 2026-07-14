/**
 * catalog.js — Catalog Handler
 *
 * Handles requests for browsable lists of sports matches.
 * Nuvio calls this when the user browses one of our sport categories.
 *
 * Flow:
 *  1. Nuvio sends a catalog request: { type: "tv", id: "football" }
 *  2. We fetch the appropriate matches from Streamed.pk
 *  3. We transform each match into a Stremio MetaPreview object
 *  4. Return { metas: [...] } — empty array if nothing found
 */

const {
  fetchLiveMatches,
  fetchTodayMatches,
  fetchAllMatches,
  fetchPopularMatches,
  fetchMatchesBySport,
  getBadgeUrl,
  getPosterUrl,
} = require('./api');

// ─── Sport Emoji Map ─────────────────────────────────────────────────────────
// Used to add a sport icon to match descriptions
const SPORT_EMOJI = {
  football:           '⚽',
  basketball:         '🏀',
  'american-football':'🏈',
  baseball:           '⚾',
  'ice-hockey':       '🏒',
  tennis:             '🎾',
  cricket:            '🏏',
  'motor-sports':     '🏎️',
  fight:              '🥊',
  golf:               '⛳',
  rugby:              '🏉',
  default:            '🏅',
};

/**
 * Format a Unix timestamp (milliseconds) as a readable local time string.
 * e.g. "Mon 14 Jul · 17:30"
 * @param {number} timestampMs
 * @returns {string}
 */
function formatMatchTime(timestampMs) {
  if (!timestampMs) return 'TBD';
  const date = new Date(timestampMs);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day  = days[date.getDay()];
  const d    = date.getDate();
  const mon  = months[date.getMonth()];
  const h    = String(date.getHours()).padStart(2, '0');
  const m    = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${d} ${mon} · ${h}:${m}`;
}

/**
 * Determine whether a match is currently live based on its date.
 * We treat a match as live if its start time is within the past 3 hours.
 * @param {number} timestampMs
 * @returns {boolean}
 */
function isMatchLive(timestampMs) {
  if (!timestampMs) return false;
  const now = Date.now();
  const threeHoursAgo = now - (3 * 60 * 60 * 1000);
  return timestampMs >= threeHoursAgo && timestampMs <= now + (60 * 1000);
}

/**
 * Transform a single Streamed.pk APIMatch into a Stremio MetaPreview object.
 *
 * @param {Object} match  APIMatch from Streamed.pk
 * @returns {Object}      Stremio MetaPreview
 */
function matchToMeta(match) {
  const emoji = SPORT_EMOJI[match.category] || SPORT_EMOJI.default;
  const live = isMatchLive(match.date);

  // Build poster: prefer home team badge, fallback to poster field
  const homeBadge = match.teams?.home?.badge;
  const awayBadge = match.teams?.away?.badge;
  const poster    = getBadgeUrl(homeBadge) || getPosterUrl(match.poster) || null;
  const background = getBadgeUrl(awayBadge) || null;

  // Build a readable description
  const timeStr = formatMatchTime(match.date);
  const sport   = match.category
    ? match.category.charAt(0).toUpperCase() + match.category.slice(1)
    : 'Sports';
  const streamCount = match.sources?.length || 0;
  const description = [
    `${emoji} ${sport}`,
    `⏰ ${timeStr}`,
    live ? '🔴 LIVE NOW' : '',
    streamCount > 0 ? `📡 ${streamCount} source${streamCount !== 1 ? 's' : ''} available` : '⚠️ No streams yet',
    match.teams?.home?.name && match.teams?.away?.name
      ? `${match.teams.home.name}  vs  ${match.teams.away.name}`
      : '',
  ].filter(Boolean).join('\n');

  return {
    // "sports-" prefix + original match ID — used by the stream handler to look up this match
    id: `sports-${match.id}`,
    type: 'tv',
    name: match.title || 'Unknown Match',
    poster,
    posterShape: 'square',
    background,
    logo: null,
    description,
    releaseInfo: live ? '🔴 LIVE' : timeStr,
    // Genres used for filtering/display in Nuvio
    genres: [
      sport,
      live ? 'Live Now' : 'Upcoming',
      match.popular ? 'Popular' : null,
    ].filter(Boolean),
  };
}

// ─── Main Catalog Handler ────────────────────────────────────────────────────

/**
 * Handle a catalog request from Nuvio/Stremio.
 *
 * @param {string} type   Always "tv" for this addon
 * @param {string} id     Catalog ID: "live", "today", "popular", or a sport slug
 * @param {Object} extra  Optional extra params (e.g. { skip: "0" })
 * @returns {Promise<{ metas: Object[] }>}
 */
async function handleCatalog(type, id, extra) {
  console.log(`[Catalog] Handling request: type=${type}, id=${id}`);

  let matches = [];

  try {
    // Dispatch to the correct API call based on catalog ID
    switch (id) {
      case 'live':
        matches = await fetchLiveMatches();
        break;
      case 'today':
        matches = await fetchTodayMatches();
        break;
      case 'popular':
        matches = await fetchPopularMatches();
        break;
      default:
        // Any other catalog ID is treated as a Streamed.pk sport slug
        matches = await fetchMatchesBySport(id);
        break;
    }
  } catch (err) {
    // Gracefully handle any unexpected errors — return empty catalog
    console.error(`[Catalog] Unexpected error for catalog "${id}":`, err.message);
    return { metas: [] };
  }

  // Handle null/undefined responses gracefully
  if (!Array.isArray(matches)) {
    console.warn(`[Catalog] API returned non-array for catalog "${id}". Returning empty.`);
    return { metas: [] };
  }

  if (matches.length === 0) {
    console.log(`[Catalog] No matches found for catalog "${id}".`);
    return { metas: [] };
  }

  // Handle pagination via "skip" extra param
  const skip = parseInt(extra?.skip) || 0;
  const PAGE_SIZE = 100; // Return up to 100 matches per page

  const paginated = matches.slice(skip, skip + PAGE_SIZE);
  const metas = paginated.map(matchToMeta);

  console.log(`[Catalog] Returning ${metas.length} matches for catalog "${id}" (skip=${skip})`);
  return { metas };
}

/**
 * Handle a meta request from Nuvio/Stremio.
 * Called when the user clicks on a match to see its detail page.
 *
 * @param {string} type  Always "tv"
 * @param {string} id    Item ID, e.g. "sports-football-123"
 * @returns {Promise<{ meta: Object }|null>}
 */
async function handleMeta(type, id) {
  console.log(`[Meta] Handling request: type=${type}, id=${id}`);

  // Strip our "sports-" prefix to get the original Streamed.pk match ID
  const matchId = id.replace(/^sports-/, '');

  // Search across live, today, and all matches
  const { findMatchById } = require('./api');
  const match = await findMatchById(matchId);

  if (!match) {
    console.warn(`[Meta] Match not found: ${matchId}`);
    return { meta: null };
  }

  const meta = matchToMeta(match);
  // Meta (detail view) can include more fields than MetaPreview
  return {
    meta: {
      ...meta,
      // Extra fields for the detail screen
      runtime: 'Live',
      country: null,
      website: 'https://streamed.pk',
    },
  };
}

module.exports = { handleCatalog, handleMeta };
