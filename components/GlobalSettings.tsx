import React, { useState, useEffect } from 'react';
import {
    ArrowLeft,
    Server,
    Key,
    Cpu,
    Check,
    AlertCircle,
    Zap,
    BrainCircuit,
    Activity,
    Download,
    Upload,
    Database,
    CheckCircle2,
    HardDrive,
    Globe,
    MessageSquare
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { aiService, AIProvider } from '../services/aiService';

interface GlobalSettingsProps {
    onExit: () => void;
}



const GlobalSettings: React.FC<GlobalSettingsProps> = ({ onExit }) => {
    // --- AI State ---
    const [aiProvider, setAiProvider] = useState<AIProvider>(() => (localStorage.getItem('app_global_ai_provider') as AIProvider) || 'google');
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('app_global_api_key') || '');
    const [aiModel, setAiModel] = useState(() => localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash');

    // Connection Check State
    const [checkStatus, setCheckStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
    const [statusMsg, setStatusMsg] = useState('');

    // --- Backup State ---
    const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null);

    // Persist AI Settings
    useEffect(() => { localStorage.setItem('app_global_ai_provider', aiProvider); }, [aiProvider]);
    useEffect(() => { localStorage.setItem('app_global_api_key', apiKey); }, [apiKey]);
    useEffect(() => { localStorage.setItem('app_global_ai_model', aiModel); }, [aiModel]);

    // Reset model defaults when provider changes
    useEffect(() => {
        const defaults: Record<string, string> = {
            'google': 'gemini-2.5-flash',
            'deepseek': 'deepseek-chat',
            'openrouter': 'anthropic/claude-3.5-sonnet'
        };
        // Only reset if the current model clearly doesn't belong to the new provider
        if (aiProvider === 'google' && !aiModel.includes('gemini')) setAiModel(defaults['google']);
        if (aiProvider === 'deepseek' && !aiModel.includes('deepseek')) setAiModel(defaults['deepseek']);
        if (aiProvider === 'openrouter' && (aiModel.includes('gemini') || aiModel.includes('deepseek-chat'))) setAiModel(defaults['openrouter']);
    }, [aiProvider]);

    // --- Helpers ---


    const checkConnection = async () => {
        setCheckStatus('checking');
        setStatusMsg('Pinging API...');
        try {
            await aiService.generate(aiProvider, aiModel, apiKey, "Hi");
            setCheckStatus('success');
            setStatusMsg('Connected Successfully');
        } catch (e: any) {
            setCheckStatus('error');
            setStatusMsg(e.message || "Connection Failed");
        }
        setTimeout(() => { if (checkStatus !== 'error') setCheckStatus('idle'); }, 3000);
    };

    // --- Backup Functions ---
    const handleFullBackup = () => {
        const backupData = {
            meta: {
                version: 1,
                date: new Date().toISOString(),
                app: "Apptify Global"
            },
            data: {
                // Global Settings
                app_global_api_key: localStorage.getItem('app_global_api_key'),
                app_global_ai_provider: localStorage.getItem('app_global_ai_provider'),
                app_global_ai_model: localStorage.getItem('app_global_ai_model'),
                // GetNote Data
                gn_notes: localStorage.getItem('gn_notes'),
                gn_todos: localStorage.getItem('gn_todos'),
                // MyWealth Data
                mw_data_main: localStorage.getItem('mw_data_main'),
                mw_theme: localStorage.getItem('mw_theme'),
            }
        };

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Apptify_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleFullRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const json = JSON.parse(ev.target?.result as string);
                if (!json.data) throw new Error("Invalid backup file format");

                // Restore keys
                Object.keys(json.data).forEach(key => {
                    if (json.data[key] !== null) {
                        localStorage.setItem(key, json.data[key]);
                    }
                });

                // Update local state to reflect changes immediately
                setApiKey(localStorage.getItem('app_global_api_key') || '');
                setAiProvider((localStorage.getItem('app_global_ai_provider') as AIProvider) || 'google');
                setAiModel(localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash');

                alert("Restore Successful! Please restart apps to see data.");
            } catch (err) {
                alert("Failed to restore: Invalid file.");
                console.error(err);
            }
            if (fileInput) fileInput.value = '';
        };
        reader.readAsText(file);
    };

    return (
        <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#121212] text-text-main flex flex-col items-center p-6 animate-fade-in">

            <div className="max-w-3xl w-full space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button onClick={onExit} className="p-3 bg-surface rounded-full shadow-sm hover:scale-105 transition-transform text-text-main">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold">Global Settings</h1>
                        <p className="text-text-muted">Configure AI & Data for all applications</p>
                    </div>
                </div>

                {/* AI Configuration Card */}
                <div className="bg-surface p-8 rounded-[32px] shadow-xl border border-border">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                            <BrainCircuit size={20} />
                        </div>
                        <h2 className="text-xl font-bold">AI Intelligence</h2>
                    </div>

                    {/* Provider Select */}
                    <div className="mb-6">
                        <label className="text-xs font-bold text-text-muted uppercase mb-3 block">Service Provider</label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { id: 'google', label: 'Google Gemini' },
                                { id: 'deepseek', label: 'DeepSeek' },
                                { id: 'openrouter', label: 'OpenRouter' }
                            ].map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        setAiProvider(p.id as AIProvider);
                                        setCheckStatus('idle');
                                        setStatusMsg('');
                                    }}
                                    className={`py-3 px-2 rounded-xl text-sm font-bold transition-all border-2 ${aiProvider === p.id ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-border bg-input-bg text-text-muted hover:border-purple-200'}`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        <div className="mt-3 p-3 bg-input-bg rounded-xl text-xs text-text-muted">
                            {aiProvider === 'google' && <p>✅ <b>Recommended:</b> Native support for Gemini. Fast & Reliable.</p>}
                            {aiProvider === 'deepseek' && <p>✅ <b>Optimized:</b> Requests are routed through local proxy to bypass CORS.</p>}
                            {aiProvider === 'openrouter' && <p>✅ <b>Best Compatibility:</b> Access DeepSeek, Claude, and Llama.</p>}
                        </div>
                    </div>

                    {/* API Key */}
                    <div className="mb-6">
                        <label className="text-xs font-bold text-text-muted uppercase mb-2 block">
                            {aiProvider === 'google' ? 'Google AI Studio Key' : aiProvider === 'deepseek' ? 'DeepSeek API Key' : 'OpenRouter Key'}
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => {
                                    setApiKey(e.target.value);
                                    setCheckStatus('idle');
                                }}
                                placeholder={aiProvider === 'google' ? "AIzaSy..." : "sk-..."}
                                className="flex-1 bg-input-bg p-4 rounded-xl border border-border focus:ring-2 focus:ring-purple-500/20 font-mono text-sm outline-none"
                            />
                            <button
                                onClick={checkConnection}
                                disabled={!apiKey || checkStatus === 'checking'}
                                className={`px-6 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${checkStatus === 'success' ? 'bg-green-500 text-white' : checkStatus === 'error' ? 'bg-red-500 text-white' : 'bg-text-main text-surface hover:opacity-90'}`}
                            >
                                {checkStatus === 'checking' ? <Activity className="animate-spin" size={18} /> :
                                    checkStatus === 'success' ? <Check size={18} /> :
                                        checkStatus === 'error' ? <AlertCircle size={18} /> :
                                            "Check"}
                            </button>
                        </div>
                        {statusMsg && (
                            <p className={`text-xs font-bold mt-2 ${checkStatus === 'success' ? 'text-green-600' : checkStatus === 'error' ? 'text-red-600' : 'text-text-muted'}`}>
                                {statusMsg}
                            </p>
                        )}
                    </div>

                    {/* Model Select */}
                    <div>
                        <label className="text-xs font-bold text-text-muted uppercase mb-3 block">Model Selection</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            {/* Google Options */}
                            {aiProvider === 'google' && (
                                <>
                                    <div onClick={() => setAiModel('gemini-2.5-flash')} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${aiModel === 'gemini-2.5-flash' ? 'border-purple-600 bg-purple-50' : 'border-border'}`}>
                                        <div className="flex justify-between items-center mb-1"><span className="font-bold text-sm">Gemini 2.5 Flash</span>{aiModel === 'gemini-2.5-flash' && <CheckCircle2 size={16} className="text-purple-600" />}</div>
                                        <div className="text-xs text-text-muted flex items-center gap-1"><Zap size={10} className="text-yellow-500" /> Fast & Efficient</div>
                                    </div>
                                    <div onClick={() => setAiModel('gemini-3-pro-preview')} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${aiModel === 'gemini-3-pro-preview' ? 'border-purple-600 bg-purple-50' : 'border-border'}`}>
                                        <div className="flex justify-between items-center mb-1"><span className="font-bold text-sm">Gemini 3 Pro</span>{aiModel === 'gemini-3-pro-preview' && <CheckCircle2 size={16} className="text-purple-600" />}</div>
                                        <div className="text-xs text-text-muted flex items-center gap-1"><BrainCircuit size={10} className="text-blue-500" /> High Intelligence</div>
                                    </div>
                                </>
                            )}

                            {/* DeepSeek Options */}
                            {aiProvider === 'deepseek' && (
                                <>
                                    <div onClick={() => setAiModel('deepseek-chat')} className={`p-4 rounded-xl border-2 cursor-pointer ${aiModel === 'deepseek-chat' ? 'border-purple-600 bg-purple-50' : 'border-border'}`}>
                                        <div className="flex justify-between items-center mb-1"><span className="font-bold text-sm">DeepSeek V3 (Chat)</span>{aiModel === 'deepseek-chat' && <CheckCircle2 size={16} className="text-purple-600" />}</div>
                                        <div className="text-xs text-text-muted">Standard high-performance model</div>
                                    </div>
                                    <div onClick={() => setAiModel('deepseek-reasoner')} className={`p-4 rounded-xl border-2 cursor-pointer ${aiModel === 'deepseek-reasoner' ? 'border-purple-600 bg-purple-50' : 'border-border'}`}>
                                        <div className="flex justify-between items-center mb-1"><span className="font-bold text-sm">DeepSeek R1 (Reasoner)</span>{aiModel === 'deepseek-reasoner' && <CheckCircle2 size={16} className="text-purple-600" />}</div>
                                        <div className="text-xs text-text-muted">Specialized in logic & reasoning</div>
                                    </div>
                                </>
                            )}

                            {/* OpenRouter Options */}
                            {aiProvider === 'openrouter' && (
                                <div className="col-span-full space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {[
                                            { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek' },
                                            { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)', provider: 'DeepSeek' },
                                            { id: 'deepseek/deepseek-r1-distill-llama-70b', name: 'R1 Distill Llama 70B', provider: 'DeepSeek' },
                                            { id: 'deepseek/deepseek-v3', name: 'DeepSeek V3', provider: 'DeepSeek' },
                                            { id: 'deepseek/deepseek-v3:free', name: 'DeepSeek V3 (Free)', provider: 'DeepSeek' },
                                            { id: 'deepseek/deepseek-coder', name: 'DeepSeek Coder V2', provider: 'DeepSeek' },
                                            { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
                                            { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: 'Meta' },
                                            { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' }
                                        ].map(m => (
                                            <div
                                                key={m.id}
                                                onClick={() => setAiModel(m.id)}
                                                className={`p-3 rounded-xl border cursor-pointer transition-all flex justify-between items-center ${aiModel === m.id ? 'border-purple-600 bg-purple-50' : 'border-border hover:border-purple-300'}`}
                                            >
                                                <div>
                                                    <div className="font-bold text-sm">{m.name}</div>
                                                    <div className="text-[10px] text-text-muted">{m.provider}</div>
                                                </div>
                                                {aiModel === m.id && <CheckCircle2 size={16} className="text-purple-600" />}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <MessageSquare size={14} className="text-text-muted" />
                                        </div>
                                        <input
                                            className="w-full bg-input-bg p-3 pl-9 rounded-xl border border-border text-sm focus:ring-2 focus:ring-purple-500/20 outline-none"
                                            placeholder="Or enter custom Model ID (e.g. mistralai/mistral-large-latest)"
                                            value={aiModel}
                                            onChange={e => setAiModel(e.target.value)}
                                        />
                                        <p className="text-[10px] text-text-muted mt-2 ml-1">
                                            Copy ID from <a href="https://openrouter.ai/models" target="_blank" className="text-purple-600 underline">openrouter.ai/models</a>
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Backup Card */}
                <div className="bg-surface p-8 rounded-[32px] shadow-xl border border-border">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                            <Database size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Data Management</h2>
                            <p className="text-sm text-text-muted">Backup applies to MyWealth, GetNote & Settings</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={handleFullBackup}
                            className="p-6 rounded-2xl bg-input-bg border border-border hover:border-blue-500 hover:bg-blue-500/5 transition-all group text-left"
                        >
                            <div className="w-10 h-10 bg-blue-500/10 text-blue-600 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Download size={20} />
                            </div>
                            <h3 className="font-bold text-lg mb-1">Export Full Backup</h3>
                            <p className="text-xs text-text-muted">Save all application data to a single JSON file.</p>
                        </button>

                        <button
                            onClick={() => document.getElementById('global-restore')?.click()}
                            className="p-6 rounded-2xl bg-input-bg border border-border hover:border-green-500 hover:bg-green-500/5 transition-all group text-left"
                        >
                            <div className="w-10 h-10 bg-green-500/10 text-green-600 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Upload size={20} />
                            </div>
                            <h3 className="font-bold text-lg mb-1">Restore Data</h3>
                            <p className="text-xs text-text-muted">Load data from a backup file.</p>
                            <input
                                id="global-restore"
                                type="file"
                                accept=".json"
                                className="hidden"
                                onChange={handleFullRestore}
                                ref={setFileInput}
                            />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default GlobalSettings;