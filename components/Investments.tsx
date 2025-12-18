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
        <div className="p-6 hover:bg-input-bg transition-colors group flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Left: Identity */}
            <div className="flex items-center gap-4 w-full md:w-1/3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold shadow-sm ${isUSD ? 'bg-blue-600 text-white' : 'bg-yellow-400 text-yellow-900'}`}>
                    {stock.symbol.substring(0, 2)}
                </div>
                <div>
                    <div className="font-bold text-text-main text-lg">{stock.symbol}</div>
                    <div className="text-xs text-text-muted font-medium">{stock.name}</div>
                </div>
            </div>

            {/* Middle: Price & Qty */}
            <div className="flex justify-between md:justify-center gap-8 w-full md:w-1/3 text-sm">
                <div className="text-right md:text-center flex flex-col items-end md:items-center">
                    <p className="text-text-muted text-[10px] font-bold uppercase mb-1">Market Price</p>
                    <div className="relative group/input">
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-text-muted font-bold text-xs pointer-events-none">
                           {currencySymbol}
                        </span>
                        <input 
                            type="number"
                            value={priceInput}
                            onChange={(e) => setPriceInput(e.target.value)}
                            onFocus={() => setIsEditing(true)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            className={`w-24 pl-5 pr-2 py-1 text-right md:text-center font-bold text-text-main bg-transparent border-b border-border focus:border-primary focus:bg-surface focus:ring-0 focus:outline-none transition-all rounded-t-md ${isEditing ? 'bg-surface shadow-sm scale-110 z-10' : 'hover:border-text-muted'}`}
                        />
                        {!isEditing && (
                             <Pencil size={10} className="absolute -right-3 top-1/2 -translate-y-1/2 text-text-muted opacity-0 group-hover/input:opacity-100 pointer-events-none transition-opacity" />
                        )}
                    </div>
                </div>
                <div className="text-right md:text-center">
                    <p className="text-text-muted text-[10px] font-bold uppercase mb-1">Avg Cost</p>
                    <p className="font-medium text-text-muted py-1">{currencySymbol} {stock.buyPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
                <div className="text-right md:text-center">
                    <p className="text-text-muted text-[10px] font-bold uppercase mb-1">Shares</p>
                    <p className="font-medium text-text-muted py-1">{stock.quantity.toLocaleString()}</p>
                </div>
            </div>

            {/* Right: Value & Actions */}
            <div className="flex items-center justify-between w-full md:w-1/3 gap-4">
                <div className="text-right flex-1">
                    <p className="font-bold text-lg text-text-main">RM {valueMYR.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                    <div className={`text-xs font-bold flex items-center justify-end gap-1 ${plPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {plPercent >= 0 ? '+' : ''}{plPercent.toFixed(2)}%
                        <span className="opacity-50">({currencySymbol}{Math.abs(plNative).toLocaleString(undefined, {maximumFractionDigits: 0})})</span>
                    </div>
                </div>
                
                <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity relative z-10">
                    <button type="button" onClick={() => onManage(stock)} className="p-2 bg-input-bg hover:bg-blue-500/10 text-text-muted hover:text-blue-600 rounded-full transition-colors cursor-pointer" title="Edit Details">
                        <Settings size={16} />
                    </button>
                    <button type="button" onClick={(e) => onDelete(stock.id, e)} className="p-2 bg-input-bg hover:bg-red-500/10 text-text-muted hover:text-red-600 rounded-full transition-colors cursor-pointer" title="Delete">
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
          const uniqueSymbols = Array.from(new Set(stocks.map(s => s.symbol)));
          
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
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* Header */}
      <div className="flex justify-between items-center pb-2">
        <div>
             <h2 className="text-3xl font-bold text-text-main tracking-tight">Portfolio</h2>
             <div className="flex items-center gap-2 mt-1">
                <p className="text-text-muted">Manage your investments</p>
             </div>
        </div>
        
        {/* REFRESH BUTTON */}
        <button 
            onClick={handleRefreshMarketData}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-input-bg hover:bg-surface text-text-main px-4 py-2 rounded-xl font-bold text-sm shadow-sm border border-border hover:border-primary/50 transition-all disabled:opacity-50 active:scale-95"
        >
            {isRefreshing ? <Loader2 size={16} className="animate-spin text-primary"/> : <RefreshCcw size={16} className="text-primary"/>}
            {isRefreshing ? "Updating..." : "Refresh Data"}
        </button>
      </div>

      {/* Hero Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Value Card */}
          <div className="md:col-span-2 bg-secondary text-surface p-8 rounded-[32px] shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[180px]">
               <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full -mr-16 -mt-16 blur-3xl"></div>
               
               <div className="relative z-10 flex justify-between items-start">
                   <div>
                       <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Total Equity (MYR)</p>
                       <h3 className="text-5xl font-bold tracking-tight">
                           RM {portfolioStats.totalValueMYR.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                       </h3>
                   </div>
               </div>

               <div className="relative z-10 flex items-center gap-6 mt-6">
                   <div>
                       <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Return</p>
                       <div className={`flex items-center gap-2 ${portfolioStats.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                           {portfolioStats.profit >= 0 ? <TrendingUp size={18}/> : <TrendingDown size={18}/>}
                           <span className="text-lg font-bold">
                               {portfolioStats.profit >= 0 ? '+' : ''}RM {Math.abs(portfolioStats.profit).toLocaleString(undefined, {maximumFractionDigits: 0})}
                           </span>
                           <span className={`text-xs px-2 py-0.5 rounded-full font-bold bg-white/10`}>
                               {portfolioStats.profitPercent.toFixed(2)}%
                           </span>
                       </div>
                   </div>
                   <div className="h-8 w-px bg-white/10"></div>
                   <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Cost Basis</p>
                        <p className="text-gray-300 font-semibold">RM {portfolioStats.totalCostMYR.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                   </div>
               </div>
          </div>

          {/* Exchange Rate Card */}
          <div className="bg-surface p-6 rounded-[32px] shadow-apple border border-border flex flex-col justify-center relative overflow-hidden group">
               <div className="flex items-center justify-between mb-4">
                   <div className="p-3 bg-blue-500/10 text-blue-600 rounded-full">
                       <Globe size={20} />
                   </div>
                   <div className="flex items-center gap-2">
                       <span className="text-xs font-bold text-text-muted uppercase bg-input-bg px-2 py-1 rounded">USD to MYR</span>
                   </div>
               </div>
               
               <div>
                   <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1 block">Current Rate</label>
                   <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-text-muted">RM</span>
                        <input 
                            type="number"
                            step="0.01"
                            value={exchangeRate}
                            onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                            className="text-4xl font-bold text-text-main w-full border-none focus:ring-0 p-0 bg-transparent"
                        />
                   </div>
               </div>
               <div className="mt-4 pt-4 border-t border-border text-xs text-text-muted flex items-center gap-1">
                   <Settings size={12}/> Auto-converts USD assets
               </div>
          </div>
      </div>
      
      {/* Assets List & Add Form Container */}
      <div className="bg-surface rounded-[32px] shadow-apple overflow-hidden border border-border min-h-[400px] flex flex-col">
          {/* Header with Add Button */}
          <div className="p-6 border-b border-border bg-input-bg flex justify-between items-center backdrop-blur-sm">
              <div className="flex items-center gap-3">
                  <h3 className="font-bold text-text-muted text-xs uppercase tracking-wider flex items-center gap-2">
                      Holdings ({stocks.length})
                  </h3>
              </div>

              <div className="flex items-center gap-3">
                  <div className="hidden md:flex gap-2 text-xs font-medium text-text-muted">
                      <span className="px-2 py-1 rounded bg-surface border border-border">USD: {stocks.filter(s => s.currency === 'USD').length}</span>
                      <span className="px-2 py-1 rounded bg-surface border border-border">MYR: {stocks.filter(s => s.currency === 'MYR').length}</span>
                  </div>

                  <button 
                    onClick={() => setShowAdd(!showAdd)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm ${showAdd ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20' : 'bg-text-main text-surface hover:opacity-90 active:scale-95'}`}
                  >
                    {showAdd ? <X size={14} /> : <Plus size={14} />}
                    {showAdd ? 'Cancel' : 'Add Position'}
                  </button>
              </div>
          </div>
          
          {/* Add Asset Form (Integrated) */}
          {showAdd && (
            <div className="bg-input-bg p-6 border-b border-border animate-slide-in relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-sm text-text-main flex items-center gap-2">
                        New Asset Details
                    </h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">Currency</label>
                        <div className="relative">
                            <select 
                                className="w-full p-3 bg-surface rounded-xl border border-border focus:ring-2 focus:ring-primary/20 appearance-none font-bold text-sm text-text-main shadow-sm"
                                value={newStock.currency}
                                onChange={e => setNewStock({...newStock, currency: e.target.value as 'MYR' | 'USD'})}
                            >
                                <option value="MYR">MYR (RM)</option>
                                <option value="USD">USD ($)</option>
                            </select>
                            <div className="absolute right-3 top-3 text-text-muted pointer-events-none text-xs">▼</div>
                        </div>
                    </div>
                    <div className="md:col-span-3">
                        <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">Symbol & Name</label>
                        <div className="flex gap-2">
                            <input className="w-1/3 p-3 bg-surface rounded-xl border border-border focus:ring-2 focus:ring-primary/20 font-bold uppercase text-sm placeholder-text-muted/50 text-text-main shadow-sm" value={newStock.symbol || ''} onChange={e => setNewStock({...newStock, symbol: e.target.value})} placeholder="AAPL" />
                            <input className="w-2/3 p-3 bg-surface rounded-xl border border-border focus:ring-2 focus:ring-primary/20 text-sm placeholder-text-muted/50 text-text-main shadow-sm" value={newStock.name || ''} onChange={e => setNewStock({...newStock, name: e.target.value})} placeholder="Apple Inc." />
                        </div>
                    </div>
                    <div className="md:col-span-7">
                        <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">Position Details</label>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-text-muted text-[10px] font-bold">Buy</span>
                                <input className="w-full p-3 pl-10 bg-surface rounded-xl border border-border focus:ring-2 focus:ring-primary/20 font-semibold text-sm shadow-sm text-text-main" type="number" value={newStock.buyPrice || ''} onChange={e => setNewStock({...newStock, buyPrice: e.target.value})} placeholder="0.00" />
                            </div>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-blue-500 text-[10px] font-bold">Now</span>
                                <input className="w-full p-3 pl-10 bg-blue-500/10 rounded-xl border border-blue-500/20 focus:ring-2 focus:ring-primary/20 font-semibold text-sm text-blue-600 shadow-sm" type="number" value={newStock.currentPrice || ''} onChange={e => setNewStock({...newStock, currentPrice: e.target.value})} placeholder="Market" />
                            </div>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-text-muted text-[10px] font-bold">Qty</span>
                                <input className="w-full p-3 pl-10 bg-surface rounded-xl border border-border focus:ring-2 focus:ring-primary/20 font-semibold text-sm shadow-sm text-text-main" type="number" value={newStock.quantity || ''} onChange={e => setNewStock({...newStock, quantity: e.target.value})} placeholder="0" />
                            </div>
                        </div>
                    </div>
                </div>
                <button onClick={handleAddStock} className="w-full mt-4 bg-text-main text-surface p-3 rounded-xl hover:opacity-90 font-bold text-sm transition-all shadow-md active:scale-[0.99]">
                    Confirm Add Asset
                </button>
            </div>
          )}

          <div className="divide-y divide-border flex-1">
              {stocks.length === 0 && !showAdd && (
                  <div className="flex flex-col items-center justify-center h-64 text-text-muted">
                      <div className="p-4 bg-input-bg rounded-full mb-4">
                          <Search size={24} className="opacity-50"/>
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
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={closeManageModal} />
            <div className="bg-surface rounded-[32px] w-full max-w-lg shadow-2xl relative z-10 animate-scale-in overflow-hidden border border-white/10">
                <div className="p-8 pb-4 border-b border-border flex justify-between items-center bg-input-bg">
                    <div>
                        <h3 className="font-bold text-2xl text-text-main flex items-center gap-2">
                            {editingStock.symbol} 
                        </h3>
                        <p className="text-sm text-text-muted">{editingStock.name}</p>
                    </div>
                    <button onClick={closeManageModal} className="p-2 bg-surface hover:bg-border rounded-full transition-colors"><X size={20}/></button>
                </div>

                <div className="p-2 bg-input-bg border-b border-border flex gap-2 px-8">
                    {(['BUY', 'SELL', 'EDIT'] as const).map(mode => (
                        <button 
                            key={mode}
                            onClick={() => setManageMode(mode)}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${manageMode === mode ? 'bg-surface shadow-md text-text-main ring-1 ring-black/5 dark:ring-white/10' : 'text-text-muted hover:text-text-main hover:bg-surface/50'}`}
                        >
                            {mode === 'BUY' ? 'Buy' : mode === 'SELL' ? 'Sell' : 'Edit'}
                        </button>
                    ))}
                </div>

                <div className="p-8 bg-surface">
                    {manageMode === 'BUY' && (
                        <div className="space-y-6">
                             <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20 flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold text-blue-600 uppercase mb-1">Current Holding</p>
                                    <p className="text-xl font-bold text-blue-900 dark:text-blue-300">{editingStock.quantity.toLocaleString()} Shares</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-blue-600 uppercase mb-1">Avg Price</p>
                                    <p className="text-lg font-bold text-blue-900 dark:text-blue-300">{editingStock.buyPrice.toFixed(2)}</p>
                                </div>
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-text-muted uppercase mb-2 block">Shares to Buy</label>
                                    <input type="number" className="w-full p-4 bg-input-bg rounded-2xl border-none focus:ring-2 focus:ring-primary/20 font-bold text-lg text-text-main" value={transQty} onChange={e => setTransQty(e.target.value)} placeholder="0" autoFocus />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text-muted uppercase mb-2 block">Price per Share</label>
                                    <input type="number" className="w-full p-4 bg-input-bg rounded-2xl border-none focus:ring-2 focus:ring-primary/20 font-bold text-lg text-text-main" value={transPrice} onChange={e => setTransPrice(e.target.value)} placeholder="0.00" />
                                </div>
                             </div>

                             {previewAvgCost !== null && (
                                 <div className="flex items-center gap-3 bg-input-bg p-4 rounded-2xl border border-border">
                                     <Calculator size={24} className="text-text-muted"/>
                                     <div className="flex-1">
                                         <p className="text-xs text-text-muted font-bold uppercase">New Average Cost Preview</p>
                                         <div className="flex items-center gap-3 mt-1">
                                            <span className="text-text-muted line-through text-sm">{editingStock.buyPrice.toFixed(2)}</span>
                                            <ArrowRight size={16} className="text-text-muted"/>
                                            <span className="text-xl font-bold text-primary">{previewAvgCost.toFixed(2)}</span>
                                         </div>
                                     </div>
                                 </div>
                             )}

                             <button onClick={handleSaveManagement} className="w-full py-4 bg-text-main text-surface rounded-2xl font-bold text-lg hover:opacity-90 transition-colors shadow-lg active:scale-[0.98]">
                                 Confirm Purchase
                             </button>
                        </div>
                    )}

                    {manageMode === 'SELL' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-text-muted uppercase mb-2 block">Shares to Sell</label>
                                    <input type="number" className="w-full p-4 bg-input-bg rounded-2xl border-none focus:ring-2 focus:ring-primary/20 font-bold text-lg text-red-600" value={transQty} onChange={e => setTransQty(e.target.value)} placeholder="0" autoFocus />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text-muted uppercase mb-2 block">Sell Price</label>
                                    <input type="number" className="w-full p-4 bg-input-bg rounded-2xl border-none focus:ring-2 focus:ring-primary/20 font-bold text-lg text-text-main" value={transPrice} onChange={e => setTransPrice(e.target.value)} placeholder="0.00" />
                                </div>
                            </div>
                            
                            {transQty && transPrice && (
                                <div className="bg-input-bg p-5 rounded-2xl border border-border space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-text-muted font-medium">Est. Total Proceeds</span>
                                        <span className="font-bold text-xl text-text-main">{(Number(transQty) * Number(transPrice)).toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-3 border-t border-border">
                                        <span className="text-sm text-text-muted font-medium">Realized P/L</span>
                                        <span className={`font-bold text-lg ${(Number(transPrice) - editingStock.buyPrice) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {( (Number(transPrice) - editingStock.buyPrice) * Number(transQty) ).toLocaleString(undefined, {minimumFractionDigits:2, style: 'currency', currency: editingStock.currency})}
                                        </span>
                                    </div>
                                </div>
                            )}

                             <p className="text-xs text-center text-text-muted">Selling reduces your quantity but preserves your average cost basis.</p>

                            <button onClick={handleSaveManagement} className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold text-lg hover:bg-red-700 transition-colors shadow-lg active:scale-[0.98]">
                                Confirm Sell Order
                            </button>
                        </div>
                    )}

                    {manageMode === 'EDIT' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-text-muted uppercase mb-1 block">Symbol</label>
                                    <input className="w-full p-3 bg-input-bg rounded-xl border-none font-bold text-text-main" value={editForm.symbol || ''} onChange={e => setEditForm({...editForm, symbol: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text-muted uppercase mb-1 block">Currency</label>
                                    <select className="w-full p-3 bg-input-bg rounded-xl border-none font-bold text-text-main" value={editForm.currency} onChange={e => setEditForm({...editForm, currency: e.target.value as any})}>
                                        <option value="MYR">MYR</option>
                                        <option value="USD">USD</option>
                                    </select>
                                </div>
                            </div>
                             <div>
                                <label className="text-xs font-bold text-text-muted uppercase mb-1 block">Name</label>
                                <input className="w-full p-3 bg-input-bg rounded-xl border-none font-bold text-text-main" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                            </div>
                            
                            {/* Current Price and Quantity Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-text-muted uppercase mb-1 block">Current Price</label>
                                    <input type="number" className="w-full p-3 bg-input-bg rounded-xl border-none font-bold text-primary" value={editForm.currentPrice} onChange={e => setEditForm({...editForm, currentPrice: Number(e.target.value)})} placeholder="Market Price" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text-muted uppercase mb-1 block">Quantity</label>
                                    <input type="number" className="w-full p-3 bg-input-bg rounded-xl border-none font-bold text-text-main" value={editForm.quantity} onChange={e => setEditForm({...editForm, quantity: Number(e.target.value)})} />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-text-muted uppercase mb-1 block">Avg Buy Cost</label>
                                <input type="number" className="w-full p-3 bg-input-bg rounded-xl border-none font-bold text-text-main" value={editForm.buyPrice} onChange={e => setEditForm({...editForm, buyPrice: Number(e.target.value)})} />
                            </div>

                            <button onClick={handleSaveManagement} className="w-full py-4 bg-text-main text-surface rounded-xl font-bold text-lg hover:opacity-90 transition-colors mt-4">
                                Save Details
                            </button>
                            <button 
                                type="button"
                                onClick={(e) => requestDelete(editingStock.id, e)}
                                className="w-full py-3 rounded-xl font-bold text-sm text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors"
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
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
            <div className="bg-surface rounded-[24px] w-full max-w-sm shadow-2xl relative z-10 animate-scale-in border border-border overflow-hidden">
                <div className="p-6 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-text-main mb-2">Delete Asset?</h3>
                    <p className="text-text-muted text-sm mb-6 leading-relaxed">
                        Are you sure you want to remove this stock from your portfolio? This action cannot be undone.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setDeleteId(null)}
                            className="flex-1 py-3.5 bg-input-bg text-text-main font-bold rounded-xl hover:bg-border transition-colors active:scale-95"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmDelete}
                            className="flex-1 py-3.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20 active:scale-95"
                        >
                            Yes, Delete
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