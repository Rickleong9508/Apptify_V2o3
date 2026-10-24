export interface ParameterDefinition {
    type: 'string' | 'number' | 'boolean' | 'array';
    description: string;
    required: boolean;
}

export interface IntentDefinition {
    description: string;
    parameters: { [key: string]: ParameterDefinition };
    examples: string[];
}

export interface Skill {
    id: string;
    name: string;
    description: string;
    intents: { [key: string]: IntentDefinition };
}

export const skillRegistry: Skill[] = [
    {
        id: 'mywealth',
        name: 'MyWealth Finance & Butler Skill',
        description: 'Manages all personal finance modules: wallets/accounts, reservations, income, monthly budgets, expenses, loans, stock portfolio, multi-currency cash, and deep financial health analysis.',
        intents: {
            ADD_MONEY: {
                description: 'Add, deposit, top up, or record income into a specific wallet.',
                parameters: {
                    walletName: { type: 'string', description: 'Name of the wallet to deposit money into (e.g. Maybank, Cash, CIMB)', required: true },
                    amount: { type: 'number', description: 'Amount of money to deposit or add', required: true },
                    description: { type: 'string', description: 'Description of the deposit or income source', required: false }
                },
                examples: ['Add RM500 to Cash', 'Deposit RM2000 into Maybank', '存入 500 到 Maybank']
            },
            WITHDRAW_MONEY: {
                description: 'Record an expense or deduct/withdraw money from a wallet and log it in monthly expenses.',
                parameters: {
                    walletName: { type: 'string', description: 'Name of the wallet to spend from (defaults to first available)', required: false },
                    amount: { type: 'number', description: 'Amount of money spent or withdrawn', required: true },
                    description: { type: 'string', description: 'Description of the expense or item bought', required: false },
                    category: { type: 'string', description: 'Expense category (Self Maintenance, Family Expenses, Loan, Saving, Other, Food, Transport, Utilities, Shopping)', required: false }
                },
                examples: ['Spent RM25 on lunch', 'Record RM80 grocery expense from Maybank', '记一笔晚餐 45 块']
            },
            TRANSFER_MONEY: {
                description: 'Transfer money from one wallet to another wallet.',
                parameters: {
                    sourceWallet: { type: 'string', description: 'Source wallet to take money from', required: true },
                    destinationWallet: { type: 'string', description: 'Destination wallet to receive money', required: true },
                    amount: { type: 'number', description: 'Amount to transfer', required: true },
                    description: { type: 'string', description: 'Description of the transfer', required: false }
                },
                examples: ['Transfer RM200 from Maybank to Cash', '从 Maybank 转账 300 到 Cash']
            },
            CREATE_WALLET: {
                description: 'Create a new bank account or wallet in MyWealth.',
                parameters: {
                    name: { type: 'string', description: 'Wallet or bank name (e.g. Touch n Go, Public Bank, GrabPay)', required: true },
                    balance: { type: 'number', description: 'Initial balance in RM', required: false },
                    interestRate: { type: 'number', description: 'Optional annual interest rate (%)', required: false }
                },
                examples: ['Create a new wallet named Touch n Go with RM200', '新建一个 GrabPay 钱包，初始余额 150']
            },
            UPDATE_WALLET: {
                description: 'Directly set or adjust a wallet balance, name, or interest rate.',
                parameters: {
                    walletName: { type: 'string', description: 'Existing wallet name', required: true },
                    newBalance: { type: 'number', description: 'New exact balance to set', required: false },
                    newName: { type: 'string', description: 'New name for the wallet', required: false },
                    interestRate: { type: 'number', description: 'Annual interest rate (%)', required: false }
                },
                examples: ['Set Maybank balance to RM5400', '把 Cash 钱包余额改为 300']
            },
            DELETE_WALLET: {
                description: 'Delete a wallet/account from MyWealth.',
                parameters: {
                    walletName: { type: 'string', description: 'Name of the wallet to delete', required: true }
                },
                examples: ['Delete wallet GrabPay', '删除 GrabPay 钱包']
            },
            ADD_RESERVATION: {
                description: 'Lock/reserve a portion of funds inside a wallet for a specific purpose (earmarked savings/tax/emergency).',
                parameters: {
                    walletName: { type: 'string', description: 'Target wallet name', required: true },
                    amount: { type: 'number', description: 'Amount to reserve', required: true },
                    reason: { type: 'string', description: 'Purpose/reason for reservation', required: true }
                },
                examples: ['Reserve RM1000 in Maybank for Insurance', '在 Maybank 预留 1000 作为旅行基金']
            },
            REMOVE_RESERVATION: {
                description: 'Release/remove a reservation from a wallet.',
                parameters: {
                    walletName: { type: 'string', description: 'Target wallet name', required: false },
                    reason: { type: 'string', description: 'Reason/name of the reservation to remove', required: true }
                },
                examples: ['Remove the Insurance reservation from Maybank', '取消旅行基金的预留金']
            },
            SET_MONTHLY_INCOME: {
                description: 'Set or update the user monthly income in the Budget module.',
                parameters: {
                    amount: { type: 'number', description: 'Monthly income amount in RM', required: true }
                },
                examples: ['Set my monthly income to RM8500', '把我的月收入设为 8500']
            },
            ADD_BUDGET: {
                description: 'Add a monthly fixed or variable budget expense item.',
                parameters: {
                    name: { type: 'string', description: 'Name of the budget item', required: true },
                    amount: { type: 'number', description: 'Amount in RM', required: true },
                    category: { type: 'string', description: 'Category (Self Maintenance, Family Expenses, Loan, Saving, Other)', required: false },
                    isFixed: { type: 'boolean', description: 'True for recurring fixed monthly bills, false for variable expense', required: false }
                },
                examples: ['Add fixed budget Rent RM1500', '添加每月固定支出：房租 1500']
            },
            UPDATE_BUDGET: {
                description: 'Update an existing budget/expense item amount or category.',
                parameters: {
                    name: { type: 'string', description: 'Name of the budget/expense item to update', required: true },
                    amount: { type: 'number', description: 'New amount in RM', required: true },
                    category: { type: 'string', description: 'Optional updated category', required: false }
                },
                examples: ['Update Rent budget to RM1600', '把房租预算改成 1600']
            },
            DELETE_BUDGET: {
                description: 'Delete a budget/expense item from the monthly budget.',
                parameters: {
                    name: { type: 'string', description: 'Name of the budget/expense item to remove', required: true }
                },
                examples: ['Remove Netflix from budget', '删除预算里的 Netflix']
            },
            ADD_LOAN: {
                description: 'Add a new loan or liability to track.',
                parameters: {
                    name: { type: 'string', description: 'Name of the loan (e.g. Car Loan, Mortgage)', required: true },
                    totalAmount: { type: 'number', description: 'Total principal loan amount', required: true },
                    monthlyPayment: { type: 'number', description: 'Monthly installment amount', required: true },
                    remainingAmount: { type: 'number', description: 'Remaining balance (defaults to totalAmount)', required: false },
                    months: { type: 'number', description: 'Remaining months', required: false }
                },
                examples: ['Add Car Loan total RM45000 monthly RM750', '添加车贷：总额 50000，月供 800']
            },
            REPAY_LOAN: {
                description: 'Record a repayment towards an active loan (and optionally deduct from a wallet).',
                parameters: {
                    loanName: { type: 'string', description: 'Name of the loan being repaid', required: true },
                    amount: { type: 'number', description: 'Repayment amount', required: false },
                    walletName: { type: 'string', description: 'Optional wallet to deduct the payment from', required: false }
                },
                examples: ['Pay RM800 towards Car Loan from Maybank', '用 Maybank 还车贷 800']
            },
            UPDATE_LOAN: {
                description: 'Update loan remaining amount, monthly payment, or remaining months.',
                parameters: {
                    loanName: { type: 'string', description: 'Loan name to update', required: true },
                    remainingAmount: { type: 'number', description: 'Updated remaining amount', required: false },
                    monthlyPayment: { type: 'number', description: 'Updated monthly payment', required: false },
                    remainingMonths: { type: 'number', description: 'Updated remaining months', required: false }
                },
                examples: ['Update Car Loan remaining amount to RM32000', '更新车贷剩余金额为 32000']
            },
            DELETE_LOAN: {
                description: 'Delete or clear a paid-off loan.',
                parameters: {
                    loanName: { type: 'string', description: 'Loan name to delete', required: true }
                },
                examples: ['Delete Car Loan', '删除车贷记录']
            },
            ADD_STOCK: {
                description: 'Add or buy a stock holding in the Investment portfolio.',
                parameters: {
                    symbol: { type: 'string', description: 'Ticker symbol (e.g. AAPL, NVDA, MAYBANK.KL)', required: true },
                    name: { type: 'string', description: 'Company name', required: false },
                    quantity: { type: 'number', description: 'Number of shares', required: true },
                    buyPrice: { type: 'number', description: 'Average buy price per share', required: true },
                    currentPrice: { type: 'number', description: 'Current market price per share (defaults to buyPrice)', required: false },
                    currency: { type: 'string', description: 'Currency: USD or MYR', required: false }
                },
                examples: ['Add stock NVDA 10 shares at USD 120', '买入 10 股 NVDA，成本价 120 美元']
            },
            UPDATE_STOCK: {
                description: 'Update a stock holding quantity, buyPrice, or currentPrice.',
                parameters: {
                    symbol: { type: 'string', description: 'Stock symbol or name', required: true },
                    quantity: { type: 'number', description: 'Updated share quantity', required: false },
                    buyPrice: { type: 'number', description: 'Updated buy price', required: false },
                    currentPrice: { type: 'number', description: 'Updated current market price', required: false }
                },
                examples: ['Update NVDA current price to 138', '把 NVDA 当前股价更新为 138']
            },
            DELETE_STOCK: {
                description: 'Remove/sell all of a stock holding from the portfolio.',
                parameters: {
                    symbol: { type: 'string', description: 'Stock symbol or name to remove', required: true }
                },
                examples: ['Remove stock AAPL from portfolio', '删除 AAPL 持仓']
            },
            UPDATE_INVEST_CASH: {
                description: 'Update multi-currency investment cash holdings (MYR, USD, HKD) or USD/MYR exchange rate.',
                parameters: {
                    myr: { type: 'number', description: 'Investment cash in MYR', required: false },
                    usd: { type: 'number', description: 'Investment cash in USD', required: false },
                    hkd: { type: 'number', description: 'Investment cash in HKD', required: false },
                    exchangeRate: { type: 'number', description: 'USD to MYR exchange rate (e.g. 4.45)', required: false }
                },
                examples: ['Set investment USD cash to 2500', '把美元投资现金设为 2500，汇率设为 4.45']
            },
            QUERY_WEALTH: {
                description: 'Query current net worth, wallets, budget, loans, or investment portfolio.',
                parameters: {
                    aspect: { type: 'string', description: 'all, networth, wallets, budget, loans, investments', required: false }
                },
                examples: ['What is my current net worth?', '查一下我的总资产和投资组合']
            },
            ANALYZE_APP_DATA: {
                description: 'Perform a comprehensive butler analysis across finances, spending structure, savings rate, debt load, investment P&L, tasks, and notes.',
                parameters: {
                    focus: { type: 'string', description: 'all, finance, budget, investment, productivity', required: false }
                },
                examples: ['Analyze my financial health and tasks', '帮我全面分析一下 App 里的数据和财务状况']
            }
        }
    },
    {
        id: 'knowledgevault',
        name: 'NoteDown Workspace Skill',
        description: 'Manages personal quick notes, pinned memos, action tasks, priorities, deadlines, and focus workspace.',
        intents: {
            CREATE_NOTE: {
                description: 'Create a new note or memo in NoteDown.',
                parameters: {
                    title: { type: 'string', description: 'Title of the note', required: true },
                    content: { type: 'string', description: 'Note content body', required: true },
                    category: { type: 'string', description: 'Tag: work, idea, meeting, or life', required: false },
                    pinned: { type: 'boolean', description: 'Whether to pin the note at the top', required: false }
                },
                examples: ['Create note: Q4 Strategy with content: Focus on AI butler', '记一下会议纪要：周三上线新版本']
            },
            UPDATE_NOTE: {
                description: 'Update an existing note content, title, or category.',
                parameters: {
                    title: { type: 'string', description: 'Existing note title to match', required: true },
                    newTitle: { type: 'string', description: 'New title', required: false },
                    content: { type: 'string', description: 'New or appended content', required: false },
                    append: { type: 'boolean', description: 'If true, append content instead of overwriting', required: false },
                    category: { type: 'string', description: 'work, idea, meeting, or life', required: false }
                },
                examples: ['Append to note Q4 Strategy: Add voice call support', '修改笔记 Q4 Strategy 的内容']
            },
            PIN_NOTE: {
                description: 'Pin or unpin a note in NoteDown.',
                parameters: {
                    title: { type: 'string', description: 'Note title to pin/unpin', required: true },
                    pinned: { type: 'boolean', description: 'true to pin, false to unpin', required: true }
                },
                examples: ['Pin my Q4 Strategy note', '置顶 Q4 Strategy 笔记']
            },
            DELETE_NOTE: {
                description: 'Delete a note by title.',
                parameters: {
                    title: { type: 'string', description: 'Note title to delete', required: true }
                },
                examples: ['Delete note Q4 Strategy', '删除 Q4 Strategy 笔记']
            },
            SEARCH_NOTES: {
                description: 'Search notes by keyword or category.',
                parameters: {
                    query: { type: 'string', description: 'Search keyword', required: true }
                },
                examples: ['Find my notes about meeting', '搜索关于会议的笔记']
            },
            QUERY_NOTES: {
                description: 'List all notes in NoteDown.',
                parameters: {},
                examples: ['Show my notes', '查看所有笔记']
            },
            CREATE_TASK: {
                description: 'Create a new todo task in NoteDown.',
                parameters: {
                    title: { type: 'string', description: 'Task title', required: true },
                    priority: { type: 'string', description: 'high, medium, or low', required: false },
                    deadline: { type: 'string', description: 'Due date YYYY-MM-DD', required: false },
                    category: { type: 'string', description: 'work or personal', required: false }
                },
                examples: ['Add high priority task: Submit tax form by Friday', '新建高优待办：周五前交报表']
            },
            UPDATE_TASK: {
                description: 'Mark a task completed/uncompleted, or change its priority/deadline/title.',
                parameters: {
                    taskTitle: { type: 'string', description: 'Task title to match', required: true },
                    completed: { type: 'boolean', description: 'Completed status', required: false },
                    priority: { type: 'string', description: 'high, medium, or low', required: false },
                    deadline: { type: 'string', description: 'New due date YYYY-MM-DD', required: false },
                    newTitle: { type: 'string', description: 'Renamed task title', required: false }
                },
                examples: ['Complete task Submit tax form', '把交报表待办设为最高优先级']
            },
            DELETE_TASK: {
                description: 'Delete a specific task.',
                parameters: {
                    taskTitle: { type: 'string', description: 'Task title to delete', required: true }
                },
                examples: ['Delete task Submit tax form', '删除交报表待办']
            },
            CLEAR_COMPLETED_TASKS: {
                description: 'Clear/delete all completed tasks to tidy up NoteDown.',
                parameters: {},
                examples: ['Clear all completed tasks', '清理所有已完成的待办事项']
            },
            QUERY_TASKS: {
                description: 'Query todo tasks by status or priority.',
                parameters: {
                    status: { type: 'string', description: 'all, pending, or completed', required: false }
                },
                examples: ['What are my pending tasks?', '查看我的待办事项']
            }
        }
    },
    {
        id: 'system',
        name: 'System Navigation Skill',
        description: 'Controls navigation between Apptify modules and settings.',
        intents: {
            NAVIGATE: {
                description: 'Navigate to any module inside Apptify (launcher, mywealth, knowledgevault, newshub, settings).',
                parameters: {
                    target: { type: 'string', description: 'Target module (launcher, mywealth, knowledgevault, newshub, settings)', required: true }
                },
                examples: ['Go to My Wealth', 'Open NoteDown', 'Switch to NewsHub', '打开记事本', '返回主页']
            }
        }
    }
];
