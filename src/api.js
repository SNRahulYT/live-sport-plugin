const axios = require('axios');

const STREAMED_API = 'https://streamed.pk/api';

/**
 * Fetch all active matches from Streamed.pk
 */
async function getAllMatches() {
  try {
    const res = await axios.get(`${STREAMED_API}/matches/all`, { timeout: 5000 });
    if (!Array.isArray(res.data)) return [];
    
    // Some endpoints wrap in { data: [] } instead, depending on the route, 
    // but /matches/all returns an array directly on success.
    return res.data;
  } catch (error) {
    console.error('[API] Error fetching matches:', error.message);
    return [];
  }
}

/**
 * Get streams for a specific match ID
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
