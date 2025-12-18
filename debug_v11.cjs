const https = require('https');

const symbol = "META";
const url = `https://query1.finance.yahoo.com/v11/finance/quoteSummary/${symbol}?modules=financialData,defaultKeyStatistics`;

console.log("Testing Yahoo Finance v11...");
console.log(`URL: ${url}`);

const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
};

https.get(url, options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log("SUCCESS. v11 works!");
            console.log(data.substring(0, 200));
        } else {
            console.log("Failed.");
        }
    });
});
