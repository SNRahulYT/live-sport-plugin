async function test() {
  try {
    const res = await fetch('http://localhost:7000/catalog/tv/nuvio_sports_football.json');
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Metas length:', data.metas ? data.metas.length : 'undefined');
  } catch (err) {
    console.error(err);
  }
}
test();
