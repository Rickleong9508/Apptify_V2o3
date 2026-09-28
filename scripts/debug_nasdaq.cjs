const https = require('https');

const symbol = "META";
const url = `https://api.nasdaq.com/api/quote/${symbol}/summary?assetclass=stocks`;

console.log("Testing Nasdaq API...");
console.log(`URL: ${url}`);

const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.nasdaq.com',
        'Referer': 'https://www.nasdaq.com/'
    }
};

https.get(url, options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const summary = json.data?.summaryData;
            if (summary) {
                console.log("SUCCESS. Nasdaq Data found.");
                console.log("P/E Ratio:", summary.PERatio?.value);
                console.log("EPS:", summary.EarningsPerShare?.value);
                console.log("Market Cap:", summary.MarketCap?.value);
                // Nasdaq might not have Book Value or EBITDA easily here, but EPS is huge.
            } else {
                console.log("Data structure not as expected.");
                console.log(data.substring(0, 200));
            }
        } catch (e) {
            console.log("Parse Error");
        }
    });
});
