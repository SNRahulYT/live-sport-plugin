const axios = require('axios');
const { getMatchStreams, getAllMatches } = require('./api');
const { BASE_URL } = require('./config');

async function handleStream(type, id) {
  if (type !== 'tv' || !id.startsWith('nuvio_sport_')) {
    return { streams: [] };
  }

  const matchId = id.replace('nuvio_sport_', '');
  
  // First, get the match details to find its sources
  const matches = await getAllMatches();
  const match = matches.find(m => m.id === matchId);

  if (!match || !match.sources || match.sources.length === 0) {
    return { streams: [] };
  }

  const streams = [];

    for (const src of match.sources) {
      const sourceName = src.source; // e.g. "admin" or "echo"
      const streamNo = '1'; // Assume stream 1 for now
  
      // By passing the embed.st URL directly, we completely bypass the streamed.pk watch page
      // which doesn't exist for streamfree matches. The resolver will happily crack the lock!
      const watchUrl = `https://embed.st/embed/${sourceName}/${src.id}/${streamNo}`;
      
      try {
      // Call our internal stream resolver running on port 3000
      const resolveRes = await axios.post('http://localhost:3000/api/stream', { url: watchUrl }, { timeout: 15000 });
      
      if (resolveRes.data && resolveRes.data.relay) {
        // The resolver gives a relay URL like http://localhost:3000/api/hls?...
        // We must replace localhost:3000 with our BASE_URL since Nuvio needs the public URL.
        const relayUrl = resolveRes.data.relay;
        
        const proxyUrlObj = new URL(relayUrl);
        const finalUrl = `${BASE_URL}${proxyUrlObj.pathname}${proxyUrlObj.search}`;
        
        streams.push({
          name: `Nuvio HLS Proxy`,
          title: `Streamed.pk (${sourceName})`,
          url: finalUrl
        });
      }
    } catch (err) {
      console.error(`[Streams] Resolver failed for ${watchUrl}:`, err.message);
    }
  }

  return { streams };
}

module.exports = {
  handleStream
};
