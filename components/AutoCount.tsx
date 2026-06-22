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

    // Load available frameworks list on mount
    useEffect(() => {
        const loadPrompts = async () => {
            try {
                const list = await investSkillService.listPrompts();
                setPromptsList(list);
                // Set default to stock-eval if present
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

    // Expose methods to window for Ask Apptify orchestration
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

    // Handle stock symbol search
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

    // Run selected InvestSkill analysis using AI
    const handleRunAnalysis = async (customStockData?: DetailedStockData) => {
        const activeStockData = customStockData || stockData;
        if (!activeStockData || !apiKey) return;

        setGeneratingReport(true);
        setError(null);
        setReportMarkdown('');
        setParsedSignal(null);

        try {
            // 1. Fetch prompt content
            const promptTemplate = await investSkillService.readPrompt(selectedPromptId);
            
            // 2. Format detailed financials context
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
            
            // Set Markdown report
            setReportMarkdown(response);
            
            // Parse Investment Signal
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

    // Save report as local HTML
    const handleSaveReport = async () => {
        if (!stockData || !reportMarkdown || !parsedSignal) return;

        try {
            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `${stockData.symbol}_InvestReport_${selectedPromptId}_${dateStr}.html`;

            const scoreColor = parsedSignal.signal === 'BULLISH' ? '#319795' : (parsedSignal.signal === 'BEARISH' ? '#E53E3E' : '#D69E2E');
            
            const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${stockData.symbol} - ${selectedPromptId.toUpperCase()} InvestReport</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            background-color: #E0E5EC;
            color: #4A4A4A;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 40px 20px;
            display: flex;
            justify-content: center;
        }
        .container {
            max-width: 900px;
            width: 100%;
            background: #E0E5EC;
            padding: 40px;
            border-radius: 40px;
            box-shadow: 9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5);
        }
        h1 {
            color: #2D3748;
            font-size: 32px;
            font-weight: 700;
            text-align: center;
            margin-bottom: 30px;
        }
        .header-meta {
            text-align: center;
            font-size: 14px;
            color: #718096;
            margin-bottom: 40px;
        }
        .signal-grid {
            display: grid;
            grid-template-cols: repeat(auto-fit, minmax(130px, 1fr));
            gap: 15px;
            margin-bottom: 40px;
        }
        .signal-card {
            background: #E0E5EC;
            padding: 15px;
            border-radius: 20px;
            text-align: center;
            box-shadow: inset 4px 4px 8px #b8b9be, inset -4px -4px 8px #ffffff;
        }
        .signal-val {
            font-size: 18px;
            font-weight: 700;
            margin-top: 5px;
            color: #2D3748;
        }
        .signal-label {
            font-size: 10px;
            font-weight: 600;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .score-card {
            background: #E0E5EC;
            box-shadow: 6px 6px 12px #b8b9be, -6px -6px 12px #ffffff;
            border: 2px solid ${scoreColor};
        }
        .score-val {
            font-size: 28px;
            font-weight: 800;
            color: ${scoreColor};
            margin-top: 5px;
        }
        .report-content {
            line-height: 1.8;
            font-size: 15px;
            color: #2D3748;
            border-top: 2px solid rgba(0,0,0,0.05);
            padding-top: 30px;
        }
        .report-content h2, .report-content h3 {
            color: #2B6CB0;
            margin-top: 30px;
            margin-bottom: 15px;
        }
        .report-content p {
            margin-bottom: 20px;
        }
        .report-content table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            box-shadow: inset 2px 2px 5px #b8b9be, inset -2px -2px 5px #ffffff;
            border-radius: 10px;
            overflow: hidden;
        }
        .report-content th, .report-content td {
            padding: 12px 15px;
            text-align: left;
        }
        .report-content th {
            background-color: rgba(0,0,0,0.03);
            color: #4A5568;
            font-weight: 600;
        }
        .report-content td {
            border-bottom: 1px solid rgba(0,0,0,0.02);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${stockData.symbol} InvestReport (${selectedPromptId.toUpperCase()})</h1>
        <div class="header-meta">
            Generated: ${new Date().toLocaleString()} | Framework: yennanliu/InvestSkill
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
                alert(`Report saved to workspace!\nPath: ${savedPath}`);
            } catch (apiError: any) {
                console.warn("Workspace save failed, falling back to browser download:", apiError);
                
                // Browser direct download fallback (works on mobile & deployed environments)
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
        <div className="flex h-screen overflow-hidden bg-[#E0E5EC] text-[#4A4A4A] font-sans selection:bg-gray-300 transition-colors duration-300 relative">
            <main className="flex-1 w-full h-full overflow-y-auto relative scroll-smooth">
                <div className="max-w-4xl mx-auto p-6 md:p-12 pb-40 animate-fade-in">

                    {/* Exit Header */}
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
                        <span className="font-bold text-lg tracking-tight text-gray-700">InvestSkill OS</span>
                    </div>

                    {/* Hero Title */}
                    <div className="flex flex-col items-center mb-12">
                        <h1 className="text-4xl md:text-5xl font-bold text-center mb-2 tracking-tight text-gray-700 flex items-center gap-3">
                            <BookOpen className="text-blue-500 fill-blue-500" size={36} /> InvestSkill
                        </h1>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-8">
                            US Stock Investment Analysis Frameworks
                        </p>

                        {/* Search Input Bar */}
                        <div className="w-full max-w-lg relative group z-20 mb-6">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">
                                <Search size={24} />
                            </div>
                            <input
                                type="text"
                                value={symbol}
                                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="Enter US Ticker (e.g. AAPL, PLTR, TSLA)"
                                className="w-full text-xl font-bold py-6 pl-14 pr-16 rounded-[24px] outline-none transition-all placeholder:text-gray-300 text-gray-700 uppercase"
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

                    {/* Main UI layout once stock is loaded */}
                    {stockData && (
                        <div className="space-y-8 animate-slide-up">

                            {/* Stock Ticker Summary */}
                            <div
                                className="p-8 rounded-[32px] relative overflow-hidden text-center"
                                style={{
                                    background: "#E0E5EC",
                                    boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                                }}
                            >
                                <p className="text-gray-400 font-bold tracking-widest text-xs uppercase mb-2">
                                    {stockData.symbol}
                                </p>
                                
                                <div className="flex flex-col items-center justify-center gap-2">
                                    <h2 className="text-5xl md:text-6xl font-bold text-gray-800 tracking-tighter">
                                        ${stockData.price.toFixed(2)}
                                    </h2>
                                    <div className={`px-4 py-1.5 rounded-full text-sm font-bold flex items-center shadow-inner ${stockData.changePercent > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                        {stockData.changePercent > 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                                        {stockData.changePercent.toFixed(2)}%
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-gray-300/40">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">PE Ratio</p>
                                        <p className="text-lg font-bold text-gray-700">{stockData.peRatio ? stockData.peRatio.toFixed(1) : 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">FCF (TTM)</p>
                                        <p className="text-lg font-bold text-gray-700">
                                            {stockData.valuationFields?.obsFreeCashFlowTtm ? `$${(stockData.valuationFields.obsFreeCashFlowTtm / 1e9).toFixed(2)}B` : 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">Market Cap</p>
                                        <p className="text-lg font-bold text-gray-700">${(stockData.marketCap / 1e9).toFixed(2)}B</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">Volume Signal</p>
                                        <p className="text-lg font-bold text-gray-700">{stockData.volumeSignal}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Framework Prompts Selection Card */}
                            <div
                                className="p-8 rounded-[32px] relative overflow-hidden"
                                style={{
                                    background: "#E0E5EC",
                                    boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                                }}
                            >
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 bg-gray-200 text-gray-600 rounded-xl flex items-center justify-center shadow-sm">
                                        <Sliders size={20} />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-700">Select InvestSkill Framework</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {promptsList.map((prompt) => (
                                        <button
                                            key={prompt.id}
                                            onClick={() => setSelectedPromptId(prompt.id)}
                                            className={`p-4 rounded-2xl text-left transition-all duration-300 ${selectedPromptId === prompt.id ? 'text-blue-600 font-bold' : 'text-gray-600'}`}
                                            style={{
                                                background: "#E0E5EC",
                                                boxShadow: selectedPromptId === prompt.id 
                                                    ? "inset 4px 4px 8px #b8b9be, inset -4px -4px 8px #ffffff" 
                                                    : "4px 4px 8px #b8b9be, -4px -4px 8px #ffffff"
                                            }}
                                        >
                                            <p className="text-sm">{prompt.title}</p>
                                            <p className="text-[9px] text-gray-400 mt-1 font-mono">{prompt.id}.md</p>
                                        </button>
                                    ))}
                                </div>

                                <div className="flex justify-center pt-8">
                                    <button
                                        onClick={handleRunAnalysis}
                                        disabled={generatingReport || !apiKey}
                                        className="w-full max-w-md py-5 px-8 rounded-3xl text-lg font-bold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all active:scale-95 shadow-md"
                                    >
                                        {generatingReport ? (
                                            <>
                                                <Loader2 size={24} className="animate-spin" />
                                                <span>Running Framework Analysis...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={24} className="fill-white" />
                                                <span>Run InvestSkill Analysis</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Investment Signal Dashboard */}
                            {parsedSignal && (
                                <div className="space-y-8 animate-slide-up">
                                    
                                    {/* Signal block metrics */}
                                    <div
                                        className="p-8 rounded-[32px]"
                                        style={{
                                            background: "#E0E5EC",
                                            boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                                        }}
                                    >
                                        <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-300/40">
                                            <h3 className="text-xl font-bold text-gray-700">Parsed Investment Signal</h3>
                                            <span className={`px-4 py-1.5 rounded-full text-xs font-bold text-white shadow-sm ${
                                                parsedSignal.signal === 'BULLISH' ? 'bg-teal-500' : (parsedSignal.signal === 'BEARISH' ? 'bg-rose-500' : 'bg-amber-500')
                                            }`}>
                                                {parsedSignal.signal}
                                            </span>
                                        </div>

                                        <div className="flex flex-col md:flex-row gap-8 items-center justify-between">
                                            
                                            {/* Score gauge */}
                                            <div className="relative w-36 h-36 flex items-center justify-center rounded-full shadow-inner bg-[#E0E5EC]">
                                                <div className="absolute inset-2 rounded-full bg-[#E0E5EC]" style={{ boxShadow: "6px 6px 12px #b8b9be, -6px -6px 12px #ffffff" }} />
                                                <div className="relative z-10 text-center">
                                                    <span className="text-4xl font-extrabold text-blue-600">{parsedSignal.score.toFixed(1)}</span>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Score</p>
                                                </div>
                                            </div>

                                            {/* Attributes cards */}
                                            <div className="flex-1 grid grid-cols-2 gap-4 w-full">
                                                <div className="p-3.5 rounded-xl text-center" style={{ boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}>
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase">Action</p>
                                                    <p className="text-sm font-bold text-gray-700 mt-1">{parsedSignal.action}</p>
                                                </div>
                                                <div className="p-3.5 rounded-xl text-center" style={{ boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}>
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase">Conviction</p>
                                                    <p className="text-sm font-bold text-gray-700 mt-1">{parsedSignal.conviction}</p>
                                                </div>
                                                <div className="p-3.5 rounded-xl text-center" style={{ boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}>
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase">Confidence</p>
                                                    <p className="text-sm font-bold text-gray-700 mt-1">{parsedSignal.confidence}</p>
                                                </div>
                                                <div className="p-3.5 rounded-xl text-center" style={{ boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}>
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase">Horizon</p>
                                                    <p className="text-sm font-bold text-gray-700 mt-1">{parsedSignal.horizon}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Full Markdown Report */}
                                    <div
                                        className="p-8 rounded-[32px] relative overflow-hidden"
                                        style={{
                                            background: "#E0E5EC",
                                            boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                                        }}
                                    >
                                        <div className="flex justify-between items-center mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gray-200 text-gray-600 rounded-xl flex items-center justify-center shadow-sm">
                                                    <FileText size={20} />
                                                </div>
                                                <h3 className="text-xl font-bold text-gray-700">Detailed Research Report</h3>
                                            </div>
                                            <button
                                                onClick={handleSaveReport}
                                                className="px-4 py-2 rounded-xl text-xs font-bold text-blue-600 flex items-center gap-1.5 transition-all hover:scale-102"
                                                style={{
                                                    background: "#E0E5EC",
                                                    boxShadow: "4px 4px 8px #b8b9be, -4px -4px 8px #ffffff"
                                                }}
                                            >
                                                <Download size={14} /> Export HTML
                                            </button>
                                        </div>

                                        <div className="prose max-w-none text-gray-700 space-y-4 leading-relaxed font-sans text-sm">
                                            {reportMarkdown.split('\n').map((line, index) => {
                                                if (line.startsWith('###')) {
                                                    return <h4 key={index} className="text-base font-bold text-gray-800 mt-6 mb-2">{line.replace('###', '')}</h4>;
                                                }
                                                if (line.startsWith('##') || line.startsWith('#')) {
                                                    return <h3 key={index} className="text-lg font-bold text-blue-600 mt-8 mb-4 border-b border-gray-300 pb-2">{line.replace('##', '').replace('#', '')}</h3>;
                                                }
                                                if (line.trim().startsWith('-')) {
                                                    return <li key={index} className="ml-4 list-disc text-gray-600">{line.replace('-', '').trim()}</li>;
                                                }
                                                if (line.trim() === '') {
                                                    return null;
                                                }
                                                return <p key={index} className="text-gray-600">{line}</p>;
                                            })}
                                        </div>
                                    </div>

                                </div>
                            )}

                        </div>
                    )}

                    {!stockData && !loading && (
                        <div className="text-center py-24 opacity-40">
                            <Cpu size={56} className="mx-auto mb-4 text-gray-400" />
                            <p className="text-gray-500 font-bold uppercase tracking-wider text-xs">
                                InvestSkill Engine Active
                            </p>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
};

export default AutoCount;
