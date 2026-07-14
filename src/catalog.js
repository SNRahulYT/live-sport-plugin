/**
 * catalog.js — Catalog & Meta Handlers (iptv-org edition)
 *
 * Serves the list of free sports TV channels from iptv-org.
 * Supports search (filter by name) and pagination (skip).
 */

const { getAllChannels, searchChannels, getChannelById, sanitizeId } = require('./api');

const PAGE_SIZE = 100;

/**
 * Transform an iptv-org channel into a Stremio MetaPreview object.
 * @param {Object} ch
 * @returns {Object}
 */
function channelToMeta(ch) {
  // Clean up channel name — strip resolution tags like "(720p)", "(1080p)"
  const cleanName = ch.name.replace(/\s*\(\d+p\)\s*/gi, '').trim();

  return {
    id:          `iptv-${sanitizeId(ch)}`,
    type:        'tv',
    name:        cleanName,
    poster:      ch.logo || null,
    posterShape: 'square',
    background:  ch.logo || null,
    logo:        ch.logo || null,
    description: `📡 Live Sports Channel\n${cleanName}`,
    releaseInfo: '🔴 LIVE',
    genres:      ['Live TV', 'Sports'],
  };
}

/**
 * Handle catalog requests from Nuvio.
 * Supports ?search=... to filter by channel name and ?skip=N for pagination.
 */
async function handleCatalog(type, id, extra) {
  console.log(`[Catalog] type=${type} id=${id} extra=${JSON.stringify(extra)}`);

  try {
    let channels;

    if (extra?.search) {
      // Search mode — filter by name
      channels = await searchChannels(extra.search);
      console.log(`[Catalog] Search "${extra.search}": ${channels.length} results`);
    } else {
      channels = await getAllChannels();
    }

    if (!channels || channels.length === 0) {
      return { metas: [] };
    }

    // Pagination
    const skip = parseInt(extra?.skip) || 0;
    const page = channels.slice(skip, skip + PAGE_SIZE);
    const metas = page.map(channelToMeta);

    console.log(`[Catalog] Returning ${metas.length} channels (skip=${skip})`);
    return { metas };

  } catch (err) {
    console.error('[Catalog] Error:', err.message);
    return { metas: [] };
  }
}

/**
 * Handle meta (detail screen) requests.
 */
async function handleMeta(type, id) {
  console.log(`[Meta] type=${type} id=${id}`);

  // Strip "iptv-" prefix to get our sanitized channel ID
  const channelId = id.replace(/^iptv-/, '');
  const ch = await getChannelById(channelId);

  if (!ch) {
    console.warn(`[Meta] Channel not found: ${channelId}`);
    return { meta: null };
  }

  return {
    meta: {
      ...channelToMeta(ch),
      runtime: 'Live',
      website: 'https://github.com/iptv-org/iptv',
    },
  };
}

module.exports = { handleCatalog, handleMeta };
