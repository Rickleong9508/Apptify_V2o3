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
        name: 'My Wealth Skill',
        description: 'Manages personal finance, wallets, transactions, budgets, loans, and stock portfolio.',
        intents: {
            ADD_MONEY: {
                description: 'Add, deposit, top up, increase, or save money into a specific wallet.',
                parameters: {
                    walletName: { type: 'string', description: 'Name of the wallet to deposit money into', required: true },
                    amount: { type: 'number', description: 'Amount of money to deposit', required: true },
                    description: { type: 'string', description: 'Description of the deposit', required: false }
                },
                examples: ['Add RM100 to Cash Wallet', 'Top up RM50 in bank account', 'Deposit RM200 into savings']
            },
            WITHDRAW_MONEY: {
                description: 'Withdraw, take out, spend, deduct, or remove money from a specific wallet.',
                parameters: {
                    walletName: { type: 'string', description: 'Name of the wallet to withdraw/spend from', required: true },
                    amount: { type: 'number', description: 'Amount of money to withdraw or spend', required: true },
                    description: { type: 'string', description: 'Description of the expense or withdrawal', required: false },
                    category: { type: 'string', description: 'Expense category (e.g. Food, Utilities, Transport)', required: false }
                },
                examples: ['Spent RM20 on lunch from Cash Wallet', 'Record RM50 lunch expense', 'Deduct RM15 from bank for coffee']
            },
            TRANSFER_MONEY: {
                description: 'Transfer, move, send, or shift money from one wallet to another wallet.',
                parameters: {
                    sourceWallet: { type: 'string', description: 'Name of the source wallet/account', required: true },
                    destinationWallet: { type: 'string', description: 'Name of the destination wallet/account', required: true },
                    amount: { type: 'number', description: 'Amount of money to transfer', required: true },
                    description: { type: 'string', description: 'Description of the transfer', required: false }
                },
                examples: ['Transfer RM200 from Savings to Cash', 'Move RM50 from Wallet to Bank']
            },
            ADD_BUDGET: {
                description: 'Add a new budget expense allocation.',
                parameters: {
                    name: { type: 'string', description: 'Name of the budget allocation', required: true },
                    amount: { type: 'number', description: 'Allocated budget amount', required: true },
                    category: { type: 'string', description: 'Category (Food, Utilities, Travel, etc.)', required: false },
                    isFixed: { type: 'boolean', description: 'Whether it is a recurring fixed monthly expense', required: false }
                },
                examples: ['Add a food budget of RM300', 'Allocate RM150 for utilities', 'Create a fixed budget for rent of RM1200']
            },
            ADD_LOAN: {
                description: 'Add a new loan to track.',
                parameters: {
                    name: { type: 'string', description: 'Name/Title of the loan (e.g. Car Loan)', required: true },
                    totalAmount: { type: 'number', description: 'Total principal loan amount', required: true },
                    monthlyPayment: { type: 'number', description: 'Monthly payment amount', required: true }
                },
                examples: ['Add loan: Car Loan, total RM50000, monthly RM800']
            },
            REPAY_LOAN: {
                description: 'Record a repayment towards an active loan.',
                parameters: {
                    loanName: { type: 'string', description: 'Name of the loan to repay', required: true },
                    amount: { type: 'number', description: 'Repayment amount', required: true },
                    accountName: { type: 'string', description: 'Name of the wallet/account to pay from', required: false }
                },
                examples: ['Pay RM800 towards Car Loan', 'Repay Loan Home Loan RM1500']
            },
            BUY_STOCK: {
                description: 'Record purchase of shares of a stock in the portfolio.',
                parameters: {
                    symbol: { type: 'string', description: 'Stock ticker symbol (e.g. META, AAPL)', required: true },
                    quantity: { type: 'number', description: 'Number of shares bought', required: true },
                    price: { type: 'number', description: 'Purchase price per share', required: true },
                    currency: { type: 'string', description: 'Currency (USD or MYR)', required: false }
                },
                examples: ['Buy 10 shares of META at $350', 'Buy AAPL 5 shares at 180 USD']
            },
            SELL_STOCK: {
                description: 'Record sale of shares of a stock in the portfolio.',
                parameters: {
                    symbol: { type: 'string', description: 'Stock ticker symbol (e.g. META, AAPL)', required: true },
                    quantity: { type: 'number', description: 'Number of shares sold', required: true },
                    price: { type: 'number', description: 'Selling price per share', required: true },
                    currency: { type: 'string', description: 'Currency (USD or MYR)', required: false }
                },
                examples: ['Sell 5 shares of META at $360', 'Sell AAPL 2 shares at 185 USD']
            }
        }
    },
    {
        id: 'autocount',
        name: 'AutoCount Skill',
        description: 'Analyzes financial reports, stock performance, and runs stock valuation frameworks.',
        intents: {
            ANALYZE_STOCK: {
                description: 'Trigger comprehensive investment research and analysis on a stock ticker.',
                parameters: {
                    symbol: { type: 'string', description: 'US stock ticker symbol (e.g. TSLA, NVDA)', required: true }
                },
                examples: ['Analyze META', 'Show latest NVDA report', 'Analyze TSLA stock']
            }
        }
    },
    {
        id: 'knowledgevault',
        name: 'Knowledge Vault Skill',
        description: 'Manages personal notes, Second Brain, and Obsidian Integration.',
        intents: {
            CREATE_NOTE: {
                description: 'Create a new markdown note in the Obsidian Vault or local storage.',
                parameters: {
                    title: { type: 'string', description: 'Title of the note', required: true },
                    content: { type: 'string', description: 'Content body of the note', required: true },
                    category: { type: 'string', description: 'Category/Folder to organize this note under', required: false },
                    tags: { type: 'array', description: 'Tags to associate with this note', required: false }
                },
                examples: ['Create a note called AI Agents with text: AI Agents are...', 'Save a note: Buy milk', 'Save Prompt Engineering notes under AI category']
            },
            SEARCH_NOTES: {
                description: 'Search Obsidian notes and personal vault using AI to synthesize answers.',
                parameters: {
                    query: { type: 'string', description: 'The search query or question to answer from notes', required: true }
                },
                examples: ['What notes do I have about AI Agents?', 'Find my Prompt Engineering notes', 'Summarize everything related to stock investing', 'Show all notes about design systems']
            }
        }
    },
    {
        id: 'videosummary',
        name: 'Video Summary Skill',
        description: 'Extracts transcripts from YouTube video URLs and formats them into structured markdown notes.',
        intents: {
            SUMMARIZE_VIDEO: {
                description: 'Extract transcript and summarize a YouTube video URL.',
                parameters: {
                    url: { type: 'string', description: 'The complete YouTube video URL (e.g., https://www.youtube.com/watch?v=...)', required: true }
                },
                examples: ['Summarize this YouTube video https://www.youtube.com/watch?v=UVrfBw44sQ8', 'Extract transcript from https://youtu.be/somevideo']
            }
        }
    }
];
