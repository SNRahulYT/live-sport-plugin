const { getAllMatches } = require('./api');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapMatchToMetaPreview(match) {
  // Use StreamFree thumbnail_url as the primary poster for a beautiful side-by-side graphic
  const genericPoster = 'https://raw.githubusercontent.com/stremio/stremio-addon-sdk/master/docs/api/images/stremio-logo.png';
  let poster = genericPoster;
  if (match.thumbnail_url) {
    poster = `https://streamfree.top${match.thumbnail_url}`;
  } else if (match.team1 && match.team1.logo) {
    poster = match.team1.logo;
  }

  // Use team2 logo or thumbnail as background
  let background = genericPoster;
  if (match.team2 && match.team2.logo) {
    background = match.team2.logo;
  } else if (match.thumbnail_url) {
    background = `https://streamfree.top${match.thumbnail_url}`;
  }

  // Convert the date
  let dateObj = new Date();
  if (match.date && !isNaN(parseInt(match.date))) {
     dateObj = new Date(parseInt(match.date));
  } else if (match.date) {
     dateObj = new Date(match.date);
  }
  const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Add [LIVE] tag if popular/live
  const prefix = match.popular === '1' ? '🔴 [LIVE] ' : '';

  return {
    id: `nuvio_sport_${match.id}`, // Custom prefix to differentiate
    type: 'tv',
    name: `${prefix}${match.title}`,
    genres: [match.category],
    poster: poster,
    posterShape: 'landscape', // ESPN logos are often transparent/square, landscape works best generally
    background: background,
    logo: match.team1 && match.team1.logo ? match.team1.logo : poster,
    description: `League: ${match.league || 'Unknown'}\nCategory: ${match.category}\nMatch Time: ${timeString}`,
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
