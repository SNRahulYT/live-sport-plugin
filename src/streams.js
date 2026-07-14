const axios = require('axios');
const { getMatchStreams, getAllMatches } = require('./api');
const { BASE_URL } = require('./config');

async function resolveStreamFree(category, streamKey) {
  try {
    const embedUrl = `https://streamfree.top/embed/${category}/${streamKey}`;
    const res = await axios.get(embedUrl, { timeout: 10000 });
    const html = res.data;

    // Extract the _0x token object from the HTML
    const match = html.match(/const\s+_0x\s*=\s*(\{.*?\});/);
    if (!match) {
      throw new Error("Could not find _0x tokens in StreamFree HTML");
    }

    const tokens = JSON.parse(match[1]);
    
    // Check available qualities in order of preference
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

    if (!bestQuality || !t) {
      throw new Error("No suitable stream qualities found in StreamFree tokens");
    }

    // Determine the server endpoint (default to origin)
    // We could call /get-stream-key to check if it's on a CDN, but it defaults to origin
    let serverRes;
    try {
      serverRes = await axios.get(`https://streamfree.top/get-stream-key/${streamKey}`, { timeout: 5000 });
    } catch (e) {
      serverRes = { data: { server_name: 'origin' } };
    }

    const serverName = serverRes.data && serverRes.data.server_name ? serverRes.data.server_name : 'origin';
    const baseUrl = serverName !== 'origin' 
      ? `https://streamfree.top/live-cdn/${streamKey}${bestQuality}/index.m3u8`
      : `https://streamfree.top/live/${streamKey}${bestQuality}/index.m3u8`;

    // Construct the authenticated m3u8 URL
    const targetUrl = `${baseUrl}?_t=${t._t}&_e=${t._e}&_n=${t._n}`;

    // Pass the streamfree target URL to our internal HLS proxy so it attaches the Referer header correctly
    // We use a dummy embed path `echo/streamfree/1` for the proxy to parse successfully
    const proxyUrlObj = new URL('http://localhost:3000/api/hls');
    proxyUrlObj.searchParams.set('url', targetUrl);
    proxyUrlObj.searchParams.set('embed', 'echo/streamfree/1');
    proxyUrlObj.searchParams.set('embedOrigin', 'https://streamfree.top');
    proxyUrlObj.searchParams.set('referer', 'https://streamfree.top/');

    const finalUrl = `${BASE_URL}${proxyUrlObj.pathname}${proxyUrlObj.search}`;

    return {
      name: `Nuvio HLS Proxy`,
      title: `StreamFree (${bestQuality})`,
      url: finalUrl
    };

  } catch (error) {
    console.error(`[Streams] StreamFree decryptor failed for ${streamKey}:`, error.message);
    return null;
  }
}

async function handleStream(type, id) {
  if (type !== 'tv' || !id.startsWith('nuvio_sport_')) {
    return { streams: [] };
  }

  const matchId = id.replace('nuvio_sport_', '');
  
  // First, get the match details to find its sources
  const matches = await getAllMatches();
  const match = matches.find(m => m.id === matchId);

  if (!match || !match.sources || match.sources.length === 0) {
    return { streams: [] };
  }

  const streams = [];

  for (const src of match.sources) {
    const sourceName = src.source; // e.g. "admin" or "echo" or "streamfree"
    const streamNo = '1'; // Assume stream 1 for now

    if (sourceName === 'streamfree') {
      const sfStream = await resolveStreamFree(match.category, src.id);
      if (sfStream) {
        streams.push(sfStream);
      }
      continue;
    }

    if (sourceName === 'bintv') {
      let url = src.url;
      
      // Clean up noooooads wrappers if they contain a direct m3u8 payload
      if (url.includes('noooooads/?src=') && url.includes('.m3u8')) {
        url = decodeURIComponent(url.split('?src=')[1]);
      }

      // 1. Direct M3U8 Links (e.g. Rumble CDN)
      if (url.includes('.m3u8')) {
        // Just return it natively!
        streams.push({
          name: 'Nuvio Direct',
          title: `BinTV (${src.id})`,
          url: url
        });
        continue;
      }
      
      // 2. StreamFree Links inside BinTV
      if (url.includes('streamfree.top/embed')) {
        try {
          const urlObj = new URL(url);
          const parts = urlObj.pathname.split('/').filter(Boolean);
          // e.g. /embed/cricket/skycricket -> parts = ['embed', 'cricket', 'skycricket']
          if (parts.length >= 3) {
            const cat = parts[1];
            const streamKey = parts[2];
            const sfStream = await resolveStreamFree(cat, streamKey);
            if (sfStream) {
              sfStream.title = `BinTV StreamFree (${src.id})`;
              streams.push(sfStream);
            }
          }
        } catch (e) {
          console.error('[Streams] Failed to parse BinTV StreamFree URL', url);
        }
        continue;
      }

      // 3. Unrecognized Embeds (e.g. dlhd.st, ritzembeds)
      // Use Stremio's externalUrl property alongside our /watch proxy
      const externalUrl = `${BASE_URL}/watch?url=${encodeURIComponent(url)}&title=${encodeURIComponent(match.title)}`;
      streams.push({
        name: 'Nuvio Web Player',
        title: `BinTV External (${src.id})`,
        externalUrl: externalUrl
      });
      continue;
    }

    // By passing the embed.st URL directly, we completely bypass the streamed.pk watch page
    // which doesn't exist for streamfree matches. The resolver will happily crack the lock!
    const watchUrl = `https://embed.st/embed/${sourceName}/${src.id}/${streamNo}`;
    
    try {
      // Call our internal stream resolver running on port 3000
      const resolveRes = await axios.post('http://localhost:3000/api/stream', { url: watchUrl }, { timeout: 15000 });
      
      if (resolveRes.data && resolveRes.data.relay) {
        // The resolver gives a relay URL like http://localhost:3000/api/hls?...
        // We must replace localhost:3000 with our BASE_URL since Nuvio needs the public URL.
        const relayUrl = resolveRes.data.relay;
        
        const proxyUrlObj = new URL(relayUrl);
        const finalUrl = `${BASE_URL}${proxyUrlObj.pathname}${proxyUrlObj.search}`;
        
        streams.push({
          name: `Nuvio HLS Proxy`,
          title: `Streamed.pk (${sourceName})`,
          url: finalUrl
        });
      }
    } catch (err) {
      console.error(`[Streams] Resolver failed for ${watchUrl}:`, err.message);
    }
  }

  return { streams };
}

module.exports = {
  handleStream
};
