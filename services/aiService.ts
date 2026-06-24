import { GoogleGenAI } from "@google/genai";

export type AIProvider = 'google' | 'deepseek' | 'openrouter' | 'openai' | 'anthropic' | 'siliconflow';

export interface AIResponse {
    text: string;
}

export interface ModelMetadata {
    id: string;
    name: string;
    provider: string;
    description: string;
    context_length: number;
    capabilities: string[]; // 'chat' | 'reasoning' | 'vision' | 'coding' | 'embedding' | 'image' | 'video' | 'audio' | 'tool_calling' | 'function_calling'
    pricing?: {
        prompt?: string;
        completion?: string;
        image?: string;
    };
    max_output_tokens?: number;
    last_updated?: string;
}

export interface AIProviderInstance {
    getModels(apiKey: string): Promise<ModelMetadata[]>;
    chat(
        model: string,
        apiKey: string,
        prompt: string,
        systemInstruction?: string,
        images?: string[]
    ): Promise<string>;
    embeddings?(model: string, apiKey: string, input: string | string[]): Promise<number[][]>;
    image?(model: string, apiKey: string, prompt: string, options?: any): Promise<string[]>;
    video?(model: string, apiKey: string, prompt: string, options?: any): Promise<string>;
    audio?(model: string, apiKey: string, prompt: string, options?: any): Promise<string>;
}

// --- Direct Gemini Provider ---
export const GeminiProvider: AIProviderInstance = {
    async getModels(apiKey: string): Promise<ModelMetadata[]> {
        return [
            {
                id: 'gemini-2.5-flash',
                name: 'Gemini 2.5 Flash',
                provider: 'Google',
                description: 'Recommended default: high-speed, balanced multimodal model.',
                context_length: 1048576,
                capabilities: ['chat', 'vision', 'coding', 'tool_calling', 'function_calling']
            },
            {
                id: 'gemini-2.5-pro',
                name: 'Gemini 2.5 Pro',
                provider: 'Google',
                description: 'Flagship model for complex analytical tasks and coding.',
                context_length: 2097152,
                capabilities: ['chat', 'vision', 'coding', 'reasoning', 'tool_calling', 'function_calling']
            },
            {
                id: 'gemini-2.0-flash',
                name: 'Gemini 2.0 Flash',
                provider: 'Google',
                description: 'Next-generation low-latency speed and multimodal features.',
                context_length: 1048576,
                capabilities: ['chat', 'vision', 'coding', 'tool_calling', 'function_calling']
            },
            {
                id: 'gemini-2.0-flash-thinking-exp-01-21',
                name: 'Gemini 2.0 Flash Thinking',
                provider: 'Google',
                description: 'Experimental reasoning model that exposes step-by-step logic.',
                context_length: 32768,
                capabilities: ['chat', 'vision', 'reasoning', 'coding']
            },
            {
                id: 'gemini-1.5-pro',
                name: 'Gemini 1.5 Pro (Legacy)',
                provider: 'Google',
                description: 'Legacy high-capacity model with 2M token context.',
                context_length: 2097152,
                capabilities: ['chat', 'vision', 'coding', 'tool_calling', 'function_calling']
            },
            {
                id: 'gemini-1.5-flash',
                name: 'Gemini 1.5 Flash (Legacy)',
                provider: 'Google',
                description: 'Legacy fast and lightweight multimodal model.',
                context_length: 1048576,
                capabilities: ['chat', 'vision', 'coding', 'tool_calling', 'function_calling']
            }
        ];
    },

    async chat(model: string, apiKey: string, prompt: string, systemInstruction?: string, images?: string[]): Promise<string> {
        const ai = new GoogleGenAI({ apiKey });
        const contents: any[] = [prompt];
        if (systemInstruction) contents.unshift(systemInstruction);

        if (images && images.length > 0) {
            images.forEach(img => {
                const [meta, data] = img.split(',');
                const mimeType = meta.split(':')[1].split(';')[0];
                contents.push({
                    inlineData: { mimeType, data }
                });
            });
        }

        const response = await ai.models.generateContent({
            model,
            contents: [{ parts: contents.map(c => typeof c === 'string' ? { text: c } : c) }]
        });
        return response.text || "";
    }
};

