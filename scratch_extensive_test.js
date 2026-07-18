const container = require('./src/container');

async function testAll() {
  const providerKeys = ['streamFreeProvider', 'timStreamsProvider', 'ntvProvider', 'sportyHunterProvider', 'streamSportsProvider', 'iptvOrgProvider', 'binTvProvider', 'streamedPkProvider'];
  
  console.log('=== EXTENSIVE PROVIDER TEST ===\n');

  for (const key of providerKeys) {
    const provider = container.resolve(key);
    console.log(`--- Testing ${provider.name} ---`);
    try {
      const start = Date.now();
      const matches = await provider.getMatches();
      console.log(`✅ Matches Fetched: ${matches.length} (in ${Date.now() - start}ms)`);
      
      if (matches.length > 0) {
        // Randomly pick a match
        const m = matches[Math.floor(Math.random() * matches.length)];
        if (m.sources && m.sources.length > 0) {
           const src = m.sources[0];
           console.log(`Testing stream resolution for: ${m.title} (Source ID: ${src.id})`);
           const s_start = Date.now();
           let streamCount = 0;
           // If it's streamedPk, we might have a slightly different signature
           if (provider.name === 'StreamedPk') {
             try {
                const streams = await provider.resolveStream(src.id, m.category, m.title, '1', src.source);
                streamCount = streams.length;
                if (streamCount > 0) console.log(`  -> URL: ${streams[0].url || streams[0].externalUrl}`);
             } catch(e) { console.log(`  -> Error: ${e.message}`); }
           } else {
             try {
                const streams = await provider.resolveStream(src.id, m.category, m.title);
                streamCount = streams.length;
                if (streamCount > 0) console.log(`  -> URL: ${streams[0].url || streams[0].externalUrl}`);
             } catch(e) { console.log(`  -> Error: ${e.message}`); }
           }
           console.log(`✅ Streams Resolved: ${streamCount} (in ${Date.now() - s_start}ms)`);
        } else {
           console.log('⚠️ Match has no sources to resolve.');
        }
      }
    } catch (e) {
      console.log(`❌ Provider Failed: ${e.message}`);
    }
    console.log('\n');
  }
}

testAll();
