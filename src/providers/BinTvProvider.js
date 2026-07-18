const axios = require('axios');
const BaseProvider = require('./BaseProvider');
const MatchEntity = require('../domain/MatchEntity');

class BinTvProvider extends BaseProvider {
  constructor(opts) {
    super(opts);
    this.name = 'BinTv';
    this.mainUrl = 'https://prabashsapkota.github.io/bintvjson/index.json';
    this.extraUrl = 'https://prabashsapkota.github.io/Streamed-images-json/index.json';
    
    this.fetchMain = this.circuitBreaker.wrap(`${this.name}_fetchMain`, async () => {
      const res = await axios.get(this.mainUrl, { timeout: 7000 });
      return res.data;
    });

    this.fetchExtra = this.circuitBreaker.wrap(`${this.name}_fetchExtra`, async () => {
      const res = await axios.get(this.extraUrl, { timeout: 7000 });
      return res.data;
    });
  }

  async getMatches() {
    const matches = [];

    // Main BinTV
    try {
      const data = await this.fetchMain.fire();
      if (Array.isArray(data)) {
        data.forEach((s, index) => {
          const title = s.name || s.title || `BinTV Event ${index}`;
          const sources = [];
          
          Object.keys(s).forEach(key => {
            if (key.startsWith('url_') && s[key]) {
              sources.push({
                source: 'bintv',
                id: key.replace('url_', '').trim(),
                url: s[key]
              });
            }
          });

          if (sources.length > 0) {
            matches.push(new MatchEntity({
              id: `bintv_${index}_${this.normalizeStr(title).substring(0, 10)}`,
              title: title,
              category: this.normalizeCategory(s.category),
              date: Date.now().toString(),
              popular: '0',
              sources: sources,
              thumbnail_url: s.logo || ''
            }));
          }
        });
      }
    } catch (e) {
      console.error(`[${this.name}] Error fetching main JSON:`, e.message);
    }

    // Extra BinTV (Streamed-Images JSON) is currently serving stale, months-old events (like Roland Garros).
    // We are skipping it to prevent the catalog from being cluttered with dead week-old streams.
    /*
    try {
      const extraData = await this.fetchExtra.fire();
      // ...
    } catch (e) {
      console.error(`[${this.name}] Error fetching extra JSON:`, e.message);
    }
    */

    return matches;
  }
}

module.exports = BinTvProvider;
