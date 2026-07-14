const axios = require('axios');

const STREAMED_API = 'https://streamed.pk/api';
const STREAMFREE_API = 'https://streamfree.top/streams';

/**
 * Fetch all active matches from both sources and merge them
 */
async function getAllMatches() {
  const matchMap = new Map(); // key = id/stream_key, value = match object

  // 1. Fetch from StreamFree.top (Primary - has logos)
  try {
    const freeRes = await axios.get(STREAMFREE_API, { timeout: 7000 });
    if (freeRes.data && freeRes.data.streams) {
      Object.entries(freeRes.data.streams).forEach(([category, streams]) => {
        if (Array.isArray(streams)) {
          streams.forEach(s => {
            const id = s.stream_key || s.id;
            matchMap.set(id, {
              id: id,
              title: s.name,
              category: category,
              // date is timestamp * 1000 to convert to ms
              date: (s.match_timestamp * 1000).toString(), 
              popular: (s.viewers || 0) > 100 ? '1' : '0',
              // Rich metadata
              league: s.league,
              team1: s.team1,
              team2: s.team2,
              thumbnail_url: s.thumbnail_url,
              // Map stream_key directly to the echo source used by embed.st
              sources: [{ source: 'echo', id: id }]
            });
          });
        }
      });
    }
  } catch (error) {
    console.error('[API] Error fetching from StreamFree.top:', error.message);
  }

  // 2. Fetch from Streamed.pk (Secondary/Fallback)
  try {
    const pkRes = await axios.get(`${STREAMED_API}/matches/all`, { timeout: 7000 });
    if (Array.isArray(pkRes.data)) {
      pkRes.data.forEach(s => {
        // Only add if not already present from StreamFree
        if (!matchMap.has(s.id)) {
          matchMap.set(s.id, {
            id: s.id,
            title: s.title,
            category: s.category,
            date: s.date,
            popular: s.popular,
            sources: s.sources || [],
            // Fallbacks for rich metadata
            league: '',
            team1: null,
            team2: null,
            thumbnail_url: ''
          });
        }
      });
    }
  } catch (error) {
    console.error('[API] Error fetching from Streamed.pk:', error.message);
  }

  return Array.from(matchMap.values());
}

/**
 * Get streams for a specific match ID
 * (Not used by new proxy resolver but kept for backwards compatibility if needed)
 */
async function getMatchStreams(matchId) {
  try {
    const res = await axios.get(`${STREAMED_API}/streams/match/${matchId}`, { timeout: 5000 });
    return res.data;
  } catch (error) {
    console.error(`[API] Error fetching streams for ${matchId}:`, error.message);
    return [];
  }
}

module.exports = {
  getAllMatches,
  getMatchStreams
};
