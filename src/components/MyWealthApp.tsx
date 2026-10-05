import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
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
import { Account, Expense, Loan, Stock, MonthlyData, Transaction, BudgetHistoryItem, ExpenseCategory, CashHolding } from '../types';
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

const NAV_ITEMS = [
  { id: 'dashboard' as const, label: 'Overview' },
  { id: 'accounts' as const, label: 'Wallets' },
  { id: 'budget' as const, label: 'Budget' },
  { id: 'loans' as const, label: 'Loans' },
  { id: 'investments' as const, label: 'Invest' },
];

interface TabIconProps {
  tabId: 'dashboard' | 'accounts' | 'budget' | 'loans' | 'investments';
  isActive: boolean;
}

const TabIcon: React.FC<TabIconProps> = ({ tabId, isActive }) => {
  // Outline style for inactive icons (stroke line icon)
  const outlineClass = "text-slate-400 dark:text-zinc-400 group-hover:text-slate-700 dark:group-hover:text-zinc-200 transition-colors shrink-0";
  // Black fill style for active in lightmode, white fill in darkmode
  const activeClass = "text-slate-900 fill-slate-900 dark:text-white dark:fill-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-transform duration-150 scale-105 shrink-0";

  if (tabId === 'dashboard') {
    if (isActive) {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" className={activeClass} fill="currentColor">
          <rect width="7" height="9" x="3" y="3" rx="1.5" />
          <rect width="7" height="5" x="14" y="3" rx="1.5" />
          <rect width="7" height="9" x="14" y="12" rx="1.5" />
          <rect width="7" height="5" x="3" y="16" rx="1.5" />
        </svg>
      );
    }
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={outlineClass}>
        <rect width="7" height="9" x="3" y="3" rx="1.5" />
        <rect width="7" height="5" x="14" y="3" rx="1.5" />
        <rect width="7" height="9" x="14" y="12" rx="1.5" />
        <rect width="7" height="5" x="3" y="16" rx="1.5" />
      </svg>
    );
  }

  if (tabId === 'accounts') {
    if (isActive) {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" className={activeClass} fill="currentColor">
          <path fillRule="evenodd" clipRule="evenodd" d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2h-4a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3h4v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6zm14 4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h4v-4h-4zm2 2.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z" />
        </svg>
      );
    }
    return <Wallet size={18} strokeWidth={1.8} className={outlineClass} />;
  }

  if (tabId === 'budget') {
    if (isActive) {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" className={activeClass} fill="currentColor">
          <path d="M12.5 2.1A10 10 0 0 1 21.9 11.5H12.5V2.1z" />
          <path d="M10.5 3.1A10 10 0 1 0 20.9 13.5H10.5V3.1z" />
        </svg>
      );
    }
    return <PieChart size={18} strokeWidth={1.8} className={outlineClass} />;
  }

  if (tabId === 'loans') {
    if (isActive) {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" className={activeClass} fill="currentColor">
          <path fillRule="evenodd" clipRule="evenodd" d="M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v1H2V7zm0 3h20v7a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-7zm4 4a1 1 0 0 0 0 2h3a1 1 0 1 0 0-2H6z" />
        </svg>
      );
    }
    return <CreditCard size={18} strokeWidth={1.8} className={outlineClass} />;
  }

  if (tabId === 'investments') {
    if (isActive) {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" className={activeClass}>
          <path d="M2 17l6.5-6.5 5 5L19 9" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <polygon points="15,5 22,5 22,12" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
        </svg>
      );
    }
    return <TrendingUp size={18} strokeWidth={1.8} className={outlineClass} />;
  }

  return null;
};

interface MyWealthAppProps {
  onExit: () => void;
}

