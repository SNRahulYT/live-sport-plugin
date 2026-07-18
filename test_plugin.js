const axios = require('axios');

async function test() {
  try {
    const cat = await axios.get('http://127.0.0.1:7000/catalog/tv/nuvio_sports_live.json');
    if (!cat.data.metas || cat.data.metas.length === 0) {
      console.log("No catalog items.");
      return;
    }
    const firstMatch = cat.data.metas.find(m => m.id.startsWith('nuvio_sport_') && m.name.toLowerCase().includes('twins'));
    const matchToTest = firstMatch || cat.data.metas[0];
    
    console.log("Found match:", matchToTest.name);
    console.log("ID:", matchToTest.id);
    
    const res = await axios.get(`http://127.0.0.1:7000/stream/tv/${matchToTest.id}.json`);
    console.log("Success! Streams returned:", res.data.streams.length);
    res.data.streams.forEach(s => {
      console.log(`\nName: ${s.name}`);
      console.log(`Title: ${s.title ? s.title.replace(/\n/g, ' - ') : ''}`);
      console.log(`URL: ${s.url}`);
      if (s.externalUrl) console.log(`External URL: ${s.externalUrl}`);
    });
  } catch (err) {
    console.error("Error:");
    if (err.response) {
      console.error(err.response.status, err.response.data);
    } else {
      console.error(err.message);
    }
  }
}

test();
