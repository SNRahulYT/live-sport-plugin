const axios = require('axios');
axios.get('https://logic.icelanders.st/embed/dirtvision-1')
  .then(r => {
    const html = r.data;
    const scripts = html.match(/<script[\s\S]*?<\/script>/gi);
    if (scripts) {
      scripts.forEach(s => {
        if (s.includes('function') && s.includes('String.fromCharCode')) {
           console.log("=== OBFUSCATED SCRIPT ===");
           console.log(s);
        }
      });
    }
  })
  .catch(e => console.error(e.message));
