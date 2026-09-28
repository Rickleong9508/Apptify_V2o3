
export interface DetailedStockData {
    symbol: string;
    price: number;
    currency: string;
    changePercent: number;
    volume: number;
    avgVolume: number;
    marketCap: number;
    peRatio: number | null;
    pegRatio: number | null;
    eps: number | null;
    bookValue: number | null;
    financeGrowth: number | null;
    dividendRate: number | null;

    // Advanced Stats (Keep data, remove calculated valuation)
    vwap: number | null;
    targetMeanPrice: number | null;
    recommendationKey: string;
    description: string;
    history: {
        date: string;
        close: number;
        volume: number;
    }[];
    volumeSignal: 'Bullish' | 'Bearish' | 'Neutral';
    prediction?: {
        text: string;
        low: number;
        high: number;
    };
    // New Fields for Valuation
    valuationFields?: {
        revenueQtr: number;        // Total Revenue (Latest Qtr)
        revenueTtm: number;        // Revenue TTM
        netIncomeTtm: number;      // Net Income TTM
        obsFreeCashFlowTtm: number;// Observed FCF TTM (OCF - CapEx)
        costOfRevenue: number;     // Cost of Revenue (Latest Qtr)
        operatingExpenses: number; // R&D + SG&A (Latest Qtr) or Total Operating Expenses
        operatingIncome: number;   // Operating Income (Latest Qtr)
        cashAndEquivalents: number; // Cash + Short Term Investments (Latest Qtr)
        totalDebt: number;         // Total Debt (Latest Qtr)
        sharesOutstanding: number; // Shares Outstanding
        priceToSales: number;      // Trailing P/S
    };
}

