const container = require('./src/container');
const { handleStream } = require('./src/streams');

async function test() {
  console.log('Testing streams resolving...');
  
  // Inject some dummy match into cache to test
  const cacheService = container.resolve('cacheService');
  cacheService.setMatches([
    {
      id: 'testmatch123',
      title: 'Test Match',
      category: 'football',
      popular: '1',
      sources: [
        { source: 'streamfree', id: '123' },
        { source: 'streamed.pk', id: '456' },
        { source: 'bintv', id: '789' }
      ]
    }
  ]);

  try {
    const result = await handleStream('tv', 'nuvio_sport_testmatch123');
    console.log(`Resolved ${result.streams.length} streams successfully.`);
    if (result.streams.length > 0) {
      console.log('First stream title:', result.streams[0].title);
      console.log('First stream url/externalUrl:', result.streams[0].url || result.streams[0].externalUrl);
    }
  } catch (err) {
    console.error('Error during handleStream:', err);
  }
}

test();
