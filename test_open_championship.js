const container = require('./src/container');

async function testStreamedPk() {
  const provider = container.resolve('streamedPkProvider');
  console.log('Fetching matches from Streamed.pk...');
  const matches = await provider.getMatches();
  console.log(`Found ${matches.length} matches.`);

  const match = matches.find(m => m.title.toLowerCase().includes('chicago cubs'));
  if (!match) {
    console.log('Could not find Chicago Cubs in Streamed.pk data.');
    return;
  }
  
  console.log(`Found match: ${match.title}`);
  console.log(`Sources:`, JSON.stringify(match.sources, null, 2));
  
  // Resolve streams for all sources in this match
  for (const src of match.sources) {
    console.log(`\nResolving source: ${src.source} (ID: ${src.id})`);
    const streams = await provider.resolveStream(src.id, match.category, match.title, null, src.source);
    
    if (streams.length === 0) {
      console.log('No streams returned for this source.');
    } else {
      console.log(`Found ${streams.length} streams:`);
      streams.forEach(s => {
        console.log(`- ${s.title}: ${s.url}`);
        if (s.externalUrl) console.log(`  (External: ${s.externalUrl})`);
      });
    }
  }
}

testStreamedPk();
