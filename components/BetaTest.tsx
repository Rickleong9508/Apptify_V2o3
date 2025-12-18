import React, { useState, useEffect } from 'react';
import { aiService, AIProvider } from '../services/aiService';
import { stockService } from '../services/stockService';
import { ValuationData, ValuationScenarios } from '../types';
import {
    Search,
    Loader2,
    AlertCircle,
    ArrowRight,
    Triangle,
    TrendingUp,
    TrendingDown,
    FileText,
    Calculator,
    Target
} from 'lucide-react';

interface BetaTestProps {
    onExit: () => void;
}

const BetaTest: React.FC<BetaTestProps> = ({ onExit }) => {
    const [symbol, setSymbol] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [valuationData, setValuationData] = useState<ValuationData | null>(null);
    const [aiAnalysis, setAiAnalysis] = useState<string>('');

    const apiKey = localStorage.getItem('app_global_api_key') || '';
    const aiProvider = (localStorage.getItem('app_global_ai_provider') as AIProvider) || 'google';
    const aiModel = localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash';

    const performValuation = (data: any, scenarios: ValuationScenarios) => {
        const { revenueTtm, sharesOutstanding, netIncomeTtm, obsFreeCashFlowTtm } = data; // use TTM revenue as base

        // FUTURE EARNINGS VALUATION MODEL
        // Formula: Intrinsic Value = (Future EPS * Exit PE) / (1 + Discount Rate)^5

        console.log("Valuation Input Data:", { revenueTtm, sharesOutstanding, netIncomeTtm, obsFreeCashFlowTtm });

        const calculateScenario = (assumptions: any, type: 'MID' | 'GOOD') => {
            const { revenueCagr, operatingMargin, taxRate, peMultiple, dilution } = assumptions;
            const discountRate = 0.10; // Standard 10%

            // 1. Projected Revenue (Year 5)
            const projectedRevenue = revenueTtm * Math.pow(1 + revenueCagr, 5);

            // 2. Projected Operating Income
            const projectedOpIncome = projectedRevenue * operatingMargin;

            // 3. Future Net Income (Taxed)
            const futureNetIncome = projectedOpIncome * (1 - taxRate);

            // 4. Future EPS
            // Dilution: Annual dilution factor applied for 5 years
            const projectedShares = sharesOutstanding * Math.pow(1 + dilution, 5);
            const futureEps = futureNetIncome / projectedShares;

            // 5. Future Stock Price
            const futureStockPrice = futureEps * peMultiple;

            // 6. Intrinsic Value (PV)
            const intrinsicValue = futureStockPrice / Math.pow(1 + discountRate, 5);

            console.log(`[${type}]`, { projectedRevenue, projectedOpIncome, futureNetIncome, futureEps, futureStockPrice, intrinsicValue });

            return { intrinsicValue, discountRate };
        };

        const midResult = calculateScenario(scenarios.mid, 'MID');
        const goodResult = calculateScenario(scenarios.good, 'GOOD');

        console.log("Valuation Results:", { mid: midResult.intrinsicValue, good: goodResult.intrinsicValue });

        return {
            midPrice: midResult.intrinsicValue,
            goodPrice: goodResult.intrinsicValue,
            valuationModel: 'Future Earnings (5y)' as const
        };
    };

    const handleSearch = async () => {
        if (!symbol.trim()) return;
        setLoading(true);
        setError(null);
        setValuationData(null);
        setAiAnalysis('');

        try {
            // 1. Fetch Data
            const quote = await stockService.getDetailedQuote(symbol);
            if (!quote.valuationFields) throw new Error("Financial data unavailable");

            const fundamentals = quote.valuationFields;

            // 2. AI Analysis
            const aiResult = await aiService.analyzeBetaTestValuation(
                aiProvider,
                aiModel,
                apiKey,
                quote.symbol,
                {
                    price: quote.price,
                    pe: quote.peRatio,
                    revenueQtr: fundamentals.revenueQtr,
                    operatingIncome: fundamentals.operatingIncome
                }
            );

            // 3. Calculate
            const { midPrice, goodPrice, valuationModel } = performValuation(fundamentals, aiResult.scenarios);

            const vData: ValuationData = {
                revenueQtr: fundamentals.revenueQtr,
                netIncome: fundamentals.netIncomeTtm,
                fcf: fundamentals.obsFreeCashFlowTtm,
                costOfRevenue: fundamentals.costOfRevenue,
                opex: fundamentals.operatingExpenses,
                operatingIncome: fundamentals.operatingIncome,
                cash: fundamentals.cashAndEquivalents,
                totalDebt: fundamentals.totalDebt,
                sharesOutstanding: fundamentals.sharesOutstanding,
                sharePrice: quote.price,
                revenuePerShare: fundamentals.revenueTtm / fundamentals.sharesOutstanding,

                marketCap: quote.marketCap,
                grossProfit: fundamentals.revenueQtr - fundamentals.costOfRevenue,
                grossMargin: fundamentals.revenueQtr ? (fundamentals.revenueQtr - fundamentals.costOfRevenue) / fundamentals.revenueQtr : 0,
                operatingMargin: fundamentals.revenueQtr ? fundamentals.operatingIncome / fundamentals.revenueQtr : 0,
                netCash: fundamentals.cashAndEquivalents - fundamentals.totalDebt,
                ebitdaPs: 0,
                pbRatio: 0,
                psRatio: fundamentals.priceToSales,

                scenarios: aiResult.scenarios,
                valuationModel,
                targets: {
                    currentPrice: quote.price,
                    midPrice,
                    goodPrice,
                    discountRate: 0.10
                }
            };

            setValuationData(vData);
            setAiAnalysis(aiResult.analysis);

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Analysis failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-text-main p-6 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onExit} className="p-2 hover:bg-surface rounded-full transition-colors">
                    <Triangle size={16} className="rotate-180" />
                </button>
                <h1 className="text-2xl font-bold">AI Stock Valuation (Beta)</h1>
            </div>

            {/* Search */}
            <div className="max-w-xl mx-auto mb-12 flex gap-2">
                <input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Enter Ticker (e.g. NVDA)"
                    className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 ring-primary/50"
                />
                <button
                    onClick={handleSearch}
                    disabled={loading || !symbol}
                    className="bg-primary text-white p-3 rounded-xl hover:bg-primary/90 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                </button>
            </div>

            {error && (
                <div className="max-w-xl mx-auto mb-8 p-4 bg-red-500/10 text-red-500 rounded-xl flex items-center gap-2">
                    <AlertCircle size={20} /> {error}
                </div>
            )}

            {valuationData && (
                <div className="max-w-6xl mx-auto space-y-8 animate-slide-up">

                    {/* Targets */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border text-center">
                            <p className="text-sm text-text-muted mb-2 font-semibold">Current Price</p>
                            <p className="text-4xl font-bold">${valuationData.targets?.currentPrice.toFixed(2)}</p>
                        </div>
                        <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                            <p className="text-sm text-blue-500 mb-2 font-semibold">Mid Target (Base)</p>
                            <p className="text-4xl font-bold text-blue-600">${valuationData.targets?.midPrice.toFixed(2)}</p>
                        </div>
                        <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                            <p className="text-sm text-emerald-500 mb-2 font-semibold">Upper Target (Bull)</p>
                            <p className="text-4xl font-bold text-emerald-600">${valuationData.targets?.goodPrice.toFixed(2)}</p>
                        </div>
                    </div>

                    {/* AI Analysis */}
                    <div className="bg-surface p-8 rounded-2xl shadow-sm border border-border">
                        <div className="flex items-center gap-3 mb-4">
                            <FileText className="text-primary" />
                            <h3 className="text-xl font-bold">AI Analysis</h3>
                        </div>
                        <p className="leading-relaxed text-text-muted">{aiAnalysis}</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Fundamentals Table */}
                        <div className="bg-surface p-6 rounded-2xl border border-border">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <TrendingUp size={20} /> Latest Fundamentals
                            </h3>
                            <div className="mb-4">
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500">
                                    Model: {valuationData.valuationModel}
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <tbody className="divide-y divide-border/50">
                                        <Row label="Revenue (TTM)" value={valuationData.revenueQtr * 4} isCurrency />
                                        <Row label="Net Income (TTM)" value={valuationData.netIncome} isCurrency />
                                        <Row label="Free Cash Flow" value={valuationData.fcf} isCurrency />
                                        <Row label="Op Expenses" value={valuationData.opex} isCurrency />
                                        <Row label="Cash" value={valuationData.cash} isCurrency />
                                        <Row label="Total Debt" value={valuationData.totalDebt} isCurrency />
                                        <Row label="Shares Out." value={valuationData.sharesOutstanding} />
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Scenario Assumptions Table */}
                        <div className="bg-surface p-6 rounded-2xl border border-border">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Target size={20} /> Scenario Assumptions
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border/50 text-left">
                                            <th className="py-2 text-text-muted font-medium">Metric</th>
                                            <th className="py-2 text-blue-500 font-bold text-right">Mid Scenario</th>
                                            <th className="py-2 text-emerald-500 font-bold text-right">Good Scenario</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        <tr>
                                            <td className="py-3 text-text-main font-medium">Revenue CAGR</td>
                                            <td className="py-3 text-right">{(valuationData.scenarios?.mid.revenueCagr! * 100).toFixed(1)}%</td>
                                            <td className="py-3 text-right">{(valuationData.scenarios?.good.revenueCagr! * 100).toFixed(1)}%</td>
                                        </tr>
                                        <tr>
                                            <td className="py-3 text-text-main font-medium">Op Margin</td>
                                            <td className="py-3 text-right">{(valuationData.scenarios?.mid.operatingMargin! * 100).toFixed(1)}%</td>
                                            <td className="py-3 text-right">{(valuationData.scenarios?.good.operatingMargin! * 100).toFixed(1)}%</td>
                                        </tr>
                                        <tr>
                                            <td className="py-3 text-text-main font-medium">Tax Rate</td>
                                            <td className="py-3 text-right">{(valuationData.scenarios?.mid.taxRate! * 100).toFixed(1)}%</td>
                                            <td className="py-3 text-right">{(valuationData.scenarios?.good.taxRate! * 100).toFixed(1)}%</td>
                                        </tr>
                                        <tr>
                                            <td className="py-3 text-text-main font-medium">Exit P/E</td>
                                            <td className="py-3 text-right">{valuationData.scenarios?.mid.peMultiple}x</td>
                                            <td className="py-3 text-right">{valuationData.scenarios?.good.peMultiple}x</td>
                                        </tr>
                                        <tr>
                                            <td className="py-3 text-text-main font-medium">Discount Rate</td>
                                            <td className="py-3 text-right">10.0%</td>
                                            <td className="py-3 text-right">10.0%</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const Row = ({ label, value, isCurrency = false }: { label: string, value: number, isCurrency?: boolean }) => (
    <tr>
        <td className="py-3 text-text-main font-medium">{label}</td>
        <td className="py-3 text-text-muted text-right font-mono">
            {isCurrency ? '$' : ''}{value ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}
        </td>
    </tr>
);

export default BetaTest;
