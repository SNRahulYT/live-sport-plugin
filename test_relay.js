async function testFetch() {
  try {
    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36' };
    const res = await fetch('https://streamed.pk/api/matches/all', { headers, signal: AbortSignal.timeout(7000) });
    console.log(res.status);
  } catch (err) {
    console.log(err);
    if (err.cause) {
      console.log('Cause:', err.cause);
    }
  }
}
testFetch();
