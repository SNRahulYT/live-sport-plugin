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

  const SOURCE_PRIORITY = { admin: 1, echo: 1, golf: 1, delta: 1, 'streamfree': 2, 'timstreams': 3, 'bintv': 4 };
  const sortedSources = [...match.sources].sort((a, b) => {
    const pa = SOURCE_PRIORITY[a.source] ?? 99;
    const pb = SOURCE_PRIORITY[b.source] ?? 99;
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

  // Sort streams by score descending
  streams.sort((a, b) => b.score - a.score);

  return { streams };
}

module.exports = {
  handleStream
};
