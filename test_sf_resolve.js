const container = require('./src/container');

async function test() {
  const provider = container.resolve('streamFreeProvider');
  console.log('Resolving...');
  const streams = await provider.resolveStream('england-vs-france', 'soccer', 'England vs France');
  console.log('Result:', JSON.stringify(streams, null, 2));
}

test();
