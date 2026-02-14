const https = require('https');

const urls = [
    "https://static.wikia.nocookie.net/lego/images/8/82/71000_Series_9_Heroic_Knight.png",
    "https://img.bricklink.com/ItemImage/M/cty1415.png"
];

urls.forEach(url => {
    https.get(url, (res) => {
        console.log(`${url} => Status: ${res.statusCode}`);
    }).on('error', (e) => console.error(`${url} => Error: ${e.message}`));
});
