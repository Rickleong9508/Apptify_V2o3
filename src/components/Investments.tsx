import React, { useState, useMemo, useEffect } from 'react';
import { Stock, CashHolding } from '../types';
import { Plus, TrendingUp, TrendingDown, Trash2, Globe, Pencil, X, Calculator, ArrowRight, Settings, Search, AlertCircle, Check, RefreshCcw, Loader2, Coins, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { getStoredLanguage, SupportedLanguage } from '../utils/i18n';

interface InvestmentsProps {
    stocks: Stock[];
    setStocks: React.Dispatch<React.SetStateAction<Stock[]>>;
    cash: CashHolding;
    setCash: React.Dispatch<React.SetStateAction<CashHolding>>;
    exchangeRate: number;
    setExchangeRate: (rate: number) => void;
}

type AIProvider = 'google' | 'deepseek' | 'openrouter';

const fetchMarketData = async (symbols: string[]) => {
    const apiKey = localStorage.getItem('app_global_api_key');
    const provider = (localStorage.getItem('app_global_ai_provider') as AIProvider) || 'google';
    const model = localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash';

    if (!apiKey) throw new Error("API Key not found. Please set it in Global Settings.");

    const prompt = `
        Task: Get real-time market data.
        1. Find the current USD to MYR exchange rate.
        2. Find the current market price for these stock symbols: ${symbols.join(', ')}. 
           (If a symbol is ambiguous, assume US market unless it ends in .KL for Malaysia).

        Output strictly valid JSON (no markdown) with this structure:
        {
            "exchangeRate": number,
            "prices": [
                { "symbol": "AAPL", "price": 150.25 },
                { "symbol": "MAYBANK.KL", "price": 9.50 }
            ]
        }
    `;

    if (provider === 'google') {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: { tools: [{ googleSearch: {} }] }
        });
        return response.text;
    }

    let url = provider === 'deepseek' ? 'https://api.deepseek.com/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
    const headers: any = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };
    if (provider === 'openrouter') {
        headers['HTTP-Referer'] = window.location.origin;
    }

    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "API Error");
    return data.choices?.[0]?.message?.content;
};

interface StockItemProps {
    stock: Stock;
    exchangeRate: number;
    onUpdateStock: (id: string, newPrice: number) => void;
    onManage: (stock: Stock) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    draggable?: boolean;
    onDragStart?: (e: React.DragEvent) => void;
    onDragEnter?: (e: React.DragEvent) => void;
    onDragEnd?: () => void;
    onDragOver?: (e: React.DragEvent) => void;
    isDragging?: boolean;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
}

