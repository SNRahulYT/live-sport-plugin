async function test() {
  try {
    const res = await fetch('https://streamfree.top/streams');
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2).substring(0, 1000));
  } catch(e) {
    console.error(e.message);
  }
}
test();
