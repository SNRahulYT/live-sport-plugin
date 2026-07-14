const { getAllMatches } = require('./api');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapMatchToMetaPreview(match) {
  // Generate a premium fallback image with placehold.co
  const safeTitle = encodeURIComponent((match.title || 'Live Match').substring(0, 30));
  const fallbackPoster = `https://placehold.co/800x450/111111/ef4444.png?text=${safeTitle}&font=Montserrat`;
  
  let poster = fallbackPoster;
  if (match.thumbnail_url) {
    poster = match.thumbnail_url.startsWith('http') ? match.thumbnail_url : `https://streamfree.top${match.thumbnail_url}`;
  }
  let background = poster;

  let dateObj = new Date();
  if (match.date && !isNaN(parseInt(match.date))) {
     dateObj = new Date(parseInt(match.date));
  } else if (match.date) {
     dateObj = new Date(match.date);
  }
  const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const prefix = match.popular === '1' ? '🔴 LIVE: ' : '';
  const cast = [];
  if (match.team1 && match.team1.name) cast.push(match.team1.name);
  if (match.team2 && match.team2.name) cast.push(match.team2.name);

  return {
    id: `nuvio_sport_${match.id}`,
    type: 'tv',
    name: `${prefix}${match.title}`,
    genres: [match.category.toUpperCase()],
    poster: poster,
    posterShape: 'landscape',
    background: background,
    logo: match.team1 && match.team1.logo ? match.team1.logo : null,
    releaseInfo: timeString,
    description: `🏆 League: ${match.league || 'Various'}\n📅 Category: ${match.category.toUpperCase()}\n⏰ Kickoff: ${timeString}`,
    cast: cast
  };
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleCatalog(type, id, extra) {
  if (type !== 'tv' || !id.startsWith('nuvio_sports_')) {
    return { metas: [] };
  }

  const categoryMatch = id.replace('nuvio_sports_', '');
  const matches = await getAllMatches();
  
  let filteredMatches = matches;
  if (categoryMatch === 'other') {
    const knownCats = ['football', 'cricket', 'motorsport', 'basketball', 'american_football'];
    filteredMatches = matches.filter(m => !knownCats.includes(m.category));
  } else if (categoryMatch !== 'catalog') {
    filteredMatches = matches.filter(m => m.category === categoryMatch);
  }

  // Smart Sorting
  const now = Date.now();
  filteredMatches.sort((a, b) => {
    const aIsLive = a.popular === '1' ? 1 : 0;
    const bIsLive = b.popular === '1' ? 1 : 0;
    
    // 1. Live events first
    if (aIsLive !== bIsLive) return bIsLive - aIsLive;
    
    // 2. Upcoming matches chronologically (closest first)
    const dateA = a.date ? parseInt(a.date) : 0;
    const dateB = b.date ? parseInt(b.date) : 0;
    
    return dateA - dateB;
  });

  let metas = filteredMatches.map(mapMatchToMetaPreview);

  // Deep Search
  if (extra && extra.search) {
    const q = extra.search.toLowerCase();
    metas = metas.filter(m => 
      m.name.toLowerCase().includes(q) || 
      (m.description && m.description.toLowerCase().includes(q)) ||
      (m.cast && m.cast.some(c => c.toLowerCase().includes(q)))
    );
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
