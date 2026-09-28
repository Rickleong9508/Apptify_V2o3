import React, { useState } from 'react';
import { aiService, AIProvider } from '../services/aiService';
import {
    Search,
    TrendingUp,
    TrendingDown,
    Activity,
    BarChart3,
    AlertCircle,
    ChevronLeft,
    Sparkles,
    Loader2,
    DollarSign,
    ArrowRight,
    Calculator,
    Target,
    Briefcase,
    LineChart
} from 'lucide-react';
import { stockService, DetailedStockData } from '../services/stockService';

interface AiValuationProps {
    onExit: () => void;
}

const AiValuation: React.FC<AiValuationProps> = ({ onExit }) => {
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
            const stockData = await stockService.getDetailedQuote(symbol);
            setData(stockData);

            if (apiKey) {
                setIsCalculatingAi(true);

                const valuationPromise = aiService.analyzeValuation(aiProvider, aiModel, apiKey, stockData.symbol, stockData)
                    .then(val => setAiValuation(val))
                    .catch(e => console.error("Auto-Valuation Failed", e));

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
                setAiAnalysis("Configure API Key in Global Settings for AI-powered valuation.");
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
        <div className="min-h-screen pb-24 animate-fade-in text-[var(--ios-label-primary)]">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header & Back Button */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={onExit}
                        className="flex items-center gap-1.5 text-blue-500 font-semibold text-sm tap-scale"
                    >
                        <ChevronLeft size={20} />
                        <span>Back to Launcher</span>
                    </button>
                    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ios-label-secondary)] bg-[var(--ios-fill-tertiary)] px-3 py-1 rounded-full">
                        <Sparkles size={13} className="text-amber-500" />
                        <span>AI Valuation Engine</span>
                    </div>
                </div>

                {/* Hero Search Box */}
                <div className="ios-card p-6 sm:p-8 text-center space-y-5">
                    <div>
                        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--ios-label-primary)]">
                            Market Intelligence & Valuation
                        </h1>
                        <p className="text-xs sm:text-sm text-[var(--ios-label-secondary)] mt-1.5 max-w-md mx-auto">
                            Instant multi-model DCF/PE valuation, volume flow analysis, and automated equity research
                        </p>
                    </div>

                    <div className="max-w-md mx-auto relative">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[var(--ios-label-tertiary)]">
                            <Search size={18} />
                        </div>
                        <input
                            type="text"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Enter Ticker (e.g. AAPL, NVDA, TSLA)"
                            className="ios-input pl-11 pr-14 py-3.5 text-base sm:text-lg font-bold tracking-wide uppercase"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={loading || !symbol.trim()}
                            className="absolute right-2 top-2 bottom-2 px-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white rounded-xl flex items-center justify-center tap-scale transition-colors shadow-sm"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                        </button>
                    </div>

                    {error && (
                        <div className="flex items-center justify-center gap-2 text-xs text-rose-500 bg-rose-500/10 py-2.5 px-4 rounded-xl max-w-md mx-auto">
                            <AlertCircle size={15} />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                {/* Live Stock Results */}
                {data && (
                    <div className="space-y-6 animate-slide-up">
                        {/* Live Price Hero Card */}
                        <div className="ios-card p-6 sm:p-8 text-center relative overflow-hidden">
                            <span className="text-xs font-bold text-[var(--ios-label-tertiary)] uppercase tracking-widest">
                                {data.symbol} Live Quote
                            </span>
                            <div className="flex items-center justify-center gap-3 mt-2">
                                <span className="text-4xl sm:text-6xl font-extrabold text-[var(--ios-label-primary)] tracking-tight">
                                    ${data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="mt-3 flex items-center justify-center">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold ${
                                    data.changePercent >= 0 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'
                                }`}>
                                    {data.changePercent >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                    <span>{data.changePercent >= 0 ? '+' : ''}{data.changePercent.toFixed(2)}% Today</span>
                                </span>
                            </div>

                            {isCalculatingAi && (
                                <div className="mt-6 flex flex-col items-center gap-2">
                                    <Loader2 size={20} className="animate-spin text-blue-500" />
                                    <span className="text-xs font-semibold text-blue-500">Generating AI Fair Value Estimate...</span>
                                </div>
                            )}
                        </div>

                        {/* AI Fair Value Range Card */}
                        {aiValuation && (
                            <div className="ios-card p-6 sm:p-8 border-2 border-blue-500/30 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
                                            <Target size={18} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-base text-[var(--ios-label-primary)]">
                                                AI Estimated Fair Value
                                            </h3>
                                            <p className="text-xs text-[var(--ios-label-secondary)]">
                                                Model: {aiValuation.methodology || 'Multi-Factor DCF'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider ${
                                            aiValuation.rating === 'Buy'
                                                ? 'bg-emerald-500 text-white'
                                                : aiValuation.rating === 'Sell'
                                                ? 'bg-rose-500 text-white'
                                                : 'bg-amber-500 text-white'
                                        }`}>
                                            {aiValuation.rating} Rating
                                        </span>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-[var(--ios-fill-tertiary)] flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                                    <div>
                                        <span className="text-[11px] font-semibold text-[var(--ios-label-tertiary)] uppercase">
                                            Intrinsic Target Range
                                        </span>
                                        <div className="text-2xl sm:text-3xl font-extrabold text-[var(--ios-label-primary)] mt-0.5">
                                            ${aiValuation.fairValueLow} – ${aiValuation.fairValueHigh}
                                        </div>
                                    </div>
                                    {data.price && (
                                        <div className="text-xs font-semibold text-[var(--ios-label-secondary)]">
                                            Current: ${data.price.toFixed(2)}
                                        </div>
                                    )}
                                </div>

                                {aiValuation.reasoning && (
                                    <div className="text-xs sm:text-sm text-[var(--ios-label-secondary)] leading-relaxed italic border-l-2 border-blue-500 pl-3">
                                        "{aiValuation.reasoning}"
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Volume Flow & Market Thesis */}
                        <div className="ios-card p-6 sm:p-8 space-y-5">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center">
                                    <LineChart size={18} />
                                </div>
                                <h3 className="font-bold text-base text-[var(--ios-label-primary)]">
                                    Volume Prediction & Market Thesis
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-4 rounded-2xl bg-[var(--ios-fill-tertiary)] space-y-3">
                                    <span className="text-[10px] font-semibold text-[var(--ios-label-tertiary)] uppercase">
                                        Smart Signal
                                    </span>
                                    <div className={`text-2xl font-extrabold ${
                                        data.volumeSignal === 'Bullish'
                                            ? 'text-emerald-500'
                                            : data.volumeSignal === 'Bearish'
                                            ? 'text-rose-500'
                                            : 'text-[var(--ios-label-primary)]'
                                    }`}>
                                        {data.volumeSignal}
                                    </div>

                                    <div className="space-y-1.5 text-xs pt-2 border-t border-[var(--ios-separator)]">
                                        <div className="flex justify-between">
                                            <span className="text-[var(--ios-label-secondary)]">Real-time Vol</span>
                                            <span className="font-semibold">{data.volume.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[var(--ios-label-secondary)]">30d Avg Vol</span>
                                            <span className="font-semibold">{Math.round(data.avgVolume).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="md:col-span-2 p-5 rounded-2xl bg-[var(--ios-fill-tertiary)] flex flex-col justify-between space-y-3">
                                    <div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-[var(--ios-label-primary)] mb-1.5">
                                            <Briefcase size={14} className="text-blue-500" />
                                            <span>AI Research Synthesis</span>
                                        </div>
                                        <p className="text-xs sm:text-sm text-[var(--ios-label-secondary)] leading-relaxed">
                                            {aiAnalysis || data.prediction?.text || "Synthesizing market volume dynamics and fundamentals..."}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 pt-2 border-t border-[var(--ios-separator)] text-xs text-[var(--ios-label-secondary)]">
                                        <span className="bg-[var(--ios-fill-secondary)] px-2.5 py-1 rounded-md font-semibold">
                                            EPS: ${data.eps?.toFixed(2) || 'N/A'}
                                        </span>
                                        <span className="bg-[var(--ios-fill-secondary)] px-2.5 py-1 rounded-md font-semibold">
                                            P/E: {data.peRatio?.toFixed(1) || 'N/A'}x
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!data && !loading && (
                    <div className="text-center py-16 ios-card border-dashed border-2 flex flex-col items-center justify-center">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--ios-fill-tertiary)] flex items-center justify-center text-[var(--ios-label-tertiary)] mb-3">
                            <BarChart3 size={24} />
                        </div>
                        <h4 className="text-sm font-bold text-[var(--ios-label-primary)]">Ready for Stock Valuation</h4>
                        <p className="text-xs text-[var(--ios-label-secondary)] mt-1 max-w-xs">
                            Type any stock symbol like AAPL, NVDA, TSLA to view institutional volume flow and fair value metrics.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AiValuation;