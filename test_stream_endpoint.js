const { builder } = require('./src/manifest');
const index = require('./src/index'); // ensures everything is registered

async function test() {
  const router = builder.getInterface();
  const args = { type: 'tv', id: 'nuvio_sport_england-vs-france' };
  
  console.log('Requesting stream for:', args.id);
  const result = await router.request('stream', args);
  console.log('Streams found:', result.streams.length);
  if (result.streams.length > 0) {
    console.log(JSON.stringify(result.streams[0], null, 2));
  }
}
setTimeout(test, 2000); // Wait for cache to sync
