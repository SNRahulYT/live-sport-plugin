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

  for (const src of sortedSources) {
    const sourceName = src.source; 

    if (sourceName === 'streamfree') {
      const provider = container.resolve('streamFreeProvider');
      const sfCategory = src.original_category || match.category;
      const resStreams = await provider.resolveStream(src.id, sfCategory, match.title);
      
      for (const s of resStreams) {
        if (s.url && s.url.startsWith('/api/hls')) {
          s.url = `${BASE_URL}${s.url}`;
        }
        s.score = streamScorer.calculateScore(s, sourceName);
        streams.push(s);
      }
      continue;
    }

    if (sourceName === 'timstreams') {
      let url = src.url;
      if (url && url.includes('.m3u8')) {
        const qualityInfo = await m3u8Parser.getHighestQuality(url);
        const titleSuffix = qualityInfo ? ` (${qualityInfo.label})` : ` (${src.id})`;
        const s = {
          name: 'Nuvio Direct',
          title: `TimStreams${titleSuffix}`,
          url: url,
          resolution: qualityInfo ? qualityInfo.resolution : null
        };
        s.score = streamScorer.calculateScore(s, sourceName);
        streams.push(s);
        continue;
      }
      const externalUrl = `${BASE_URL}/watch?url=${encodeURIComponent(url)}&title=${encodeURIComponent(match.title)}`;
      const s = {
        name: 'Nuvio Web Player',
        title: `TimStreams (${src.id})`,
        externalUrl: externalUrl
      };
      s.score = streamScorer.calculateScore(s, sourceName);
      streams.push(s);
      continue;
    }

    if (sourceName === 'bintv') {
      let url = src.url;
      if (url && url.includes('noooooads/?src=') && url.includes('.m3u8')) {
        url = decodeURIComponent(url.split('?src=')[1]);
      }
      if (url && url.includes('.m3u8')) {
        const qualityInfo = await m3u8Parser.getHighestQuality(url);
        const titleSuffix = qualityInfo ? ` (${qualityInfo.label})` : ` (${src.id})`;
        const s = {
          name: 'Nuvio Direct',
          title: `BinTV${titleSuffix}`,
          url: url,
          resolution: qualityInfo ? qualityInfo.resolution : null
        };
        s.score = streamScorer.calculateScore(s, sourceName);
        streams.push(s);
        continue;
      }
      if (url && url.includes('streamfree.top/embed')) {
        try {
          const urlObj = new URL(url);
          const parts = urlObj.pathname.split('/').filter(Boolean);
          if (parts.length >= 3) {
            const provider = container.resolve('streamFreeProvider');
            const resStreams = await provider.resolveStream(parts[2], parts[1], match.title);
            for (const s of resStreams) {
              if (s.url && s.url.startsWith('/api/hls')) {
                s.url = `${BASE_URL}${s.url}`;
              }
              s.title = `BinTV StreamFree (${s.resolution || 'Auto'})`;
              s.score = streamScorer.calculateScore(s, sourceName);
              streams.push(s);
            }
          }
        } catch (e) {}
        continue;
      }

      const externalUrl = `${BASE_URL}/watch?url=${encodeURIComponent(url)}&title=${encodeURIComponent(match.title)}`;
      const s = {
        name: 'Nuvio Web Player',
        title: `BinTV External (${src.id})`,
        externalUrl: externalUrl
      };
      s.score = streamScorer.calculateScore(s, sourceName);
      streams.push(s);
      continue;
    }

    if (sourceName === 'ntv') {
      const provider = container.resolve('ntvProvider');
      const resStreams = await provider.resolveStream(src.id, match.category, match.title);
      for (const s of resStreams) {
        s.score = streamScorer.calculateScore(s, sourceName);
        streams.push(s);
      }
      continue;
    }

    if (sourceName === 'sportyhunter') {
      const provider = container.resolve('sportyHunterProvider');
      const resStreams = await provider.resolveStream(src.id, match.category, match.title);
      for (const s of resStreams) {
        s.score = streamScorer.calculateScore(s, sourceName);
        streams.push(s);
      }
      continue;
    }

    if (sourceName === 'streamsports') {
      const provider = container.resolve('streamSportsProvider');
      const resStreams = await provider.resolveStream(src.id, match.category, match.title);
      for (const s of resStreams) {
        s.score = streamScorer.calculateScore(s, sourceName);
        streams.push(s);
      }
      continue;
    }

    if (sourceName === 'iptv-org') {
      const s = {
        name: 'Nuvio Direct',
        title: `24/7 TV (${src.quality || 'Auto'})`,
        url: src.url,
        resolution: src.quality
      };
      s.score = streamScorer.calculateScore(s, sourceName);
      streams.push(s);
      continue;
    }

    // Streamed.pk
    const provider = container.resolve('streamedPkProvider');
    const resStreams = await provider.resolveStream(src.id, match.category, match.title, '1', sourceName);
    for (const s of resStreams) {
      if (s.url && s.url.startsWith('/api/hls')) {
        s.url = `${BASE_URL}${s.url}`;
      }
      s.score = streamScorer.calculateScore(s, sourceName);
      streams.push(s);
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

    s.name = `${icon} Nuvio`;
    s.title = isWeb ? `🌐 [Web] ${providerName}` : `▶️ [${quality}] ${providerName}`;
    
    // Add extra info if present
    if (s.title.includes('Direct IPTV') && s.url) {
      s.title = `📺 [Live] 24/7 Network`;
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