// --- DeepSeek Provider ---
export const DeepSeekProvider: AIProviderInstance = {
    async getModels(apiKey: string): Promise<ModelMetadata[]> {
        return [
            {
                id: 'deepseek-chat',
                name: 'DeepSeek V3 (Chat)',
                provider: 'DeepSeek',
                description: 'Flagship general-purpose chat model with excellent performance and cost.',
                context_length: 64000,
                capabilities: ['chat', 'coding', 'tool_calling', 'function_calling']
            },
            {
                id: 'deepseek-reasoner',
                name: 'DeepSeek R1 (Reasoner)',
                provider: 'DeepSeek',
                description: 'Specialized reasoning and logic model showcasing chain-of-thought.',
                context_length: 64000,
                capabilities: ['chat', 'reasoning', 'coding']
            }
        ];
    },

    async chat(model: string, apiKey: string, prompt: string, systemInstruction?: string, images?: string[]): Promise<string> {
        const messages = [];
        if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });

        let finalPrompt = prompt;
        if (images && images.length > 0) {
            finalPrompt += "\n\n[System Note: The user attached images, but DeepSeek standard API does not support image analysis directly.]";
        }
        messages.push({ role: 'user', content: finalPrompt });

        const res = await fetch('/api/deepseek/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.7
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || `API Error ${res.status}`);
        }
        const data = await res.json();
        return data.choices?.[0]?.message?.content || "";
    }
};

// --- OpenAI Provider ---
export const OpenAIProvider: AIProviderInstance = {
    async getModels(apiKey: string): Promise<ModelMetadata[]> {
        return [
            {
                id: 'gpt-4o',
                name: 'GPT-4o',
                provider: 'OpenAI',
                description: 'Flagship multimodal chat model.',
                context_length: 128000,
                capabilities: ['chat', 'vision', 'coding', 'tool_calling', 'function_calling']
            },
            {
                id: 'gpt-4o-mini',
                name: 'GPT-4o Mini',
                provider: 'OpenAI',
                description: 'Fast, lightweight multimodal model.',
                context_length: 128000,
                capabilities: ['chat', 'vision', 'coding', 'tool_calling', 'function_calling']
            },
            {
                id: 'o3-mini',
                name: 'o3-mini',
                provider: 'OpenAI',
                description: 'Reasoning model optimized for STEM, coding, and logical tasks.',
                context_length: 200000,
                capabilities: ['chat', 'reasoning', 'coding', 'tool_calling']
            },
            {
                id: 'o1',
                name: 'o1',
                provider: 'OpenAI',
                description: 'Flagship reasoning model for complex science and coding.',
                context_length: 200000,
                capabilities: ['chat', 'reasoning', 'coding']
            }
        ];
    },

    async chat(model: string, apiKey: string, prompt: string, systemInstruction?: string, images?: string[]): Promise<string> {
        const messages = [];
        if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });

        if (images && images.length > 0) {
            const contentParts: any[] = [{ type: 'text', text: prompt }];
            images.forEach(img => {
                contentParts.push({ type: 'image_url', image_url: { url: img } });
            });
            messages.push({ role: 'user', content: contentParts });
        } else {
            messages.push({ role: 'user', content: prompt });
        }

        const res = await fetch('/api/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.7
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || `API Error ${res.status}`);
        }
        const data = await res.json();
        return data.choices?.[0]?.message?.content || "";
    }
};

// --- Anthropic Provider ---
export const AnthropicProvider: AIProviderInstance = {
    async getModels(apiKey: string): Promise<ModelMetadata[]> {
        return [
            {
                id: 'claude-3-7-sonnet-20250219',
                name: 'Claude 3.7 Sonnet',
                provider: 'Anthropic',
                description: 'State-of-the-art model with hybrid reasoning/thinking options.',
                context_length: 200000,
                capabilities: ['chat', 'vision', 'reasoning', 'coding', 'tool_calling']
            },
            {
                id: 'claude-3-5-sonnet-20241022',
                name: 'Claude 3.5 Sonnet',
                provider: 'Anthropic',
                description: 'Highly intelligent model, excels at reasoning and programming.',
                context_length: 200000,
                capabilities: ['chat', 'vision', 'coding', 'tool_calling']
            },
            {
                id: 'claude-3-5-haiku-20241022',
                name: 'Claude 3.5 Haiku',
                provider: 'Anthropic',
                description: 'Ultra-fast and cost-effective text intelligence.',
                context_length: 200000,
                capabilities: ['chat', 'coding', 'tool_calling']
            }
        ];
    },

    async chat(model: string, apiKey: string, prompt: string, systemInstruction?: string, images?: string[]): Promise<string> {
        const messages: any[] = [];
        
        if (images && images.length > 0) {
            const contentParts: any[] = [];
            images.forEach(img => {
                const [meta, data] = img.split(',');
                const mimeType = meta.split(':')[1].split(';')[0];
                contentParts.push({
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: mimeType,
                        data: data
                    }
                });
            });
            contentParts.push({ type: 'text', text: prompt });
            messages.push({ role: 'user', content: contentParts });
        } else {
            messages.push({ role: 'user', content: prompt });
        }

        const body: any = {
            model,
            messages,
            max_tokens: 4096
        };
        if (systemInstruction) {
            body.system = systemInstruction;
        }

        const res = await fetch('/api/anthropic/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || `API Error ${res.status}`);
        }
        const data = await res.json();
        return data.content?.[0]?.text || "";
    }
};

