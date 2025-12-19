import React, { useState, useMemo, useEffect } from 'react';
import { Stock } from '../types';
import { Plus, TrendingUp, TrendingDown, Trash2, Globe, Pencil, X, Calculator, ArrowRight, Settings, Search, AlertCircle, Check, RefreshCcw, Loader2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface InvestmentsProps {
    stocks: Stock[];
    setStocks: React.Dispatch<React.SetStateAction<Stock[]>>;
    exchangeRate: number;
    setExchangeRate: (rate: number) => void;
}

// --- AI Helper (Local) ---
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

    // Google Logic (Supports Search for Real-time)
    if (provider === 'google') {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: { tools: [{ googleSearch: {} }] }
        });
        return response.text;
    }

    // Other Providers (Standard Fetch)
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

// --- Sub-component for individual stock rows to handle local edit state ---
interface StockItemProps {
    stock: Stock;
    exchangeRate: number;
    onUpdateStock: (id: string, newPrice: number) => void;
    onManage: (stock: Stock) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
}

const StockItem: React.FC<StockItemProps> = ({ stock, exchangeRate, onUpdateStock, onManage, onDelete }) => {
    const [priceInput, setPriceInput] = useState(stock.currentPrice.toString());
    const [isEditing, setIsEditing] = useState(false);

    // Sync if external updates happen
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
            // Revert if invalid
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

    // Calculations
    const valueNative = stock.currentPrice * stock.quantity;
    const valueMYR = valueNative * rate;
    const costNative = stock.buyPrice * stock.quantity;
    const plNative = valueNative - costNative;
    const plPercent = costNative > 0 ? (plNative / costNative) * 100 : 0;

    return (
        <div className="p-6 transition-colors group flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4 border-b border-gray-300/50 last:border-none hover:bg-white/40">
            {/* Left: Identity */}
            <div className="flex items-center gap-4 w-full md:w-1/3">
                <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center text-sm font-bold shadow-sm ${isUSD ? 'text-blue-600' : 'text-yellow-700'}`}
                    style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                >
                    {stock.symbol.substring(0, 2)}
                </div>
                <div>
                    <div className="font-bold text-gray-700 text-lg">{stock.symbol}</div>
                    <div className="text-xs text-gray-500 font-medium">{stock.name}</div>
                </div>
            </div>

            {/* Middle: Price & Qty */}
            <div className="flex justify-between md:justify-center gap-8 w-full md:w-1/3 text-sm">
                <div className="text-right md:text-center flex flex-col items-end md:items-center">
                    <p className="text-gray-400 text-[10px] font-bold uppercase mb-1">Market Price</p>
                    <div className="relative group/input">
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs pointer-events-none">
                            {currencySymbol}
                        </span>
                        <input
                            type="number"
                            value={priceInput}
                            onChange={(e) => setPriceInput(e.target.value)}
                            onFocus={() => setIsEditing(true)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            className={`w-28 pl-6 pr-2 py-1.5 text-right md:text-center font-bold text-gray-700 bg-transparent border-b-2 border-transparent focus:border-blue-500 focus:bg-white/50 focus:ring-0 focus:outline-none transition-all rounded-md ${isEditing ? 'shadow-inner' : 'hover:border-gray-300'}`}
                        />
                        {!isEditing && (
                            <Pencil size={12} className="absolute -right-4 top-1/2 -translate-y-1/2 text-gray-400 opacity-0 group-hover/input:opacity-100 pointer-events-none transition-opacity" />
                        )}
                    </div>
                </div>
                <div className="text-right md:text-center">
                    <p className="text-gray-400 text-[10px] font-bold uppercase mb-1">Avg Cost</p>
                    <p className="font-medium text-gray-500 py-1">{currencySymbol} {stock.buyPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="text-right md:text-center">
                    <p className="text-gray-400 text-[10px] font-bold uppercase mb-1">Shares</p>
                    <p className="font-medium text-gray-500 py-1">{stock.quantity.toLocaleString()}</p>
                </div>
            </div>

            {/* Right: Value & Actions */}
            <div className="flex items-center justify-between w-full md:w-1/3 gap-4">
                <div className="text-right flex-1">
                    <p className="font-bold text-lg text-gray-700">RM {valueMYR.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    <div className={`text-xs font-bold flex items-center justify-end gap-1 ${plPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {plPercent >= 0 ? '+' : ''}{plPercent.toFixed(2)}%
                        <span className="opacity-50 text-gray-400">({currencySymbol}{Math.abs(plNative).toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>
                    </div>
                </div>

                <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity relative z-10">
                    <button type="button" onClick={() => onManage(stock)} className="p-2 text-gray-500 hover:text-blue-600 rounded-full transition-all cursor-pointer hover:scale-110 active:scale-95" style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }} title="Edit Details">
                        <Settings size={16} />
                    </button>
                    <button type="button" onClick={(e) => onDelete(stock.id, e)} className="p-2 text-gray-500 hover:text-red-600 rounded-full transition-all cursor-pointer hover:scale-110 active:scale-95" style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }} title="Delete">
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}

