const https = require('https');

const symbol = "NVDA";
// EPS endpoint
const epsUrl = `https://api.nasdaq.com/api/quote/${symbol}/eps`;
// Info endpoint (often has ratios)
const infoUrl = `https://api.nasdaq.com/api/quote/${symbol}/info?assetclass=stocks`;

const headers = {
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://www.nasdaq.com',
    'Referer': 'https://www.nasdaq.com/'
};

console.log("Dumping Nasdaq EPS & Info...");

https.get(epsUrl, { headers }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log("\n--- EPS Endpoint ---");
            // print nested structure keys
            if (json.data && json.data.earningsPerShare) {
                console.log("EPS Keys:", Object.keys(json.data.earningsPerShare));
                console.log("Sample Data:", JSON.stringify(json.data.earningsPerShare, null, 2).substring(0, 500));
            }
        } catch (e) {
            console.log("EPS Parse Error");
        }
    });
});

https.get(infoUrl, { headers }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log("\n--- Info Endpoint ---");
            if (json.data) {
                console.log("Info Keys:", Object.keys(json.data));
                // check for key stats
                if (json.data.keyStats) {
                    console.log("Key Stats:", JSON.stringify(json.data.keyStats, null, 2));
                }
            }
        } catch (e) {
            console.log("Info Parse Error");
        }
    });
});
