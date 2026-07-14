const { getAllMatches } = require('./api');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapMatchToMetaPreview(match) {
  // Use a generic placeholder poster
  const poster = 'https://raw.githubusercontent.com/stremio/stremio-addon-sdk/master/docs/api/images/stremio-logo.png';

  const dateObj = new Date(match.date);
  const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Add [LIVE] tag if popular/live
  const prefix = match.popular ? '🔴 [LIVE] ' : '';

  return {
    id: `nuvio_sport_${match.id}`, // Custom prefix to differentiate
    type: 'tv',
    name: `${prefix}${match.title}`,
    genres: [match.category],
    poster: poster,
    posterShape: 'landscape',
    background: poster,
    description: `Category: ${match.category}\nMatch Time: ${timeString}\nPopular: ${match.popular ? 'Yes' : 'No'}`,
  };
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleCatalog(type, id, extra) {
  if (type !== 'tv' || id !== 'nuvio_sports_catalog') {
    return { metas: [] };
  }

  const matches = await getAllMatches();
  const metas = matches.map(mapMatchToMetaPreview);

  // Stremio supports search in catalogs
  if (extra && extra.search) {
    const q = extra.search.toLowerCase();
    const filtered = metas.filter(m => m.name.toLowerCase().includes(q));
    return { metas: filtered };
  }

  return { metas };
}

async function handleMeta(type, id) {
  if (type !== 'tv' || !id.startsWith('nuvio_sport_')) {
    return { meta: null };
  }

  const matchId = id.replace('nuvio_sport_', '');
  const matches = await getAllMatches();
  const match = matches.find(m => m.id === matchId);

  if (!match) {
    return { meta: null };
  }

  const metaPreview = mapMatchToMetaPreview(match);
  return { meta: metaPreview };
}

module.exports = {
  handleCatalog,
  handleMeta
};
