const https = require('https');

function checkUrl(url) {
  https.get(url, (res) => {
    console.log(url, ':', res.statusCode);
  }).on('error', (e) => {
    console.error(url, ':', e.message);
  });
}

checkUrl('https://copy.sh/v86/images/buildroot-bzimage.bin');
checkUrl('https://copy.sh/v86/images/bzImage');
checkUrl('https://copy.sh/v86/images/linux.iso');
checkUrl('https://copy.sh/v86/images/linux3.iso');
checkUrl('https://copy.sh/v86/images/linux4.iso');
