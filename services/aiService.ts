
import { GoogleGenAI } from "@google/genai";

export type AIProvider = 'google' | 'deepseek' | 'openrouter';

export interface AIResponse {
    text: string;
}

export const aiService = {
    generate: async (
        provider: AIProvider,
        model: string,
        apiKey: string,
        prompt: string,
        systemInstruction?: string,
        images?: string[] // Array of Base64 data URLs
    ): Promise<string> => {
        const key = apiKey.trim();
        if (!key) throw new Error("API Key Missing");

        // --- Google Gemini (Direct SDK) ---
        if (provider === 'google') {
            const ai = new GoogleGenAI({ apiKey: key });

            // Construct inputs
            const contents: any[] = [prompt];
            if (systemInstruction) contents.unshift(systemInstruction);

            if (images && images.length > 0) {
                images.forEach(img => {
                    const [meta, data] = img.split(',');
                    const mimeType = meta.split(':')[1].split(';')[0];
                    contents.push({
                        inlineData: {
                            mimeType: mimeType,
                            data: data
                        }
                    });
                });
            }

            const response = await ai.models.generateContent({
                model,
                contents: [{ parts: contents.map(c => typeof c === 'string' ? { text: c } : c) }]
            });
            return response.text || "";
        }

        // --- Deepseek & OpenRouter (Via Proxy) ---
        let url = '';
        let headers: any = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
        };

        if (provider === 'deepseek') {
            url = '/api/deepseek/chat/completions';
        } else if (provider === 'openrouter') {
            url = '/api/openrouter/v1/chat/completions';

            headers['X-Title'] = 'Apptify';
        }

        const messages = [];
        if (systemInstruction) {
            messages.push({ role: 'system', content: systemInstruction });
        }

        if (images && images.length > 0 && provider === 'openrouter') {
            // Multimodal Request for compatible OpenRouter models
            const contentParts: any[] = [{ type: 'text', text: prompt }];
            images.forEach(img => {
                contentParts.push({ type: 'image_url', image_url: { url: img } });
            });

            messages.push({
                role: 'user',
                content: contentParts
            });
        } else {
            // Text only or Deepseek (TEXT ONLY FOR NOW - Deepseek V3/R1 are text models mainly)
            let finalPrompt = prompt;
            if (images && images.length > 0 && provider === 'deepseek') {
                finalPrompt += "\n\n[System Note: The user attached images, but this model/provider does not support image analysis directly. Please ask the user to describe the images.]";
            }
            messages.push({ role: 'user', content: finalPrompt });
        }

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers,
                mode: 'cors',
                credentials: 'omit',
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    temperature: 0.7
                })
            });

            if (!res.ok) {
                const errorText = await res.text();
                let errorData = {};
                try { errorData = JSON.parse(errorText); } catch (e) { }

                const errorMessage = (errorData as any).error?.message || errorText || `API Error ${res.status}: ${res.statusText}`;
                if (errorMessage.includes('cookie auth') || res.status === 401) {
                    throw new Error("Authentication Failed: Invalid API Key.");
                }
                throw new Error(errorMessage);
            }

            const data = await res.json();
            return data.choices?.[0]?.message?.content || "";

        } catch (error: any) {
            console.error("AI Service Error:", error);
            if (error.message.includes('Unexpected token')) {
                throw new Error("Proxy Error: The server returned a non-JSON response.");
            }
            throw error;
        }
    },

    analyzeValuation: async (
        provider: AIProvider,
        model: string,
        apiKey: string,
        symbol: string,
        stockData: any
    ): Promise<any> => {
        const prompt = `
      You are a Senior Equity Research Analyst. Perform a deep valuation analysis for ${symbol}.
      
      Financial Data:
      - Price: ${stockData.price}
      - PE Ratio: ${stockData.peRatio}
      - PEG Ratio: ${stockData.pegRatio}
      - EPS: ${stockData.eps}
      - Growth Rate: ${stockData.financeGrowth ? (stockData.financeGrowth * 100).toFixed(2) + '%' : 'N/A'}
      - Dividend Yield: ${stockData.dividendRate ? (stockData.dividendRate / stockData.price * 100).toFixed(2) + '%' : '0%'}
      - Book Value: ${stockData.bookValue}
      - Sector: ${stockData.description ? 'Derived from description' : 'Unknown'}

      Task:
      ACT AS A SENIOR EQUITY RESEARCH ANALYST. Perform a rigorous valuation analysis for ${symbol}.
      
      You MUST provide a SCENARIO ANALYSIS with 3 distinct cases:
      1. BEAR CASE: Conservative assumptions (lower growth/margins).
      2. BASE CASE: Most likely outcome based on consensus and current trajectory.
      3. BULL CASE: Optimistic assumptions (execution success, macro tailwinds).

      Select the most appropriate valuation methodology (DCF, PEG, Multiples) and apply it consistently across scenarios.

      Output strictly valid JSON (no markdown formatting):
      {
        "fairValueLow": number,
        "fairValueHigh": number,
        "rating": "Buy" | "Hold" | "Sell",
        "methodology": "Method used (e.g. 'DCF (5yr) & EV/EBITDA')",
        "reasoning": "Concise executive summary of the investment thesis.",
        "scenarios": {
            "bear": { "price": number, "logic": "Brief assumption (e.g. 'Growth slows to 2%')" },
            "base": { "price": number, "logic": "Brief assumption (e.g. 'Consensus estimates met')" },
            "bull": { "price": number, "logic": "Brief assumption (e.g. 'Margins expand 200bps')" }
        }
      }
    `;

        try {
            const responseText = await aiService.generate(provider, model, apiKey, prompt);
            // Clean response if it contains markdown code blocks
            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanJson);

            // Validate structure (basic check)
            if (!result.scenarios || !result.scenarios.base) {
                console.warn("AI didn't return scenarios, attempting to derive them.");
                // Fallback if AI fails to follow strict schema (rare but possible)
                result.scenarios = {
                    bear: { price: result.fairValueLow, logic: "Conservative Estimate" },
                    base: { price: (result.fairValueLow + result.fairValueHigh) / 2, logic: "Base Estimate" },
                    bull: { price: result.fairValueHigh, logic: "Optimistic Estimate" }
                };
            }
            return result;
        } catch (error) {
            console.error("AI Valuation Error:", error);
            throw new Error("Failed to generate AI valuation.");
        }
    },


};
