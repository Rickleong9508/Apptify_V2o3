export interface StockData {
    code: string;
    name: string;
    price: string;
    change: string;
    change_percent: string;
    open: string;
    prev_close: string;
    high: string;
    low: string;
    volume: number;
    amount: string;
    market_cap: string;
    float_cap: string;
    pe: string;
    pb: string;
    turnover: string;
    volume_ratio: string;
    limit_up: string;
    limit_down: string;
}

export interface FundFlowData {
    main_flow: string;
    main_ratio: string;
    super_large_flow: string;
    large_flow: string;
    medium_flow: string;
    small_flow: string;
    name: string;
    price: string;
    change_percent: string;
}

export interface AnomalyVolatilityData {
    board: string;
    threshold: number;
    indexName: string;
    deviation3d: number;
    deviation10d: number;
    deviation30d: number;
    progress: number;
    alertLevel: string;
    alertClass: string;
    ceilingPrice: number;
    remainingSpace: number;
}

export interface MaValuationData {
    targetName: string;
    acquisitionRatio: number; // e.g. 100 for 100%
    acquisitionPrice: number; // in CNY (e.g. 1.2e9)
    paymentMethod: '现金' | '股份' | '混合';
    targetRevenue: number;
    targetNetProfit: number;
    targetGrossProfit: number;
    targetIndustryPE: number;
    
    // Calculated
    postMergeRevenue: number;
    postMergeNetProfit: number;
    postMergeGrossMargin: number;
    goodwill: number;
    goodwillRatio: number;
    goodwillRisk: string;
    goodwillRiskClass: string;
    
    scenarios: {
        optimistic: { price: number; upside: number; pe: number };
        neutral: { price: number; upside: number; pe: number };
        conservative: { price: number; upside: number; pe: number };
    };
}

