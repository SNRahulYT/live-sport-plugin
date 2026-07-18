const container = require('./container');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapMatchToMetaPreview(match) {
  const safeTitle = encodeURIComponent((match.title || 'Live Match').substring(0, 30));
  
  // Dynamic Sport-Specific Posters
  const categoryColors = {
    football: '10b981', // green
    basketball: 'f97316', // orange
    motorsport: 'ef4444', // red
    cricket: '0ea5e9', // light blue
    tennis: 'a3e635', // lime
    rugby: '8b5cf6', // purple
    american_football: '0369a1', // dark blue
    baseball: 'f43f5e', // rose
    hockey: '06b6d4', // cyan
    golf: '22c55e', // emerald
    darts: 'eab308', // yellow
    networks: '64748b' // slate
  };
  const color = categoryColors[match.category] || '333333';
  const fallbackPoster = `https://placehold.co/800x450/111111/${color}.png?text=${safeTitle}&font=Montserrat`;
  
  let poster = fallbackPoster;
  if (match.thumbnail_url) {
    poster = match.thumbnail_url.startsWith('http') ? match.thumbnail_url : `https://streamfree.top${match.thumbnail_url}`;
  }
  let background = poster;

  let timeString = '24/7 Stream';
  let relativeTimeStr = '';
  
  if (match.date && !isNaN(parseInt(match.date)) && parseInt(match.date) > 0) {
     const dateObj = new Date(parseInt(match.date));
     timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
     
     const now = Date.now();
     const diff = dateObj.getTime() - now;
     if (diff > 0 && match.popular === '0') {
       const hours = Math.floor(diff / (1000 * 60 * 60));
       const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
       if (hours > 24) {
         relativeTimeStr = ` (in ${Math.floor(hours / 24)} days)`;
       } else if (hours > 0) {
         relativeTimeStr = ` (in ${hours}h ${minutes}m)`;
       } else {
         relativeTimeStr = ` (in ${minutes} mins)`;
       }
     }
  }

  const prefix = match.popular === '1' ? '🔴 LIVE: ' : '⏱️ ';
  const cast = [];
  if (match.team1 && match.team1.name) cast.push(match.team1.name);
  if (match.team2 && match.team2.name) cast.push(match.team2.name);

  const leagueStr = match.league ? `🏆 **League:** ${match.league}\n` : '';
  const desc = `${leagueStr}📅 **Category:** ${match.category.toUpperCase()}\n⏰ **Status:** ${timeString === '24/7 Stream' ? '24/7 Live Network' : 'Kickoff at ' + timeString + relativeTimeStr}`;

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
    description: desc,
    cast: cast,
    behaviorHints: {
      defaultVideoId: `nuvio_sport_${match.id}`
    }
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
  
  if (extra && extra.config && extra.config.sports && extra.config.sports !== 'all') {
    const allowedSports = extra.config.sports.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    // Don't filter out networks (24/7 TV) since they aren't tied to a specific sport
    filteredMatches = filteredMatches.filter(m => m.category === 'networks' || allowedSports.includes(m.category) || allowedSports.includes('other'));
  }
  
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
