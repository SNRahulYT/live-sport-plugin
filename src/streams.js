const container = require('./container');
const { BASE_URL } = require('./config');

async function handleStream(type, id) {
  if (type !== 'tv' || !id.startsWith('nuvio_sport_')) {
    return { streams: [] };
  }

  const matchId = id.replace('nuvio_sport_', '');
  
  const cacheService = container.resolve('cacheService');
  const matches = cacheService.getMatches();
  const match = matches.find(m => m.id === matchId);

  if (!match || !match.sources || match.sources.length === 0) {
    return { streams: [] };
  }

  const streams = [];

  const SOURCE_PRIORITY = { admin: 1, echo: 1, golf: 1, delta: 1, 'streamfree': 2, 'timstreams': 3, 'bintv': 4, 'ntv': 5, 'sportyhunter': 6, 'streamsports': 7, 'iptv-org': 8 };
  const sortedSources = [...match.sources].sort((a, b) => {
    // If a source isn't in the list, but it's not one of our known fallback providers, 
    // it's likely a new Streamed.pk source. Give it priority 1.5 so it stays near the top.
    const getPriority = (src) => SOURCE_PRIORITY[src] ?? (['streamfree', 'timstreams', 'bintv', 'ntv', 'sportyhunter', 'streamsports', 'iptv-org'].includes(src) ? 99 : 1.5);
    const pa = getPriority(a.source);
    const pb = getPriority(b.source);
    if (pa !== pb) return pa - pb;
    if (a.source === 'bintv' && b.source === 'bintv') {
      const aIsDirect = a.url && (a.url.includes('.m3u8') || (a.url.includes('noooooads/?src=') && a.url.includes('.m3u8')));
      const bIsDirect = b.url && (b.url.includes('.m3u8') || (b.url.includes('noooooads/?src=') && b.url.includes('.m3u8')));
      if (aIsDirect && !bIsDirect) return -1;
      if (!aIsDirect && bIsDirect) return 1;
    }
    return 0;
  });

  const m3u8Parser = container.resolve('m3u8Parser');
  const streamScorer = container.resolve('streamScorer');

  const resolvePromises = sortedSources.map(async (src) => {
    const sourceName = src.source;
    let resStreams = [];

    try {
      if (sourceName === 'streamfree') {
        const provider = container.resolve('streamFreeProvider');
        const sfCategory = src.original_category || match.category;
        resStreams = await provider.resolveStream(src.id, sfCategory, match.title);
        for (const s of resStreams) {
          if (s.url && s.url.startsWith('/api/hls')) {
            s.url = `${BASE_URL}${s.url}`;
          }
        }
      } else if (sourceName === 'timstreams') {
        const provider = container.resolve('timStreamsProvider');
        resStreams = await provider.resolveStream(src.id, match.category, match.title);
      } else if (sourceName === 'bintv') {
        const provider = container.resolve('binTvProvider');
        resStreams = await provider.resolveStream(src.id, match.category, match.title);
      } else if (sourceName === 'ntv') {
        const provider = container.resolve('ntvProvider');
        resStreams = await provider.resolveStream(src.id, match.category, match.title);
      } else if (sourceName === 'sportyhunter') {
        const provider = container.resolve('sportyHunterProvider');
        resStreams = await provider.resolveStream(src.id, match.category, match.title);
      } else if (sourceName === 'streamsports') {
        const provider = container.resolve('streamSportsProvider');
        resStreams = await provider.resolveStream(src.id, match.category, match.title);
      } else if (sourceName === 'iptv-org') {
        resStreams = [{
          name: 'Nuvio Direct',
          title: `24/7 TV (${src.quality || 'Auto'})`,
          url: src.url,
          resolution: src.quality
        }];
      } else {
        // Streamed.pk
        const provider = container.resolve('streamedPkProvider');
        resStreams = await provider.resolveStream(src.id, match.category, match.title, '1', sourceName);
      }

      for (const s of resStreams) {
        s.score = streamScorer.calculateScore(s, sourceName);
        s._source = sourceName;
      }
    } catch (e) {
      console.warn(`[streams.js] Error resolving ${sourceName} for ${src.id}:`, e.message);
    }
    
    return resStreams;
  });

  const results = await Promise.allSettled(resolvePromises);
  for (const result of results) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      streams.push(...result.value);
    }
  }

  // Standardize Stream Labels
  const sportIcons = {
    football: '⚽', cricket: '🏏', motorsport: '🏎️',
    basketball: '🏀', american_football: '🏈', rugby: '🏉', networks: '📺'
  };
  const icon = sportIcons[match.category] || '📡';
  
  const niceNames = {
    streamfree: 'StreamFree', timstreams: 'TimStreams', bintv: 'BinTV',
    ntv: 'NTV', sportyhunter: 'SportyHunter', streamsports: 'StreamSports',
    'iptv-org': 'Direct IPTV'
  };

  streams.forEach(s => {
    let quality = s.resolution || s.quality || 'Auto';
    if (quality.includes('x')) {
       const h = quality.split('x')[1];
       quality = h + 'p';
    }
    
    const isWeb = !!s.externalUrl || s.name === 'Nuvio Web Player';
    // The scorer attached the sourceName as _source in calculateScore? No, we didn't attach it.
    // Wait, streamScorer doesn't attach sourceName to s.
    // I can determine providerName from the string it already had.
    let providerName = niceNames[s._source] || niceNames[Object.keys(niceNames).find(k => s.title && s.title.toLowerCase().includes(k))] || 'Streamed.pk';
    
    if (s.title && s.title.toLowerCase().includes('timstreams')) providerName = 'TimStreams';
    else if (s.title && s.title.toLowerCase().includes('bintv')) providerName = 'BinTV';
    else if (s.title && s.title.toLowerCase().includes('ntv')) providerName = 'NTV';
    else if (s.title && s.title.toLowerCase().includes('sporty')) providerName = 'SportyHunter';
    else if (s.title && s.title.toLowerCase().includes('streamfree')) providerName = 'StreamFree';
    else if (s.title && s.title.toLowerCase().includes('24/7')) providerName = 'Direct IPTV';

    s.name = `${icon} Nuvio\n${providerName}`;
    
    const typeIndicator = isWeb ? '🌐 Web Stream' : '▶️ Direct Stream';
    s.title = `${typeIndicator}\n⚙️ Quality: ${quality} | ⭐️ Score: ${s.score || 0}`;
    
    // Add behaviorHints to group streams and handle CORS for direct streams
    s.behaviorHints = s.behaviorHints || {};
    s.behaviorHints.bingeGroup = `nuvio_sport_${matchId}`;
    
    // If it's a direct m3u8 stream and not routed through our proxy, mark it notWebReady
    if (s.url && s.url.includes('.m3u8') && !s.url.includes('/api/hls')) {
      s.behaviorHints.notWebReady = true;
      if (providerName === 'Streamed.pk') {
        s.behaviorHints.proxyHeaders = {
          request: {
            "Referer": "https://embed.st/",
            "Origin": "https://embed.st"
          }
        };
      }
    }
    
    // Add extra info if present
    if (providerName === 'Direct IPTV' && s.url) {
      s.title = `📺 24/7 Live Network\n⚙️ Quality: ${quality} | ⭐️ Score: ${s.score || 0}`;
    }
  });

  // Sort streams by score descending
  streams.sort((a, b) => b.score - a.score);

  // Return streams with cacheMaxAge: 0 to force Nuvio to fetch a fresh token every time!
  return { 
    streams, 
    cacheMaxAge: 0, 
    staleRevalidate: 0, 
    staleError: 0 
  };
}

module.exports = {
  handleStream
};
