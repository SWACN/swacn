const https = require('https');

https.get('https://copy.sh/v86/', (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    // Find lines containing "buildroot" or "bzimage"
    const lines = data.split('\n');
    for (let line of lines) {
      if (line.includes('bzimage') || line.includes('buildroot') || line.includes('bzImage') || line.includes('images/')) {
        console.log(line.trim());
      }
    }
  });
}).on('error', (e) => {
  console.error(e);
});
