const https = require('https');

const symbol = "NVDA"; // Use a liquid stock

const tests = [
    {
        name: "Yahoo Query2 Modules",
        url: `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=financialData,defaultKeyStatistics,summaryDetail`
    },
    {
        name: "Nasdaq EPS",
        url: `https://api.nasdaq.com/api/quote/${symbol}/eps`
    },
    {
        name: "Nasdaq Summary",
        url: `https://api.nasdaq.com/api/quote/${symbol}/summary?assetclass=stocks`
    },
    {
        name: "Nasdaq Info",
        url: `https://api.nasdaq.com/api/quote/${symbol}/info?assetclass=stocks`
    }
];

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://www.nasdaq.com',
    'Referer': 'https://www.nasdaq.com/'
};

tests.forEach(test => {
    console.log(`\n--- Testing ${test.name} ---`);
    console.log(`URL: ${test.url}`);

    https.get(test.url, { headers }, (res) => {
        console.log(`Status: ${res.statusCode}`);
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    const json = JSON.parse(data);

                    if (test.name.includes("Yahoo")) {
                        const result = json.quoteSummary?.result?.[0];
                        if (result) {
                            console.log("SUCCESS Yahoo Data:");
                            console.log(" PEG:", result.defaultKeyStatistics?.pegRatio?.raw);
                            console.log(" EBITDA:", result.financialData?.ebitda?.raw);
                        } else {
                            console.log("Yahoo JSON valid but empty result.");
                        }
                    } else if (test.name.includes("Nasdaq")) {
                        // Log keys to see structure
                        const d = json.data;
                        if (d) {
                            console.log("Nasdaq Data Found.");
                            if (d.epsTable) console.log(" EPS Table Rows:", d.epsTable.rows?.length);
                            if (d.summaryData) {
                                console.log(" Summary P/E:", d.summaryData.PERatio?.value);
                                console.log(" Summary EPS:", d.summaryData.EarningsPerShare?.value);
                            }
                            if (d.keyStats) {
                                console.log(" KeyStats:", Object.keys(d.keyStats));
                            }
                        } else {
                            console.log("Nasdaq JSON valid but data null.");
                        }
                    }
                } catch (e) {
                    console.log("JSON Parse Error");
                }
            } else {
                console.log("Request Failed");
            }
        });
    }).on('error', e => console.error("Net Error", e.message));
});
