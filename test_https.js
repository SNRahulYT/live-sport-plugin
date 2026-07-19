const https = require('https');

const req = https.get('https://streamed.pk/api/matches/all', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
  }
}, (res) => {
  console.log('Status:', res.statusCode);
  res.on('data', d => process.stdout.write(d.toString().substring(0, 100)));
});
req.on('error', e => console.error(e));
