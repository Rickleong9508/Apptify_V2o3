const https = require('https');

const symbol = "META";
// v7 quote endpoint
const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}&formatted=false`;

console.log("Testing Yahoo Finance v7 Quote...");
console.log(`URL: ${url}`);

const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
};

const req = https.get(url, options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);

    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const result = json.quoteResponse?.result?.[0];
            if (result) {
                console.log("SUCCESS. Data found.");
                console.log("Price:", result.regularMarketPrice);
                console.log("EPS (TTM):", result.epsTrailingTwelveMonths);
                console.log("EPS (Fwd):", result.epsForward);
                console.log("Book Value:", result.bookValue);
                console.log("PEG Ratio:", result.pegRatio);
                console.log("Price/Book:", result.priceToBook);
                console.log("Market Cap:", result.marketCap);
            } else {
                console.log("No data found.");
            }
        } catch (e) {
            console.log("Parse Error or Body empty");
            console.log(data.substring(0, 200));
        }
    });
});
