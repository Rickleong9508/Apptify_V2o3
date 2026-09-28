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
        name: 'MyWealth Finance Skill',
        description: 'Manages personal finance, wallets, expenses, income, transfers, budgets, loans, and portfolio.',
        intents: {
            ADD_MONEY: {
                description: 'Add, deposit, top up, increase, or save money into a specific wallet or record income.',
                parameters: {
                    walletName: { type: 'string', description: 'Name of the wallet to deposit money into (e.g. Maybank, Cash, CIMB)', required: true },
                    amount: { type: 'number', description: 'Amount of money to deposit or add', required: true },
                    description: { type: 'string', description: 'Description of the deposit or income source', required: false }
                },
                examples: ['Add RM500 to Cash', 'Deposit RM2000 into Maybank', 'Top up RM100 to wallet', '存入 500 到 Maybank']
            },
            WITHDRAW_MONEY: {
                description: 'Record an expense or deduct/withdraw money from a specific wallet.',
                parameters: {
                    walletName: { type: 'string', description: 'Name of the wallet to spend from (defaults to first available or Cash)', required: false },
                    amount: { type: 'number', description: 'Amount of money spent or withdrawn', required: true },
                    description: { type: 'string', description: 'Description of the expense or item bought', required: false },
                    category: { type: 'string', description: 'Expense category (Food, Transport, Utilities, Entertainment, Shopping, Health, Other)', required: false }
                },
                examples: ['Spent RM25 on lunch', 'Record RM80 grocery expense from Maybank', 'Bought coffee RM15 with Cash', '记录一笔支出：晚餐 45 块']
            },
            TRANSFER_MONEY: {
                description: 'Transfer, move, or shift money from one wallet to another wallet.',
                parameters: {
                    sourceWallet: { type: 'string', description: 'Source wallet to take money from', required: true },
                    destinationWallet: { type: 'string', description: 'Destination wallet to receive money', required: true },
                    amount: { type: 'number', description: 'Amount to transfer', required: true },
                    description: { type: 'string', description: 'Description of the transfer', required: false }
                },
                examples: ['Transfer RM200 from Maybank to Cash', 'Move RM500 from Savings to Credit Card', '从 Maybank 转账 300 到 Cash']
            },
            ADD_BUDGET: {
                description: 'Add a new monthly budget expense allocation.',
                parameters: {
                    name: { type: 'string', description: 'Name of the budget allocation', required: true },
                    amount: { type: 'number', description: 'Allocated budget amount', required: true },
                    category: { type: 'string', description: 'Category (Food, Utilities, Travel, etc.)', required: false },
                    isFixed: { type: 'boolean', description: 'Whether it is a recurring fixed monthly expense', required: false }
                },
                examples: ['Add a food budget of RM600', 'Allocate RM200 for utilities', '设定餐饮预算 800']
            },
            ADD_LOAN: {
                description: 'Add a new liability or loan to track.',
                parameters: {
                    name: { type: 'string', description: 'Name/Title of the loan (e.g. Car Loan, Mortgage)', required: true },
                    totalAmount: { type: 'number', description: 'Total principal loan amount', required: true },
                    monthlyPayment: { type: 'number', description: 'Monthly repayment amount', required: true }
                },
                examples: ['Add loan: Car Loan, total RM45000, monthly RM750', '记录车贷：总额 50000，每月还款 800']
            },
            REPAY_LOAN: {
                description: 'Record a repayment towards an active loan.',
                parameters: {
                    loanName: { type: 'string', description: 'Name of the loan being repaid', required: true },
                    amount: { type: 'number', description: 'Repayment amount', required: true },
                    accountName: { type: 'string', description: 'Wallet to pay from', required: false }
                },
                examples: ['Pay RM800 towards Car Loan', 'Repay Loan Home Loan RM1500', '还车贷 800']
            },
            QUERY_WEALTH: {
                description: 'Query current net worth, total balance, wallet breakdown, or monthly budget status.',
                parameters: {
                    aspect: { type: 'string', description: 'Specific aspect to query (all, networth, wallets, budget, loans)', required: false }
                },
                examples: ['What is my current net worth?', 'Show my wallet balances', 'How much have I spent this month?', '查一下我的总资产和钱包余额']
            }
        }
    },
    {
        id: 'knowledgevault',
        name: 'Knowledge Vault Skill',
        description: 'Manages personal quick notes, work records, task todos, and focus timer.',
        intents: {
            CREATE_NOTE: {
                description: 'Create a new note or work log in Knowledge Vault.',
                parameters: {
                    title: { type: 'string', description: 'Title of the note', required: true },
                    content: { type: 'string', description: 'Note content body', required: true },
                    category: { type: 'string', description: 'Tag or category: work, idea, meeting, or life', required: false }
                },
                examples: ['Create note: Apptify V3 with content: Design liquid glass UI', '记一下：明天下午开会讨论产品规划', 'Save note: Meeting notes with team']
            },
            SEARCH_NOTES: {
                description: 'Search personal notes in Knowledge Vault.',
                parameters: {
                    query: { type: 'string', description: 'Search term or query', required: true }
                },
                examples: ['Find my notes about UI design', 'Search notes: meeting', '搜索笔记']
            },
            CREATE_TASK: {
                description: 'Create a new todo task in Knowledge Vault.',
                parameters: {
                    title: { type: 'string', description: 'Task title or action description', required: true },
                    priority: { type: 'string', description: 'Priority level: high, medium, or low (default medium)', required: false },
                    deadline: { type: 'string', description: 'Due date or time (optional)', required: false }
                },
                examples: ['Add task: Submit monthly report by Friday', '提醒我下午三点开会', 'Create high priority task: Finish Apptify redesign']
            },
            UPDATE_TASK: {
                description: 'Mark a task as completed or update its status.',
                parameters: {
                    taskTitle: { type: 'string', description: 'Name of the task to update', required: true },
                    completed: { type: 'boolean', description: 'Whether the task is completed (true/false)', required: true }
                },
                examples: ['Complete task Submit monthly report', '完成任务 提交周报', 'Mark finish Apptify as done']
            },
            QUERY_TASKS: {
                description: 'Query active or pending todo tasks.',
                parameters: {
                    status: { type: 'string', description: 'all, pending, or completed', required: false }
                },
                examples: ['What are my pending tasks?', 'Show my todo list', '查看我的待办清单']
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
                examples: ['Go to My Wealth', 'Open Knowledge Vault', 'Switch to NewsHub', '打开记事本', '返回主页']
            }
        }
    }
];
