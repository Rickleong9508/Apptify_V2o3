import React, { useState, useEffect } from 'react';
import { aiService, AIProvider } from '../services/aiService';
import { investSkillService, PromptInfo, InvestmentSignal } from '../services/investSkillService';
import { stockService, DetailedStockData } from '../services/stockService';
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
    LineChart,
    Cpu,
    CheckCircle,
    Info,
    FileText,
    Download,
    Eye,
    Sliders,
    Zap,
    BookOpen,
    ShieldAlert
} from 'lucide-react';

interface AutoCountProps {
    onExit: () => void;
}

const AutoCount: React.FC<AutoCountProps> = ({ onExit }) => {
    const [symbol, setSymbol] = useState('');
    const [loading, setLoading] = useState(false);
    const [stockData, setStockData] = useState<DetailedStockData | null>(null);
    const [promptsList, setPromptsList] = useState<PromptInfo[]>([]);
    const [selectedPromptId, setSelectedPromptId] = useState('stock-eval');
    
    // AI Analysis states
    const [generatingReport, setGeneratingReport] = useState(false);
    const [reportMarkdown, setReportMarkdown] = useState('');
    const [parsedSignal, setParsedSignal] = useState<InvestmentSignal | null>(null);
    const [error, setError] = useState<string | null>(null);

    const apiKey = localStorage.getItem('app_global_api_key') || '';
    const aiProvider = (localStorage.getItem('app_global_ai_provider') as AIProvider) || 'google';
    const aiModel = localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash';

    useEffect(() => {
        const loadPrompts = async () => {
            try {
                const list = await investSkillService.listPrompts();
                setPromptsList(list);
                if (list.some(p => p.id === 'stock-eval')) {
                    setSelectedPromptId('stock-eval');
                } else if (list.length > 0) {
                    setSelectedPromptId(list[0].id);
                }
            } catch (err) {
                console.error("Failed to load prompt frameworks:", err);
            }
        };
        loadPrompts();
    }, []);

    useEffect(() => {
        (window as any).__apptify_autocount = {
            symbol,
            setSymbol,
            handleSearch,
            handleRunAnalysis,
            generatingReport,
            reportMarkdown,
            parsedSignal
        };
        return () => {
            (window as any).__apptify_autocount = null;
        };
    }, [symbol, stockData, generatingReport, reportMarkdown, parsedSignal]);

    const handleSearch = async (searchSymbol?: string) => {
        const activeSymbol = searchSymbol || symbol;
        if (!activeSymbol.trim()) return;

        setLoading(true);
        setError(null);
        setStockData(null);
        setReportMarkdown('');
        setParsedSignal(null);

        try {
            const data = await stockService.getDetailedQuote(activeSymbol.toUpperCase());
            setStockData(data);
            return data;
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to find US stock ticker. Please check symbol (e.g. AAPL, PLTR, MSFT).');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const handleRunAnalysis = async (customStockData?: DetailedStockData) => {
        const activeStockData = customStockData || stockData;
        if (!activeStockData || !apiKey) return;

        setGeneratingReport(true);
        setError(null);
        setReportMarkdown('');
        setParsedSignal(null);

        try {
            const promptTemplate = await investSkillService.readPrompt(selectedPromptId);
            
            const financials = activeStockData.valuationFields || {};
            const revenueBillions = financials.revenueTtm ? (financials.revenueTtm / 1e9).toFixed(3) + 'B' : 'N/A';
            const netIncomeBillions = financials.netIncomeTtm ? (financials.netIncomeTtm / 1e9).toFixed(3) + 'B' : 'N/A';
            const fcfBillions = financials.obsFreeCashFlowTtm ? (financials.obsFreeCashFlowTtm / 1e9).toFixed(3) + 'B' : 'N/A';
            const cashBillions = financials.cashAndEquivalents ? (financials.cashAndEquivalents / 1e9).toFixed(3) + 'B' : 'N/A';
            const debtBillions = financials.totalDebt ? (financials.totalDebt / 1e9).toFixed(3) + 'B' : 'N/A';
            const marketCapBillions = activeStockData.marketCap ? (activeStockData.marketCap / 1e9).toFixed(3) + 'B' : 'N/A';

            const financialContext = `
=== live quotes and raw financial data ===
Ticker: ${activeStockData.symbol}
Company Description: ${activeStockData.description ? activeStockData.description.slice(0, 500) + '...' : 'N/A'}
Current Stock Price: $${activeStockData.price}
Market Cap: $${marketCapBillions}
Trailing PE Ratio: ${activeStockData.peRatio ? activeStockData.peRatio.toFixed(2) : 'N/A'}
PEG Ratio: ${activeStockData.pegRatio ? activeStockData.pegRatio.toFixed(2) : 'N/A'}
Trailing EPS: ${activeStockData.eps ? activeStockData.eps.toFixed(2) : 'N/A'}
Revenue Growth: ${activeStockData.financeGrowth ? (activeStockData.financeGrowth * 100).toFixed(2) + '%' : 'N/A'}
Dividend Rate: $${activeStockData.dividendRate ? activeStockData.dividendRate.toFixed(2) : '0.00'}

=== TTM Financial Ratios ===
TTM Revenue: $${revenueBillions} (Latest Quarter Rev: $${(financials.revenueQtr / 1e9).toFixed(3)}B)
TTM Net Income: $${netIncomeBillions}
TTM Free Cash Flow (FCF): $${fcfBillions}
Total Cash & Equivalents: $${cashBillions}
Total Debt: $${debtBillions}
Shares Outstanding: ${financials.sharesOutstanding ? (financials.sharesOutstanding / 1e9).toFixed(3) + 'B' : 'N/A'}
Book Value Per Share: $${activeStockData.bookValue ? activeStockData.bookValue.toFixed(2) : 'N/A'}

=== Technical Price Action (Last 30 Days) ===
30-Day VWAP: $${activeStockData.vwap ? activeStockData.vwap.toFixed(2) : 'N/A'}
Volume Trend: ${activeStockData.volumeSignal}
Recent Price History (Close Prices): ${activeStockData.history ? activeStockData.history.slice(-10).map(h => `$${h.close.toFixed(2)}`).join(', ') : 'N/A'}
`;

            const systemInstruction = `
You are an institutional equity researcher. Execute the selected investment framework strictly adhering to its prompts instructions.
You must retrieve the provided live metrics and run all DCF, DuPont, or Technical assessments as required.

At the very end of your response, you MUST include the standardized INVESTMENT SIGNAL block exactly in the following format so it can be parsed:

╔══════════════════════════════════════════════╗
║              INVESTMENT SIGNAL               ║
╠══════════════════════════════════════════════╣
║ Signal:      BULLISH / NEUTRAL / BEARISH     ║
║ Confidence:  HIGH / MEDIUM / LOW             ║
║ Horizon:     SHORT / MEDIUM / LONG-TERM      ║
║ Score:       X.X / 10                        ║
╠══════════════════════════════════════════════╣
║ Action:      BUY / HOLD / SELL               ║
║ Conviction:  STRONG / MODERATE / WEAK        ║
╚══════════════════════════════════════════════╝

Score Guide: 8.0–10.0 Strongly Bullish | 6.0–7.9 Moderately Bullish | 4.0–5.9 Neutral | 2.0–3.9 Moderately Bearish | 0.0–1.9 Strongly Bearish.
Do not omit this signal box.
`;

            const finalPrompt = `
Selected framework instructions:
${promptTemplate}

Ticker and real-time financial stats to analyze:
${financialContext}

Please run the framework and output the research report with the Signal Block at the bottom.
`;

            const response = await aiService.generate(aiProvider, aiModel, apiKey, finalPrompt, systemInstruction);
            setReportMarkdown(response);
            
            const parsed = investSkillService.parseInvestmentSignal(response);
            setParsedSignal(parsed);
            return { report: response, signal: parsed };

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to complete InvestSkill analysis.');
            throw err;
        } finally {
            setGeneratingReport(false);
        }
    };

    const handleSaveReport = async () => {
        if (!stockData || !reportMarkdown || !parsedSignal) return;

        try {
            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `${stockData.symbol}_InvestReport_${selectedPromptId}_${dateStr}.html`;
            const scoreColor = parsedSignal.signal === 'BULLISH' ? '#10B981' : (parsedSignal.signal === 'BEARISH' ? '#EF4444' : '#F59E0B');
            
            const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${stockData.symbol} - ${selectedPromptId.toUpperCase()} InvestReport</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        body {
            background-color: #0F172A;
            color: #F8FAFC;
            font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 40px 20px;
            display: flex;
            justify-content: center;
        }
        .container {
            max-width: 900px;
            width: 100%;
            background: #1E293B;
            padding: 40px;
            border-radius: 32px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        }
        h1 {
            color: #FFFFFF;
            font-size: 28px;
            font-weight: 800;
            text-align: center;
            margin-bottom: 8px;
        }
        .header-meta {
            text-align: center;
            font-size: 13px;
            color: #94A3B8;
            margin-bottom: 32px;
        }
        .signal-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 12px;
            margin-bottom: 36px;
        }
        .signal-card {
            background: rgba(255, 255, 255, 0.04);
            padding: 16px;
            border-radius: 20px;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .signal-val {
            font-size: 18px;
            font-weight: 700;
            margin-top: 6px;
            color: #FFFFFF;
        }
        .signal-label {
            font-size: 11px;
            font-weight: 600;
            color: #94A3B8;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .score-card {
            background: rgba(59, 130, 246, 0.1);
            border: 2px solid ${scoreColor};
        }
        .score-val {
            font-size: 32px;
            font-weight: 800;
            color: ${scoreColor};
            margin-top: 4px;
        }
        .report-content {
            line-height: 1.8;
            font-size: 14px;
            color: #E2E8F0;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            padding-top: 28px;
        }
        .report-content h2, .report-content h3 {
            color: #38BDF8;
            margin-top: 24px;
            margin-bottom: 12px;
        }
        .report-content p {
            margin-bottom: 16px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${stockData.symbol} Institutional Research Report</h1>
        <div class="header-meta">
            Generated: ${new Date().toLocaleString()} | Framework: ${selectedPromptId.toUpperCase()}
        </div>
        
        <div class="signal-grid">
            <div class="signal-card score-card">
                <div class="signal-label">Overall Score</div>
                <div class="score-val">${parsedSignal.score.toFixed(1)}/10</div>
            </div>
            <div class="signal-card">
                <div class="signal-label">Signal</div>
                <div class="signal-val" style="color: ${scoreColor}">${parsedSignal.signal}</div>
            </div>
            <div class="signal-card">
                <div class="signal-label">Action</div>
                <div class="signal-val">${parsedSignal.action}</div>
            </div>
            <div class="signal-card">
                <div class="signal-label">Conviction</div>
                <div class="signal-val">${parsedSignal.conviction}</div>
            </div>
            <div class="signal-card">
                <div class="signal-label">Confidence</div>
                <div class="signal-val">${parsedSignal.confidence}</div>
            </div>
            <div class="signal-card">
                <div class="signal-label">Horizon</div>
                <div class="signal-val">${parsedSignal.horizon}</div>
            </div>
        </div>
        
        <div class="report-content">
            ${reportMarkdown
                .replace(/\n\n/g, '</p><p>')
                .replace(/### (.*)/g, '<h3>$1</h3>')
                .replace(/## (.*)/g, '<h2>$1</h2>')
                .replace(/^- (.*)/gm, '<li>$1</li>')
                .replace(/(<li>.*<\/li>)/g, '<ul>$1<\/ul>')
                .replace(/<\/ul><ul>/g, '')
            }
        </div>
    </div>
</body>
</html>
`;

            try {
                const savedPath = await investSkillService.saveReport(fileName, htmlContent);
                alert(`Report successfully saved!\nLocation: ${savedPath}`);
            } catch (apiError: any) {
                console.warn("Workspace save failed, downloading directly:", apiError);
                const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', fileName);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
        } catch (e: any) {
            console.error("Failed to export report:", e);
            alert(`Export failed: ${e.message}`);
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
                        <BookOpen size={13} className="text-blue-500" />
                        <span>InvestSkill Framework Hub</span>
                    </div>
                </div>

                {/* Hero Search Box */}
                <div className="ios-card p-6 sm:p-8 text-center space-y-5">
                    <div>
                        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--ios-label-primary)]">
                            AutoCount & InvestSkill
                        </h1>
                        <p className="text-xs sm:text-sm text-[var(--ios-label-secondary)] mt-1.5 max-w-md mx-auto">
                            25 institutional analysis frameworks applied to real-time US equity data
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
                            placeholder="Enter US Ticker (e.g. AAPL, PLTR, NVDA)"
                            className="ios-input pl-11 pr-14 py-3.5 text-base sm:text-lg font-bold tracking-wide uppercase"
                        />
                        <button
                            onClick={() => handleSearch()}
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

                {/* Main UI layout once stock is loaded */}
                {stockData && (
                    <div className="space-y-6 animate-slide-up">
                        {/* Live Price Quote Card */}
                        <div className="ios-card p-6 sm:p-8 text-center relative overflow-hidden">
                            <span className="text-xs font-bold text-[var(--ios-label-tertiary)] uppercase tracking-widest">
                                {stockData.symbol}
                            </span>
                            <div className="flex items-center justify-center gap-3 mt-2">
                                <span className="text-4xl sm:text-6xl font-extrabold text-[var(--ios-label-primary)] tracking-tight">
                                    ${stockData.price.toFixed(2)}
                                </span>
                            </div>
                            <div className="mt-2.5 flex items-center justify-center">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold ${
                                    stockData.changePercent >= 0 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'
                                }`}>
                                    {stockData.changePercent >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                    <span>{stockData.changePercent.toFixed(2)}% Today</span>
                                </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-[var(--ios-separator)]">
                                <div className="p-2">
                                    <span className="text-[10px] font-semibold uppercase text-[var(--ios-label-tertiary)]">P/E Ratio</span>
                                    <p className="font-bold text-base sm:text-lg text-[var(--ios-label-primary)] mt-0.5">
                                        {stockData.peRatio ? stockData.peRatio.toFixed(1) : 'N/A'}
                                    </p>
                                </div>
                                <div className="p-2">
                                    <span className="text-[10px] font-semibold uppercase text-[var(--ios-label-tertiary)]">FCF (TTM)</span>
                                    <p className="font-bold text-base sm:text-lg text-[var(--ios-label-primary)] mt-0.5">
                                        {stockData.valuationFields?.obsFreeCashFlowTtm ? `$${(stockData.valuationFields.obsFreeCashFlowTtm / 1e9).toFixed(2)}B` : 'N/A'}
                                    </p>
                                </div>
                                <div className="p-2">
                                    <span className="text-[10px] font-semibold uppercase text-[var(--ios-label-tertiary)]">Market Cap</span>
                                    <p className="font-bold text-base sm:text-lg text-[var(--ios-label-primary)] mt-0.5">
                                        ${(stockData.marketCap / 1e9).toFixed(2)}B
                                    </p>
                                </div>
                                <div className="p-2">
                                    <span className="text-[10px] font-semibold uppercase text-[var(--ios-label-tertiary)]">Volume Signal</span>
                                    <p className={`font-bold text-base sm:text-lg mt-0.5 ${
                                        stockData.volumeSignal === 'Bullish' ? 'text-emerald-500' : stockData.volumeSignal === 'Bearish' ? 'text-rose-500' : 'text-[var(--ios-label-primary)]'
                                    }`}>
                                        {stockData.volumeSignal}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Framework Selection Grid */}
                        <div className="ios-card p-6 sm:p-8 space-y-4">
                            <div className="flex items-center gap-2">
                                <Sliders size={18} className="text-blue-500" />
                                <h3 className="font-bold text-base text-[var(--ios-label-primary)]">
                                    Select Investment Framework ({promptsList.length})
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                                {promptsList.map((prompt) => {
                                    const isSelected = selectedPromptId === prompt.id;
                                    return (
                                        <button
                                            key={prompt.id}
                                            onClick={() => setSelectedPromptId(prompt.id)}
                                            className={`p-3 rounded-2xl text-left transition-all tap-scale flex flex-col justify-between ${
                                                isSelected
                                                    ? 'bg-blue-500 text-white shadow-sm ring-2 ring-blue-500/50'
                                                    : 'bg-[var(--ios-fill-tertiary)] hover:bg-[var(--ios-fill-secondary)] text-[var(--ios-label-primary)]'
                                            }`}
                                        >
                                            <span className="text-xs font-bold leading-snug line-clamp-1">{prompt.title}</span>
                                            <span className={`text-[10px] font-mono mt-1 ${isSelected ? 'text-white/80' : 'text-[var(--ios-label-tertiary)]'}`}>
                                                {prompt.id}.md
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="pt-2">
                                <button
                                    onClick={() => handleRunAnalysis()}
                                    disabled={generatingReport || !apiKey}
                                    className="w-full ios-button-primary py-4 text-sm font-semibold flex items-center justify-center gap-2 tap-scale disabled:opacity-40"
                                >
                                    {generatingReport ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            <span>Running Framework Analysis...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={18} />
                                            <span>Execute Analysis with AI</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Parsed Signal & Research Report */}
                        {parsedSignal && (
                            <div className="space-y-6 animate-slide-up">
                                {/* Signal Dashboard Card */}
                                <div className="ios-card p-6 sm:p-8 space-y-6">
                                    <div className="flex items-center justify-between pb-3 border-b border-[var(--ios-separator)]">
                                        <h3 className="font-bold text-base text-[var(--ios-label-primary)]">
                                            Institutional Signal
                                        </h3>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm ${
                                            parsedSignal.signal === 'BULLISH' ? 'bg-emerald-500' : (parsedSignal.signal === 'BEARISH' ? 'bg-rose-500' : 'bg-amber-500')
                                        }`}>
                                            {parsedSignal.signal}
                                        </span>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-center gap-6">
                                        {/* Score Gauge */}
                                        <div className="w-28 h-28 rounded-3xl bg-[var(--ios-fill-tertiary)] flex flex-col items-center justify-center shrink-0 border border-[var(--ios-separator)]">
                                            <span className="text-3xl font-extrabold text-blue-500">
                                                {parsedSignal.score.toFixed(1)}
                                            </span>
                                            <span className="text-[10px] font-bold text-[var(--ios-label-tertiary)] uppercase mt-0.5">
                                                Score / 10
                                            </span>
                                        </div>

                                        {/* Grid Attributes */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full">
                                            <div className="p-3 rounded-2xl bg-[var(--ios-fill-tertiary)] text-center">
                                                <span className="text-[9px] font-semibold text-[var(--ios-label-tertiary)] uppercase">Action</span>
                                                <p className="font-bold text-sm text-[var(--ios-label-primary)] mt-0.5">{parsedSignal.action}</p>
                                            </div>
                                            <div className="p-3 rounded-2xl bg-[var(--ios-fill-tertiary)] text-center">
                                                <span className="text-[9px] font-semibold text-[var(--ios-label-tertiary)] uppercase">Conviction</span>
                                                <p className="font-bold text-sm text-[var(--ios-label-primary)] mt-0.5">{parsedSignal.conviction}</p>
                                            </div>
                                            <div className="p-3 rounded-2xl bg-[var(--ios-fill-tertiary)] text-center">
                                                <span className="text-[9px] font-semibold text-[var(--ios-label-tertiary)] uppercase">Confidence</span>
                                                <p className="font-bold text-sm text-[var(--ios-label-primary)] mt-0.5">{parsedSignal.confidence}</p>
                                            </div>
                                            <div className="p-3 rounded-2xl bg-[var(--ios-fill-tertiary)] text-center">
                                                <span className="text-[9px] font-semibold text-[var(--ios-label-tertiary)] uppercase">Horizon</span>
                                                <p className="font-bold text-sm text-[var(--ios-label-primary)] mt-0.5">{parsedSignal.horizon}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Full Report Card */}
                                <div className="ios-card p-6 sm:p-8 space-y-4">
                                    <div className="flex items-center justify-between pb-3 border-b border-[var(--ios-separator)]">
                                        <div className="flex items-center gap-2">
                                            <FileText size={18} className="text-blue-500" />
                                            <h3 className="font-bold text-base text-[var(--ios-label-primary)]">
                                                Detailed Research Report
                                            </h3>
                                        </div>
                                        <button
                                            onClick={handleSaveReport}
                                            className="ios-button-secondary text-xs flex items-center gap-1.5 py-1.5 px-3 tap-scale"
                                        >
                                            <Download size={14} />
                                            <span>Export HTML</span>
                                        </button>
                                    </div>

                                    <div className="prose max-w-none text-xs sm:text-sm text-[var(--ios-label-primary)] space-y-3 leading-relaxed">
                                        {reportMarkdown.split('\n').map((line, index) => {
                                            if (line.startsWith('###')) {
                                                return <h4 key={index} className="text-sm sm:text-base font-bold text-[var(--ios-label-primary)] mt-4 mb-1">{line.replace('###', '')}</h4>;
                                            }
                                            if (line.startsWith('##') || line.startsWith('#')) {
                                                return <h3 key={index} className="text-base sm:text-lg font-bold text-blue-500 mt-5 mb-2 border-b border-[var(--ios-separator)] pb-1">{line.replace('##', '').replace('#', '')}</h3>;
                                            }
                                            if (line.trim().startsWith('-')) {
                                                return <li key={index} className="ml-4 list-disc text-[var(--ios-label-secondary)]">{line.replace('-', '').trim()}</li>;
                                            }
                                            if (line.trim() === '') {
                                                return null;
                                            }
                                            return <p key={index} className="text-[var(--ios-label-secondary)]">{line}</p>;
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Empty State */}
                {!stockData && !loading && (
                    <div className="text-center py-16 ios-card border-dashed border-2 flex flex-col items-center justify-center">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--ios-fill-tertiary)] flex items-center justify-center text-[var(--ios-label-tertiary)] mb-3">
                            <Cpu size={26} />
                        </div>
                        <h4 className="text-sm font-bold text-[var(--ios-label-primary)]">InvestSkill Analysis Ready</h4>
                        <p className="text-xs text-[var(--ios-label-secondary)] mt-1 max-w-xs">
                            Enter any US ticker above to select from 25 institutional frameworks including DCF, Buffett MOAT, and DuPont models.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AutoCount;
