const http = require('http');

const url = 'http://localhost:3000/api/yahoo/v10/finance/quoteSummary/META?modules=financialData,defaultKeyStatistics,summaryDetail,assetProfile,earnings,incomeStatementHistoryQuarterly,balanceSheetHistoryQuarterly,cashflowStatementHistoryQuarterly';

console.log(`Fetching from: ${url}`);

http.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const result = json.quoteSummary?.result?.[0];
            if (!result) {
                console.error("No result found in response");
                return;
            }

            console.log("--- Financial Data (TTM Candidates) ---");
            console.log("revenueGrowth:", result.financialData?.revenueGrowth);
            console.log("earningsGrowth:", result.financialData?.earningsGrowth);
            console.log("freeCashflow:", result.financialData?.freeCashflow);
            console.log("operatingCashflow:", result.financialData?.operatingCashflow);

            console.log("\n--- Income Statement History (Quarterly) ---");
            const income = result.incomeStatementHistoryQuarterly?.incomeStatementHistory || [];
            if (income.length > 0) {
                console.log("Latest Qtr keys:", Object.keys(income[0]));
                console.log("Latest Qtr netIncome:", income[0].netIncome);
                console.log("Latest Qtr netIncomeCommonStockholders:", income[0].netIncomeCommonStockholders);
            } else {
                console.log("No income history found.");
            }

            console.log("\n--- Cashflow Statement History (Quarterly) ---");
            const cashflow = result.cashflowStatementHistoryQuarterly?.cashflowStatements || [];
            if (cashflow.length > 0) {
                console.log("Latest Qtr keys:", Object.keys(cashflow[0]));
                console.log("Latest Qtr totalCashFromOperatingActivities:", cashflow[0].totalCashFromOperatingActivities);
                console.log("Latest Qtr operatingCashFlow:", cashflow[0].operatingCashFlow);
                console.log("Latest Qtr capitalExpenditures:", cashflow[0].capitalExpenditures);
            } else {
                console.log("No cashflow history found.");
            }

        } catch (e) {
            console.error("Parse Error:", e);
            console.log("Raw Data snippet:", data.substring(0, 500));
        }
    });
}).on('error', (err) => {
    console.error("Request Error:", err);
});