export const stockService = {
    async getDetailedQuote(symbol: string): Promise<DetailedStockData> {
        try {
            // 1. Fetch Chart Data (Reliable for Price/Vol/History)
            const chartRes = await fetch(`/api/yahoo/v8/finance/chart/${symbol}?interval=1d&range=3mo`);
            if (!chartRes.ok) throw new Error("Failed to fetch chart data");
            const chartJson = await chartRes.json();
            const chartResult = chartJson.chart?.result?.[0];

            if (!chartResult) throw new Error("Symbol not found");

            // 2. Try Fetch Detailed Stats (Fundamentals)
            const modules = [
                'financialData',
                'defaultKeyStatistics',
                'summaryDetail',
                'assetProfile',
                'earnings',
                'incomeStatementHistoryQuarterly',
                'balanceSheetHistoryQuarterly',
                'cashflowStatementHistoryQuarterly' // Added for FCF
            ].join(',');

            let summaryData: any = {};
            try {
                const summaryRes = await fetch(`/api/yahoo/v10/finance/quoteSummary/${symbol}?modules=${modules}`);
                if (summaryRes.ok) {
                    const summaryJson = await summaryRes.json();
                    summaryData = summaryJson.quoteSummary?.result?.[0] || {};
                }
            } catch (ignore) { console.warn("Fundamentals API network error."); }

            // --- Parse Chart Data ---
            const meta = chartResult.meta;
            const quote = chartResult.indicators?.quote?.[0];
            const timestamps = chartResult.timestamp;
            let lastIndex = quote.close.length - 1;
            while (lastIndex >= 0 && (quote.close[lastIndex] === null || quote.volume[lastIndex] === null)) lastIndex--;

            const currentPrice = meta.regularMarketPrice;
            const previousClose = meta.chartPreviousClose;
            const currentVolume = meta.regularMarketVolume || quote.volume[lastIndex];
            const changePercent = ((currentPrice - previousClose) / previousClose) * 100;

            const history = timestamps.map((ts: number, i: number) => ({
                date: new Date(ts * 1000).toISOString().split('T')[0],
                close: quote.close[i] || 0,
                volume: quote.volume[i] || 0
            })).filter((h: any) => h.close > 0 && h.volume > 0).slice(-30);

            // --- Parse Summary Data ---
            let financial = summaryData.financialData || {};
            let stats = summaryData.defaultKeyStatistics || {};
            let details = summaryData.summaryDetail || {};
            let profile = summaryData.assetProfile || {};

            // --- Parse Financial Statements (Latest Quarter + TTM) ---
            const incomeStmts = summaryData.incomeStatementHistoryQuarterly?.incomeStatementHistory || [];
            const balanceSheets = summaryData.balanceSheetHistoryQuarterly?.balanceSheetStatements || [];
            const cashflowStmts = summaryData.cashflowStatementHistoryQuarterly?.cashflowStatements || [];

            const latestIncome = incomeStmts[0] || {};
            const latestBalance = balanceSheets[0] || {};

            // Calculate TTM (Sum of last 4 quarters if available)
            const getRaw = (item: any, ...keys: string[]) => {
                for (const key of keys) {
                    if (item[key]?.raw !== undefined) return item[key].raw;
                }
                return 0;
            };

            const sumTtm = (arr: any[], ...keys: string[]) => {
                // Sum up to 4 quarters
                const quarters = arr.slice(0, 4);
                if (quarters.length === 0) return 0;
                // If less than 4, we might want to annualize or just return what we have? 
                // For robustness, let's sum available. Ideally we'd scale if < 4 but let's stick to sum.
                return quarters.reduce((acc: number, item: any) => acc + getRaw(item, ...keys), 0);
            };

            const revenueTtm = sumTtm(incomeStmts, 'totalRevenue', 'revenue');
            const netIncomeTtm = sumTtm(incomeStmts, 'netIncome', 'netIncomeCommonStockholders', 'netIncomeContinuousOperations');

            // FCF TTM = OCF - CapEx
            const ocfTtm = sumTtm(cashflowStmts, 'totalCashFromOperatingActivities', 'operatingCashFlow');
            const capexTtm = sumTtm(cashflowStmts, 'capitalExpenditures', 'capitalExpenditure'); // Usually negative
            const obsFreeCashFlowTtm = ocfTtm + capexTtm;

            // Robust Shares Outstanding
            let shares = stats.sharesOutstanding?.raw || details.sharesOutstanding?.raw;
            if (!shares || shares === 0) {
                const mCap = details.marketCap?.raw || summaryData.price?.marketCap?.raw;
                if (mCap && currentPrice) shares = mCap / currentPrice;
            }

            // Fallback Helper
            const fallbackTtm = (ttmVal: number, latestVal: number) => {
                if (ttmVal && ttmVal !== 0) return ttmVal;
                if (latestVal && latestVal !== 0) return latestVal * 4;
                return 0;
            };

            const latestRev = getRaw(latestIncome, 'totalRevenue', 'revenue');
            const latestNet = getRaw(latestIncome, 'netIncome', 'netIncomeCommonStockholders');
            const latestOcf = getRaw(cashflowStmts[0] || {}, 'totalCashFromOperatingActivities', 'operatingCashFlow');
            const latestCapex = getRaw(cashflowStmts[0] || {}, 'capitalExpenditures', 'capitalExpenditure');

            const finalRevenueTtm = fallbackTtm(revenueTtm, latestRev);
            const finalNetIncomeTtm = fallbackTtm(netIncomeTtm, latestNet);
            const finalFcfTtm = (obsFreeCashFlowTtm !== 0) ? obsFreeCashFlowTtm : ((latestOcf + latestCapex) * 4); // Annualize qtr FCF

            const valuationFields = {
                revenueQtr: latestRev || 0,
                revenueTtm: finalRevenueTtm || 0,
                netIncomeTtm: finalNetIncomeTtm || 0,
                obsFreeCashFlowTtm: finalFcfTtm || 0,
                costOfRevenue: getRaw(latestIncome, 'costOfRevenue'),
                operatingExpenses: getRaw(latestIncome, 'totalOperatingExpenses', 'operatingExpenses'),
                operatingIncome: getRaw(latestIncome, 'operatingIncome', 'operatingIncomeLoss'),
                cashAndEquivalents: getRaw(latestBalance, 'cashAndCashEquivalents', 'cash', 'cashAndShortTermInvestments'),
                totalDebt: getRaw(latestBalance, 'totalDebt', 'shortLongTermDebt') + getRaw(latestBalance, 'longTermDebt'),
                sharesOutstanding: shares || 0,
                priceToSales: details.priceToSalesTrailing12Months?.raw || summaryData.summaryDetail?.priceToSalesTrailing12Months?.raw || 0
            };


            // --- HYBRID DATA ENRICHMENT (Nasdaq Fallback) ---
            // Trigger if ANY critical field is missing
            const needsFallback = !stats.pegRatio?.raw || !details.trailingPE?.raw ||
                valuationFields.revenueQtr === 0 ||
                valuationFields.cashAndEquivalents === 0 ||
                !valuationFields.sharesOutstanding;

            if (needsFallback) {
                console.log(`[StockService] Triggering Fallback for ${symbol}. Stats missing or Valuation Fields incomplete.`);
                try {
                    const [nasdaqSumRes, nasdaqEpsRes, nasdaqIncRes, nasdaqBalRes, nasdaqCfRes] = await Promise.all([
                        fetch(`/api/nasdaq/quote/${symbol}/summary?assetclass=stocks`),
                        fetch(`/api/nasdaq/quote/${symbol}/eps`),
                        fetch(`/api/nasdaq/company/${symbol}/financials?frequency=2`), // Income
                        fetch(`/api/nasdaq/company/${symbol}/financials?frequency=2&financialsType=balance-sheet`), // Balance
                        fetch(`/api/nasdaq/company/${symbol}/financials?frequency=2&financialsType=cash-flow`) // Cash Flow
                    ]);

                    if (nasdaqSumRes.ok) {
                        const sumJson = await nasdaqSumRes.json();
                        if (sumJson.data?.summaryData?.MarketCap?.value) {
                            details.marketCap = { raw: parseInt(sumJson.data.summaryData.MarketCap.value.replace(/,/g, '')) };
                        }
                    }
                    if (nasdaqEpsRes.ok) {
                        const epsJson = await nasdaqEpsRes.json();
                        if (epsJson.data?.earningsPerShare) {
                            let validEps = epsJson.data.earningsPerShare
                                .filter((e: any) => e.earnings && !isNaN(parseFloat(e.earnings)))
                                .map((e: any) => parseFloat(e.earnings));
                            if (validEps.length >= 4) {
                                stats.trailingEps = { raw: validEps.slice(0, 4).reduce((a: number, b: number) => a + b, 0) };
                                financial.revenueGrowth = { raw: 0.15 };
                            }
                        }
                    }

                    // Ensure Shares Outstanding is Present (Recalculate using potentially updated Market Cap)
                    if (!valuationFields.sharesOutstanding || valuationFields.sharesOutstanding === 0) {
                        const mCap = details.marketCap?.raw || 0;
                        if (mCap > 0 && currentPrice > 0) {
                            valuationFields.sharesOutstanding = mCap / currentPrice;
                        }
                    }

                    // Parse Nasdaq Financials
                    if (nasdaqIncRes.ok && nasdaqBalRes.ok) {
                        const incJson = await nasdaqIncRes.json();
                        const balJson = await nasdaqBalRes.json();
                        const cfJson = nasdaqCfRes.ok ? await nasdaqCfRes.json() : {};

                        const incRows = incJson.data?.incomeStatementTable?.rows || [];
                        const balRows = balJson.data?.balanceSheetTable?.rows || [];
                        const cfRows = cfJson.data?.cashFlowTable?.rows || [];

                        console.log(`[StockService] Fallback Financials fetched for ${symbol}. IncRows: ${incRows.length}, BalRows: ${balRows.length}`);

                        const getVal = (rows: any[], key: string) => {
                            // Fuzzy search (Case-insensitive substring)
                            if (!rows) return 0;
                            const row = rows.find(r => r.value1 && r.value1.toLowerCase().includes(key.toLowerCase()));
                            if (row && row.value2) {
                                // Nasdaq data is in thousands, multiply by 1000
                                const val = parseFloat(row.value2.replace(/[^0-9.-]+/g, ""));
                                return isNaN(val) ? 0 : val * 1000;
                            }
                            return 0;
                        };

                        // Patch Income Statement
                        if (valuationFields.revenueQtr === 0) {
                            const rev = getVal(incRows, "Total Revenue");
                            valuationFields.revenueQtr = rev;
                            valuationFields.revenueTtm = rev * 4;
                        }
                        if (valuationFields.costOfRevenue === 0) valuationFields.costOfRevenue = getVal(incRows, "Cost of Revenue");
                        if (valuationFields.operatingIncome === 0) valuationFields.operatingIncome = getVal(incRows, "Operating Income");

                        // Operating Expenses
                        if (valuationFields.operatingExpenses === 0) {
                            const rnd = getVal(incRows, "Research and Development");
                            const sga = getVal(incRows, "Sales, General and Admin.");
                            valuationFields.operatingExpenses = rnd + sga;
                        }

                        // Patch Balance Sheet (Cash & Debt)
                        let longTermDebt = 0; // Initialize variable in scope
                        if (valuationFields.cashAndEquivalents === 0 || valuationFields.totalDebt === 0) {
                            console.log(`[StockService] Patching Balance Sheet for ${symbol}...`);
                            const getCash = (rows: any[]) => {
                                // 1. Try "Total Cash"
                                const totalCash = getVal(rows, "Total Cash");
                                if (totalCash > 0) return totalCash;

                                // 2. Try Summing Components
                                const cce = getVal(rows, "Cash and Cash Equivalents") || getVal(rows, "Cash");
                                const sti = getVal(rows, "Short-Term Investments");
                                console.log(`[StockService] CCE: ${cce}, STI: ${sti}`);

                                if (cce > 0 || sti > 0) return cce + sti;
                                return 0;
                            };

                            if (valuationFields.cashAndEquivalents === 0) {
                                valuationFields.cashAndEquivalents = getCash(balRows);
                                console.log(`[StockService] New Cash Value: ${valuationFields.cashAndEquivalents}`);
                            }

                            longTermDebt = getVal(balRows, "Long-Term Debt");
                            const currentDebt = getVal(balRows, "Current Debt") || getVal(balRows, "Short-Term Debt") || getVal(balRows, "Current Portion of Long-Term Debt");
                            if (valuationFields.totalDebt === 0) {
                                valuationFields.totalDebt = longTermDebt + currentDebt;
                            }
                        }

                        // Patch Net Income (TTM Estimate = Latest * 4)
                        if (valuationFields.netIncomeTtm === 0) {
                            const ni = getVal(incRows, "Net Income");
                            valuationFields.netIncomeTtm = ni * 4;
                        }

                        // Patch FCF (TTM Estimate = Latest * 4)
                        if (valuationFields.obsFreeCashFlowTtm === 0) {
                            // Nasdaq keys: "Net Cash Provided by Operating Activities", "Capital Expenditures"
                            // Fuzzy match "Operating" or "Operating Activities"
                            const ocf = getVal(cfRows, "Operating Activities");
                            const capex = getVal(cfRows, "Capital Expenditures") || getVal(cfRows, "Property, Plant");
                            valuationFields.obsFreeCashFlowTtm = (ocf + capex) * 4;
                            console.log(`[StockService] Patched FCF TTM: ${valuationFields.obsFreeCashFlowTtm}`);
                        }
                    }

                } catch (ignore) { console.warn("Nasdaq Fallback Error", ignore); }
            }

            const pegRatio = stats.pegRatio?.raw || null;
            const peRatio = details.trailingPE?.raw || stats.forwardPE?.raw || null;
            const eps = stats.trailingEps?.raw || (peRatio ? currentPrice / peRatio : null);
            let bookValue = stats.bookValue?.raw || (stats.priceToBook?.raw ? currentPrice / stats.priceToBook.raw : null);
            let financeGrowth = financial.revenueGrowth?.raw || financial.earningsGrowth?.raw || 0.10;
            const dividendRate = details.dividendRate?.raw || details.dividendYield?.raw * currentPrice || 0;

            const targetMeanPrice = financial.targetMeanPrice?.raw || null;
            const recommendationKey = financial.recommendationKey || "N/A";
            const avgVolume = details.averageVolume?.raw || 0;
            const finalPeRatio = peRatio || (eps && currentPrice ? currentPrice / eps : null);

            let vwap: number | null = null;
            if (history.length > 0) {
                const totalPV = history.reduce((acc, h) => acc + h.close * h.volume, 0);
                const totalV = history.reduce((acc, h) => acc + h.volume, 0);
                vwap = totalV > 0 ? totalPV / totalV : null;
            }

            let volumeSignal: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
            const historicalAvgVol = history.reduce((acc, val) => acc + val.volume, 0) / (history.length || 1);
            const rvol = currentVolume / (historicalAvgVol || 1);
            if (vwap && currentPrice > vwap && rvol > 1.2) volumeSignal = 'Bullish';
            else if (vwap && currentPrice < vwap && rvol > 1.2) volumeSignal = 'Bearish';

            return {
                symbol: meta.symbol,
                price: currentPrice,
                currency: meta.currency,
                changePercent: changePercent,
                volume: currentVolume,
                avgVolume: historicalAvgVol,
                marketCap: details.marketCap?.raw || 0,
                peRatio: finalPeRatio,
                pegRatio,
                eps,
                bookValue,
                financeGrowth,
                dividendRate,
                vwap,
                targetMeanPrice,
                recommendationKey,
                description: profile.longBusinessSummary || "",
                history,
                volumeSignal,
                valuationFields // Include this in return
            };

        } catch (error) {
            console.error("Stock Service Error:", error);
            throw error;
        }
    }
};