// --- OpenRouter Provider ---
export const OpenRouterProvider: AIProviderInstance = {
    async getModels(apiKey: string): Promise<ModelMetadata[]> {
        return [
            { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', description: 'DeepSeek R1 via OpenRouter.', context_length: 128000, capabilities: ['chat', 'reasoning'] },
            { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', provider: 'Anthropic', description: 'Claude 3.7 Sonnet via OpenRouter.', context_length: 200000, capabilities: ['chat', 'coding', 'vision'] },
            { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', description: 'GPT-4o via OpenRouter.', context_length: 128000, capabilities: ['chat', 'vision'] }
        ];
    },

    async chat(model: string, apiKey: string, prompt: string, systemInstruction?: string, images?: string[]): Promise<string> {
        const messages = [];
        if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });

        if (images && images.length > 0) {
            const contentParts: any[] = [{ type: 'text', text: prompt }];
            images.forEach(img => {
                contentParts.push({ type: 'image_url', image_url: { url: img } });
            });
            messages.push({ role: 'user', content: contentParts });
        } else {
            messages.push({ role: 'user', content: prompt });
        }

        const res = await fetch('/api/openrouter/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'X-Title': 'Apptify'
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.7
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || `API Error ${res.status}`);
        }
        const data = await res.json();
        return data.choices?.[0]?.message?.content || "";
    }
};

