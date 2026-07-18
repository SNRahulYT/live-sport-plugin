const axios = require('axios');
const BaseProvider = require('./BaseProvider');
const MatchEntity = require('../domain/MatchEntity');
const StreamEntity = require('../domain/StreamEntity');

class StreamedPkProvider extends BaseProvider {
  constructor(opts) {
    super(opts);
    this.name = 'StreamedPk';
    
    // Support dynamic domain fallback if streamed.pk changes
    const domain = process.env.STREAMED_ORIGIN || 'https://streamed.pk';
    this.apiUrl = `${domain}/api/matches/all`;
    
    this.fetchData = this.circuitBreaker.wrap(`${this.name}_fetch`, async () => {
      const res = await axios.get(this.apiUrl, { timeout: 7000 });
      return res.data;
    });
  }

  async getMatches() {
    const matches = [];
    try {
      const data = await this.fetchData.fire();
      if (!Array.isArray(data)) return [];

      data.forEach(s => {
        matches.push(new MatchEntity({
          id: s.id,
          title: s.title,
          category: this.normalizeCategory(s.category),
          date: s.date,
          popular: s.popular,
          sources: s.sources || []
        }));
      });
    } catch (error) {
      console.error(`[${this.name}] Error fetching matches:`, error.message);
    }
    return matches;
  }

  async resolveStream(sourceId, matchCategory, matchTitle, streamNoParam = null, sourceName = 'admin') {
    const streams = [];
    try {
      // 1. Fetch available streams for this source/id to know how many there are
      const domain = process.env.STREAMED_ORIGIN || 'https://streamed.pk';
      const streamListUrl = `${domain}/api/stream/${sourceName}/${sourceId}`;
      let availableCount = 1; // fallback to 1 if we can't fetch the list
      
      try {
        const listRes = await axios.get(streamListUrl, { timeout: 5000 });
        if (Array.isArray(listRes.data) && listRes.data.length > 0) {
          availableCount = listRes.data.length;
        }
      } catch (e) {
        console.warn(`[${this.name}] Could not fetch stream list for ${sourceName}/${sourceId}, defaulting to 1 stream`);
      }

      // 2. Resolve each available stream
      for (let i = 1; i <= availableCount; i++) {
        const streamNo = i.toString();
        const watchUrl = `https://embed.st/embed/${sourceName}/${sourceId}/${streamNo}`;
        
        const resolveRes = await axios.post('http://localhost:3000/api/stream', { url: watchUrl }, { timeout: 15000 });
        
        if (resolveRes.data && resolveRes.data.relay) {
          const proxyUrlObj = new URL(resolveRes.data.relay);
          const titleSuffix = availableCount > 1 ? ` (${sourceName} - Stream ${streamNo})` : ` (${sourceName})`;
          streams.push(new StreamEntity({
            name: `Nuvio HLS Proxy`,
            title: `Streamed.pk${titleSuffix}`,
            url: proxyUrlObj.pathname + proxyUrlObj.search
          }));
        }
      }
    } catch (err) {
      console.error(`[${this.name}] resolveStream failed for ${sourceId}:`, err.message);
    }
    return streams;
  }
}

module.exports = StreamedPkProvider;
