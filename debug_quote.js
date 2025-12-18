const https = require('https');

// Test with simpler modules first
const symbol = "META";
const modules = "financialData,defaultKeyStatistics";
const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=${modules}`;

console.log("Testing Yahoo Finance QuoteSummary...");
console.log(`URL: ${url}`);

const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    }
};

const req = https.get(url, options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            console.log("Response Length:", data.length);
            const json = JSON.parse(data);
            if (json.quoteSummary && json.quoteSummary.result) {
                const result = json.quoteSummary.result[0];
                console.log("SUCCESS. Modules found.");
                if (result.financialData) {
                    console.log("EBITDA:", result.financialData.ebitda);
                }
                if (result.defaultKeyStatistics) {
                    console.log("PEG Ratio:", result.defaultKeyStatistics.pegRatio);
                }
            } else {
                console.log("JSON parsed but structure invalid/empty:", JSON.stringify(json).substring(0, 200));
            }
        } catch (err) {
            console.log("Failed to parse JSON.");
            console.log("First 200 chars:", data.substring(0, 200));
        }
    });
});

req.on('error', (e) => {
    console.error(`Request Error: ${e.message}`);
});