// --- SiliconFlow Provider ---
export const SiliconFlowProvider: AIProviderInstance = {
    async getModels(apiKey: string): Promise<ModelMetadata[]> {
        const res = await fetch('/api/siliconflow/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'accept': 'application/json'
            }
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || `Failed to fetch SiliconFlow models (${res.status})`);
        }

        const data = await res.json();
        if (!data.data || !Array.isArray(data.data)) {
            throw new Error("Invalid models response from SiliconFlow.");
        }

        return data.data.map((m: any) => {
            const id = m.id;
            let provider = 'SiliconFlow';
            let cleanName = id;
            if (id.includes('/')) {
                const parts = id.split('/');
                const owner = parts[0].toLowerCase();
                cleanName = parts.slice(1).join('/');
                
                if (owner.includes('deepseek')) provider = 'DeepSeek';
                else if (owner.includes('qwen') || owner.includes('alibaba')) provider = 'Qwen';
                else if (owner.includes('thudm') || owner.includes('glm')) provider = 'GLM';
                else if (owner.includes('meta')) provider = 'Meta';
                else if (owner.includes('mistral')) provider = 'Mistral';
                else if (owner.includes('01-ai')) provider = '01.AI (Yi)';
                else if (owner.includes('kimi') || owner.includes('moonshot')) provider = 'Kimi';
                else if (owner.includes('google')) provider = 'Google';
                else if (owner.includes('stability')) provider = 'Stability';
                else if (owner.includes('baai')) provider = 'BAAI';
                else if (owner.includes('openai')) provider = 'OpenAI';
                else if (owner.includes('funaudiollm') || owner.includes('audio')) provider = 'FunAudioLLM';
                else if (owner.includes('wan-ai')) provider = 'Wan-AI';
                else if (owner.includes('sensetime')) provider = 'SenseTime';
                else provider = parts[0];
            }

            const capabilities: string[] = [];
            const lowercaseId = id.toLowerCase();
            
            if (lowercaseId.includes('embedding') || lowercaseId.includes('bge') || lowercaseId.includes('text2vec')) {
                capabilities.push('embedding');
            } else if (lowercaseId.includes('stable-diffusion') || lowercaseId.includes('flux') || lowercaseId.includes('sdxl') || lowercaseId.includes('image') || lowercaseId.includes('diff') || lowercaseId.includes('kolors') || lowercaseId.includes('cogview')) {
                capabilities.push('image');
            } else if (lowercaseId.includes('video') || lowercaseId.includes('cogvideo') || lowercaseId.includes('luma') || lowercaseId.includes('wan2.')) {
                capabilities.push('video');
            } else if (lowercaseId.includes('audio') || lowercaseId.includes('speech') || lowercaseId.includes('tts') || lowercaseId.includes('whisper') || lowercaseId.includes('voice') || lowercaseId.includes('sensevoice')) {
                capabilities.push('audio');
            } else if (lowercaseId.includes('reasoner') || lowercaseId.endsWith('-r1') || lowercaseId.includes('r1-') || lowercaseId.includes('thinking')) {
                capabilities.push('chat', 'reasoning');
            } else if (lowercaseId.includes('coder') || lowercaseId.includes('code-')) {
                capabilities.push('chat', 'coding');
            } else {
                capabilities.push('chat');
            }

            if (lowercaseId.includes('-vl') || lowercaseId.includes('vision') || lowercaseId.includes('multimodal')) {
                capabilities.push('vision');
            }

            if (capabilities.includes('chat') && !lowercaseId.includes('free') && 
                (lowercaseId.includes('qwen2.5') || lowercaseId.includes('deepseek-v3') || lowercaseId.includes('glm-4') || lowercaseId.includes('llama-3.1') || lowercaseId.includes('llama-3.3'))) {
                capabilities.push('tool_calling', 'function_calling');
            }

            let context_length = 8192;
            if (lowercaseId.includes('128k') || lowercaseId.includes('deepseek-') || lowercaseId.includes('qwen2.5') || lowercaseId.includes('glm-4')) {
                context_length = 131072;
            } else if (lowercaseId.includes('32k')) {
                context_length = 32768;
            } else if (lowercaseId.includes('256k')) {
                context_length = 262144;
            } else if (lowercaseId.includes('1m') || lowercaseId.includes('1024k')) {
                context_length = 1048576;
            } else if (capabilities.includes('image') || capabilities.includes('video') || capabilities.includes('audio')) {
                context_length = 0;
            }

            let pricingText = "Pay-as-you-go";
            if (lowercaseId.includes('free')) {
                pricingText = "Free Tier";
            }
            
            const categoryLabel = capabilities.includes('embedding') ? 'Embedding' : 
                                  capabilities.includes('image') ? 'Image Generation' :
                                  capabilities.includes('video') ? 'Video Generation' :
                                  capabilities.includes('audio') ? 'Audio Processing' :
                                  capabilities.includes('reasoning') ? 'Reasoning/Logic' :
                                  capabilities.includes('coding') ? 'Coding/Software' : 'General Chat';

            const description = `SiliconFlow ${categoryLabel} model: ${cleanName}. Provider: ${provider}.`;

            return {
                id,
                name: cleanName,
                provider,
                description,
                context_length,
                capabilities,
                pricing: {
                    prompt: pricingText
                },
                max_output_tokens: capabilities.includes('chat') ? 4096 : undefined,
                last_updated: m.created ? new Date(m.created * 1000).toLocaleDateString() : undefined
            };
        });
    },

    async chat(model: string, apiKey: string, prompt: string, systemInstruction?: string, images?: string[]): Promise<string> {
        const messages = [];
        if (systemInstruction) {
            messages.push({ role: 'system', content: systemInstruction });
        }

        if (images && images.length > 0 && model.toLowerCase().includes('vl')) {
            const contentParts: any[] = [{ type: 'text', text: prompt }];
            images.forEach(img => {
                contentParts.push({ type: 'image_url', image_url: { url: img } });
            });
            messages.push({ role: 'user', content: contentParts });
        } else {
            let finalPrompt = prompt;
            if (images && images.length > 0) {
                finalPrompt += "\n\n[System Note: The user attached images, but this model does not support image analysis directly.]";
            }
            messages.push({ role: 'user', content: finalPrompt });
        }

        const res = await fetch('/api/siliconflow/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.7
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || `API Error ${res.status}`);
        }
        const data = await res.json();
        return data.choices?.[0]?.message?.content || "";
    },

    async image(model: string, apiKey: string, prompt: string, options?: any): Promise<string[]> {
        const res = await fetch('/api/siliconflow/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                prompt,
                image_size: options?.image_size || '1024x1024'
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || `Image Generation Failed: ${res.status}`);
        }

        const data = await res.json();
        const imagesList = data.images || data.data;
        if (imagesList && Array.isArray(imagesList)) {
            return imagesList.map((img: any) => img.url || img.b64_json || img);
        }
        throw new Error("No image data found in response.");
    },

    async video(model: string, apiKey: string, prompt: string, options?: any): Promise<string> {
        const submitRes = await fetch('/api/siliconflow/v1/video/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                prompt,
                image_size: options?.image_size || '1280x720'
            })
        });

        if (!submitRes.ok) {
            const errText = await submitRes.text();
            throw new Error(errText || `Video Generation submission failed: ${submitRes.status}`);
        }

        const submitData = await submitRes.json();
        const requestId = submitData.requestId;
        if (!requestId) {
            throw new Error("No request ID received for video generation task.");
        }
        return requestId;
    },

    async audio(model: string, apiKey: string, prompt: string, options?: any): Promise<string> {
        const res = await fetch('/api/siliconflow/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                input: prompt,
                voice: options?.voice || `${model}:alex`,
                response_format: options?.response_format || 'mp3'
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || `Audio synthesis failed: ${res.status}`);
        }

        const blob = await res.blob();
        return URL.createObjectURL(blob);
    }
};

