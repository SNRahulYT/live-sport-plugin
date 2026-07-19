const container = require('./src/container');

async function test() {
  const matchAggregator = container.resolve('matchAggregator');
  // Mock streamedPkProvider to throw error like Cloudflare 522
  const streamedPkProvider = container.resolve('streamedPkProvider');
  streamedPkProvider.getMatches = async () => [];

  // Run sync
  const matches = await matchAggregator.syncMatches();
  console.log('Total active matches:', matches.length);
  const football = matches.filter(m => m.category === 'football');
  console.log('Football matches:', football.length);
  
  if (football.length > 0) {
    console.log('Sample football match:', football[0].title);
  }
}
test();
