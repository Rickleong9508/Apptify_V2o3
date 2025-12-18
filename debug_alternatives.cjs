const https = require('https');

const symbol = "META";

const urls = [
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`, // query2 mirror
    `https://query1.finance.yahoo.com/v7/finance/options/${symbol}`, // options chain often accepts public
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d` // verify chart still works
];

urls.forEach(url => {
    console.log(`Testing: ${url}`);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        console.log(`URL: ${url} -> Status: ${res.statusCode}`);
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            if (res.statusCode === 200) {
                console.log(`SUCCESS for ${url}`);
                // Check if it has useful data
                if (data.includes("marketCap")) console.log("  -> Contains marketCap");
                if (data.includes("bookValue")) console.log("  -> Contains bookValue");
                if (data.includes("eps")) console.log("  -> Contains eps");
            }
        });
    }).on('error', e => console.log(`Error ${url}: ${e.message}`));
});
