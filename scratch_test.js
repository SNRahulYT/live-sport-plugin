const container = require('./src/container');

async function test() {
  const provider = container.resolve('streamedPkProvider');
  const streams = await provider.resolveStream('ppv-minnesota-twins-vs-chicago-cubs', 'baseball', 'Chicago Cubs vs Minnesota Twins', '1', 'admin');
  console.log("Returned streams:", streams);
}

test();
