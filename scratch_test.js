const axios = require('axios');
axios.get('https://www.bintv.cc/', {
  headers: {
    'User-Agent': 'Mozilla/5.0'
  }
}).then(r => {
  const html = r.data;
  console.log("PPV_API_URL:", html.match(/const\s+PPV_API_URL\s*=\s*['"]([^'"]+)['"]/)?.[1]);
  console.log("STREAMED_IMAGES_URL:", html.match(/const\s+STREAMED_IMAGES_URL\s*=\s*['"]([^'"]+)['"]/)?.[1]);
}).catch(e => console.error(e.message));
