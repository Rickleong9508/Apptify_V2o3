export interface Transaction {
  id: string;
  date: string;
  type: 'IN' | 'OUT';
  amount: number;
  description: string;
}

export interface Reservation {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  reservations: Reservation[]; // Updated from single 'reserved' number
  history: Transaction[];
}

export enum ExpenseCategory {
  MAINTENANCE = 'Self Maintenance',
  LOAN = 'Loan',
  SAVING = 'Saving',
  FAMILY = 'Family Expenses',
  OTHER = 'Other'
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory | string;
  isFixed: boolean;
}

export interface MonthlyData {
  targetDate: string; // YYYY-MM
  income: number;
  expenses: Expense[];
}

export interface Loan {
  id: string;
  name: string; // e.g., "Car Loan"
  totalAmount: number; // Original principal
  monthlyPayment: number;
  remainingAmount: number;
  remainingMonths: number;
}

export interface Stock {
  id: string;
  symbol: string; // e.g., "MAYBANK.KL" or "AAPL"
  name: string;
  buyPrice: number;
  quantity: number;
  currentPrice: number; // To be updated manually or via AI
  currency: 'MYR' | 'USD';
}

export interface ScenarioAssumptions {
  revenueCagr: number;
  operatingMargin: number;
  taxRate: number;
  dilution: number;
  peMultiple: number;
}

export interface ValuationScenarios {
  mid: ScenarioAssumptions;
  good: ScenarioAssumptions;
}

export interface ValuationData {
  // Fundamentals (Quarterly/TTM)
  revenueQtr: number;
  netIncome: number; // TTM
  fcf: number;       // TTM
  costOfRevenue: number;
  opex: number;
  operatingIncome: number;
  cash: number;
  totalDebt: number;
  sharesOutstanding: number;
  sharePrice: number;
  revenuePerShare: number; // Added

  // Calculated Fundamentals
  marketCap: number;
  grossProfit: number;
  grossMargin: number;
  operatingMargin: number;
  netCash: number;
  ebitdaPs: number;
  pbRatio: number;      // Added
  psRatio: number;      // Added

  // Projections
  scenarios?: ValuationScenarios; // AI Populated

  // Targets (Calculated)
  valuationModel: 'DCF (Standard)' | 'Price-to-Sales (Growth)' | 'Future Earnings (5y)'; // Added
  targets?: {
    currentPrice: number;
    midPrice: number;
    goodPrice: number;
    discountRate: number;
  }
}
