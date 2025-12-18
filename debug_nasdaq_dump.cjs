const https = require('https');

const symbol = "NVDA";
const url = `https://api.nasdaq.com/api/quote/${symbol}/summary?assetclass=stocks`;

console.log("Dumping Nasdaq Keys...");

const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.nasdaq.com',
        'Referer': 'https://www.nasdaq.com/'
    }
};

https.get(url, options, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const summary = json.data?.summaryData;
            if (summary) {
                console.log("Summary Keys:", Object.keys(summary));
                console.log("Full Object:", JSON.stringify(summary, null, 2));
            } else {
                console.log("No summary data found.");
            }
        } catch (e) {
            console.log("Parse Error");
        }
    });
});