const StockItem: React.FC<StockItemProps> = ({
    stock,
    exchangeRate,
    onUpdateStock,
    onManage,
    onDelete,
    draggable,
    onDragStart,
    onDragEnter,
    onDragEnd,
    onDragOver,
    isDragging,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown
}) => {
    const [priceInput, setPriceInput] = useState(stock.currentPrice.toString());
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        setPriceInput(stock.currentPrice.toString());
    }, [stock.currentPrice]);

    const handleBlur = () => {
        setIsEditing(false);
        const val = parseFloat(priceInput);
        if (!isNaN(val) && val >= 0) {
            if (val !== stock.currentPrice) {
                onUpdateStock(stock.id, val);
            }
        } else {
            setPriceInput(stock.currentPrice.toString());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
        }
    };

    const isUSD = stock.currency === 'USD';
    const currencySymbol = isUSD ? '$' : 'RM';
    const rate = isUSD ? exchangeRate : 1;

    const valueNative = stock.currentPrice * stock.quantity;
    const valueMYR = valueNative * rate;
    const costNative = stock.buyPrice * stock.quantity;
    const plNative = valueNative - costNative;
    const plPercent = costNative > 0 ? (plNative / costNative) * 100 : 0;

    return (
        <div
            draggable={draggable && !isEditing}
            onDragStart={onDragStart}
            onDragEnter={onDragEnter}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            className={`p-4 sm:p-5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--ios-separator)] last:border-none hover:bg-[var(--ios-fill-tertiary)]/40 ${
                isDragging ? 'opacity-30 scale-[0.99] border-dashed border-2 border-blue-500/50 bg-blue-500/10' : ''
            }`}
        >
            {/* Identity & Drag/Move Controls */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 w-full md:w-1/3">
                {/* Touch-Friendly Reorder Buttons (Works on both Phone & Desktop) */}
                <div className="flex flex-col gap-0.5 items-center shrink-0">
                    <button
                        type="button"
                        disabled={!canMoveUp}
                        onClick={(e) => {
                            e.stopPropagation();
                            onMoveUp?.();
                        }}
                        className="p-1 rounded-md text-[var(--ios-label-tertiary)] hover:text-blue-500 disabled:opacity-20 active:scale-75 transition-all tap-scale"
                        title="Move Up"
                        aria-label="Move Up"
                    >
                        <ChevronUp size={14} />
                    </button>
                    <div 
                        className="text-[var(--ios-label-tertiary)] hover:text-[var(--ios-label-primary)] cursor-grab active:cursor-grabbing hidden sm:flex items-center justify-center"
                        title="Drag to Reorder (Desktop)"
                    >
                        <GripVertical size={13} />
                    </div>
                    <button
                        type="button"
                        disabled={!canMoveDown}
                        onClick={(e) => {
                            e.stopPropagation();
                            onMoveDown?.();
                        }}
                        className="p-1 rounded-md text-[var(--ios-label-tertiary)] hover:text-blue-500 disabled:opacity-20 active:scale-75 transition-all tap-scale"
                        title="Move Down"
                        aria-label="Move Down"
                    >
                        <ChevronDown size={14} />
                    </button>
                </div>
                <div
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-xs sm:text-sm font-bold shrink-0 ${
                        isUSD ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'
                    }`}
                >
                    {(stock.symbol || '??').substring(0, 3)}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-[var(--ios-label-primary)] truncate">{stock.symbol || 'Unknown'}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isUSD ? 'bg-blue-500/15 text-blue-500' : 'bg-amber-500/15 text-amber-500'}`}>
                            {stock.currency}
                        </span>
                    </div>
                    <div className="text-xs text-[var(--ios-label-secondary)] truncate">{stock.name}</div>
                </div>
            </div>

            {/* Middle: Price, Avg Cost, Qty */}
            <div className="flex items-center justify-between md:justify-center gap-4 sm:gap-6 w-full md:w-1/3 text-xs sm:text-sm bg-[var(--ios-fill-tertiary)]/50 md:bg-transparent p-3 md:p-0 rounded-xl">
                <div className="text-left md:text-center">
                    <p className="text-[10px] font-semibold uppercase text-[var(--ios-label-tertiary)] mb-0.5">Price</p>
                    <div className="relative flex items-center">
                        <span className="text-xs text-[var(--ios-label-tertiary)] font-bold mr-1">{currencySymbol}</span>
                        <input
                            type="number"
                            value={priceInput}
                            onChange={(e) => setPriceInput(e.target.value)}
                            onFocus={() => setIsEditing(true)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            className={`w-20 py-0.5 text-left md:text-center font-bold text-[var(--ios-label-primary)] bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none transition-all ${
                                isEditing ? 'border-blue-500 bg-[var(--ios-fill-secondary)] rounded px-1' : ''
                            }`}
                        />
                    </div>
                </div>

                <div className="text-center">
                    <p className="text-[10px] font-semibold uppercase text-[var(--ios-label-tertiary)] mb-0.5">Avg Cost</p>
                    <p className="font-semibold text-[var(--ios-label-secondary)]">
                        {currencySymbol} {stock.buyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>

                <div className="text-right md:text-center">
                    <p className="text-[10px] font-semibold uppercase text-[var(--ios-label-tertiary)] mb-0.5">Shares</p>
                    <p className="font-semibold text-[var(--ios-label-secondary)]">{stock.quantity.toLocaleString()}</p>
                </div>
            </div>

            {/* Right: Value, P/L, Actions */}
            <div className="flex items-center justify-between w-full md:w-1/3 gap-3">
                <div className="text-left md:text-right flex-1">
                    <p className="font-bold text-base sm:text-lg text-[var(--ios-label-primary)]">
                        RM {valueMYR.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <div className={`text-xs font-bold flex items-center md:justify-end gap-1 ${plPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {plPercent >= 0 ? '+' : ''}{plPercent.toFixed(2)}%
                        <span className="opacity-60 text-[10px]">
                            ({currencySymbol}{Math.abs(plNative).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        type="button"
                        onClick={() => onManage(stock)}
                        className="p-2 text-[var(--ios-label-secondary)] hover:text-blue-500 rounded-full hover:bg-[var(--ios-fill-tertiary)] tap-scale transition-colors"
                        title="Trade / Edit Details"
                    >
                        <Settings size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => onDelete(stock.id, e)}
                        className="p-2 text-[var(--ios-label-secondary)] hover:text-rose-500 rounded-full hover:bg-[var(--ios-fill-tertiary)] tap-scale transition-colors"
                        title="Delete Position"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

const Investments: React.FC<InvestmentsProps> = ({ stocks, setStocks, cash, setCash, exchangeRate, setExchangeRate }) => {
    const [lang, setLang] = useState<SupportedLanguage>(getStoredLanguage());
    useEffect(() => {
        const handleLang = () => setLang(getStoredLanguage());
        window.addEventListener('apptify_language_change', handleLang);
        return () => window.removeEventListener('apptify_language_change', handleLang);
    }, []);

    const [showAdd, setShowAdd] = useState(false);
    const [newStock, setNewStock] = useState<any>({ currency: 'MYR' });

    // Drag and Drop
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
        setDraggedIndex(index);
    };

    const handleDragEnter = (e: React.DragEvent, index: number) => {
        if (draggedIndex === null || draggedIndex === index) return;
        const newStocks = [...stocks.filter(s => s && s.id)];
        const draggedItem = newStocks[draggedIndex];
        newStocks.splice(draggedIndex, 1);
        newStocks.splice(index, 0, draggedItem);
        setStocks(newStocks);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => setDraggedIndex(null);
    const handleDragOver = (e: React.DragEvent) => e.preventDefault();

    // Mobile & Quick Click Reorder Handler
    const handleMoveStock = (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        const validList = [...stocks.filter(s => s && s.id)];
        if (targetIndex < 0 || targetIndex >= validList.length) return;
        const item = validList[index];
        validList.splice(index, 1);
        validList.splice(targetIndex, 0, item);
        setStocks(validList);
    };

    // Manage Modal
    const [editingStock, setEditingStock] = useState<Stock | null>(null);
    const [manageMode, setManageMode] = useState<'BUY' | 'SELL' | 'EDIT'>('BUY');
    const [transQty, setTransQty] = useState('');
    const [transPrice, setTransPrice] = useState('');
    const [editForm, setEditForm] = useState<Partial<Stock>>({});
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const openManageModal = (stock: Stock) => {
        setEditingStock(stock);
        setManageMode('BUY');
        setTransQty('');
        setTransPrice(stock.currentPrice.toString());
        setEditForm({ ...stock });
    };

    const closeManageModal = () => setEditingStock(null);

    const updateStockPrice = (id: string, newPrice: number) => {
        setStocks(current => current.map(s => (s.id === id ? { ...s, currentPrice: newPrice } : s)));
    };

    const handleRefreshMarketData = async () => {
        if (stocks.length === 0) {
            alert("No stocks to update. Add a position first.");
            return;
        }
        setIsRefreshing(true);
        try {
            const uniqueSymbols: string[] = Array.from(new Set(stocks.map(s => s.symbol)));
            const jsonString = await fetchMarketData(uniqueSymbols);

            if (jsonString) {
                const cleanJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
                const result = JSON.parse(cleanJson);

                if (result.exchangeRate) {
                    setExchangeRate(Number(result.exchangeRate));
                }

                if (result.prices && Array.isArray(result.prices)) {
                    setStocks(prevStocks => prevStocks.map(stock => {
                        const update = result.prices.find((p: any) =>
                            p.symbol.toUpperCase() === stock.symbol.toUpperCase() ||
                            stock.symbol.toUpperCase().includes(p.symbol.toUpperCase())
                        );
                        if (update && update.price) {
                            return { ...stock, currentPrice: Number(update.price) };
                        }
                        return stock;
                    }));
                }
                alert("Market data updated successfully!");
            }
        } catch (e: any) {
            console.error(e);
            alert(`Update failed: ${e.message}`);
        } finally {
            setIsRefreshing(false);
        }
    };

    const previewAvgCost = useMemo(() => {
        if (!editingStock || manageMode !== 'BUY') return null;
        const qty = parseFloat(transQty) || 0;
        const price = parseFloat(transPrice) || 0;
        if (qty <= 0) return editingStock.buyPrice;

        const totalOld = editingStock.quantity * editingStock.buyPrice;
        const totalNew = qty * price;
        return (totalOld + totalNew) / (editingStock.quantity + qty);
    }, [editingStock, manageMode, transQty, transPrice]);

    const requestDelete = (id: string, e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        setDeleteId(id);
    };

    const confirmDelete = () => {
        if (deleteId) {
            setStocks(current => current.filter(s => s.id !== deleteId));
            if (editingStock?.id === deleteId) {
                setEditingStock(null);
            }
            setDeleteId(null);
        }
    };

    const handleSaveManagement = () => {
        if (!editingStock) return;
        let updatedStock = { ...editingStock };

        if (manageMode === 'BUY') {
            const qty = parseFloat(transQty);
            const price = parseFloat(transPrice);
            if (isNaN(qty) || isNaN(price) || qty <= 0) return;

            const totalOld = updatedStock.quantity * updatedStock.buyPrice;
            const totalNew = qty * price;
            const newQty = updatedStock.quantity + qty;
            const newAvg = (totalOld + totalNew) / newQty;

            updatedStock.quantity = newQty;
            updatedStock.buyPrice = newAvg;
            updatedStock.currentPrice = price;
        } else if (manageMode === 'SELL') {
            const qty = parseFloat(transQty);
            const price = parseFloat(transPrice);
            if (isNaN(qty) || qty <= 0) return;

            if (qty > updatedStock.quantity) {
                alert("You cannot sell more than you own.");
                return;
            }

            updatedStock.quantity = updatedStock.quantity - qty;
            updatedStock.currentPrice = price;

            if (updatedStock.quantity === 0) {
                setDeleteId(updatedStock.id);
                return;
            }
        } else if (manageMode === 'EDIT') {
            if (editForm.symbol) updatedStock.symbol = editForm.symbol;
            if (editForm.name) updatedStock.name = editForm.name;
            if (editForm.quantity !== undefined) updatedStock.quantity = Number(editForm.quantity);
            if (editForm.buyPrice !== undefined) updatedStock.buyPrice = Number(editForm.buyPrice);
            if (editForm.currentPrice !== undefined) updatedStock.currentPrice = Number(editForm.currentPrice);
            if (editForm.currency) updatedStock.currency = editForm.currency as 'MYR' | 'USD';
        }

        setStocks(prev => prev.map(s => s.id === editingStock.id ? updatedStock : s));
        closeManageModal();
    };

    const handleAddStock = () => {
        if (!newStock.symbol || !newStock.buyPrice || !newStock.quantity) return;

        const stock: Stock = {
            id: Date.now().toString(),
            symbol: newStock.symbol.toUpperCase(),
            name: newStock.name || newStock.symbol.toUpperCase(),
            buyPrice: Number(newStock.buyPrice),
            quantity: Number(newStock.quantity),
            currentPrice: newStock.currentPrice ? Number(newStock.currentPrice) : Number(newStock.buyPrice),
            currency: newStock.currency as 'MYR' | 'USD'
        };

        setStocks(prev => [...prev, stock]);
        setShowAdd(false);
        setNewStock({ currency: 'MYR' });
    };

    const portfolioStats = useMemo(() => {
        let totalValueMYR = 0;
        let totalCostMYR = 0;

        stocks.forEach(s => {
            if (!s || !s.buyPrice || !s.quantity) return;
            const rate = s.currency === 'USD' ? exchangeRate : 1;
            const currentPrice = s.currentPrice || 0;
            const currentValueMYR = currentPrice * s.quantity * rate;
            const costBasisMYR = s.buyPrice * s.quantity * rate;
            totalValueMYR += currentValueMYR;
            totalCostMYR += costBasisMYR;
        });

        const hkdRate = Number(cash.hkdRate || 0.58);
        const cashMYR = Number(cash.myr || 0) + (Number(cash.usd || 0) * exchangeRate) + (Number(cash.hkd || 0) * hkdRate);
        totalValueMYR += cashMYR;
        totalCostMYR += cashMYR;

        const profit = totalValueMYR - totalCostMYR;
        return { totalValueMYR, totalCostMYR, profit, profitPercent: totalCostMYR > 0 ? (profit / totalCostMYR) * 100 : 0 };
    }, [stocks, cash, exchangeRate]);

    const validStocks = stocks.filter(s => s && s.id);

    return (
        <div className="space-y-6 pb-20 animate-fade-in font-sans">
            {/* Avant-Garde Masthead */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200/60 dark:border-zinc-800/60 pb-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 rounded font-extrabold bg-zinc-900 text-[#D4FF00] dark:bg-[#D4FF00] dark:text-black">
                            CAPITAL // MARKETS
                        </span>
                        <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                            05 // INVESTMENTS
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-[-0.03em] uppercase text-zinc-950 dark:text-white">
                        {lang === 'zh' ? '投资组合与证券持仓' : 'Portfolio & Investments'}
                    </h2>
                    <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {lang === 'zh' ? '多币种标的持仓 · 实时市价浮盈 · 券商闲置流动本金' : 'Multi-currency holdings · Live quotes & P/L · Broker liquid capital'}
                    </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto font-mono">
                    <button
                        onClick={handleRefreshMarketData}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 py-2 px-3.5 text-xs font-bold rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-all active:scale-95 cursor-pointer tactile-press border border-zinc-200 dark:border-zinc-700"
                    >
                        {isRefreshing ? <Loader2 size={13} className="animate-spin text-[#D4FF00]" /> : <RefreshCcw size={13} className="text-[#D4FF00]" />}
                        <span>{isRefreshing ? "SYNCING..." : (lang === 'zh' ? "QUOTES // 刷新行情" : "QUOTES // SYNC")}</span>
                    </button>
                    <button
                        onClick={() => setShowAdd(!showAdd)}
                        className="flex items-center gap-1.5 py-2 px-3.5 text-xs font-black uppercase tracking-wider rounded-xl bg-zinc-950 text-white dark:bg-[#D4FF00] dark:text-black hover:opacity-90 transition-all active:scale-95 cursor-pointer tactile-press shadow-sm"
                    >
                        {showAdd ? <X size={14} /> : <Plus size={14} />}
                        <span>{showAdd ? (lang === 'zh' ? 'CLOSE // 关闭' : 'CLOSE') : (lang === 'zh' ? 'NEW POSITION // 加仓' : 'NEW POSITION')}</span>
                    </button>
                </div>
            </div>

            {/* Top Cards: Total Equity, Exchange Rate, Liquid Reserves */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 font-mono">
                {/* Main Equity Card */}
                <div className="lg:col-span-2 avant-card p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

                    <div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                                {lang === 'zh' ? 'TOTAL INVESTMENT EQUITY // 投资净资产' : 'TOTAL INVESTMENT EQUITY'}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                STOCKS + BROKER CASH
                            </span>
                        </div>
                        <div className="text-3xl sm:text-5xl font-black text-zinc-950 dark:text-white tracking-tight mt-2 font-mono-numbers">
                            RM {portfolioStats.totalValueMYR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-5 mt-5 border-t border-zinc-200/60 dark:border-zinc-800/60">
                        <div>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                                {lang === 'zh' ? 'UNREALIZED P/L // 浮动盈亏' : 'UNREALIZED P/L'}
                            </span>
                            <div className={`flex items-center gap-2 mt-1 ${portfolioStats.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {portfolioStats.profit >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                                <span className="text-base sm:text-xl font-black font-mono-numbers">
                                    {portfolioStats.profit >= 0 ? '+' : ''}RM {Math.abs(portfolioStats.profit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${portfolioStats.profit >= 0 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                                    {portfolioStats.profitPercent.toFixed(2)}%
                                </span>
                            </div>
                        </div>

                        <div>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                                {lang === 'zh' ? 'TOTAL COST BASIS // 累计投入本金' : 'TOTAL COST BASIS'}
                            </span>
                            <p className="font-black text-base sm:text-xl text-zinc-950 dark:text-white mt-1 font-mono-numbers">
                                RM {portfolioStats.totalCostMYR.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Forex & Liquid Cash Card */}
                <div className="avant-card p-5 sm:p-6 space-y-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-3 border-b border-zinc-200/60 dark:border-zinc-800/60">
                            <div className="flex items-center gap-2">
                                <Globe size={16} className="text-[#D4FF00]" />
                                <span className="text-xs font-black text-zinc-950 dark:text-white uppercase font-mono">USD / MYR RATE</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-zinc-400 font-bold font-mono">RM</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={exchangeRate}
                                    onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                                    className="w-16 text-right font-black font-mono text-sm text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-0.5 focus:outline-none focus:border-[#D4FF00]"
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 mb-2.5">
                                <Coins size={14} className="text-[#D4FF00]" />
                                {lang === 'zh' ? 'BROKER CASH // 券商闲置资金' : 'BROKER CASH'}
                            </span>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-zinc-600 dark:text-zinc-300">{lang === 'zh' ? 'MYR (马币现金)' : 'MYR (Cash)'}</span>
                                    <input
                                        type="number"
                                        value={cash.myr || ''}
                                        onChange={e => setCash({ ...cash, myr: parseFloat(e.target.value) || 0 })}
                                        className="w-28 text-right font-black font-mono text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#D4FF00] font-mono-numbers"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-zinc-600 dark:text-zinc-300">{lang === 'zh' ? 'USD (美元现金)' : 'USD (Cash)'}</span>
                                    <input
                                        type="number"
                                        value={cash.usd || ''}
                                        onChange={e => setCash({ ...cash, usd: parseFloat(e.target.value) || 0 })}
                                        className="w-28 text-right font-bold text-[var(--ios-label-primary)] bg-[var(--ios-fill-tertiary)] rounded-lg px-2 py-1 text-xs focus:outline-none"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-[var(--ios-label-secondary)]">HKD (Cash)</span>
                                    <input
                                        type="number"
                                        value={cash.hkd || ''}
                                        onChange={e => setCash({ ...cash, hkd: parseFloat(e.target.value) || 0 })}
                                        className="w-28 text-right font-bold text-[var(--ios-label-primary)] bg-[var(--ios-fill-tertiary)] rounded-lg px-2 py-1 text-xs focus:outline-none"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-[var(--ios-separator)] flex items-center justify-between text-[10px] text-[var(--ios-label-tertiary)]">
                        <span>HKD Peg Rate:</span>
                        <input
                            type="number"
                            value={cash.hkdRate || 0.58}
                            onChange={e => setCash({ ...cash, hkdRate: parseFloat(e.target.value) || 0 })}
                            className="w-14 text-right bg-transparent border-none p-0 text-[var(--ios-label-secondary)] font-semibold focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Collapsible Add Position Form */}
            {showAdd && (
                <div className="ios-card p-5 sm:p-6 space-y-4 border-2 border-blue-500/30 animate-slide-up">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-[var(--ios-label-primary)] flex items-center gap-2">
                            <Plus size={16} className="text-blue-500" />
                            <span>Add New Investment Holding</span>
                        </h4>
                        <button
                            onClick={() => setShowAdd(false)}
                            className="text-xs text-[var(--ios-label-secondary)] hover:text-[var(--ios-label-primary)]"
                        >
                            Cancel
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-2">
                            <label className="text-[10px] font-semibold text-[var(--ios-label-secondary)] uppercase block mb-1">Currency</label>
                            <select
                                className="ios-input text-xs"
                                value={newStock.currency}
                                onChange={e => setNewStock({ ...newStock, currency: e.target.value as 'MYR' | 'USD' })}
                            >
                                <option value="MYR">MYR (RM)</option>
                                <option value="USD">USD ($)</option>
                            </select>
                        </div>
                        <div className="sm:col-span-3">
                            <label className="text-[10px] font-semibold text-[var(--ios-label-secondary)] uppercase block mb-1">Symbol & Name</label>
                            <div className="flex gap-2">
                                <input
                                    className="ios-input w-2/5 uppercase text-xs font-bold"
                                    placeholder="AAPL"
                                    value={newStock.symbol || ''}
                                    onChange={e => setNewStock({ ...newStock, symbol: e.target.value })}
                                />
                                <input
                                    className="ios-input w-3/5 text-xs"
                                    placeholder="Company Name"
                                    value={newStock.name || ''}
                                    onChange={e => setNewStock({ ...newStock, name: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="sm:col-span-7">
                            <label className="text-[10px] font-semibold text-[var(--ios-label-secondary)] uppercase block mb-1">Position Metrics</label>
                            <div className="grid grid-cols-3 gap-2">
                                <input
                                    type="number"
                                    className="ios-input text-xs"
                                    placeholder="Avg Buy Price"
                                    value={newStock.buyPrice || ''}
                                    onChange={e => setNewStock({ ...newStock, buyPrice: e.target.value })}
                                />
                                <input
                                    type="number"
                                    className="ios-input text-xs text-blue-500 font-semibold"
                                    placeholder="Market Price"
                                    value={newStock.currentPrice || ''}
                                    onChange={e => setNewStock({ ...newStock, currentPrice: e.target.value })}
                                />
                                <input
                                    type="number"
                                    className="ios-input text-xs"
                                    placeholder="Quantity (Shares)"
                                    value={newStock.quantity || ''}
                                    onChange={e => setNewStock({ ...newStock, quantity: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleAddStock}
                        disabled={!newStock.symbol || !newStock.buyPrice || !newStock.quantity}
                        className="w-full ios-button-primary py-3 text-xs font-semibold tap-scale disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Confirm Add Holding
                    </button>
                </div>
            )}

            {/* Holdings List Card */}
            <div className="ios-card overflow-hidden">
                <div className="p-4 sm:p-5 flex items-center justify-between border-b border-[var(--ios-separator)]">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--ios-label-primary)]">Holdings & Positions</span>
                        <span className="text-xs text-[var(--ios-label-secondary)] font-semibold bg-[var(--ios-fill-tertiary)] px-2 py-0.5 rounded-full">
                            {validStocks.length}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[var(--ios-label-secondary)]">
                        <span className="hidden sm:inline">Drag handle to reorder</span>
                    </div>
                </div>

                {validStocks.length === 0 ? (
                    <div className="text-center py-16 flex flex-col items-center justify-center">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--ios-fill-tertiary)] flex items-center justify-center text-[var(--ios-label-tertiary)] mb-3">
                            <Search size={24} />
                        </div>
                        <h4 className="text-sm font-bold text-[var(--ios-label-primary)]">No investment holdings yet</h4>
                        <p className="text-xs text-[var(--ios-label-secondary)] mt-1 max-w-xs">
                            Add US or Malaysian stocks to track portfolio valuation, dividends, and returns.
                        </p>
                        <button
                            onClick={() => setShowAdd(true)}
                            className="mt-4 ios-button-primary text-xs tap-scale"
                        >
                            Add Position
                        </button>
                    </div>
                ) : (
                    <div>
                        {validStocks.map((stock, index) => (
                            <StockItem
                                key={stock.id}
                                stock={stock}
                                exchangeRate={exchangeRate}
                                onUpdateStock={updateStockPrice}
                                onManage={openManageModal}
                                onDelete={requestDelete}
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragEnter={(e) => handleDragEnter(e, index)}
                                onDragEnd={handleDragEnd}
                                onDragOver={handleDragOver}
                                isDragging={draggedIndex === index}
                                onMoveUp={() => handleMoveStock(index, 'up')}
                                onMoveDown={() => handleMoveStock(index, 'down')}
                                canMoveUp={index > 0}
                                canMoveDown={index < validStocks.length - 1}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* --- MANAGE / TRADE MODAL (BUY / SELL / EDIT) --- */}
            {editingStock && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="w-full sm:max-w-lg ios-card rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 space-y-5 max-h-[90vh] overflow-y-auto animate-slide-up sm:animate-scale-in">
                        {/* Header */}
                        <div className="flex items-start justify-between pb-3 border-b border-[var(--ios-separator)]">
                            <div>
                                <h3 className="text-xl font-bold text-[var(--ios-label-primary)] flex items-center gap-2">
                                    <span>{editingStock.symbol}</span>
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--ios-fill-tertiary)] text-[var(--ios-label-secondary)]">
                                        {editingStock.currency}
                                    </span>
                                </h3>
                                <p className="text-xs text-[var(--ios-label-secondary)] mt-0.5">{editingStock.name}</p>
                            </div>
                            <button
                                onClick={closeManageModal}
                                className="w-8 h-8 rounded-full bg-[var(--ios-fill-tertiary)] flex items-center justify-center text-[var(--ios-label-secondary)] tap-scale"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Segmented Mode Selector */}
                        <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--ios-fill-tertiary)] rounded-xl">
                            {(['BUY', 'SELL', 'EDIT'] as const).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setManageMode(mode)}
                                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                                        manageMode === mode
                                            ? 'bg-blue-500 text-white shadow-sm'
                                            : 'text-[var(--ios-label-secondary)] hover:text-[var(--ios-label-primary)]'
                                    }`}
                                >
                                    {mode === 'BUY' ? 'Buy More' : mode === 'SELL' ? 'Sell Shares' : 'Edit Holding'}
                                </button>
                            ))}
                        </div>

                        {/* BUY MODE */}
                        {manageMode === 'BUY' && (
                            <div className="space-y-4">
                                <div className="p-4 rounded-2xl bg-[var(--ios-fill-tertiary)] flex justify-between items-center text-xs">
                                    <div>
                                        <span className="text-[var(--ios-label-secondary)] font-medium">Current Holding</span>
                                        <p className="text-base font-bold text-[var(--ios-label-primary)] mt-0.5">
                                            {editingStock.quantity.toLocaleString()} Shares
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[var(--ios-label-secondary)] font-medium">Avg Cost</span>
                                        <p className="text-base font-bold text-[var(--ios-label-primary)] mt-0.5">
                                            {editingStock.currency === 'USD' ? '$' : 'RM'} {editingStock.buyPrice.toFixed(2)}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-semibold text-[var(--ios-label-secondary)] uppercase block mb-1">
                                            Shares to Buy
                                        </label>
                                        <input
                                            type="number"
                                            className="ios-input"
                                            placeholder="0"
                                            value={transQty}
                                            onChange={e => setTransQty(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-semibold text-[var(--ios-label-secondary)] uppercase block mb-1">
                                            Purchase Price
                                        </label>
                                        <input
                                            type="number"
                                            className="ios-input"
                                            placeholder="0.00"
                                            value={transPrice}
                                            onChange={e => setTransPrice(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {previewAvgCost !== null && (
                                    <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-3">
                                        <Calculator size={18} className="text-blue-500 shrink-0" />
                                        <div className="text-xs">
                                            <span className="text-blue-500 font-semibold">New Average Cost Preview</span>
                                            <div className="flex items-center gap-2 mt-0.5 font-bold text-[var(--ios-label-primary)]">
                                                <span className="line-through opacity-50">{editingStock.buyPrice.toFixed(2)}</span>
                                                <ArrowRight size={12} className="opacity-50" />
                                                <span className="text-blue-500">{previewAvgCost.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={handleSaveManagement}
                                    disabled={!transQty || !transPrice || Number(transQty) <= 0}
                                    className="w-full ios-button-primary py-3.5 text-sm tap-scale disabled:opacity-40"
                                >
                                    Confirm Purchase
                                </button>
                            </div>
                        )}

                        {/* SELL MODE */}
                        {manageMode === 'SELL' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-semibold text-[var(--ios-label-secondary)] uppercase block mb-1">
                                            Shares to Sell (Max {editingStock.quantity})
                                        </label>
                                        <input
                                            type="number"
                                            className="ios-input"
                                            placeholder="0"
                                            value={transQty}
                                            onChange={e => setTransQty(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-semibold text-[var(--ios-label-secondary)] uppercase block mb-1">
                                            Selling Price
                                        </label>
                                        <input
                                            type="number"
                                            className="ios-input"
                                            placeholder="0.00"
                                            value={transPrice}
                                            onChange={e => setTransPrice(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {transQty && transPrice && (
                                    <div className="p-4 rounded-2xl bg-[var(--ios-fill-tertiary)] space-y-2 text-xs">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[var(--ios-label-secondary)]">Est. Total Proceeds</span>
                                            <span className="font-bold text-sm text-[var(--ios-label-primary)]">
                                                {(Number(transQty) * Number(transPrice)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-[var(--ios-separator)]">
                                            <span className="text-[var(--ios-label-secondary)]">Realized P/L</span>
                                            <span className={`font-bold ${(Number(transPrice) - editingStock.buyPrice) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {((Number(transPrice) - editingStock.buyPrice) * Number(transQty)).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    style: 'currency',
                                                    currency: editingStock.currency
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={handleSaveManagement}
                                    disabled={!transQty || !transPrice || Number(transQty) <= 0 || Number(transQty) > editingStock.quantity}
                                    className="w-full py-3.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-sm tap-scale disabled:opacity-40"
                                >
                                    Confirm Sell Order
                                </button>
                            </div>
                        )}

                        {/* EDIT MODE */}
                        {manageMode === 'EDIT' && (
                            <div className="space-y-3.5">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-semibold text-[var(--ios-label-secondary)] uppercase block mb-1">Symbol</label>
                                        <input
                                            className="ios-input uppercase"
                                            value={editForm.symbol || ''}
                                            onChange={e => setEditForm({ ...editForm, symbol: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-semibold text-[var(--ios-label-secondary)] uppercase block mb-1">Currency</label>
                                        <select
                                            className="ios-input"
                                            value={editForm.currency}
                                            onChange={e => setEditForm({ ...editForm, currency: e.target.value as any })}
                                        >
                                            <option value="MYR">MYR</option>
                                            <option value="USD">USD</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-semibold text-[var(--ios-label-secondary)] uppercase block mb-1">Holding Name</label>
                                    <input
                                        className="ios-input"
                                        value={editForm.name || ''}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="text-[10px] font-semibold text-[var(--ios-label-secondary)] uppercase block mb-1">Market Price</label>
                                        <input
                                            type="number"
                                            className="ios-input text-blue-500 font-semibold"
                                            value={editForm.currentPrice}
                                            onChange={e => setEditForm({ ...editForm, currentPrice: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-semibold text-[var(--ios-label-secondary)] uppercase block mb-1">Avg Cost</label>
                                        <input
                                            type="number"
                                            className="ios-input"
                                            value={editForm.buyPrice}
                                            onChange={e => setEditForm({ ...editForm, buyPrice: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-semibold text-[var(--ios-label-secondary)] uppercase block mb-1">Shares</label>
                                        <input
                                            type="number"
                                            className="ios-input"
                                            value={editForm.quantity}
                                            onChange={e => setEditForm({ ...editForm, quantity: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveManagement}
                                    className="w-full ios-button-primary py-3.5 text-sm tap-scale mt-2"
                                >
                                    Save Changes
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => requestDelete(editingStock.id, e)}
                                    className="w-full py-2.5 text-xs text-rose-500 font-semibold hover:bg-rose-500/10 rounded-xl tap-scale transition-colors"
                                >
                                    Delete Position Permanently
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* CONFIRM DELETE MODAL */}
            {deleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-sm ios-card rounded-3xl p-6 text-center space-y-4 animate-scale-in">
                        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
                            <AlertCircle size={28} />
                        </div>
                        <h3 className="text-lg font-bold text-[var(--ios-label-primary)]">Delete Position?</h3>
                        <p className="text-xs sm:text-sm text-[var(--ios-label-secondary)] leading-relaxed">
                            Are you sure you want to remove this stock from your portfolio? This action cannot be undone.
                        </p>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setDeleteId(null)}
                                className="flex-1 py-3 rounded-xl bg-[var(--ios-fill-tertiary)] hover:bg-[var(--ios-fill-secondary)] font-semibold text-xs sm:text-sm text-[var(--ios-label-primary)] tap-scale"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs sm:text-sm tap-scale shadow-sm"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Investments;