const axios = require('axios');
const BaseProvider = require('./BaseProvider');
const MatchEntity = require('../domain/MatchEntity');
const StreamEntity = require('../domain/StreamEntity');

class StreamedPkProvider extends BaseProvider {
  constructor(opts) {
    super(opts);
    this.name = 'StreamedPk';
    this.apiUrl = 'https://streamed.pk/api/matches/all';
    
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

  async resolveStream(sourceId, matchCategory, matchTitle, streamNo = '1', sourceName = 'admin') {
    try {
      // By passing the embed.st URL directly, we completely bypass the streamed.pk watch page
      const watchUrl = `https://embed.st/embed/${sourceName}/${sourceId}/${streamNo}`;
      
      const resolveRes = await axios.post('http://localhost:3000/api/stream', { url: watchUrl }, { timeout: 15000 });
      
      if (resolveRes.data && resolveRes.data.relay) {
        const proxyUrlObj = new URL(resolveRes.data.relay);
        return [new StreamEntity({
          name: `Nuvio HLS Proxy`,
          title: `Streamed.pk (${sourceName})`,
          url: proxyUrlObj.pathname + proxyUrlObj.search
        })];
      }
    } catch (err) {
      console.error(`[${this.name}] resolveStream failed for ${sourceId}:`, err.message);
    }
    return [];
  }
}

module.exports = StreamedPkProvider;
