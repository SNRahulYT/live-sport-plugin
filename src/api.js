const axios = require('axios');

const STREAMED_API = 'https://streamed.pk/api';
const STREAMFREE_API = 'https://streamfree.top/streams';

function normalizeCategory(cat) {
  if (!cat) return 'other';
  cat = cat.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (cat.includes('soccer')) return 'football';
  if (cat.includes('motor')) return 'motorsport';
  if (cat.includes('american')) return 'american_football';
  return cat;
}

function normalizeStr(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isSameEvent(e1, e2) {
  if (e1.category !== e2.category) return false;
  
  // Check if dates are within 24 hours of each other
  const d1 = parseInt(e1.date) || 0;
  const d2 = parseInt(e2.date) || 0;
  if (d1 && d2 && Math.abs(d1 - d2) > 86400000) return false;

  // Exact ID match
  if (e1.id === e2.id) return true;

  // Fuzzy match on title
  const words1 = normalizeStr(e1.title).split(' ').filter(w => w.length > 2);
  const words2 = normalizeStr(e2.title).split(' ').filter(w => w.length > 2);
  
  let matches = 0;
  for (const w of words1) {
    if (words2.includes(w)) matches++;
  }
  
  const similarity = matches / Math.max(words1.length, words2.length, 1);
  return similarity >= 0.4;
}

/**
 * Fetch all active matches from both sources and merge them into unified events
 */
async function getAllMatches() {
  const unifiedEvents = [];

  // 1. Fetch from StreamFree.top (Primary - has logos)
  try {
    const freeRes = await axios.get(STREAMFREE_API, { timeout: 7000 });
    if (freeRes.data && freeRes.data.streams) {
      Object.entries(freeRes.data.streams).forEach(([category, streams]) => {
        if (Array.isArray(streams)) {
          streams.forEach(s => {
            const id = s.stream_key || s.id;
            unifiedEvents.push({
              id: id,
              title: s.name,
              category: normalizeCategory(category),
              date: (s.match_timestamp * 1000).toString(), 
              popular: (s.viewers || 0) > 100 ? '1' : '0',
              league: s.league,
              team1: s.team1,
              team2: s.team2,
              thumbnail_url: s.thumbnail_url,
              sources: [{ source: 'streamfree', id: id }]
            });
          });
        }
      });
    }
  } catch (error) {
    console.error('[API] Error fetching from StreamFree.top:', error.message);
  }

  // 2. Fetch from Streamed.pk (Secondary/Fallback) and group them
  try {
    const pkRes = await axios.get(`${STREAMED_API}/matches/all`, { timeout: 7000 });
    if (Array.isArray(pkRes.data)) {
      pkRes.data.forEach(s => {
        const pkEvent = {
          id: s.id,
          title: s.title,
          category: normalizeCategory(s.category),
          date: s.date,
          popular: s.popular,
          sources: s.sources || [],
          league: '',
          team1: null,
          team2: null,
          thumbnail_url: ''
        };

        // Try to find a matching event in unifiedEvents
        const existingMatch = unifiedEvents.find(e => isSameEvent(e, pkEvent));

        if (existingMatch) {
          // Merge sources
          existingMatch.sources = [...existingMatch.sources, ...pkEvent.sources];
          // Update popularity if needed
          if (pkEvent.popular === '1') existingMatch.popular = '1';
        } else {
          // If no match found, add as a new event
          unifiedEvents.push(pkEvent);
        }
      });
    }
  } catch (error) {
    console.error('[API] Error fetching from Streamed.pk:', error.message);
  }

  // 3. Fetch from BinTV (Third/Fallback) and group them
  try {
    const bintvRes = await axios.get('https://prabashsapkota.github.io/bintvjson/index.json', { timeout: 7000 });
    if (Array.isArray(bintvRes.data)) {
      bintvRes.data.forEach((s, index) => {
        const title = s.name || s.title || `BinTV Event ${index}`;
        
        // Extract sources from keys like 'url_Sky Sports'
        const bintvSources = [];
        Object.keys(s).forEach(key => {
          if (key.startsWith('url_') && s[key]) {
            const streamName = key.replace('url_', '').trim();
            bintvSources.push({
              source: 'bintv',
              id: streamName,
              url: s[key] // The direct URL, m3u8, or iframe
            });
          }
        });

        if (bintvSources.length === 0) return;

        const binEvent = {
          id: `bintv_${index}_${normalizeStr(title).substring(0, 10)}`,
          title: title,
          category: normalizeCategory(s.category),
          date: Date.now().toString(), // BinTV JSON doesn't provide precise unix timestamps, just 'Live' string
          popular: '0',
          sources: bintvSources,
          league: '',
          team1: null,
          team2: null,
          thumbnail_url: s.logo || ''
        };

        // Try to find a matching event in unifiedEvents
        const existingMatch = unifiedEvents.find(e => isSameEvent(e, binEvent));

        if (existingMatch) {
          existingMatch.sources = [...existingMatch.sources, ...binEvent.sources];
          if (!existingMatch.thumbnail_url && binEvent.thumbnail_url) {
            existingMatch.thumbnail_url = binEvent.thumbnail_url;
          }
        } else {
          unifiedEvents.push(binEvent);
        }
      });
    }
  } catch (error) {
    console.error('[API] Error fetching from BinTV:', error.message);
  }

  console.log(`[API] Fetched ${unifiedEvents.length} total events`);
  return unifiedEvents;
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
