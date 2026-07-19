async function test() {
  try {
    const res = await fetch('http://localhost:7000/manifest.json');
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Catalogs:', data.catalogs.map(c => c.id));
  } catch (err) {
    console.error(err);
  }
}
test();