const MyWealthApp: React.FC<MyWealthAppProps> = ({ onExit }) => {
  const { session, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts' | 'budget' | 'loans' | 'investments'>('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  // Dynamic Liquid Droplet Position State & Silky Drag Gesture
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number; height: number }>({ left: 0, width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffsetLeft, setDragOffsetLeft] = useState<number | null>(null);

  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const navRef = useRef<HTMLElement>(null);
  const dragStartRef = useRef<{ startX: number; hasMoved: boolean }>({ startX: 0, hasMoved: false });

  useLayoutEffect(() => {
    const updatePill = () => {
      const currentTabEl = tabRefs.current[activeTab];
      if (currentTabEl) {
        setPillStyle({
          left: currentTabEl.offsetLeft,
          width: currentTabEl.offsetWidth,
          height: currentTabEl.offsetHeight,
        });
      }
    };

    updatePill();
    const rafId = requestAnimationFrame(updatePill);
    const t1 = setTimeout(updatePill, 40);
    const t2 = setTimeout(updatePill, 120);
    window.addEventListener('resize', updatePill);

    const currentTabEl = tabRefs.current[activeTab];
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && currentTabEl) {
      ro = new ResizeObserver(() => {
        updatePill();
      });
      ro.observe(currentTabEl);
      if (navRef.current) ro.observe(navRef.current);
    }

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', updatePill);
      if (ro) ro.disconnect();
    };
  }, [activeTab]);

  // Silky Smooth Droplet Hold & Drag Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    dragStartRef.current = {
      startX: e.clientX,
      hasMoved: false,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!navRef.current) return;
    if (e.buttons === 0) {
      if (isDragging) {
        setIsDragging(false);
        setDragOffsetLeft(null);
      }
      return;
    }

    const deltaX = e.clientX - dragStartRef.current.startX;
    if (!dragStartRef.current.hasMoved && Math.abs(deltaX) > 3) {
      dragStartRef.current.hasMoved = true;
      setIsDragging(true);
    }

    if (!dragStartRef.current.hasMoved) return;

    const navRect = navRef.current.getBoundingClientRect();
    const pointerX = e.clientX - navRect.left;
    const currentTabEl = tabRefs.current[activeTab];
    const currentWidth = currentTabEl?.offsetWidth || (pillStyle.width > 0 ? pillStyle.width : 104);

    // Direct tracking with boundaries clamped to container
    const minLeft = 6;
    const maxLeft = Math.max(minLeft, navRect.width - currentWidth - 6);
    const newLeft = Math.max(minLeft, Math.min(maxLeft, pointerX - currentWidth / 2));
    setDragOffsetLeft(newLeft);

    // Dynamic magnetic snap detection to closest tab
    let closestId = activeTab;
    let minDistance = Infinity;

    NAV_ITEMS.forEach((item) => {
      const el = tabRefs.current[item.id];
      if (el) {
        const elRect = el.getBoundingClientRect();
        const tabCenter = elRect.left + elRect.width / 2;
        const dist = Math.abs(e.clientX - tabCenter);
        if (dist < minDistance) {
          minDistance = dist;
          closestId = item.id;
        }
      }
    });

    if (closestId !== activeTab) {
      setActiveTab(closestId);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(10); } catch {}
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {}
    setIsDragging(false);
    setDragOffsetLeft(null);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLElement>) => {
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {}
    setIsDragging(false);
    setDragOffsetLeft(null);
  };

  const handleTabClick = (tabId: typeof activeTab) => {
    if (dragStartRef.current.hasMoved) {
      dragStartRef.current.hasMoved = false;
      return;
    }
    setActiveTab(tabId);
  };

  // --- Theme State ---
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('mw_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const syncTheme = () => {
      setThemeState((localStorage.getItem('mw_theme') as 'light' | 'dark') || 'light');
    };
    window.addEventListener('apptify_theme_change', syncTheme);
    window.addEventListener('storage', syncTheme);
    return () => {
      window.removeEventListener('apptify_theme_change', syncTheme);
      window.removeEventListener('storage', syncTheme);
    };
  }, []);

  // --- Data State ---
  const [accounts, setAccounts] = useState<Account[]>(INITIAL_ACCOUNTS_DEFAULT);
  const [monthlyData, setMonthlyData] = useState<MonthlyData>(INITIAL_MONTHLY_DATA);
  const [budgetHistory, setBudgetHistory] = useState<BudgetHistoryItem[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<Expense[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [cash, setCash] = useState<CashHolding>({ myr: 0, usd: 0, hkd: 0 });
  const [exchangeRate, setExchangeRate] = useState<number>(4.50);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // --- Load Data (Local then Cloud) ---
  // --- Load Data (Local then Cloud) ---
  // --- Load Data (Local then Cloud) ---
  // --- Ref for Timestamp Protection ---
  const lastLocalUpdateRef = React.useRef<number>(0);
  const isIncomingSyncRef = React.useRef<boolean>(false);
  const isSyncInitializedRef = React.useRef<boolean>(false);
  const prevUserRef = React.useRef<any>(null);

  // Sync auth state changes synchronously during render
  if (user?.id !== prevUserRef.current?.id) {
    prevUserRef.current = user;
    if (user) {
      isSyncInitializedRef.current = false;
    } else {
      isSyncInitializedRef.current = true;
    }
  }



  // --- Interest Calculation Helper ---
  const checkAndApplyInterest = (accs: Account[]): Account[] => {
    let hasChanges = false;
    const now = new Date();

    const updatedAccounts = accs.map(acc => {
      if (!acc.interestRate || acc.interestFrequency === 'NONE' || !acc.nextInterestDate) return acc;

      let nextDate = new Date(acc.nextInterestDate);
      // If the date is invalid, skip
      if (isNaN(nextDate.getTime())) return acc;

      // If next interest date is in the future, do nothing
      if (nextDate > now) return acc;

      let newBalance = acc.balance;
      let newHistory = [...acc.history];
      let changed = false;
      let loops = 0;
      const MAX_LOOPS = 365; // Prevent inf loop if date is very old

      while (nextDate <= now && loops < MAX_LOOPS) {
        const rate = acc.interestRate / 100;
        let interestAmount = 0;
        const transactionDate = nextDate.toISOString(); // Capture scheduled time

        if (acc.interestFrequency === 'DAILY') {
          interestAmount = newBalance * (rate / 365);
          nextDate.setDate(nextDate.getDate() + 1);
        } else if (acc.interestFrequency === 'MONTHLY') {
          interestAmount = newBalance * (rate / 12);
          nextDate.setMonth(nextDate.getMonth() + 1);
        } else if (acc.interestFrequency === 'YEARLY') {
          interestAmount = newBalance * rate;
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        }

        if (interestAmount > 0) {
          newBalance += interestAmount;
          newHistory.unshift({
            id: `int-${Date.now()}-${loops}`,
            date: transactionDate,
            type: 'IN',
            amount: interestAmount,
            description: `Interest Paid`
          });
          changed = true;
        }
        loops++;
      }

      if (changed) {
        hasChanges = true;
        return {
          ...acc,
          balance: newBalance,
          history: newHistory,
          nextInterestDate: nextDate.toISOString()
        };
      }
      return acc;
    });

    return hasChanges ? updatedAccounts : accs;
  };

  // --- Load Data (Local then Cloud) ---
  const fetchData = async () => {
    // Reset sync status during login phase
    if (session && user) {
      isSyncInitializedRef.current = false;
    } else {
      isSyncInitializedRef.current = true;
    }

    // 1. Load Local
    const savedJSON = localStorage.getItem(STORAGE_KEY);
    let localData: any = null;
    if (savedJSON) {
      try {
        localData = JSON.parse(savedJSON);
        // Only set state if we haven't loaded yet to avoid flickering, 
        // OR if needed. Ideally we want to merge or prioritize cloud.
        // For simple init, we set specific states if they are currently defaults.
        // But here we are "re-fetching", so we might want to be careful not to overwrite 
        // unsaved user input if we were just typing. 
        // However, this is a full sync, usually triggered on load or manually.

        if (!isDataLoaded) {
          const processedAccounts = checkAndApplyInterest(localData.accounts || []);
          setAccounts(processedAccounts);
          setMonthlyData(localData.monthlyData || INITIAL_MONTHLY_DATA);
          setBudgetHistory(localData.budgetHistory || []);
          setFixedExpenses(localData.fixedExpenses || []);
          setLoans(localData.loans || []);
          setStocks(localData.stocks || []);
          setCash(localData.cash || { myr: 0, usd: 0, hkd: 0 });
          setExchangeRate(localData.exchangeRate || 4.5);
          // Init the ref
          if (localData.lastUpdated) {
            lastLocalUpdateRef.current = new Date(localData.lastUpdated).getTime();
          }
        }
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
          const cloudApp = data.data.mywealth || data.data;
          const cloudTime = new Date(cloudApp.lastUpdated || data.updated_at).getTime();
          // Use Ref for latest check because state might be stale in closures
          const localTime = lastLocalUpdateRef.current;

          // Only overwrite if Cloud is STRICTLY newer than what we have locally
          if (cloudTime > localTime) {
            console.log(`Sync: Cloud (${cloudTime}) > Local (${localTime}). Applying update...`);
            const processedAccounts = checkAndApplyInterest(cloudApp.accounts || []);
            
            isIncomingSyncRef.current = true;
            setTimeout(() => {
              isIncomingSyncRef.current = false;
            }, 100);

            setAccounts(processedAccounts);
            setMonthlyData(cloudApp.monthlyData || INITIAL_MONTHLY_DATA);
            setBudgetHistory(cloudApp.budgetHistory || []);
            setFixedExpenses(cloudApp.fixedExpenses || []);
            setLoans(cloudApp.loans || []);
            setStocks(cloudApp.stocks || []);
            setCash(cloudApp.cash || { myr: 0, usd: 0, hkd: 0 });
            setExchangeRate(cloudApp.exchangeRate || 4.5);
            lastLocalUpdateRef.current = cloudTime; // Update ref to match new cloud state
            setShowSyncSuccess(true);
            setTimeout(() => setShowSyncSuccess(false), 2000);
          } else {
            console.log(`Sync: Cloud (${cloudTime}) <= Local (${localTime}). Ignoring.`);
          }
        }
      } catch (err) {
        console.error("Sync error:", err);
      } finally {
        setIsSyncing(false);
      }
    }
    isSyncInitializedRef.current = true;
    setIsDataLoaded(true);
  };

  useEffect(() => {
    fetchData();
  }, [session, user]);

  // --- Auto-Sync on Window Focus & Custom Event ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        console.log("App foregrounded: Triggering sync...");
        fetchData();
      }
    };
    const handleDataChanged = () => {
      const savedJSON = localStorage.getItem(STORAGE_KEY);
      if (savedJSON) {
        try {
          const localData = JSON.parse(savedJSON);
          if (localData.accounts) setAccounts(localData.accounts);
          if (localData.monthlyData) setMonthlyData(localData.monthlyData);
          if (localData.budgetHistory) setBudgetHistory(localData.budgetHistory);
          if (localData.fixedExpenses) setFixedExpenses(localData.fixedExpenses);
          if (localData.loans) setLoans(localData.loans);
          if (localData.stocks) setStocks(localData.stocks);
          if (localData.cash) setCash(localData.cash);
          if (localData.exchangeRate) setExchangeRate(localData.exchangeRate);
        } catch (e) {
          console.error("Failed to reload data on apptify_data_changed", e);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("apptify_data_changed", handleDataChanged);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("apptify_data_changed", handleDataChanged);
    };
  }, [user]);

  // --- Realtime Sync Subscription ---
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(`mywealth_sync_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_data' },
        (payload) => {
          console.log("Realtime event received:", payload);
          const newData = payload.new as any;
          if (newData && newData.data) {
            const cloudApp = newData.data.mywealth || newData.data;
            const cloudTime = new Date(cloudApp.lastUpdated || newData.updated_at).getTime();
            const localTime = lastLocalUpdateRef.current;

            if (cloudTime > localTime) {
              console.log(`Realtime: Cloud (${cloudTime}) > Local (${localTime}). Updating...`);
              const processedAccounts = checkAndApplyInterest(cloudApp.accounts || []);
              
              isIncomingSyncRef.current = true;
              setTimeout(() => {
                isIncomingSyncRef.current = false;
              }, 100);

              setAccounts(processedAccounts);
              setMonthlyData(cloudApp.monthlyData || INITIAL_MONTHLY_DATA);
              setBudgetHistory(cloudApp.budgetHistory || []);
              setFixedExpenses(cloudApp.fixedExpenses || []);
              setLoans(cloudApp.loans || []);
              setStocks(cloudApp.stocks || []);
              setCash(cloudApp.cash || { myr: 0, usd: 0, hkd: 0 });
              setExchangeRate(cloudApp.exchangeRate || 4.5);
              lastLocalUpdateRef.current = cloudTime;
              setIsSyncing(true);
              setTimeout(() => setIsSyncing(false), 1000);
            } else {
              console.log(`Realtime: Cloud (${cloudTime}) <= Local (${localTime}). Ignoring echo/stale.`);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(`Realtime subscription status: ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // --- Save Data (Local & Cloud) ---
  useEffect(() => {
    if (!isDataLoaded || !isSyncInitializedRef.current) return;

    if (isIncomingSyncRef.current) {
      console.log("Sync: State change was from remote sync. Skipping cloud push.");
      
      // Save locally but retain the remote lastUpdated time
      const dataToSave = { 
        accounts, 
        monthlyData, 
        budgetHistory, 
        fixedExpenses, 
        loans, 
        stocks, 
        cash, 
        exchangeRate, 
        lastUpdated: new Date(lastLocalUpdateRef.current).toISOString() 
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      return;
    }

    const now = new Date();
    const dataToSave = { accounts, monthlyData, budgetHistory, fixedExpenses, loans, stocks, cash, exchangeRate, lastUpdated: now.toISOString() };

    // Update Ref immediately so pending cloud saves/realtime echoes don't overwrite us
    lastLocalUpdateRef.current = now.getTime();

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

  }, [accounts, monthlyData, budgetHistory, fixedExpenses, loans, stocks, cash, exchangeRate, isDataLoaded, session, user]);

  // --- Expose State to Window for Ask Apptify ---
  useEffect(() => {
    (window as any).__apptify_mywealth = {
      accounts,
      setAccounts,
      monthlyData,
      setMonthlyData,
      budgetHistory,
      setBudgetHistory,
      fixedExpenses,
      setFixedExpenses,
      loans,
      setLoans,
      stocks,
      setStocks,
      cash,
      setCash,
      exchangeRate,
      setExchangeRate,
      activeTab,
      setActiveTab,
    };
    return () => {
      (window as any).__apptify_mywealth = null;
    };
  }, [accounts, monthlyData, budgetHistory, fixedExpenses, loans, stocks, cash, exchangeRate, activeTab]);

  const handleArchiveMonth = () => {
    // 1. Calculate Totals
    const currentVariableExpenses = monthlyData.expenses;
    const allExpenses = [...fixedExpenses, ...currentVariableExpenses];
    const totalExpenses = allExpenses.reduce((sum, item) => sum + item.amount, 0);
    const savings = monthlyData.income - totalExpenses;

    // 2. Breakdown
    const breakdown: { category: string; amount: number }[] = [];
    const categories = Object.values(ExpenseCategory);
    categories.forEach(cat => {
      const catTotal = allExpenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0);
      if (catTotal > 0) breakdown.push({ category: cat, amount: catTotal });
    });
    // Catch 'Other' or uncategorized that might not be in the enum iterators if any custom strings exist (though types prevent this mostly)

    // 3. Create History Item
    const newItem: BudgetHistoryItem = {
      id: Date.now().toString(),
      month: monthlyData.targetDate, // e.g. "2023-10"
      income: monthlyData.income,
      totalExpenses,
      savings,
      expenseBreakdown: breakdown
    };

    // 4. Update State
    setBudgetHistory(prev => [newItem, ...prev]);

    // 5. Reset Current Month
    // - Keep Fixed Expenses (handled by separate state, so just don't touch them)
    // - Clear Variable Expenses
    // - Reset targetDate to next month? Or just keep current real time?
    //   Usually resetting implies starting "now" or "next month". 
    //   Let's set targetDate to current real month in case it was old.
    const newDate = new Date().toISOString().slice(0, 7);

    setMonthlyData({
      ...monthlyData,
      expenses: [], // Clear variables
      targetDate: newDate
    });

    alert("Month Ended! Summary saved to history.");
  };

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
    <div className="flex h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] overflow-hidden bg-transparent text-gray-900 dark:text-gray-100 font-sans relative">

      {/* Main Content Area */}
      <main className="flex-1 w-full h-full overflow-y-auto relative scroll-smooth">
        <div className="max-w-5xl mx-auto px-3 sm:px-8 pt-4 pb-36">

          {/* Minimal Header Sync Status */}
          <div className="flex items-center justify-between mb-5 sm:mb-8 animate-fade-in-down">
            <div className="flex items-center gap-3">
              {/* Sync Status Indicator */}
              <button
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-white/70 dark:bg-white/10 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-sm hover:border-blue-500/30 transition-all active:scale-95"
                onClick={fetchData}
                title="点击强制云端同步"
              >
                {isSyncing ? (
                  <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 animate-pulse">
                    <Cloud size={14} />
                    <span>同步中...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    <Cloud size={14} />
                    <span>云端同步</span>
                  </div>
                )}
              </button>

              {showSyncSuccess && !isSyncing && (
                <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-fade-in">
                  <CheckCircle2 size={14} />
                  <span>已保存</span>
                </div>
              )}
            </div>
          </div>

          {/* Smooth Zero-Lag Tab Views (Persisted for instantaneous 60fps switching) */}
          <div className="w-full">
            <div className={activeTab === 'dashboard' ? 'block animate-fade-in' : 'hidden'}>
              <Dashboard accounts={accounts} monthlyData={monthlyData} fixedExpenses={fixedExpenses} loans={loans} stocks={stocks} exchangeRate={exchangeRate} cash={cash} budgetHistory={budgetHistory} />
            </div>
            <div className={activeTab === 'accounts' ? 'block animate-fade-in' : 'hidden'}>
              <Accounts accounts={accounts} setAccounts={setAccounts} />
            </div>
            <div className={activeTab === 'budget' ? 'block animate-fade-in' : 'hidden'}>
              <Budget monthlyData={monthlyData} setMonthlyData={setMonthlyData} fixedExpenses={fixedExpenses} setFixedExpenses={setFixedExpenses} budgetHistory={budgetHistory} onArchiveMonth={handleArchiveMonth} accounts={accounts} />
            </div>
            <div className={activeTab === 'loans' ? 'block animate-fade-in' : 'hidden'}>
              <Loans loans={loans} setLoans={setLoans} />
            </div>
            <div className={activeTab === 'investments' ? 'block animate-fade-in' : 'hidden'}>
              <Investments stocks={stocks} setStocks={setStocks} cash={cash} setCash={setCash} exchangeRate={exchangeRate} setExchangeRate={setExchangeRate} />
            </div>
          </div>
        </div>
      </main>

      {/* iOS LIQUID GLASS FLOATING DOCK (Draggable Water Droplet & High-Contrast Lightmode) */}
      <div className="fixed bottom-3 sm:bottom-6 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none pb-safe">
        <nav
          ref={navRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{ touchAction: 'none' }}
          className={`bg-white/70 dark:bg-[#12151e]/80 backdrop-blur-3xl rounded-full p-1.5 flex items-center gap-1 sm:gap-1.5 border border-slate-200/80 dark:border-white/12 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.4)] dark:shadow-[0_16px_40px_-10px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] pointer-events-auto relative overflow-hidden select-none transition-shadow ${
            isDragging ? 'cursor-grabbing ring-2 ring-slate-400/20 dark:ring-white/20' : 'cursor-grab'
          }`}
        >
          {/* Transparent Liquid Glass Water Droplet Pill */}
          {pillStyle.width > 0 && (
            <div
              className={`absolute rounded-full pointer-events-none overflow-hidden ${
                isDragging ? 'z-20' : ''
              }`}
              style={{
                left: `${(isDragging && dragOffsetLeft !== null) ? dragOffsetLeft : pillStyle.left}px`,
                width: `${pillStyle.width}px`,
                height: `${pillStyle.height}px`,
                top: '6px',
                transform: isDragging ? 'scale(1.05) translateZ(0)' : 'scale(1) translateZ(0)',
                willChange: 'left, width, transform',
                transition: isDragging
                  ? 'width 180ms ease, transform 150ms cubic-bezier(0.2, 0.8, 0.4, 1.2)'
                  : 'left 280ms cubic-bezier(0.25, 1.25, 0.5, 1), width 260ms cubic-bezier(0.25, 1.25, 0.5, 1), transform 200ms ease',
              }}
            >
              {/* Droplet Glass Body */}
              <div
                className={`absolute inset-0 rounded-full backdrop-blur-2xl transition-all duration-200 ${
                  isDragging
                    ? 'bg-white/95 dark:bg-white/25 border border-white dark:border-white/35 shadow-[0_8px_25px_rgba(0,0,0,0.22),inset_0_1px_2px_rgba(255,255,255,0.9),inset_0_-1px_1px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_28px_rgba(0,0,0,0.55),inset_0_1px_2px_rgba(255,255,255,0.4)]'
                    : 'bg-white/85 dark:bg-white/15 border border-white/80 dark:border-white/25 shadow-[0_4px_16px_rgba(0,0,0,0.12),inset_0_1px_2px_rgba(255,255,255,0.9),inset_0_-1px_1px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_18px_rgba(0,0,0,0.35),inset_0_1px_2px_rgba(255,255,255,0.3)]'
                }`}
              />

              {/* Top Water Specular Reflection */}
              <div className="absolute top-0 inset-x-3 h-[1px] bg-gradient-to-r from-transparent via-white/90 to-transparent pointer-events-none" />

              {/* Top Glass Lens Glare Bubble */}
              <div className="absolute -top-1 left-1/4 w-1/2 h-2.5 rounded-full bg-white/40 dark:bg-white/25 blur-[1px] pointer-events-none" />

              {/* Upper-half glass sheen */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/25 via-white/5 to-transparent opacity-90 pointer-events-none" />
            </div>
          )}

          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                ref={(el) => { tabRefs.current[item.id] = el; }}
                onClick={() => handleTabClick(item.id)}
                className={`relative z-10 flex items-center justify-center shrink-0 h-10 rounded-full select-none cursor-pointer group active:scale-95 transition-transform duration-100 ${
                  isActive
                    ? 'pl-4 pr-5 sm:pl-4.5 sm:pr-5.5 text-slate-900 dark:text-white'
                    : 'w-10 text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white'
                }`}
                title={item.label}
              >
                <TabIcon tabId={item.id} isActive={isActive} />
                {isActive && (
                  <span className="text-xs sm:text-[13px] font-bold text-slate-900 dark:text-white tracking-wide ml-1.5 whitespace-nowrap select-none animate-fade-in">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

    </div>
  );
};

export default MyWealthApp;