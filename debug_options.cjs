const https = require('https');

const symbol = "META";
const url = `https://query1.finance.yahoo.com/v7/finance/options/${symbol}`;

console.log("Testing Yahoo Options Endpoint...");
console.log(`URL: ${url}`);

https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    console.log(`Status: ${res.statusCode}`);
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const quote = json.optionChain?.result?.[0]?.quote;
            if (quote) {
                console.log("SUCCESS. Quote found in Options.");
                console.log("Market Cap:", quote.marketCap);
                console.log("Book Value:", quote.bookValue);
                console.log("EPS (TTM):", quote.epsTrailingTwelveMonths);
                console.log("EPS (Fwd):", quote.epsForward);
                console.log("Price/Book:", quote.priceToBook);
                console.log("Forward PE:", quote.forwardPE);
                console.log("Trailing PE:", quote.trailingPE);
            } else {
                console.log("No quote found in options result.");
            }
        } catch (e) {
            console.log("Parse Error");
        }
    });
});
