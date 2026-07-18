const axios = require('axios');
const BaseProvider = require('./BaseProvider');
const MatchEntity = require('../domain/MatchEntity');
const StreamEntity = require('../domain/StreamEntity');

class BinTvProvider extends BaseProvider {
  constructor(opts) {
    super(opts);
    this.name = 'BinTv';
    // BINTV moved to ppv.st API
    this.mainUrl = 'https://api.ppv.st/api/streams';
    
    this.fetchMain = this.circuitBreaker.wrap(`${this.name}_fetchMain`, async () => {
      const res = await axios.get(this.mainUrl, { timeout: 10000 });
      return res.data;
    });
  }

  async getMatches() {
    const matches = [];

    try {
      const data = await this.fetchMain.fire();
      if (data && Array.isArray(data.streams)) {
        data.streams.forEach(categoryObj => {
          if (Array.isArray(categoryObj.streams)) {
            categoryObj.streams.forEach((s) => {
              const title = s.name || `Event ${s.id}`;
              const sources = [];
              
              if (s.iframe) {
                sources.push({
                  source: 'bintv',
                  id: s.uri_name || s.id.toString(),
                  url: s.iframe
                });
              }

              if (Array.isArray(s.substreams)) {
                s.substreams.forEach(sub => {
                  if (sub.iframe) {
                    sources.push({
                      source: 'bintv',
                      id: sub.uri_name || sub.id.toString(),
                      url: sub.iframe
                    });
                  }
                });
              }

              if (sources.length > 0) {
                let cat = s.category_name || categoryObj.category || 'other';
                matches.push(new MatchEntity({
                  id: `bintv_${s.id}`,
                  title: title,
                  category: this.normalizeCategory(cat),
                  date: s.starts_at ? (s.starts_at * 1000).toString() : Date.now().toString(),
                  popular: '0',
                  sources: sources,
                  thumbnail_url: s.poster || ''
                }));
              }
            });
          }
        });
      }
    } catch (e) {
      console.error(`[${this.name}] Error fetching PPV JSON:`, e.message);
    }

    return matches;
  }

  async resolveStream(sourceId, matchCategory, matchTitle) {
    const streams = [];
    try {
      const matches = await this.getMatches();
      const match = matches.find(m => m.id === `bintv_${sourceId}` || m.sources.some(s => s.id === sourceId));
      let watchUrl = '';
      
      if (match) {
        const src = match.sources.find(s => s.id === sourceId);
        if (src && src.url) watchUrl = src.url;
      }
      
      if (watchUrl) {
        streams.push(new StreamEntity({
          name: `Nuvio Web Player`,
          title: `BinTV (${sourceId.split('/').pop()})`,
          externalUrl: `/watch?url=${encodeURIComponent(watchUrl)}&title=${encodeURIComponent(matchTitle || 'Live Event')}`
        }));
      }
    } catch (err) {
      console.error(`[${this.name}] resolveStream failed for ${sourceId}:`, err.message);
    }
    return streams;
  }
}

module.exports = BinTvProvider;
