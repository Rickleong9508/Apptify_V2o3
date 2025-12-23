import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Wallet,
  PieChart,
  CreditCard,
  TrendingUp,
  Triangle,
  Grid,
  Cloud,
  CheckCircle2
} from 'lucide-react';
import Dashboard from './Dashboard';
import Accounts from './Accounts';
import Budget from './Budget';
import Loans from './Loans';
import Investments from './Investments';
import { Account, Expense, Loan, Stock, MonthlyData, Transaction } from '../types';
import WealthAiAssistant from './WealthAiAssistant';
import { aiService } from '../services/aiService';
import { useAuth } from './AuthProvider'; // New
import { supabase } from '../services/supabaseClient'; // New

// Initial Data Defaults
const INITIAL_ACCOUNTS_DEFAULT: Account[] = [];
const INITIAL_MONTHLY_DATA: MonthlyData = {
  income: 0,
  expenses: [],
  targetDate: new Date().toISOString().slice(0, 7)
};
const STORAGE_KEY = 'mw_data_main';

interface MyWealthAppProps {
  onExit: () => void;
}

const MyWealthApp: React.FC<MyWealthAppProps> = ({ onExit }) => {
  const { session, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts' | 'budget' | 'loans' | 'investments'>('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  // --- Theme State ---
  // Note: Theme is still handled locally for rendering, but storage is available to backup
  const [theme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('mw_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // --- Data State ---
  const [accounts, setAccounts] = useState<Account[]>(INITIAL_ACCOUNTS_DEFAULT);
  const [monthlyData, setMonthlyData] = useState<MonthlyData>(INITIAL_MONTHLY_DATA);
  const [fixedExpenses, setFixedExpenses] = useState<Expense[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(4.50);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // --- Load Data (Local then Cloud) ---
  // --- Load Data (Local then Cloud) ---
  useEffect(() => {
    const loadData = async () => {
      setIsDataLoaded(false);
      // 1. Load Local
      const savedJSON = localStorage.getItem(STORAGE_KEY);
      let localData: any = null;
      if (savedJSON) {
        try {
          localData = JSON.parse(savedJSON);
          setAccounts(localData.accounts || []);
          setMonthlyData(localData.monthlyData || INITIAL_MONTHLY_DATA);
          setFixedExpenses(localData.fixedExpenses || []);
          setLoans(localData.loans || []);
          setStocks(localData.stocks || []);
          setExchangeRate(localData.exchangeRate || 4.5);
        } catch (e) {
          console.error("Failed to load local data", e);
        }
      }

      // 2. Sync Cloud if Logged In
      if (session && user) {
        setIsSyncing(true);
        try {
          const { data, error } = await supabase
            .from('user_data')
            .select('data, updated_at')
            .eq('user_id', user.id)
            .single();

          if (data && data.data) {
            // Support both new scoped format and legacy root format
            const cloudApp = data.data.mywealth || data.data;

            const cloudTime = new Date(cloudApp.lastUpdated || data.updated_at).getTime();
            const localTime = localData?.lastUpdated ? new Date(localData.lastUpdated).getTime() : 0;

            // If Cloud is newer or Local is empty, use Cloud
            if (cloudTime > localTime || !localData) {
              console.log("Sync: Cloud data is newer, applying...", cloudApp);
              setAccounts(cloudApp.accounts || []);
              setMonthlyData(cloudApp.monthlyData || INITIAL_MONTHLY_DATA);
              setFixedExpenses(cloudApp.fixedExpenses || []);
              setLoans(cloudApp.loans || []);
              setStocks(cloudApp.stocks || []);
              setExchangeRate(cloudApp.exchangeRate || 4.5);
            } else {
              console.log("Sync: Local data is newer or same.");
            }
          }
        } catch (err) {
          console.error("Sync error:", err);
        } finally {
          setIsSyncing(false);
        }
      }
      setIsDataLoaded(true);
    };

    loadData();
  }, [session, user]); // Reload when session changes

  // --- Realtime Sync Subscription ---
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(`mywealth_sync_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_data', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newData = payload.new as any;
          if (newData && newData.data) {
            const cloudApp = newData.data.mywealth || newData.data; // Support legacy
            // Check if it's actually different/newer? 
            // For now, strict sync to ensure data propagation
            console.log("Realtime: Remote update received", cloudApp);

            setAccounts(cloudApp.accounts || []);
            setMonthlyData(cloudApp.monthlyData || INITIAL_MONTHLY_DATA);
            setFixedExpenses(cloudApp.fixedExpenses || []);
            setLoans(cloudApp.loans || []);
            setStocks(cloudApp.stocks || []);
            setExchangeRate(cloudApp.exchangeRate || 4.5);

            // Visual feedback
            setIsSyncing(true);
            setTimeout(() => setIsSyncing(false), 1000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // --- Save Data (Local & Cloud) ---
  useEffect(() => {
    if (!isDataLoaded) return;

    const dataToSave = { accounts, monthlyData, fixedExpenses, loans, stocks, exchangeRate, lastUpdated: new Date().toISOString() };

    // Save Local
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));

    // Save Cloud (Debounced 2s)
    if (session && user) {
      const pushToCloud = async () => {
        setIsSyncing(true);
        try {
          // Fetch LATEST full data to avoid overwriting other apps
          const { data: existing } = await supabase.from('user_data').select('id, data').eq('user_id', user.id).single();

          let finalData = existing?.data || {};
          // Merge MyWealth Data
          finalData.mywealth = dataToSave;

          if (existing?.id) {
            await supabase.from('user_data').update({
              data: finalData,
              updated_at: new Date().toISOString()
            }).eq('user_id', user.id);
          } else {
            // First time creation
            await supabase.from('user_data').insert({
              user_id: user.id,
              data: finalData,
              updated_at: new Date().toISOString()
            });
          }
          setShowSyncSuccess(true);
          setTimeout(() => setShowSyncSuccess(false), 2000);
        } catch (err) {
          console.error("Cloud save failed", err);
        } finally {
          setIsSyncing(false);
        }
      };
      const timer = setTimeout(pushToCloud, 2000); // Debounce Cloud Save
      return () => clearTimeout(timer);
    }

  }, [accounts, monthlyData, fixedExpenses, loans, stocks, exchangeRate, isDataLoaded, session, user]);

  const navItems = [
    { id: 'dashboard' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'accounts' as const, label: 'Wallets', icon: Wallet },
    { id: 'budget' as const, label: 'Budget', icon: PieChart },
    { id: 'loans' as const, label: 'Loans', icon: CreditCard },
    { id: 'investments' as const, label: 'Invest', icon: TrendingUp },
  ];

  // --- AI Command Processor ---
  const processAiCommand = async (text: string): Promise<string> => {
    const apiKey = localStorage.getItem('app_global_api_key');
    const provider = (localStorage.getItem('app_global_ai_provider') as any) || 'google';
    const model = localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash';

    if (!apiKey) return "Please set your API Key in Settings first.";

    const accountNames = accounts.map(a => a.name).join(', ');
    const stockSymbols = stocks.map(s => s.symbol).join(', ');

    const prompt = `
        You are a smart financial assistant for 'Apptify'.
        Current Date: ${new Date().toISOString()}
        Existing Wallets: [${accountNames}]
        Existing Stocks: [${stockSymbols}]

        User Query: "${text}"

        Analyze the query and output a JSON object describing the action to take.
        Do NOT output markdown (no \`\`\`json). Just the raw JSON object.

        Schemas:
        1. RECORD TRANSACTION (Income/Expense/Transfer)
        {
          "type": "TRANSACTION",
          "action": "IN" | "OUT",
          "accountName": "string (best match from existing, or new if explicitly named)",
          "amount": number,
          "description": "string"
        }

        2. STOCK TRADE (Buy/Sell)
        {
          "type": "INVESTMENT",
          "action": "BUY" | "SELL",
          "symbol": "string (uppercase)",
          "name": "string (optional company name)",
          "quantity": number,
          "price": number,
          "currency": "MYR" | "USD" (Default to MYR unless symbol is US stock or specified)
        }

        3. CREATE WALLET
        {
          "type": "ADD_WALLET",
          "name": "string"
        }

        4. GENERAL QUERY / ERROR
        {
          "type": "UNKNOWN",
          "message": "string (helpful response)"
        }
      `;

    try {
      const responseText = await aiService.generate(provider, model, apiKey, prompt);
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const action = JSON.parse(cleanJson);

      if (action.type === 'UNKNOWN') {
        return action.message;
      }

      if (action.type === 'ADD_WALLET') {
        const newAcc: Account = {
          id: Date.now().toString(),
          name: action.name,
          balance: 0,
          reservations: [],
          history: []
        };
        setAccounts(prev => [...prev, newAcc]);
        return `Created new wallet: ${action.name}`;
      }

      if (action.type === 'TRANSACTION') {
        // Find Account
        let targetAcc = accounts.find(a => a.name.toLowerCase().includes(action.accountName.toLowerCase()));

        // If strict match fails, try looser or default to first if only one exists
        if (!targetAcc && accounts.length === 1) targetAcc = accounts[0];

        if (!targetAcc) {
          return `I couldn't find a wallet named "${action.accountName}". Available: ${accountNames}`;
        }

        const newTx: Transaction = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          type: action.action,
          amount: action.amount,
          description: action.description
        };

        setAccounts(prev => prev.map(acc => {
          if (acc.id === targetAcc!.id) {
            return {
              ...acc,
              balance: action.action === 'IN' ? acc.balance + action.amount : acc.balance - action.amount,
              history: [newTx, ...acc.history]
            };
          }
          return acc;
        }));

        return `Recorded ${action.action === 'IN' ? 'Income' : 'Expense'}: RM${action.amount} in ${targetAcc.name} (${action.description})`;
      }

      if (action.type === 'INVESTMENT') {
        const symbol = action.symbol.toUpperCase();
        let stock = stocks.find(s => s.symbol === symbol);

        if (action.action === 'BUY') {
          if (stock) {
            // Average Down/Up
            const totalOld = stock.quantity * stock.buyPrice;
            const totalNew = action.quantity * action.price;
            const newQty = stock.quantity + action.quantity;
            const newAvg = (totalOld + totalNew) / newQty;

            setStocks(prev => prev.map(s => s.id === stock!.id ? { ...s, quantity: newQty, buyPrice: newAvg, currentPrice: action.price } : s));
            return `Bought ${action.quantity} more ${symbol} at ${action.price}. New Avg: ${newAvg.toFixed(2)}`;
          } else {
            // New Position
            const newStock: Stock = {
              id: Date.now().toString(),
              symbol: symbol,
              name: action.name || symbol,
              buyPrice: action.price,
              currentPrice: action.price,
              quantity: action.quantity,
              currency: action.currency || 'MYR'
            };
            setStocks(prev => [...prev, newStock]);
            return `Opened position: ${symbol}, ${action.quantity} units at ${action.price}`;
          }
        } else if (action.action === 'SELL') {
          if (!stock) return `You don't own ${symbol}.`;
          if (stock.quantity < action.quantity) return `Insufficient shares. You have ${stock.quantity} ${symbol}.`;

          const newQty = stock.quantity - action.quantity;
          if (newQty === 0) {
            setStocks(prev => prev.filter(s => s.id !== stock!.id));
            return `Sold all ${symbol} at ${action.price}.`;
          } else {
            setStocks(prev => prev.map(s => s.id === stock!.id ? { ...s, quantity: newQty, currentPrice: action.price } : s));
            return `Sold ${action.quantity} ${symbol}. Remaining: ${newQty}`;
          }
        }
      }

      return "Command processed but no action taken.";

    } catch (e: any) {
      console.error(e);
      return "Failed to process intent. " + e.message;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#E0E5EC] text-[#4A4A4A] font-sans selection:bg-gray-300 transition-colors duration-300 relative">

      {/* Main Content Area */}
      <main className="flex-1 w-full h-full overflow-y-auto relative scroll-smooth">
        {/* Added extra bottom padding (pb-40) to accommodate floating bar */}
        <div className="max-w-5xl mx-auto p-6 md:p-12 pb-40">


          {/* Minimal Header Branding & Auth */}
          <div className="flex items-center justify-between mb-8 animate-fade-in-down">
            <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity w-fit select-none cursor-pointer group" onClick={onExit}>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-700 transition-transform active:scale-95 group-hover:scale-105"
                style={{
                  background: "#E0E5EC",
                  boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                }}
              >
                <Triangle size={14} fill="currentColor" className="rotate-180" />
              </div>
              <span className="font-bold text-lg tracking-tight text-gray-700">MyWealth</span>
            </div>

            {/* Sync Status Only */}
            <div className="flex items-center gap-4">
              {/* Sync Status Indicator */}
              {isSyncing && (
                <div className="flex items-center gap-1 text-xs text-blue-500 font-medium animate-pulse">
                  <Cloud size={14} />
                  <span>Syncing...</span>
                </div>
              )}
              {showSyncSuccess && !isSyncing && (
                <div className="flex items-center gap-1 text-xs text-green-500 font-medium animate-fade-in">
                  <CheckCircle2 size={14} />
                  <span>Saved</span>
                </div>
              )}
            </div>
          </div>

          {/* Component Render */}
          <div key={activeTab} className="animate-fade-in-up">
            {activeTab === 'dashboard' && <Dashboard accounts={accounts} monthlyData={monthlyData} fixedExpenses={fixedExpenses} loans={loans} stocks={stocks} exchangeRate={exchangeRate} />}
            {activeTab === 'accounts' && <Accounts accounts={accounts} setAccounts={setAccounts} />}
            {activeTab === 'budget' && <Budget monthlyData={monthlyData} setMonthlyData={setMonthlyData} fixedExpenses={fixedExpenses} setFixedExpenses={setFixedExpenses} />}
            {activeTab === 'loans' && <Loans loans={loans} setLoans={setLoans} />}
            {activeTab === 'investments' && <Investments stocks={stocks} setStocks={setStocks} exchangeRate={exchangeRate} setExchangeRate={setExchangeRate} />}
          </div>
        </div>
      </main>

      <WealthAiAssistant onProcessCommand={processAiCommand} />



      {/* FLOATING CLAY NAVIGATION DOCK */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] md:w-auto max-w-lg transition-all duration-300">
        <nav
          className="bg-[#E0E5EC] rounded-[30px] px-4 py-3 md:px-6 md:py-4 flex items-center justify-between md:gap-6 transition-all hover:scale-[1.02]"
          style={{
            boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
          }}
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 relative group
                    ${isActive ? 'text-blue-600 transform -translate-y-1' : 'text-gray-400 hover:text-gray-600'}
                `}
                style={isActive ? {
                  background: "#E0E5EC",
                  boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                } : {}}
              >
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 2}
                  className="transition-all"
                />

              </button>
            )
          })}
        </nav>
      </div>

    </div>
  );
};

export default MyWealthApp;