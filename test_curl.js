const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);

async function testCurl() {
  try {
    const { stdout, stderr } = await exec('curl', ['--version']);
    console.log('Curl version:', stdout);
    
    // Now let's try to curl a simple URL with headers, similar to curl.js
    const args = ['-sS', '-L', '--compressed', '-H', 'User-Agent: Mozilla/5.0', 'http://example.com', '-o', '-', '-w', 'HTTPSTATUS:%{http_code}'];
    console.log('Running curl with args:', args);
    const { stdout: out } = await exec('curl', args, { maxBuffer: 64 * 1024 * 1024, encoding: 'buffer' });
    
    const mark = out.lastIndexOf(Buffer.from('HTTPSTATUS:'));
    if (mark < 0) throw new Error('curl response parse failed');
    const body = out.subarray(0, mark);
    const code = Number(out.subarray(mark + 11).toString('utf8'));
    
    console.log(`Code: ${code}`);
    console.log(`Body length: ${body.length}`);
  } catch (err) {
    console.error('Curl failed:', err);
  }
}
testCurl();
