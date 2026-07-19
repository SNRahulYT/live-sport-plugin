const axios = require('axios');
async function test() {
  try {
    const res = await axios.get('https://streamed.pk/api/matches/all', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
      }
    });
    console.log('Status:', res.status);
    console.log('Data:', JSON.stringify(res.data).substring(0, 100));
  } catch (err) {
    console.error(err.message);
  }
}
test();
