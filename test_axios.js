const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('https://streamed.pk/api/matches/all', { timeout: 7000 });
    console.log("Success! Data length:", res.data.length);
  } catch (err) {
    console.error("Error:");
    if (err.response) {
      console.error(err.response.status, err.response.statusText);
    } else {
      console.error(err.message);
    }
  }
}

test();
