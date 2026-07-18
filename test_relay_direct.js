const fetch = require('node-fetch');

async function testRelayDirectly() {
  console.log('Fetching matches from local server...');
  
  const catRes = await fetch('http://127.0.0.1:7000/catalog/tv/nuvio_sports_catalog.json');
  const catData = await catRes.json();
  const matches = catData.metas || [];
  
  const match = matches.find(m => m.name.toLowerCase().includes('chicago cubs'));
  if (!match) return console.log('No match found');
  
  console.log(`Resolving streams for ${match.name}...`);
  const streamRes = await fetch(`http://127.0.0.1:7000/stream/tv/${match.id}.json`);
  const streamData = await streamRes.json();
  const streams = streamData.streams || [];
  
  // Find a direct Nuvio stream from Streamed.pk
  const directStream = streams.find(s => s.name === '📡 Nuvio' && s.url && s.url.includes('/api/hls'));
  
  if (directStream) {
    const streamUrl = directStream.url; 
    const fullUrl = streamUrl.startsWith('http') ? streamUrl : `http://127.0.0.1:7000${streamUrl}`;
    console.log(`Testing Proxy URL: ${fullUrl}`);
    
    const res = await fetch(fullUrl);
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Body starts with:\n${text.substring(0, 300)}`);
    if (!res.ok) {
      console.log(`Error body: ${text}`);
    }
  } else {
    console.log("No direct /api/hls stream found.");
  }
}

testRelayDirectly();