const providersMap: Record<AIProvider, AIProviderInstance> = {
    'google': GeminiProvider,
    'deepseek': DeepSeekProvider,
    'openrouter': OpenRouterProvider,
    'openai': OpenAIProvider,
    'anthropic': AnthropicProvider,
    'siliconflow': SiliconFlowProvider
};

export const aiService = {
    getModels: async (provider: AIProvider, apiKey: string): Promise<ModelMetadata[]> => {
        const pInstance = providersMap[provider];
        if (!pInstance) throw new Error(`Unsupported AI Provider: ${provider}`);
        return await pInstance.getModels(apiKey);
    },

    generate: async (
        provider: AIProvider,
        model: string,
        apiKey: string,
        prompt: string,
        systemInstruction?: string,
        images?: string[]
    ): Promise<string> => {
        const key = apiKey.trim();
        if (!key) throw new Error("API Key Missing");

        const pInstance = providersMap[provider];
        if (!pInstance) throw new Error(`Unsupported AI Provider: ${provider}`);
        return await pInstance.chat(model, key, prompt, systemInstruction, images);
    },

    embeddings: async (
        provider: AIProvider,
        model: string,
        apiKey: string,
        input: string | string[]
    ): Promise<number[][]> => {
        const pInstance = providersMap[provider];
        if (!pInstance) throw new Error(`Unsupported AI Provider: ${provider}`);
        if (!pInstance.embeddings) {
            // Check if provider is SiliconFlow, we can call their standard embeddings API
            if (provider === 'siliconflow') {
                const res = await fetch('/api/siliconflow/v1/embeddings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model,
                        input: Array.isArray(input) ? input : [input]
                    })
                });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`Embedding generation failed: ${text}`);
                }
                const data = await res.json();
                return data.data.map((item: any) => item.embedding);
            }
            throw new Error(`Embeddings not supported by provider: ${provider}`);
        }
        return await pInstance.embeddings(model, apiKey, input);
    },

    image: async (
        provider: AIProvider,
        model: string,
        apiKey: string,
        prompt: string,
        options?: any
    ): Promise<string[]> => {
        const pInstance = providersMap[provider];
        if (!pInstance || !pInstance.image) throw new Error(`Image generation not supported by provider: ${provider}`);
        return await pInstance.image(model, apiKey, prompt, options);
    },

    video: async (
        provider: AIProvider,
        model: string,
        apiKey: string,
        prompt: string,
        options?: any
    ): Promise<string> => {
        const pInstance = providersMap[provider];
        if (!pInstance || !pInstance.video) throw new Error(`Video generation not supported by provider: ${provider}`);
        return await pInstance.video(model, apiKey, prompt, options);
    },

    audio: async (
        provider: AIProvider,
        model: string,
        apiKey: string,
        prompt: string,
        options?: any
    ): Promise<string> => {
        const pInstance = providersMap[provider];
        if (!pInstance || !pInstance.audio) throw new Error(`Audio synthesis not supported by provider: ${provider}`);
        return await pInstance.audio(model, apiKey, prompt, options);
    },

    analyzeValuation: async (
        provider: AIProvider,
        model: string,
        apiKey: string,
        symbol: string,
        stockData: any
    ): Promise<any> => {
        const financials = stockData.valuationFields || {};
        const revenue = financials.revenueTtm ? (financials.revenueTtm / 1e9).toFixed(2) + 'B' : 'N/A';
        const netIncome = financials.netIncomeTtm ? (financials.netIncomeTtm / 1e9).toFixed(2) + 'B' : 'N/A';
        const fcf = financials.obsFreeCashFlowTtm ? (financials.obsFreeCashFlowTtm / 1e9).toFixed(2) + 'B' : 'N/A';
        const cash = financials.cashAndEquivalents ? (financials.cashAndEquivalents / 1e9).toFixed(2) + 'B' : 'N/A';
        const debt = financials.totalDebt ? (financials.totalDebt / 1e9).toFixed(2) + 'B' : 'N/A';
        const marketCap = stockData.marketCap ? (stockData.marketCap / 1e9).toFixed(2) + 'B' : 'N/A';

        const prompt = `
      You are a Senior Equity Research Analyst. Perform a deep valuation analysis for ${symbol}.
      
      MARKET DATA:
      - Price: ${stockData.price}
      - Market Cap: ${marketCap}
      - PE Ratio: ${stockData.peRatio || 'N/A'}
      - PEG Ratio: ${stockData.pegRatio || 'N/A'}
      - EPS: ${stockData.eps || 'N/A'}
      
      FINANCIAL FUNDAMENTALS (TTM):
      - Revenue: $${revenue}
      - Net Income: $${netIncome}
      - Free Cash Flow (FCF): $${fcf} (CRITICAL FOR VALUATION)
      - Cash & Equivalents: $${cash}
      - Total Debt: $${debt}
      - Shares Outstanding: ${financials.sharesOutstanding ? (financials.sharesOutstanding / 1e9).toFixed(2) + 'B' : 'N/A'}

      GROWTH & HEALTH:
      - Revenue Growth: ${stockData.financeGrowth ? (stockData.financeGrowth * 100).toFixed(2) + '%' : 'N/A'}
      - Dividend Yield: ${stockData.dividendRate ? (stockData.dividendRate / stockData.price * 100).toFixed(2) + '%' : '0%'}
      - Book Value/Share: ${stockData.bookValue || 'N/A'}
      - Sector: ${stockData.description ? 'Derived from context' : 'Unknown'}

      TASK:
      ACT AS A SENIOR ANALYST. Calculate the *Intrinsic Value* of ${symbol} using professional methodologies.
      
      KEY INSTRUCTIONS:
      1. **Enterprise Value (EV)**: Consider the Net Cash/Debt position ($${cash} Cash vs $${debt} Debt).
      2. **DCF Emphasis**: If FCF ($${fcf}) is positive, prioritize a Discounted Cash Flow (DCF) approach for the 'Base Case'.
      3. **Metric Triangulation**: Combine DCF with relative valuation (PE, PEG, EV/EBITDA).
      
      You MUST provide a SCENARIO ANALYSIS with 3 distinct cases:
      1. BEAR CASE: Conservative growth/margin compression.
      2. BASE CASE: Realistic trajectory based on provided financials.
      3. BULL CASE: Optimistic execution & macro tailwinds.

      Output strictly valid JSON (no markdown formatting):
      {
        "fairValueLow": number,
        "fairValueHigh": number,
        "rating": "Buy" | "Hold" | "Sell",
        "methodology": "Method used (e.g. 'DCF (WACC 9%) & PE 25x')",
        "reasoning": "Concise executive summary of the investment thesis, explicitly citing the FCF and Debt figures provided.",
        "scenarios": {
            "bear": { "price": number, "logic": "Brief assumption" },
            "base": { "price": number, "logic": "Brief assumption" },
            "bull": { "price": number, "logic": "Brief assumption" }
        }
      }
    `;

        try {
            const responseText = await aiService.generate(provider, model, apiKey, prompt);
            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanJson);

            if (!result.scenarios || !result.scenarios.base) {
                console.warn("AI didn't return scenarios, attempting to derive them.");
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
    }
};
