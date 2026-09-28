const https = require('https');

const symbol = "META";
const modules = "financialData,defaultKeyStatistics,summaryDetail,assetProfile";
const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=${modules}`;

console.log("Testing API Connectivity...");
console.log(`URL: ${url}`);

const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
};

https.get(url, options, (res) => {
    let data = '';
    console.log(`Status Code: ${res.statusCode}`);

    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const result = json.quoteSummary?.result?.[0];
            if (result) {
                console.log("SUCCESS: Data fetched successfully.");
                console.log("Modules found:", Object.keys(result));
                console.log("PEG Ratio:", result.defaultKeyStatistics?.pegRatio?.raw);
                console.log("EBITDA:", result.financialData?.ebitda?.raw);
            } else {
                console.log("FAILURE: JSON parsed but no result found.");
                console.log("Raw Response Snippet:", data.substring(0, 200));
            }
        } catch (e) {
            console.log("FAILURE: Could not parse JSON.");
            console.log("Raw Response Snippet:", data.substring(0, 200));
        }
    });
}).on('error', (e) => {
    console.error("NETWORK ERROR:", e.message);
});
