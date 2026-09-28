const https = require('https');

const symbol = "AAPL";
const url = `https://api.nasdaq.com/api/company/${symbol}/financials?frequency=2`;

console.log(`Fetching Nasdaq Financials: ${url}`);

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
            const income = json.data?.incomeStatementTable;

            if (income) {
                console.log("--- Income Statement ---");
                // Print first 5 rows to see structure
                income.rows.slice(0, 10).forEach(r => {
                    console.log(`${r.value1}: ${r.value2}`); // Check if value1 is label and value2 is latest qtr
                });
            }

            // Check if Balance Sheet is in the same response or we need another call
            // Usually valid tabs are passed as query param? or different endpoint?
            // "financials" usually implies Income Statement.
            // Try fetching Balance Sheet explicitly often /company/AAPL/financials?frequency=2&financialsType=balance-sheet
            console.log("\n--- Checking Balance Sheet Endpoint ---");
            fetchBalanceSheet();

        } catch (e) {
            console.log("Parse Error", e);
        }
    });
});

function fetchBalanceSheet() {
    const bsUrl = `https://api.nasdaq.com/api/company/${symbol}/financials?frequency=2&financialsType=balance-sheet`;
    https.get(bsUrl, options, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                const bs = json.data?.balanceSheetTable;
                if (bs) {
                    console.log("\n--- Balance Sheet ---");
                    bs.rows.slice(0, 10).forEach(r => {
                        console.log(`${r.value1}: ${r.value2}`);
                    });
                } else {
                    console.log("No Balance Sheet found.");
                }
            } catch (e) { }
        });
    });
}
