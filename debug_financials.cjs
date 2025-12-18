const https = require('https');

const symbol = "AAPL";
const modules = "incomeStatementHistoryQuarterly,balanceSheetHistoryQuarterly";
const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=${modules}`;

console.log("Fetching Financials...");

const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0'
    }
};

https.get(url, options, (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const result = json.quoteSummary.result[0];

            const income = result.incomeStatementHistoryQuarterly?.incomeStatementHistory?.[0];
            const balance = result.balanceSheetHistoryQuarterly?.balanceSheetStatements?.[0];

            console.log("--- Income Statement Keys ---");
            if (income) console.log(Object.keys(income));
            else console.log("No Income Data");

            console.log("\n--- Balance Sheet Keys ---");
            if (balance) console.log(Object.keys(balance));
            else console.log("No Balance Data");

            console.log("\n--- Specific Values ---");
            if (income) {
                console.log("Total Revenue:", JSON.stringify(income.totalRevenue));
                console.log("Cost Of Revenue:", JSON.stringify(income.costOfRevenue));
                console.log("Op Income:", JSON.stringify(income.operatingIncome));
                console.log("Op Expenses:", JSON.stringify(income.totalOperatingExpenses));
            }
            if (balance) {
                console.log("Cash:", JSON.stringify(balance.cashAndCashEquivalents));
                console.log("ShortTermDebt:", JSON.stringify(balance.shortLongTermDebt));
                console.log("LongTermDebt:", JSON.stringify(balance.longTermDebt));
            }

        } catch (e) {
            console.error("Parse Error", e);
            console.log(data.substring(0, 500));
        }
    });
});
