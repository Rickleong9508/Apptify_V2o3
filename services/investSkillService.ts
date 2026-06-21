export interface PromptInfo {
    id: string;
    title: string;
    fileName: string;
}

export interface InvestmentSignal {
    signal: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    horizon: 'SHORT' | 'MEDIUM' | 'LONG-TERM';
    score: number; // 0 - 10
    action: 'BUY' | 'HOLD' | 'SELL';
    conviction: 'STRONG' | 'MODERATE' | 'WEAK';
}

export const investSkillService = {
    // 1. List available Prompts
    async listPrompts(): Promise<PromptInfo[]> {
        // Try static list first (highly reliable, works everywhere including mobile/Vercel)
        try {
            const res = await fetch('/invest-skills/list.json');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) return data;
            }
        } catch (e) {
            console.warn('Failed to load static prompts list, falling back to API', e);
        }

        // Fallback to API
        try {
            const res = await fetch('/api/invest_skills/list');
            if (res.ok) {
                const data = await res.json();
                return data.prompts || [];
            }
        } catch (e) {
            console.error('All listPrompts methods failed:', e);
        }
        return [];
    },

    // 2. Read Prompt template content
    async readPrompt(id: string): Promise<string> {
        // Try static read first (highly reliable, works everywhere)
        try {
            const cleanId = id.replace(/\.md$/, '');
            const res = await fetch(`/invest-skills/${cleanId}.md`);
            if (res.ok) {
                const content = await res.text();
                return content;
            }
        } catch (e) {
            console.warn(`Failed to read static prompt for ${id}, falling back to API`, e);
        }

        // Fallback to API
        const res = await fetch('/api/invest_skills/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        if (!res.ok) throw new Error(`Failed to load prompt: ${id}`);
        const data = await res.json();
        return data.content || '';
    },

    // 3. Save report as local HTML file
    async saveReport(fileName: string, htmlContent: string): Promise<string> {
        const res = await fetch('/api/invest_skills/save_report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName, htmlContent })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to save report');
        }
        const data = await res.json();
        return data.filePath;
    },

    // 4. Parse standardized Investment Signal Block using regex
    parseInvestmentSignal(text: string): InvestmentSignal {
        // Safe defaults
        const result: InvestmentSignal = {
            signal: 'NEUTRAL',
            confidence: 'MEDIUM',
            horizon: 'MEDIUM',
            score: 5.0,
            action: 'HOLD',
            conviction: 'MODERATE'
        };

        try {
            // Remove markdown format characters to get raw text for regex parsing
            const cleanText = text.replace(/[║╠═╚╔╗]/g, ' ');

            const scoreMatch = cleanText.match(/Score:\s*([\d.]+)\s*\/\s*10/i);
            if (scoreMatch) result.score = parseFloat(scoreMatch[1]);

            const signalMatch = cleanText.match(/Signal:\s*(BULLISH|NEUTRAL|BEARISH)/i);
            if (signalMatch) result.signal = signalMatch[1].toUpperCase() as any;

            const confidenceMatch = cleanText.match(/Confidence:\s*(HIGH|MEDIUM|LOW)/i);
            if (confidenceMatch) result.confidence = confidenceMatch[1].toUpperCase() as any;

            const horizonMatch = cleanText.match(/Horizon:\s*(SHORT|MEDIUM|LONG-TERM)/i);
            if (horizonMatch) result.horizon = horizonMatch[1].toUpperCase() as any;

            const actionMatch = cleanText.match(/Action:\s*(BUY|HOLD|SELL)/i);
            if (actionMatch) result.action = actionMatch[1].toUpperCase() as any;

            const convictionMatch = cleanText.match(/Conviction:\s*(STRONG|MODERATE|WEAK)/i);
            if (convictionMatch) result.conviction = convictionMatch[1].toUpperCase() as any;
        } catch (e) {
            console.error("Failed to parse investment signal block:", e);
        }

        return result;
    }
};
