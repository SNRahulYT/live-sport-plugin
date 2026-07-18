const axios = require('axios');
const BaseProvider = require('./BaseProvider');
const MatchEntity = require('../domain/MatchEntity');
const StreamEntity = require('../domain/StreamEntity');

class StreamFreeProvider extends BaseProvider {
  constructor(opts) {
    super(opts);
    this.name = 'StreamFree';
    this.apiUrl = 'https://streamfree.top/streams';
    // Wrap the axios fetch with our circuit breaker
    this.fetchData = this.circuitBreaker.wrap(`${this.name}_fetch`, async () => {
      const res = await axios.get(this.apiUrl, { timeout: 7000 });
      return res.data;
    });
  }

  async getMatches() {
    const matches = [];
    try {
      const data = await this.fetchData.fire();
      if (!data || !data.streams) return [];

      Object.entries(data.streams).forEach(([category, streams]) => {
        if (Array.isArray(streams)) {
          streams.forEach(s => {
            const id = s.stream_key || s.id;
            matches.push(new MatchEntity({
              id: id,
              title: s.name,
              category: this.normalizeCategory(category),
              date: s.match_timestamp ? (s.match_timestamp * 1000).toString() : null,
              popular: (s.viewers || 0) > 100 ? '1' : '0',
              league: s.league,
              team1: s.team1,
              team2: s.team2,
              thumbnail_url: s.thumbnail_url,
              sources: [{ source: 'streamfree', id: id, original_category: category }]
            }));
          });
        }
      });
    } catch (error) {
      console.error(`[${this.name}] Error fetching matches:`, error.message);
    }
    return matches;
  }

  async resolveStream(sourceId, matchCategory, matchTitle) {
    try {
      // For StreamFree, we need the original category to resolve the stream
      const embedUrl = `https://streamfree.top/embed/${matchCategory}/${sourceId}`;
      const embedFetcher = this.circuitBreaker.wrap(`${this.name}_embed`, async () => {
        return axios.get(embedUrl, { timeout: 10000 }).then(r => r.data);
      });
      
      const html = await embedFetcher.fire();
      if (!html) return [];

      const match = html.match(/const\s+_0x\s*=\s*(\{.*?\});/);
      if (!match) throw new Error("Could not find _0x tokens in StreamFree HTML");

      const tokens = JSON.parse(match[1]);
      const prefs = ['1080p', '720p', '540p'];
      let bestQuality = null;
      let t = null;

      for (const q of prefs) {
        if (tokens[q]) {
          bestQuality = q;
          t = tokens[q];
          break;
        }
      }

      if (!bestQuality || !t) throw new Error("No suitable stream qualities found");

      // We skip the server check and just assume origin for now to save a request,
      // or we can wrap the server fetch in circuit breaker too.
      // Keeping it simple: assume origin
      const baseUrl = `https://streamfree.top/live/${sourceId}${bestQuality}/index.m3u8`;
      const targetUrl = `${baseUrl}?_t=${t._t}&_e=${t._e}&_n=${t._n}`;

      // Nuvio HLS Proxy URL
      const proxyUrlObj = new URL('http://localhost:3000/api/hls');
      proxyUrlObj.searchParams.set('url', targetUrl);
      proxyUrlObj.searchParams.set('embed', 'streamfree/live/1');
      proxyUrlObj.searchParams.set('embedOrigin', 'https://streamfree.top');
      proxyUrlObj.searchParams.set('referer', 'https://streamfree.top/');

      // We'll replace the base url dynamically when returning the streams in catalog.js
      return [new StreamEntity({
        name: 'Nuvio HLS Proxy',
        title: `StreamFree (${bestQuality})`,
        url: proxyUrlObj.pathname + proxyUrlObj.search, // Path only, so we can append BASE_URL later
        resolution: bestQuality
      })];
    } catch (error) {
      console.error(`[${this.name}] resolveStream failed for ${sourceId}:`, error.message);
      return [];
    }
  }
}

module.exports = StreamFreeProvider;
