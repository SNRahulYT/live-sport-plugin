const axios = require('axios');
const BaseProvider = require('./BaseProvider');
const MatchEntity = require('../domain/MatchEntity');

class TimStreamsProvider extends BaseProvider {
  constructor(opts) {
    super(opts);
    this.name = 'TimStreams';
    this.apiUrl = 'https://api.vixnuvew.uk/api/live-upcoming';
    
    this.fetchData = this.circuitBreaker.wrap(`${this.name}_fetch`, async () => {
      const res = await axios.get(this.apiUrl, { timeout: 7000 });
      return res.data;
    });
  }

  async getMatches() {
    const matches = [];
    try {
      const data = await this.fetchData.fire();
      if (!data || !Array.isArray(data.events)) return [];

      const genres = data.genres || {};
      
      data.events.forEach((s, index) => {
        const title = s.name || `TimStreams Event ${index}`;
        const genreLabel = genres[String(s.genre)] || 'other';
        const category = this.normalizeCategory(genreLabel);
        
        let dateMs = Date.now();
        if (s.time) {
          const parsed = new Date(s.time).getTime();
          if (!isNaN(parsed)) dateMs = parsed;
        }

        const sources = (s.streams || [])
          .filter(st => !st.vip)
          .map(st => ({
            source: 'timstreams',
            id: st.name || 'Stream',
            url: st.url
          }));

        if (sources.length > 0) {
          matches.push(new MatchEntity({
            id: `ts_${s.url || index}`,
            title: title,
            category: category,
            date: dateMs.toString(),
            popular: s.featured ? '1' : '0',
            sources: sources,
            thumbnail_url: s.logo || ''
          }));
        }
      });
    } catch (error) {
      console.error(`[${this.name}] Error fetching matches:`, error.message);
    }
    return matches;
  }
}

module.exports = TimStreamsProvider;