export const stockAnalyzerService = {
    // 1. Fetch details or fund flow from backend
    async fetchStock(code: string, market = 'auto', fundFlow = false): Promise<any> {
        const response = await fetch('/api/stock_analyzer/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, market, fundFlow })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to fetch stock data');
        }
        return await response.json();
    },

    // 2. Fetch K-line helper
    async fetchKline(secid: string, limit = 35): Promise<any[]> {
        const params = new URLSearchParams({
            secid,
            fields1: 'f1,f2,f3,f4,f5,f6',
            fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
            klt: '101', // Daily K-line
            fqt: '1',   // Forward adjusted
            end: '20500101',
            lmt: String(limit)
        });

        const res = await fetch(`/api/stock_analyzer/kline?${params.toString()}`);
        if (!res.ok) throw new Error(`K-line fetch failed for ${secid}`);
        const data = await res.json();
        
        const klines = data?.data?.klines || [];
        // Map to object
        return klines.map((k: string) => {
            const parts = k.split(',');
            return {
                date: parts[0],
                open: parseFloat(parts[1]),
                close: parseFloat(parts[2]),
                high: parseFloat(parts[3]),
                low: parseFloat(parts[4]),
                volume: parseFloat(parts[5]),
                amount: parseFloat(parts[6]),
                amplitude: parseFloat(parts[7]),
                changePercent: parseFloat(parts[8]),
                changeAmount: parseFloat(parts[9]),
                turnover: parseFloat(parts[10])
            };
        });
    },

    // 3. Compute anomaly volatility (偏离值 & 异动进度)
    async calculateAnomalyVolatility(stockCode: string, currentPrice: number, isSt = false): Promise<AnomalyVolatilityData | null> {
        let board = "";
        let threshold = 20;
        let indexSecid = "";
        let indexName = "";
        let stockSecid = "";

        // Determine Board & Index mapping
        if (stockCode.startsWith('60')) {
            board = "沪深主板 (上海)";
            threshold = isSt ? 12 : 20;
            indexSecid = "1.000001";
            indexName = "上证指数";
            stockSecid = `1.${stockCode}`;
        } else if (stockCode.startsWith('00')) {
            board = "沪深主板 (深圳)";
            threshold = isSt ? 12 : 20;
            indexSecid = "0.399106";
            indexName = "深证综指";
            stockSecid = `0.${stockCode}`;
        } else if (stockCode.startsWith('30')) {
            board = "创业板";
            threshold = 30;
            indexSecid = "0.399102";
            indexName = "创业板综指";
            stockSecid = `0.${stockCode}`;
        } else if (stockCode.startsWith('688')) {
            board = "科创板";
            threshold = 30;
            indexSecid = "1.000688";
            indexName = "科创50";
            stockSecid = `1.${stockCode}`;
        } else if (stockCode.startsWith('8') || stockCode.startsWith('4')) {
            board = "北交所";
            threshold = 40;
            indexSecid = "0.899050";
            indexName = "北证50";
            stockSecid = `0.${stockCode}`;
        } else {
            // Not A-share (HK/US do not have this regulation)
            return null;
        }

        try {
            // Fetch K-line for stock and index (limit to last 35 days)
            const [stockK, indexK] = await Promise.all([
                this.fetchKline(stockSecid, 35),
                this.fetchKline(indexSecid, 35)
            ]);

            if (stockK.length < 3 || indexK.length < 3) {
                return null;
            }

            // Calculation Helper
            const calcPeriodDeviation = (stockList: any[], indexList: any[], days: number) => {
                if (stockList.length < days + 1 || indexList.length < days + 1) return 0;
                
                const stockEnd = stockList[stockList.length - 1].close;
                const stockStart = stockList[stockList.length - 1 - days].close;
                const indexEnd = indexList[indexList.length - 1].close;
                const indexStart = indexList[indexList.length - 1 - days].close;

                const stockChange = ((stockEnd - stockStart) / stockStart) * 100;
                const indexChange = ((indexEnd - indexStart) / indexStart) * 100;

                return stockChange - indexChange;
            };

            const deviation3d = calcPeriodDeviation(stockK, indexK, 3);
            const deviation10d = calcPeriodDeviation(stockK, indexK, 10);
            const deviation30d = calcPeriodDeviation(stockK, indexK, 30);

            // Compute warning progress (based on 3-day deviation)
            const progress = (Math.abs(deviation3d) / threshold) * 100;
            
            let alertLevel = "⚪ 安全区间";
            let alertClass = "bg-gray-100 text-gray-600";
            if (progress >= 100) {
                alertLevel = "🔴 已触发异动";
                alertClass = "bg-red-100 text-red-600 font-bold animate-pulse";
            } else if (progress >= 80) {
                alertLevel = "单日/区间 临近异动 ⚠️";
                alertClass = "bg-orange-100 text-orange-600 font-bold";
            } else if (progress >= 60) {
                alertLevel = "双日/区间 异动警戒 ⚠️";
                alertClass = "bg-yellow-100 text-yellow-600 font-semibold";
            } else if (progress >= 40) {
                alertLevel = "🟢 轻度偏离";
                alertClass = "bg-green-100 text-green-600";
            }

            const remainingSpace = threshold - Math.abs(deviation3d);
            const ceilingPrice = currentPrice * (1 + remainingSpace / 100);

            return {
                board,
                threshold,
                indexName,
                deviation3d: parseFloat(deviation3d.toFixed(2)),
                deviation10d: parseFloat(deviation10d.toFixed(2)),
                deviation30d: parseFloat(deviation30d.toFixed(2)),
                progress: parseFloat(progress.toFixed(1)),
                alertLevel,
                alertClass,
                ceilingPrice: parseFloat(ceilingPrice.toFixed(2)),
                remainingSpace: parseFloat(remainingSpace.toFixed(2))
            };
        } catch (e) {
            console.error("Error calculating anomaly volatility:", e);
            return null;
        }
    },

    // 4. Calculate M&A scenario valuation
    calculateMaValuation(
        currentStockPrice: number,
        acquirerRevenue: number,     // TTM in CNY
        acquirerNetProfit: number,   // TTM in CNY
        acquirerShares: number,      // Outstanding
        acquirerNetAssets: number,   // Net assets of acquirer (for goodwill calculation)
        targetName: string,
        acquisitionRatio: number,    // 0 - 100
        acquisitionPrice: number,    // Purchase price in CNY
        paymentMethod: '现金' | '股份' | '混合',
        targetRevenue: number,       // in CNY
        targetNetProfit: number,     // in CNY
        targetGrossProfit: number,   // in CNY
        targetIndustryPE: number     // average sector PE
    ): MaValuationData {
        const ratio = acquisitionRatio / 100;
        
        // Post merge financials
        const postMergeRevenue = acquirerRevenue + targetRevenue * ratio;
        const postMergeNetProfit = acquirerNetProfit + targetNetProfit * ratio;
        
        // Gross Profit Estimate
        // Acquirer Gross Profit is estimated from PE/Rev or assumed 40% if not available
        const acquirerGrossProfit = acquirerRevenue * 0.40;
        const postMergeGrossProfit = acquirerGrossProfit + targetGrossProfit * ratio;
        const postMergeGrossMargin = (postMergeGrossProfit / postMergeRevenue) * 100;

        // Goodwill = Acquisition Price - (Target Net Profit * 10) * ratio (estimation of net asset value)
        // Let's assume target's book value is Target Net Profit * 8 (typical tech valuation)
        const targetNetAssets = targetNetProfit * 8;
        const goodwill = Math.max(0, acquisitionPrice - targetNetAssets * ratio);
        const goodwillRatio = acquirerNetAssets > 0 ? (goodwill / acquirerNetAssets) * 100 : 0;
        
        let goodwillRisk = "可控风险 - 商誉比例合理";
        let goodwillRiskClass = "text-green-600 bg-green-50";
        if (goodwillRatio > 80) {
            goodwillRisk = "极高风险 - 商誉减值可能严重侵蚀利润";
            goodwillRiskClass = "text-red-600 bg-red-50 font-bold";
        } else if (goodwillRatio > 50) {
            goodwillRisk = "高风险 - 需警惕商誉减值";
            goodwillRiskClass = "text-orange-600 bg-orange-50 font-semibold";
        } else if (goodwillRatio > 30) {
            goodwillRisk = "中等风险 - 商誉比例偏高";
            goodwillRiskClass = "text-yellow-600 bg-yellow-50";
        }

        // Shares increment
        let postMergeShares = acquirerShares;
        if (paymentMethod === '股份') {
            // Assume issue price is current stock price
            const newIssuedShares = acquisitionPrice / currentStockPrice;
            postMergeShares = acquirerShares + newIssuedShares;
        } else if (paymentMethod === '混合') {
            // 50% cash, 50% shares
            const newIssuedShares = (acquisitionPrice * 0.5) / currentStockPrice;
            postMergeShares = acquirerShares + newIssuedShares;
        }

        // Scenarios based on Target Industry PE
        const peNeutral = targetIndustryPE || 25;
        const peOptimistic = peNeutral * 1.5;
        const peConservative = peNeutral * 0.7;

        const getScenario = (pe: number) => {
            const marketCap = postMergeNetProfit * pe;
            const price = marketCap / postMergeShares;
            const upside = ((price - currentStockPrice) / currentStockPrice) * 100;
            return {
                price: parseFloat(price.toFixed(2)),
                upside: parseFloat(upside.toFixed(2)),
                pe: parseFloat(pe.toFixed(1))
            };
        };

        return {
            targetName,
            acquisitionRatio,
            acquisitionPrice,
            paymentMethod,
            targetRevenue,
            targetNetProfit,
            targetGrossProfit,
            targetIndustryPE,
            postMergeRevenue,
            postMergeNetProfit,
            postMergeGrossMargin: parseFloat(postMergeGrossMargin.toFixed(1)),
            goodwill,
            goodwillRatio: parseFloat(goodwillRatio.toFixed(1)),
            goodwillRisk,
            goodwillRiskClass,
            scenarios: {
                optimistic: getScenario(peOptimistic),
                neutral: getScenario(peNeutral),
                conservative: getScenario(peConservative)
            }
        };
    },

    // 5. Save report helper
    async saveReport(fileName: string, htmlContent: string): Promise<string> {
        const response = await fetch('/api/stock_analyzer/save_report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName, htmlContent })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to save report');
        }
        const data = await response.json();
        return data.filePath;
    }
};
