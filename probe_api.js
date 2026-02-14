const https = require('https');

const endpoints = [
    '/api/minifigs',
    '/api/minifigures',
    '/api/sets',
    '/api/v1/minifigures',
    '/api/v1/sets'
];

endpoints.forEach(path => {
    const url = `https://go-lego-api.vercel.app${path}`;
    https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            console.log(`--- ${url} ---`);
            console.log(`Status: ${res.statusCode}`);
            if (res.statusCode === 200) {
                try {
                    const json = JSON.parse(data);
                    // Print summary
                    if (Array.isArray(json)) {
                        console.log(`Type: Array, Length: ${json.length}`);
                        console.log('Sample:', JSON.stringify(json[0], null, 2));
                    } else if (json.results) { // array in results?
                        console.log(`Type: Object with results, Length: ${json.results.length}`);
                        console.log('Sample:', JSON.stringify(json.results[0], null, 2));
                    } else {
                        console.log('Sample:', JSON.stringify(json, null, 2).substring(0, 200));
                    }
                } catch (e) {
                    console.log('Not JSON');
                }
            }
        });
    }).on('error', (err) => {
        console.error(`Error: ${url}`, err.message);
    });
});