const Investments: React.FC<InvestmentsProps> = ({ stocks, setStocks, exchangeRate, setExchangeRate }) => {
    const [showAdd, setShowAdd] = useState(false);
    const [newStock, setNewStock] = useState<any>({ currency: 'MYR' });

    // --- Edit/Manage Modal State ---
    const [editingStock, setEditingStock] = useState<Stock | null>(null);
    const [manageMode, setManageMode] = useState<'BUY' | 'SELL' | 'EDIT'>('BUY');

    // Transaction Inputs
    const [transQty, setTransQty] = useState('');
    const [transPrice, setTransPrice] = useState('');

    // Manual Edit Inputs
    const [editForm, setEditForm] = useState<Partial<Stock>>({});

    // --- Delete Modal State ---
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // --- Refresh State ---
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Reset modal state when opening a stock
    const openManageModal = (stock: Stock) => {
        setEditingStock(stock);
        setManageMode('BUY');
        setTransQty('');
        setTransPrice(stock.currentPrice.toString());
        setEditForm({ ...stock });
    };

    const closeManageModal = () => {
        setEditingStock(null);
    };

    const updateStockPrice = (id: string, newPrice: number) => {
        setStocks(current => current.map(s => {
            if (s.id === id) {
                return { ...s, currentPrice: newPrice };
            }
            return s;
        }));
    };

    // --- Real-time Refresh Handler ---
    const handleRefreshMarketData = async () => {
        if (stocks.length === 0) {
            alert("No stocks to update. Add a position first.");
            return;
        }
        setIsRefreshing(true);
        try {
            // 1. Get unique symbols
            const uniqueSymbols: string[] = Array.from(new Set(stocks.map(s => s.symbol)));

            // 2. Fetch AI data
            const jsonString = await fetchMarketData(uniqueSymbols);

            // 3. Parse and Update
            if (jsonString) {
                const cleanJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
                const result = JSON.parse(cleanJson);

                if (result.exchangeRate) {
                    setExchangeRate(Number(result.exchangeRate));
                }

                if (result.prices && Array.isArray(result.prices)) {
                    setStocks(prevStocks => prevStocks.map(stock => {
                        // Find matching price update (loose matching for symbol)
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

    // Calculate New Average Cost (Preview)
    const previewAvgCost = useMemo(() => {
        if (!editingStock || manageMode !== 'BUY') return null;
        const qty = parseFloat(transQty) || 0;
        const price = parseFloat(transPrice) || 0;
        if (qty <= 0) return editingStock.buyPrice;

        const totalOld = editingStock.quantity * editingStock.buyPrice;
        const totalNew = qty * price;
        return (totalOld + totalNew) / (editingStock.quantity + qty);
    }, [editingStock, manageMode, transQty, transPrice]);

    // Request Delete (Opens Modal)
    const requestDelete = (id: string, e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        setDeleteId(id);
    };

    // Confirm Delete (Actual Action)
    const confirmDelete = () => {
        if (deleteId) {
            setStocks(current => current.filter(s => s.id !== deleteId));

            // If we are currently editing this stock, close the edit modal too
            if (editingStock?.id === deleteId) {
                setEditingStock(null);
            }
            setDeleteId(null);
        }
    };

    // Handle Transactions & Edits
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
                // Trigger delete flow if 0 quantity
                setDeleteId(updatedStock.id); // Set ID to delete
                // We don't close manage modal immediately here, we let the delete modal handle the flow
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

    // Calculate Portfolio Stats
    const portfolioStats = useMemo(() => {
        let totalValueMYR = 0;
        let totalCostMYR = 0;

        stocks.forEach(s => {
            const rate = s.currency === 'USD' ? exchangeRate : 1;
            const currentValueMYR = s.currentPrice * s.quantity * rate;
            const costBasisMYR = s.buyPrice * s.quantity * rate;
            totalValueMYR += currentValueMYR;
            totalCostMYR += costBasisMYR;
        });

        const profit = totalValueMYR - totalCostMYR;
        const profitPercent = totalCostMYR > 0 ? (profit / totalCostMYR) * 100 : 0;

        return { totalValueMYR, totalCostMYR, profit, profitPercent };
    }, [stocks, exchangeRate]);

    return (
        <div className="space-y-8 animate-fade-in pb-10">

            {/* Header */}
            <div className="flex justify-between items-center pb-2">
                <div>
                    <h2 className="text-4xl font-bold text-gray-700 tracking-tight animate-fade-in-down">Portfolio</h2>
                    <div className="flex items-center gap-2 mt-1 animate-fade-in-down" style={{ animationDelay: '100ms' }}>
                        <p className="text-gray-500">Manage your investments</p>
                    </div>
                </div>

                {/* REFRESH BUTTON */}
                <button
                    onClick={handleRefreshMarketData}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-gray-600 transition-all disabled:opacity-50 active:scale-95 hover:text-blue-600 animate-fade-in-down"
                    style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff", animationDelay: '200ms' }}
                >
                    {isRefreshing ? <Loader2 size={18} className="animate-spin text-blue-600" /> : <RefreshCcw size={18} className="text-blue-600" />}
                    {isRefreshing ? "Updating..." : "Refresh Data"}
                </button>
            </div>

            {/* Hero Stats Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Main Value Card */}
                <div className="md:col-span-2 p-8 rounded-[32px] relative overflow-hidden flex flex-col justify-between min-h-[180px] group animate-fade-in-up opacity-0"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                        animationDelay: '300ms'
                    }}
                >
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                Total Equity (MYR)
                            </p>
                            <h3 className="text-5xl font-bold tracking-tight text-gray-700">
                                RM {portfolioStats.totalValueMYR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </h3>
                        </div>
                    </div>

                    <div className="relative z-10 flex items-center gap-6 mt-6">
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Total Return</p>
                            <div className={`flex items-center gap-2 ${portfolioStats.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {portfolioStats.profit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                                <span className="text-xl font-bold">
                                    {portfolioStats.profit >= 0 ? '+' : ''}RM {Math.abs(portfolioStats.profit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${portfolioStats.profit >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {portfolioStats.profitPercent.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                        <div className="h-10 w-px bg-gray-300"></div>
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Cost Basis</p>
                            <p className="text-gray-600 font-semibold text-lg">RM {portfolioStats.totalCostMYR.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        </div>
                    </div>
                </div>

                {/* Exchange Rate Card */}
                <div
                    className="p-6 rounded-[32px] flex flex-col justify-center relative overflow-hidden group animate-fade-in-up opacity-0"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                        animationDelay: '400ms'
                    }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 text-blue-600 rounded-2xl" style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}>
                            <Globe size={24} />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500 uppercase px-2 py-1 rounded" style={{ background: "#E0E5EC", boxShadow: "inset 2px 2px 4px #b8b9be, inset -2px -2px 4px #ffffff" }}>USD to MYR</span>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Current Rate</label>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-gray-400">RM</span>
                            <input
                                type="number"
                                step="0.01"
                                value={exchangeRate}
                                onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                                className="text-4xl font-bold text-gray-700 w-full border-none focus:ring-0 p-0 bg-transparent outline-none"
                            />
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-300 text-xs text-gray-500 flex items-center gap-1">
                        <Settings size={12} /> Auto-converts USD assets
                    </div>
                </div>
            </div>
            {/* Assets List & Add Form Container */}
            <div
                className="rounded-[32px] overflow-hidden min-h-[400px] flex flex-col animate-fade-in-up opacity-0"
                style={{
                    background: "#E0E5EC",
                    boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                    animationDelay: '500ms'
                }}
            >
                {/* Header with Add Button */}
                <div className="p-6 flex justify-between items-center bg-[#E0E5EC]" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <div className="flex items-center gap-3">
                        <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider flex items-center gap-2">
                            Holdings ({stocks.length})
                        </h3>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex gap-3 text-xs font-bold text-gray-500">
                            <span className="px-3 py-1.5 rounded-lg" style={{ background: "#E0E5EC", boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}>USD: {stocks.filter(s => s.currency === 'USD').length}</span>
                            <span className="px-3 py-1.5 rounded-lg" style={{ background: "#E0E5EC", boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}>MYR: {stocks.filter(s => s.currency === 'MYR').length}</span>
                        </div>

                        <button
                            onClick={() => setShowAdd(!showAdd)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95 ${showAdd ? 'text-red-500 hover:text-red-600' : 'text-blue-600 hover:text-blue-700'}`}
                            style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                        >
                            {showAdd ? <X size={14} /> : <Plus size={14} />}
                            {showAdd ? 'Cancel' : 'Add Position'}
                        </button>
                    </div>
                </div>

                {/* Add Asset Form (Integrated) */}
                {showAdd && (
                    <div className="p-6 animate-slide-in relative bg-[#E0E5EC]" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="font-bold text-sm text-gray-700 flex items-center gap-2">
                                New Asset Details
                            </h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Currency</label>
                                <div className="relative">
                                    <select
                                        className="w-full p-3 rounded-xl border-none focus:ring-0 appearance-none font-bold text-sm text-gray-700 shadow-inner outline-none"
                                        style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                        value={newStock.currency}
                                        onChange={e => setNewStock({ ...newStock, currency: e.target.value as 'MYR' | 'USD' })}
                                    >
                                        <option value="MYR">MYR (RM)</option>
                                        <option value="USD">USD ($)</option>
                                    </select>
                                    <div className="absolute right-3 top-3 text-gray-400 pointer-events-none text-xs">▼</div>
                                </div>
                            </div>
                            <div className="md:col-span-3">
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Symbol & Name</label>
                                <div className="flex gap-3">
                                    <input
                                        className="w-1/3 p-3 rounded-xl border-none focus:ring-0 font-bold uppercase text-sm placeholder-gray-400 text-gray-700 outline-none"
                                        style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                        value={newStock.symbol || ''}
                                        onChange={e => setNewStock({ ...newStock, symbol: e.target.value })}
                                        placeholder="AAPL"
                                    />
                                    <input
                                        className="w-2/3 p-3 rounded-xl border-none focus:ring-0 text-sm placeholder-gray-400 text-gray-700 outline-none"
                                        style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                        value={newStock.name || ''}
                                        onChange={e => setNewStock({ ...newStock, name: e.target.value })}
                                        placeholder="Apple Inc."
                                    />
                                </div>
                            </div>
                            <div className="md:col-span-7">
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Position Details</label>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-gray-400 text-[10px] font-bold">Buy</span>
                                        <input
                                            className="w-full p-3 pl-10 rounded-xl border-none focus:ring-0 font-semibold text-sm text-gray-700 outline-none"
                                            style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                            type="number"
                                            value={newStock.buyPrice || ''}
                                            onChange={e => setNewStock({ ...newStock, buyPrice: e.target.value })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-blue-500 text-[10px] font-bold">Now</span>
                                        <input
                                            className="w-full p-3 pl-10 rounded-xl border-none focus:ring-0 font-semibold text-sm text-blue-600 outline-none"
                                            style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                            type="number"
                                            value={newStock.currentPrice || ''}
                                            onChange={e => setNewStock({ ...newStock, currentPrice: e.target.value })}
                                            placeholder="Market"
                                        />
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-gray-400 text-[10px] font-bold">Qty</span>
                                        <input
                                            className="w-full p-3 pl-10 rounded-xl border-none focus:ring-0 font-semibold text-sm text-gray-700 outline-none"
                                            style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                            type="number"
                                            value={newStock.quantity || ''}
                                            onChange={e => setNewStock({ ...newStock, quantity: e.target.value })}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleAddStock}
                            className="w-full mt-6 bg-[#E0E5EC] text-blue-600 p-3 rounded-xl hover:scale-[1.01] font-bold text-sm transition-all active:scale-[0.99]"
                            style={{ boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                        >
                            Confirm Add Asset
                        </button>
                    </div>
                )}

                <div className="flex-1">
                    {stocks.length === 0 && !showAdd && (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            <div className="p-6 rounded-full mb-4" style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}>
                                <Search size={32} className="opacity-50" />
                            </div>
                            <p className="font-medium">No assets found</p>
                            <button onClick={() => setShowAdd(true)} className="mt-2 text-blue-500 text-sm font-bold hover:underline">Add your first stock</button>
                        </div>
                    )}

                    {stocks.map(stock => (
                        <StockItem
                            key={stock.id}
                            stock={stock}
                            exchangeRate={exchangeRate}
                            onUpdateStock={updateStockPrice}
                            onManage={openManageModal}
                            onDelete={requestDelete}
                        />
                    ))}
                </div>
            </div>

            {/* MANAGE STOCK MODAL */}
            {editingStock && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-500/30 backdrop-blur-md transition-opacity" onClick={closeManageModal} />
                    <div className="bg-[#E0E5EC] rounded-[32px] w-full max-w-lg shadow-2xl relative z-10 animate-scale-in overflow-hidden border border-white/40" style={{ boxShadow: "20px 20px 60px #bebebe, -20px -20px 60px #ffffff" }}>
                        <div className="p-8 pb-4 border-b border-gray-200 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-2xl text-gray-700 flex items-center gap-2">
                                    {editingStock.symbol}
                                </h3>
                                <p className="text-sm text-gray-500">{editingStock.name}</p>
                            </div>
                            <button onClick={closeManageModal} className="p-2 hover:bg-white/50 rounded-full transition-colors text-gray-500 hover:text-gray-700"><X size={20} /></button>
                        </div>

                        <div className="p-2 border-b border-gray-200 flex gap-2 px-8 bg-[#E0E5EC]">
                            {(['BUY', 'SELL', 'EDIT'] as const).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setManageMode(mode)}
                                    className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${manageMode === mode ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    style={manageMode === mode ? {
                                        background: "#E0E5EC",
                                        boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                    } : {}}
                                >
                                    {mode === 'BUY' ? 'Buy' : mode === 'SELL' ? 'Sell' : 'Edit'}
                                </button>
                            ))}
                        </div>

                        <div className="p-8 bg-[#E0E5EC]">
                            {manageMode === 'BUY' && (
                                <div className="space-y-6">
                                    <div className="p-4 rounded-2xl flex justify-between items-center" style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}>
                                        <div>
                                            <p className="text-xs font-bold text-blue-600 uppercase mb-1">Current Holding</p>
                                            <p className="text-xl font-bold text-gray-700">{editingStock.quantity.toLocaleString()} Shares</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-blue-600 uppercase mb-1">Avg Price</p>
                                            <p className="text-lg font-bold text-gray-700">{editingStock.buyPrice.toFixed(2)}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Shares to Buy</label>
                                            <input
                                                type="number"
                                                className="w-full p-4 rounded-2xl border-none focus:ring-0 font-bold text-lg text-gray-700 outline-none"
                                                value={transQty}
                                                onChange={e => setTransQty(e.target.value)}
                                                placeholder="0"
                                                autoFocus
                                                style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Price per Share</label>
                                            <input
                                                type="number"
                                                className="w-full p-4 rounded-2xl border-none focus:ring-0 font-bold text-lg text-gray-700 outline-none"
                                                value={transPrice}
                                                onChange={e => setTransPrice(e.target.value)}
                                                placeholder="0.00"
                                                style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                            />
                                        </div>
                                    </div>

                                    {previewAvgCost !== null && (
                                        <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}>
                                            <Calculator size={24} className="text-gray-400" />
                                            <div className="flex-1">
                                                <p className="text-xs text-gray-400 font-bold uppercase">New Average Cost Preview</p>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-gray-400 line-through text-sm">{editingStock.buyPrice.toFixed(2)}</span>
                                                    <ArrowRight size={16} className="text-gray-400" />
                                                    <span className="text-xl font-bold text-blue-600">{previewAvgCost.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleSaveManagement}
                                        className="w-full py-4 text-white rounded-2xl font-bold text-lg hover:opacity-90 transition-all active:scale-[0.98]"
                                        style={{ background: "linear-gradient(145deg, #0071e3, #4facfe)", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                                    >
                                        Confirm Purchase
                                    </button>
                                </div>
                            )}

                            {manageMode === 'SELL' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Shares to Sell</label>
                                            <input
                                                type="number"
                                                className="w-full p-4 rounded-2xl border-none focus:ring-0 font-bold text-lg text-red-500 outline-none"
                                                value={transQty}
                                                onChange={e => setTransQty(e.target.value)}
                                                placeholder="0"
                                                autoFocus
                                                style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Sell Price</label>
                                            <input
                                                type="number"
                                                className="w-full p-4 rounded-2xl border-none focus:ring-0 font-bold text-lg text-gray-700 outline-none"
                                                value={transPrice}
                                                onChange={e => setTransPrice(e.target.value)}
                                                placeholder="0.00"
                                                style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                            />
                                        </div>
                                    </div>

                                    {transQty && transPrice && (
                                        <div className="p-5 rounded-2xl space-y-3" style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-500 font-medium">Est. Total Proceeds</span>
                                                <span className="font-bold text-xl text-gray-700">{(Number(transQty) * Number(transPrice)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                                                <span className="text-sm text-gray-500 font-medium">Realized P/L</span>
                                                <span className={`font-bold text-lg ${(Number(transPrice) - editingStock.buyPrice) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {((Number(transPrice) - editingStock.buyPrice) * Number(transQty)).toLocaleString(undefined, { minimumFractionDigits: 2, style: 'currency', currency: editingStock.currency })}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <p className="text-xs text-center text-gray-400">Selling reduces your quantity but preserves your average cost basis.</p>

                                    <button
                                        onClick={handleSaveManagement}
                                        className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold text-lg hover:bg-red-600 transition-all active:scale-[0.98]"
                                        style={{ boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                                    >
                                        Confirm Sell Order
                                    </button>
                                </div>
                            )}

                            {manageMode === 'EDIT' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Symbol</label>
                                            <input
                                                className="w-full p-3 rounded-xl border-none font-bold text-gray-700 outline-none"
                                                style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                                value={editForm.symbol || ''}
                                                onChange={e => setEditForm({ ...editForm, symbol: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Currency</label>
                                            <select
                                                className="w-full p-3 rounded-xl border-none font-bold text-gray-700 outline-none"
                                                style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                                value={editForm.currency}
                                                onChange={e => setEditForm({ ...editForm, currency: e.target.value as any })}
                                            >
                                                <option value="MYR">MYR</option>
                                                <option value="USD">USD</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Name</label>
                                        <input
                                            className="w-full p-3 rounded-xl border-none font-bold text-gray-700 outline-none"
                                            style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                            value={editForm.name || ''}
                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        />
                                    </div>

                                    {/* Current Price and Quantity Row */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Current Price</label>
                                            <input
                                                type="number"
                                                className="w-full p-3 rounded-xl border-none font-bold text-blue-600 outline-none"
                                                style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                                value={editForm.currentPrice}
                                                onChange={e => setEditForm({ ...editForm, currentPrice: Number(e.target.value) })}
                                                placeholder="Market Price"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Quantity</label>
                                            <input
                                                type="number"
                                                className="w-full p-3 rounded-xl border-none font-bold text-gray-700 outline-none"
                                                style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                                value={editForm.quantity}
                                                onChange={e => setEditForm({ ...editForm, quantity: Number(e.target.value) })}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Avg Buy Cost</label>
                                        <input
                                            type="number"
                                            className="w-full p-3 rounded-xl border-none font-bold text-gray-700 outline-none"
                                            style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                            value={editForm.buyPrice}
                                            onChange={e => setEditForm({ ...editForm, buyPrice: Number(e.target.value) })}
                                        />
                                    </div>

                                    <button
                                        onClick={handleSaveManagement}
                                        className="w-full py-4 text-white rounded-xl font-bold text-lg hover:opacity-90 transition-all active:scale-[0.98] mt-4"
                                        style={{ background: "linear-gradient(145deg, #0071e3, #4facfe)", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                                    >
                                        Save Details
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => requestDelete(editingStock.id, e)}
                                        className="w-full py-3 rounded-xl font-bold text-sm text-red-500 hover:text-red-600 transition-colors"
                                        style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                                    >
                                        Delete Asset Permanently
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRM DELETE MODAL */}
            {deleteId && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-500/30 backdrop-blur-sm transition-opacity" onClick={() => setDeleteId(null)} />
                    <div className="bg-[#E0E5EC] rounded-[32px] w-full max-w-sm relative z-10 animate-scale-in border border-white/40 overflow-hidden" style={{ boxShadow: "20px 20px 60px #bebebe, -20px -20px 60px #ffffff" }}>
                        <div className="p-8 flex flex-col items-center text-center">
                            <div className="w-20 h-20 text-red-500 rounded-full flex items-center justify-center mb-6" style={{ background: "#E0E5EC", boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}>
                                <AlertCircle size={40} />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-700 mb-2">Delete Asset?</h3>
                            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                                Are you sure you want to remove this stock from your portfolio? This action cannot be undone.
                            </p>
                            <div className="flex gap-4 w-full">
                                <button
                                    onClick={() => setDeleteId(null)}
                                    className="flex-1 py-4 text-gray-700 font-bold rounded-xl transition-all active:scale-95 hover:text-gray-900"
                                    style={{ background: "#E0E5EC", boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 py-4 bg-red-500 text-white font-bold rounded-xl transition-all active:scale-95 hover:bg-red-600"
                                    style={{ boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Investments;