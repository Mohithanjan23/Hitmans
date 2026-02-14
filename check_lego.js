const https = require('https');
https.get("https://randomuser.me/api/portraits/lego/1.jpg", (res) => {
    console.log(`Lego 1: ${res.statusCode}`);
});
