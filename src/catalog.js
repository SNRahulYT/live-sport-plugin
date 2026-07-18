const container = require('./container');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapMatchToMetaPreview(match) {
  const safeTitle = encodeURIComponent((match.title || 'Live Match').substring(0, 30));
  const fallbackPoster = `https://placehold.co/800x450/111111/ef4444.png?text=${safeTitle}&font=Montserrat`;
  
  let poster = fallbackPoster;
  if (match.thumbnail_url) {
    poster = match.thumbnail_url.startsWith('http') ? match.thumbnail_url : `https://streamfree.top${match.thumbnail_url}`;
  }
  let background = poster;

  let timeString = '24/7 Stream';
  if (match.date && !isNaN(parseInt(match.date)) && parseInt(match.date) > 0) {
     const dateObj = new Date(parseInt(match.date));
     timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

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
    description: `🏆 League: ${match.league || 'Various'}\n📅 Category: ${match.category.toUpperCase()}\n⏰ ${timeString === '24/7 Stream' ? 'Status: 24/7 Live Network' : 'Kickoff: ' + timeString}`,
    cast: cast
  };
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleCatalog(type, id, extra) {
  if (type !== 'tv' || !id.startsWith('nuvio_sports_')) {
    return { metas: [] };
  }

  const categoryMatch = id.replace('nuvio_sports_', '');
  
  // Use CacheService instead of hitting APIs on demand
  const cacheService = container.resolve('cacheService');
  const matches = cacheService.getMatches();
  
  let filteredMatches = matches;
  
  if (categoryMatch === 'live') {
    filteredMatches = matches.filter(m => m.popular === '1');
  } else if (categoryMatch === 'upcoming') {
    const now = Date.now();
    filteredMatches = matches.filter(m => {
      const kickoff = parseInt(m.date) || 0;
      return m.popular === '0' && kickoff > now;
    });
  } else if (categoryMatch === 'teams') {
    if (extra && extra.config && extra.config.teams) {
      const favoriteTeams = extra.config.teams.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
      filteredMatches = matches.filter(m => {
        const titleWords = m.title.toLowerCase();
        return favoriteTeams.some(team => titleWords.includes(team));
      });
    } else {
      filteredMatches = []; // If no config, return empty
    }
  } else if (categoryMatch === 'other') {
    const knownCats = ['football', 'cricket', 'motorsport', 'basketball', 'american_football', 'rugby', 'baseball', 'tennis', 'hockey', 'darts', 'golf'];
    filteredMatches = matches.filter(m => !knownCats.includes(m.category));
  } else if (categoryMatch !== 'catalog') {
    filteredMatches = matches.filter(m => m.category === categoryMatch);
  }

  filteredMatches = [...filteredMatches].sort((a, b) => {
    const aIsLive = a.popular === '1' ? 1 : 0;
    const bIsLive = b.popular === '1' ? 1 : 0;
    if (aIsLive !== bIsLive) return bIsLive - aIsLive;
    
    const dateA = a.date ? parseInt(a.date) : 0;
    const dateB = b.date ? parseInt(b.date) : 0;
    
    // Sort upcoming by closest first
    if (dateA > 0 && dateB > 0) return dateA - dateB;
    return 0;
  });

  let metas = filteredMatches.map(mapMatchToMetaPreview);

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
  const cacheService = container.resolve('cacheService');
  const matches = cacheService.getMatches();
  const match = matches.find(m => m.id === matchId);

  if (!match) {
    return { meta: null };
  }

  return { meta: mapMatchToMetaPreview(match) };
}

module.exports = {
  handleCatalog,
  handleMeta
};
