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
      const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36' };
      const res = await axios.get(this.apiUrl, { headers, timeout: 7000 });
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
        const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36' };
        const listRes = await axios.get(streamListUrl, { headers, timeout: 5000 });
        if (Array.isArray(listRes.data) && listRes.data.length > 0) {
          availableCount = listRes.data.length;
        }
      } catch (e) {
        console.warn(`[${this.name}] Could not fetch stream list for ${sourceName}/${sourceId}, defaulting to 1 stream`);
      }

      // 2. Resolve each available stream with a concurrency limit of 2 to prevent OOM
      const resolveTasks = [];
      for (let i = 1; i <= availableCount; i++) {
        const streamNo = i.toString();
        const watchUrl = `https://embed.st/embed/${sourceName}/${sourceId}/${streamNo}`;
        
        resolveTasks.push(async () => {
          try {
            const resolveRes = await axios.post('http://127.0.0.1:3000/api/stream', { url: watchUrl }, { timeout: 15000 });
            return { streamNo, data: resolveRes.data };
          } catch (err) {
            console.warn(`[${this.name}] resolve failed for ${watchUrl}:`, err.message);
            return null;
          }
        });
      }

      const results = [];
      for (let i = 0; i < resolveTasks.length; i += 2) {
        const chunk = resolveTasks.slice(i, i + 2).map(task => task());
        const chunkResults = await Promise.all(chunk);
        results.push(...chunkResults);
      }

      for (const res of results) {
        if (res && res.data) {
          if (res.data.m3u8) {
            const watchUrl = `https://embed.st/embed/${sourceName}/${sourceId}/${res.streamNo}`;
            const titleSuffix = availableCount > 1 ? ` (${sourceName} - Stream ${res.streamNo})` : ` (${sourceName})`;
            streams.push(new StreamEntity({
              name: `Nuvio Direct`,
              title: `Streamed.pk${titleSuffix}`,
              url: res.data.relay || res.data.m3u8,
              externalUrl: `/watch?url=${encodeURIComponent(watchUrl)}&title=${encodeURIComponent(matchTitle)}`
            }));
          } else {
            console.warn(`[${this.name}] resolve success but no m3u8. Data:`, res.data);
          }
        }
      }
    } catch (err) {
      console.error(`[${this.name}] resolveStream failed for ${sourceId}:`, err.message);
    }
    return streams;
  }
}

module.exports = StreamedPkProvider;
