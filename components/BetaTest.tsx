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
        <div className="min-h-screen p-6 overflow-y-auto bg-[#E0E5EC] text-gray-700">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={onExit}
                    className="p-3 rounded-full transition-all active:scale-95 text-gray-600 hover:text-red-500"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                    }}
                >
                    <Triangle size={20} className="rotate-180" />
                </button>
                <h1 className="text-3xl font-bold text-gray-700 tracking-tight">AI Stock Valuation <span className="text-blue-500 text-lg uppercase tracking-wider ml-2">Beta</span></h1>
            </div>

            {/* Search */}
            <div className="max-w-xl mx-auto mb-12 flex gap-4">
                <input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Enter Ticker (e.g. NVDA)"
                    className="flex-1 rounded-2xl px-6 py-4 font-bold outline-none text-xl placeholder-gray-400 text-gray-700 tracking-wider"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                    }}
                />
                <button
                    onClick={handleSearch}
                    disabled={loading || !symbol}
                    className="p-4 rounded-2xl transition-all active:scale-95 disabled:opacity-50 text-blue-600"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                    }}
                >
                    {loading ? <Loader2 className="animate-spin" /> : <ArrowRight size={24} />}
                </button>
            </div>

            {error && (
                <div className="max-w-xl mx-auto mb-8 p-4 bg-red-500/10 text-red-500 rounded-xl flex items-center gap-2">
                    <AlertCircle size={20} /> {error}
                </div>
            )}

            {valuationData && (
                <div className="max-w-6xl mx-auto space-y-8">

                    {/* Targets */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div
                            className="p-8 rounded-[32px] text-center animate-scale-in opacity-0"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                                animationDelay: '100ms'
                            }}
                        >
                            <p className="text-sm text-gray-400 mb-2 font-bold uppercase tracking-wider">Current Price</p>
                            <p className="text-4xl font-bold text-gray-700">${valuationData.targets?.currentPrice.toFixed(2)}</p>
                        </div>
                        <div
                            className="p-8 rounded-[32px] text-center relative overflow-hidden group animate-scale-in opacity-0"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                                animationDelay: '200ms'
                            }}
                        >
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                            <p className="text-sm text-blue-500 mb-2 font-bold uppercase tracking-wider">Mid Target (Base)</p>
                            <p className="text-4xl font-bold text-blue-600">${valuationData.targets?.midPrice.toFixed(2)}</p>
                        </div>
                        <div
                            className="p-8 rounded-[32px] text-center relative overflow-hidden group animate-scale-in opacity-0"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                                animationDelay: '300ms'
                            }}
                        >
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                            <p className="text-sm text-emerald-500 mb-2 font-bold uppercase tracking-wider">Upper Target (Bull)</p>
                            <p className="text-4xl font-bold text-emerald-600">${valuationData.targets?.goodPrice.toFixed(2)}</p>
                        </div>
                    </div>

                    {/* AI Analysis */}
                    <div
                        className="p-8 rounded-[32px] animate-fade-in-up opacity-0"
                        style={{
                            background: "#E0E5EC",
                            boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                            animationDelay: '400ms'
                        }}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <FileText className="text-blue-500" />
                            <h3 className="text-xl font-bold text-gray-700">AI Analysis</h3>
                        </div>
                        <p className="leading-relaxed text-gray-600 font-medium">{aiAnalysis}</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Fundamentals Table */}
                        <div
                            className="p-8 rounded-[32px] animate-fade-in-up opacity-0"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                                animationDelay: '500ms'
                            }}
                        >
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-700">
                                <TrendingUp size={20} className="text-gray-500" /> Latest Fundamentals
                            </h3>
                            <div className="mb-6">
                                <span
                                    className="px-4 py-2 rounded-full text-xs font-bold text-blue-500"
                                    style={{
                                        background: "#E0E5EC",
                                        boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff"
                                    }}
                                >
                                    Model: {valuationData.valuationModel}
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <tbody className="divide-y divide-gray-300/30">
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
                        <div
                            className="p-8 rounded-[32px] animate-fade-in-up opacity-0"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                                animationDelay: '600ms'
                            }}
                        >
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-700">
                                <Target size={20} className="text-gray-500" /> Scenario Assumptions
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-300/30 text-left">
                                            <th className="py-2 text-gray-400 font-bold uppercase text-xs tracking-wider">Metric</th>
                                            <th className="py-2 text-blue-500 font-bold text-right">Mid Scenario</th>
                                            <th className="py-2 text-emerald-500 font-bold text-right">Good Scenario</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-300/30 text-gray-700">
                                        <tr>
                                            <td className="py-3 font-medium">Revenue CAGR</td>
                                            <td className="py-3 text-right font-mono text-gray-500">{(valuationData.scenarios?.mid.revenueCagr! * 100).toFixed(1)}%</td>
                                            <td className="py-3 text-right font-mono text-gray-500">{(valuationData.scenarios?.good.revenueCagr! * 100).toFixed(1)}%</td>
                                        </tr>
                                        <tr>
                                            <td className="py-3 font-medium">Op Margin</td>
                                            <td className="py-3 text-right font-mono text-gray-500">{(valuationData.scenarios?.mid.operatingMargin! * 100).toFixed(1)}%</td>
                                            <td className="py-3 text-right font-mono text-gray-500">{(valuationData.scenarios?.good.operatingMargin! * 100).toFixed(1)}%</td>
                                        </tr>
                                        <tr>
                                            <td className="py-3 font-medium">Tax Rate</td>
                                            <td className="py-3 text-right font-mono text-gray-500">{(valuationData.scenarios?.mid.taxRate! * 100).toFixed(1)}%</td>
                                            <td className="py-3 text-right font-mono text-gray-500">{(valuationData.scenarios?.good.taxRate! * 100).toFixed(1)}%</td>
                                        </tr>
                                        <tr>
                                            <td className="py-3 font-medium">Exit P/E</td>
                                            <td className="py-3 text-right font-mono text-gray-500">{valuationData.scenarios?.mid.peMultiple}x</td>
                                            <td className="py-3 text-right font-mono text-gray-500">{valuationData.scenarios?.good.peMultiple}x</td>
                                        </tr>
                                        <tr>
                                            <td className="py-3 font-medium">Discount Rate</td>
                                            <td className="py-3 text-right font-mono text-gray-500">10.0%</td>
                                            <td className="py-3 text-right font-mono text-gray-500">10.0%</td>
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
        <td className="py-3 text-gray-700 font-medium">{label}</td>
        <td className="py-3 text-gray-500 text-right font-mono font-bold">
            {isCurrency ? '$' : ''}{value ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}
        </td>
    </tr>
);

export default BetaTest;
