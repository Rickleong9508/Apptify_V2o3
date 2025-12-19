import React, { useState } from 'react';
import { aiService, AIProvider } from '../services/aiService';
import {
    Search,
    TrendingUp,
    TrendingDown,
    Activity,
    BarChart3,
    AlertCircle,
    Triangle,
    Sparkles,
    Loader2,
    DollarSign,
    ArrowRight,
    Calculator,
    Scale,
    Target,
    Briefcase,
    LineChart,
    Cpu
} from 'lucide-react';

import { stockService, DetailedStockData } from '../services/stockService';

interface AutoCountProps {
    onExit: () => void;
}

const AutoCount: React.FC<AutoCountProps> = ({ onExit }) => {
    const [symbol, setSymbol] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<DetailedStockData | null>(null);
    const [aiAnalysis, setAiAnalysis] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [aiValuation, setAiValuation] = useState<any | null>(null);
    const [isCalculatingAi, setIsCalculatingAi] = useState(false);

    const apiKey = localStorage.getItem('app_global_api_key') || '';
    const aiProvider = (localStorage.getItem('app_global_ai_provider') as AIProvider) || 'google';
    const aiModel = localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash';

    const handleSearch = async () => {
        if (!symbol.trim()) return;

        setLoading(true);
        setError(null);
        setData(null);
        setAiAnalysis('');
        setAiValuation(null);
        setIsCalculatingAi(false);

        try {
            // 1. Fetch Real-time Detailed Data
            const stockData = await stockService.getDetailedQuote(symbol);
            setData(stockData);

            // 2. Auto-Trigger AI Analysis (AutoCount Logic)
            if (apiKey) {
                setIsCalculatingAi(true);

                // Valuation Request
                const valuationPromise = aiService.analyzeValuation(aiProvider, aiModel, apiKey, stockData.symbol, stockData)
                    .then(val => setAiValuation(val))
                    .catch(e => console.error("AutoCount Valuation Failed", e));

                // Narrative Request
                const prompt = `
          Based on the following PROFESSIONAL financial data for ${stockData.symbol}, provide a concise 3-sentence investment thesis.
          
          Market Data:
          - Price: ${stockData.price}
          - VWAP (30d): ${stockData.vwap ? stockData.vwap.toFixed(2) : 'N/A'}
          - Volume Signal: ${stockData.volumeSignal}
          - PE Ratio: ${stockData.peRatio ? stockData.peRatio.toFixed(1) : 'N/A'}
          - Avg Target Price: ${stockData.targetMeanPrice ? '$' + stockData.targetMeanPrice : 'N/A'}
          
          Output only the narrative text. No markdown. Focus on the Volume Signal and Analyst Consensus vs Price.
        `;
                const analysisPromise = aiService.generate(aiProvider, aiModel, apiKey, prompt)
                    .then(text => setAiAnalysis(text))
                    .catch(e => {
                        console.error("AI Narrative Failed", e);
                        setAiAnalysis("AI Analysis unavailable.");
                    });

                await Promise.allSettled([valuationPromise, analysisPromise]);
                setIsCalculatingAi(false);
            } else {
                setAiAnalysis("Configure API Key for AutoCount.");
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to analyze stock. Please check the symbol or try again.");
        } finally {
            setLoading(false);
            setIsCalculatingAi(false);
        }
    };

    return (
        <div className="flex h-screen overflow-hidden bg-[#E0E5EC] text-[#4A4A4A] font-sans selection:bg-gray-300 transition-colors duration-300 relative">
            <main className="flex-1 w-full h-full overflow-y-auto relative scroll-smooth">
                <div className="max-w-4xl mx-auto p-6 md:p-12 pb-40 animate-fade-in">

                    {/* Header */}
                    <div
                        onClick={onExit}
                        className="flex items-center gap-2 mb-12 pl-1 opacity-60 hover:opacity-100 transition-opacity w-fit select-none cursor-pointer group"
                    >
                        <div
                            className="w-10 h-10 rounded-[12px] flex items-center justify-center text-gray-600 transition-transform active:scale-95 group-hover:scale-105"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                            }}
                        >
                            <Triangle size={12} fill="currentColor" className="rotate-180" />
                        </div>
                        <span className="font-bold text-lg tracking-tight text-gray-700">AutoCount</span>
                    </div>

                    {/* Search Section */}
                    <div className="flex flex-col items-center mb-12">
                        <h1 className="text-4xl md:text-5xl font-bold text-center mb-6 tracking-tight text-gray-700">
                            AutoCount AI
                        </h1>

                        <div className="w-full max-w-lg relative group z-20">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">
                                <Search size={24} />
                            </div>
                            <input
                                type="text"
                                value={symbol}
                                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="Enter Symbol (e.g. AAPL, MSFT)"
                                className="w-full text-2xl font-bold py-6 pl-14 pr-16 rounded-[24px] outline-none transition-all placeholder:text-gray-300 uppercase text-gray-700"
                                style={{
                                    background: "#E0E5EC",
                                    boxShadow: "inset 6px 6px 12px #b8b9be, inset -6px -6px 12px #ffffff"
                                }}
                            />
                            <div className="absolute inset-y-0 right-3 flex items-center">
                                <button
                                    onClick={handleSearch}
                                    disabled={loading || !symbol}
                                    className="w-12 h-12 rounded-xl flex items-center justify-center text-gray-600 hover:text-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                                    style={{
                                        background: "#E0E5EC",
                                        boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                    }}
                                >
                                    {loading ? <Loader2 size={24} className="animate-spin" /> : <ArrowRight size={24} />}
                                </button>
                            </div>
                        </div>
                        {error && (
                            <div className="mt-6 flex items-center gap-2 text-red-500 bg-red-100 px-4 py-2 rounded-xl shadow-sm">
                                <AlertCircle size={18} />
                                <span className="font-medium text-sm">{error}</span>
                            </div>
                        )}
                    </div>

                    {/* Result Dashboard */}
                    {data && (
                        <div className="space-y-8 animate-slide-up">

                            <div className="grid grid-cols-1 gap-6">
                                {/* Hero Card: Price */}
                                <div
                                    className="p-8 md:p-10 rounded-[32px] relative overflow-hidden group text-center"
                                    style={{
                                        background: "#E0E5EC",
                                        boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                                    }}
                                >
                                    <div className="flex flex-col items-center justify-center gap-4">
                                        <p className="text-gray-500 font-bold tracking-widest text-sm uppercase">{data.symbol} Price</p>
                                        <div className="flex items-center justify-center gap-4">
                                            <h2 className="text-6xl md:text-7xl font-bold text-gray-800 tracking-tighter">
                                                {data.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </h2>
                                        </div>
                                        <div className={`px-5 py-2 rounded-full text-lg font-bold flex items-center shadow-inner w-fit ${data.changePercent > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                            {data.changePercent > 0 ? <TrendingUp size={20} className="mr-2" /> : <TrendingDown size={20} className="mr-2" />}
                                            {Math.abs(data.changePercent).toFixed(2)}%
                                        </div>
                                    </div>

                                    {/* AI Calculation Loader - AutoCount Branding */}
                                    {isCalculatingAi && (
                                        <div className="mt-8 flex flex-col items-center animate-pulse">
                                            <div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin mb-2"></div>
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">AutoCount Running...</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* AutoCount Result Card */}
                            {aiValuation && (
                                <div
                                    className="p-8 rounded-[32px] relative overflow-hidden group"
                                    style={{
                                        background: "#E0E5EC",
                                        boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                                    }}
                                >
                                    <div className="absolute top-4 right-4 text-gray-300 opacity-20">
                                        <Cpu size={120} />
                                    </div>

                                    <div className="flex flex-col md:flex-row gap-8 relative z-10">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="p-2 bg-gray-200 rounded-lg text-gray-600 shadow-sm">
                                                    <Target size={20} />
                                                </div>
                                                <h3 className="text-xl font-bold text-gray-700">AutoCount Fair Value</h3>
                                            </div>

                                            <div className="flex items-baseline gap-1 mb-2">
                                                <span className="text-4xl md:text-5xl font-bold text-gray-800">
                                                    ${aiValuation.fairValueLow} - ${aiValuation.fairValueHigh}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3 mt-4">
                                                <span className={`px-4 py-1.5 rounded-xl text-sm font-bold uppercase tracking-wider shadow-sm text-white ${aiValuation.rating === 'Buy' ? 'bg-emerald-500' : aiValuation.rating === 'Sell' ? 'bg-rose-500' : 'bg-amber-500'}`}>
                                                    {aiValuation.rating}
                                                </span>
                                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-300 px-3 py-1.5 rounded-xl">
                                                    Model: {aiValuation.methodology}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex-1 flex flex-col justify-center">
                                            <p className="text-sm text-gray-600 leading-relaxed italic border-l-4 border-gray-300 pl-4 py-1">
                                                "{aiValuation.reasoning}"
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Standard Analysis */}
                            <div
                                className="p-8 rounded-[32px] relative overflow-hidden"
                                style={{
                                    background: "#E0E5EC",
                                    boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                                }}
                            >
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 bg-gray-200 text-gray-600 rounded-xl flex items-center justify-center shadow-sm">
                                        <LineChart size={20} />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-700">Volume & AI Thesis</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="md:col-span-1 p-6 rounded-[24px]" style={{ boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}>
                                        <p className="text-xs font-bold uppercase text-gray-500 mb-2">Smart Signal</p>
                                        <p className={`text-3xl font-bold mb-4 ${data.volumeSignal === 'Bullish' ? 'text-emerald-500' : data.volumeSignal === 'Bearish' ? 'text-rose-500' : 'text-gray-700'}`}>
                                            {data.volumeSignal}
                                        </p>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-gray-500">Real-time Vol</span>
                                                <span className="font-mono font-bold text-gray-700">{data.volume.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 space-y-4">
                                        <div className="p-5 rounded-[24px] h-full flex flex-col justify-center border border-white/50" style={{ background: "rgba(255,255,255,0.4)" }}>
                                            <div className="flex gap-3 mb-3">
                                                <Briefcase size={18} className="text-gray-600 shrink-0 mt-0.5" />
                                                <h4 className="font-bold text-gray-700 text-sm">AI Market Thesis</h4>
                                            </div>
                                            <p className="text-sm text-gray-800 leading-relaxed mb-4">
                                                {aiAnalysis || "Analyzing Data..."}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[10px] text-right text-gray-400 mt-4 opacity-50 uppercase font-bold">
                                    Source: AutoCount AI Engine
                                </p>
                            </div>

                        </div>
                    )}

                    {!data && !loading && (
                        <div className="text-center py-20 opacity-40">
                            <Cpu size={48} className="mx-auto mb-4 text-gray-400" />
                            <p className="text-gray-500 font-medium">AutoCount: AI-Powered Stock Valuation</p>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
};

export default AutoCount;
