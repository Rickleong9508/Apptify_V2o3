const https = require('https');

const symbol = "META";
const url = `https://finance.yahoo.com/quote/${symbol}`;

console.log("Testing HTML Scraping...");
console.log(`URL: ${url}`);

const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    }
};

https.get(url, options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        console.log("Response Length:", data.length);
        if (data.length > 1000) {
            // Look for EPS
            // Pattern: "EPS (TTM)" value is usually nearby in a span or table
            // In generic Yahoo HTML, they often dump a JSON called "root.App.main"
            const rootMatch = data.match(/root\.App\.main\s*=\s*({[\s\S]*?});/);
            if (rootMatch && rootMatch[1]) {
                console.log("FOUND root.App.main JSON store!");
                // This often contains ALL the data
                try {
                    const store = JSON.parse(rootMatch[1]);
                    const stores = store.context.dispatcher.stores;
                    const quoteStore = stores.QuoteSummaryStore;
                    if (quoteStore) {
                        console.log("SUCCESS! Found QuoteSummaryStore in HTML.");
                        console.log("EPS:", quoteStore.defaultKeyStatistics?.trailingEps?.fmt);
                        console.log("Book Value:", quoteStore.defaultKeyStatistics?.bookValue?.fmt);
                        console.log("EBITDA:", quoteStore.financialData?.ebitda?.fmt);
                    } else {
                        console.log("Root found but QuoteSummaryStore missing.");
                        console.log("Keys available:", Object.keys(stores));
                    }
                } catch (e) {
                    console.log("Failed to parse root JSON.");
                }
            } else {
                console.log("No root.App.main JSON found.");
                // Fallback regex for keys
                const epsMatch = data.match(/"epsTrailingTwelveMonths":{"raw":([\d\.]+)/);
                if (epsMatch) console.log("Regex EPS:", epsMatch[1]);
            }
        }
    });
});
