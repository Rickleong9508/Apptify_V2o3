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
import { useAuth } from './AuthProvider';
import AuthModal from './AuthModal'; // New Import

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

    // --- Obsidian Integration State ---
    const [obsidianPath, setObsidianPath] = useState(() => localStorage.getItem('app_obsidian_vault_path') || '');
    const [obsidianStatus, setObsidianStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
    const [obsidianStatusMsg, setObsidianStatusMsg] = useState('');

    // --- Backup State ---
    const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null);

    // Persist AI Settings
    useEffect(() => { localStorage.setItem('app_global_ai_provider', aiProvider); }, [aiProvider]);
    useEffect(() => { localStorage.setItem('app_global_api_key', apiKey); }, [apiKey]);
    useEffect(() => { localStorage.setItem('app_global_ai_model', aiModel); }, [aiModel]);
    useEffect(() => { localStorage.setItem('app_obsidian_vault_path', obsidianPath); }, [obsidianPath]);

    const checkObsidianConnection = async () => {
        if (!obsidianPath.trim()) return;
        setObsidianStatus('checking');
        setObsidianStatusMsg('Verifying directory access...');
        try {
            const res = await fetch('/api/obsidian/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vaultPath: obsidianPath })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setObsidianStatus('success');
                setObsidianStatusMsg('Successfully connected to local Obsidian vault.');
            } else {
                throw new Error(data.error || 'Failed to verify folder.');
            }
        } catch (e: any) {
            setObsidianStatus('error');
            setObsidianStatusMsg(e.message || 'Verification failed. Make sure path is correct & writeable.');
        }
    };

    // Reset model defaults when provider changes
    useEffect(() => {
        const defaults: Record<string, string> = {
            'google': 'gemini-2.5-flash',
            'deepseek': 'deepseek-chat',
            'openrouter': 'anthropic/claude-3.7-sonnet'
        };
        // Only reset if the current model clearly doesn't belong to the new provider
        if (aiProvider === 'google' && !aiModel.startsWith('gemini-')) setAiModel(defaults['google']);
        if (aiProvider === 'deepseek' && !aiModel.startsWith('deepseek-')) setAiModel(defaults['deepseek']);
        if (aiProvider === 'openrouter' && !aiModel.includes('/')) setAiModel(defaults['openrouter']);
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

    const { session, user, signOut } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [confirmLogout, setConfirmLogout] = useState(false); // New state for inline confirmation

    return (
        <div className="min-h-screen bg-[#E0E5EC] text-gray-700 flex flex-col items-center p-6 animate-fade-in font-sans">
            <div className="max-w-3xl w-full space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between animate-fade-in-down">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onExit}
                            className="p-3 rounded-full transition-all active:scale-95 text-gray-600 hover:text-blue-500"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                            }}
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-700">Global Settings</h1>
                            <p className="text-gray-500 font-medium">Configure AI & Data for all applications</p>
                        </div>
                    </div>
                </div>

                {/* Account Actions Section (New) */}
                <div
                    className="p-8 rounded-[32px] animate-scale-in opacity-0"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                        animationDelay: '50ms'
                    }}
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-red-500"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                            }}
                        >
                            <Key size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-700">Account</h2>
                            <p className="text-sm text-gray-500 font-medium">Manage your session</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-2xl bg-[#E0E5EC]"
                        style={{ boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}>

                        {session ? (
                            <>
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-600">Logged in as</span>
                                    <span className="text-sm text-blue-500 font-mono">{user?.email}</span>
                                </div>
                                <button
                                    onClick={() => {
                                        if (confirmLogout) {
                                            signOut();
                                            setConfirmLogout(false);
                                        } else {
                                            setConfirmLogout(true);
                                            // Auto-reset after 3 seconds if not confirmed
                                            setTimeout(() => setConfirmLogout(false), 3000);
                                        }
                                    }}
                                    className={`px-6 py-3 rounded-xl font-bold text-sm text-white transition-all shadow-lg active:scale-95 flex items-center gap-2 ${confirmLogout ? 'bg-red-600 animate-pulse' : 'bg-red-500 hover:bg-red-600'}`}
                                >
                                    {confirmLogout ? "Confirm?" : "Log Out"}
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-600">Not Logged In</span>
                                    <span className="text-sm text-gray-400">Sign in to sync your data</span>
                                </div>
                                <button
                                    onClick={() => setShowAuthModal(true)}
                                    className="px-6 py-3 rounded-xl font-bold text-sm text-white bg-blue-500 hover:bg-blue-600 transition-all shadow-lg active:scale-95 flex items-center gap-2"
                                >
                                    Sign In
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* AI Configuration Card */}
                <div
                    className="p-8 rounded-[32px] animate-scale-in opacity-0"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                        animationDelay: '100ms'
                    }}
                >
                    <div className="flex items-center gap-3 mb-8">
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-purple-600"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                            }}
                        >
                            <BrainCircuit size={24} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-700">AI Intelligence</h2>
                    </div>

                    {/* Provider Select */}
                    <div className="mb-8">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 block pl-2">Service Provider</label>
                        <div className="grid grid-cols-3 gap-4">
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
                                    className={`py-4 px-2 rounded-2xl text-sm font-bold transition-all ${aiProvider === p.id ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'}`}
                                    style={{
                                        background: "#E0E5EC",
                                        boxShadow: aiProvider === p.id
                                            ? "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                            : "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                    }}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        <div
                            className="mt-4 p-4 rounded-2xl text-xs font-medium text-gray-500"
                            style={{
                                boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff"
                            }}
                        >
                            {aiProvider === 'google' && <p>✅ <b>Recommended:</b> Native support for Gemini. Fast & Reliable.</p>}
                            {aiProvider === 'deepseek' && <p>✅ <b>Optimized:</b> Requests are routed through local proxy to bypass CORS.</p>}
                            {aiProvider === 'openrouter' && <p>✅ <b>Best Compatibility:</b> Access DeepSeek, Claude, and Llama.</p>}
                        </div>
                    </div>

                    {/* API Key */}
                    <div className="mb-8">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 block pl-2">
                            {aiProvider === 'google' ? 'Google AI Studio Key' : aiProvider === 'deepseek' ? 'DeepSeek API Key' : 'OpenRouter Key'}
                        </label>
                        <div className="flex gap-4">
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => {
                                    setApiKey(e.target.value);
                                    setCheckStatus('idle');
                                }}
                                placeholder={aiProvider === 'google' ? "AIzaSy..." : "sk-..."}
                                className="flex-1 p-4 rounded-2xl font-mono text-sm outline-none text-gray-700 bg-[#E0E5EC]"
                                style={{
                                    boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                }}
                            />
                            <button
                                onClick={checkConnection}
                                disabled={!apiKey || checkStatus === 'checking'}
                                className={`px-6 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 active:scale-95 ${checkStatus === 'success' ? 'text-green-500' : checkStatus === 'error' ? 'text-red-500' : 'text-gray-600'}`}
                                style={{
                                    background: "#E0E5EC",
                                    boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                }}
                            >
                                {checkStatus === 'checking' ? <Activity className="animate-spin" size={18} /> :
                                    checkStatus === 'success' ? <Check size={18} /> :
                                        checkStatus === 'error' ? <AlertCircle size={18} /> :
                                            "Check"}
                            </button>
                        </div>
                        {statusMsg && (
                            <p className={`text-xs font-bold mt-3 pl-2 ${checkStatus === 'success' ? 'text-green-600' : checkStatus === 'error' ? 'text-red-600' : 'text-gray-400'}`}>
                                {statusMsg}
                            </p>
                        )}
                    </div>

                    {/* Model Select */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 block pl-2">Model Selection</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            {/* Google Options */}
                            {aiProvider === 'google' && (
                                <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Recommended: Default fast & efficient', icon: Zap, color: 'text-yellow-500' },
                                        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Best for complex analysis & coding', icon: BrainCircuit, color: 'text-purple-500' },
                                        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', desc: 'Next-gen low latency speed', icon: Zap, color: 'text-orange-500' },
                                        { id: 'gemini-2.0-flash-thinking-exp-01-21', name: 'Gemini 2.0 Flash Thinking', desc: 'Thinking model for step-by-step analysis', icon: BrainCircuit, color: 'text-blue-500' },
                                        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', desc: 'Legacy production model', icon: BrainCircuit, color: 'text-gray-500' },
                                        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', desc: 'Legacy lightweight model', icon: Zap, color: 'text-gray-400' }
                                    ].map((m) => (
                                        <div
                                            key={m.id}
                                            onClick={() => setAiModel(m.id)}
                                            className={`p-5 rounded-2xl cursor-pointer transition-all active:scale-95 group ${aiModel === m.id ? 'text-purple-600' : 'text-gray-600'}`}
                                            style={{
                                                background: "#E0E5EC",
                                                boxShadow: aiModel === m.id
                                                    ? "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                                    : "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                                            }}
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-sm">{m.name}</span>
                                                {aiModel === m.id && <CheckCircle2 size={16} />}
                                            </div>
                                            <div className="text-xs text-gray-400 flex items-center gap-1">
                                                <m.icon size={10} className={m.color} /> {m.desc}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* DeepSeek Options */}
                            {aiProvider === 'deepseek' && (
                                <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { id: 'deepseek-v4-flash', name: 'DeepSeek v4 Flash', desc: 'Next-gen ultra-fast inference' },
                                        { id: 'deepseek-v4-pro', name: 'DeepSeek v4 Pro', desc: 'Next-gen flagship pro capabilities' },
                                        { id: 'deepseek-chat', name: 'DeepSeek V3 (Chat)', desc: 'Standard high-performance model' },
                                        { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoner)', desc: 'Specialized in logic & reasoning' }
                                    ].map((m) => (
                                        <div
                                            key={m.id}
                                            onClick={() => setAiModel(m.id)}
                                            className={`p-5 rounded-2xl cursor-pointer transition-all active:scale-95 group ${aiModel === m.id ? 'text-purple-600' : 'text-gray-600'}`}
                                            style={{
                                                background: "#E0E5EC",
                                                boxShadow: aiModel === m.id
                                                    ? "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                                    : "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                                            }}
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-sm">{m.name}</span>
                                                {aiModel === m.id && <CheckCircle2 size={16} />}
                                            </div>
                                            <div className="text-xs text-gray-400">{m.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* OpenRouter Options */}
                            {aiProvider === 'openrouter' && (
                                <div className="col-span-full space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {[
                                            { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek v4 Pro', provider: 'DeepSeek' },
                                            { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek v4 Flash', provider: 'DeepSeek' },
                                            { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', provider: 'Anthropic' },
                                            { id: 'anthropic/claude-3.7-sonnet:thinking', name: 'Claude 3.7 Sonnet (Thinking)', provider: 'Anthropic' },
                                            { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
                                            { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek' },
                                            { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)', provider: 'DeepSeek' },
                                            { id: 'deepseek/deepseek-v3', name: 'DeepSeek V3', provider: 'DeepSeek' },
                                            { id: 'deepseek/deepseek-v3:free', name: 'DeepSeek V3 (Free)', provider: 'DeepSeek' },
                                            { id: 'openai/o3-mini', name: 'OpenAI o3-mini', provider: 'OpenAI' },
                                            { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
                                            { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
                                            { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'Meta' },
                                            { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google' },
                                            { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google' }
                                        ].map(m => (
                                            <div
                                                key={m.id}
                                                onClick={() => setAiModel(m.id)}
                                                className={`p-4 rounded-2xl cursor-pointer transition-all active:scale-95 ${aiModel === m.id ? 'text-purple-600' : 'text-gray-600 hover:text-gray-800'}`}
                                                style={{
                                                    background: "#E0E5EC",
                                                    boxShadow: aiModel === m.id
                                                        ? "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                                        : "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                                }}
                                            >
                                                <div>
                                                    <div className="font-bold text-sm flex items-center justify-between">
                                                        {m.name}
                                                        {aiModel === m.id && <CheckCircle2 size={16} />}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 font-medium">{m.provider}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <MessageSquare size={16} className="text-gray-400" />
                                        </div>
                                        <input
                                            className="w-full pl-10 p-4 rounded-2xl text-sm outline-none text-gray-700 bg-[#E0E5EC]"
                                            placeholder="Or enter custom Model ID (e.g. mistralai/mistral-large-latest)"
                                            value={aiModel}
                                            onChange={e => setAiModel(e.target.value)}
                                            style={{
                                                boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                            }}
                                        />
                                        <p className="text-[10px] text-gray-400 font-bold mt-2 ml-2 tracking-wide">
                                            Copy ID from <a href="https://openrouter.ai/models" target="_blank" className="text-blue-500 underline decoration-blue-500/30">openrouter.ai/models</a>
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Obsidian Vault Integration Card */}
                <div
                    className="p-8 rounded-[32px] animate-scale-in opacity-0"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                        animationDelay: '150ms'
                    }}
                >
                    <div className="flex items-center gap-3 mb-8">
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-emerald-600"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                            }}
                        >
                            <HardDrive size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-700">Obsidian Knowledge Vault</h2>
                            <p className="text-sm text-gray-500 font-medium">Connect your local Obsidian Vault folder</p>
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 block pl-2">
                            Obsidian Vault Path (Absolute Path)
                        </label>
                        <div className="flex gap-4">
                            <input
                                type="text"
                                value={obsidianPath}
                                onChange={(e) => {
                                    setObsidianPath(e.target.value);
                                    setObsidianStatus('idle');
                                    setObsidianStatusMsg('');
                                }}
                                placeholder="/Users/username/Obsidian/MyVault"
                                className="flex-1 p-4 rounded-2xl text-sm outline-none text-gray-700 bg-[#E0E5EC]"
                                style={{
                                    boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                }}
                            />
                            <button
                                onClick={checkObsidianConnection}
                                disabled={!obsidianPath || obsidianStatus === 'checking'}
                                className={`px-6 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 active:scale-95 ${
                                    obsidianStatus === 'success' ? 'text-green-500' : obsidianStatus === 'error' ? 'text-red-500' : 'text-gray-600'
                                }`}
                                style={{
                                    background: "#E0E5EC",
                                    boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                }}
                            >
                                {obsidianStatus === 'checking' ? <Activity className="animate-spin" size={18} /> :
                                    obsidianStatus === 'success' ? <Check size={18} /> :
                                        obsidianStatus === 'error' ? <AlertCircle size={18} /> :
                                            "Verify"}
                            </button>
                        </div>
                        {obsidianStatusMsg && (
                            <p className={`text-xs font-bold mt-3 pl-2 ${
                                obsidianStatus === 'success' ? 'text-green-600' : obsidianStatus === 'error' ? 'text-red-600' : 'text-gray-400'
                            }`}>
                                {obsidianStatusMsg}
                            </p>
                        )}
                        <p className="text-[10px] text-gray-400 font-bold mt-2 ml-2 tracking-wide leading-relaxed">
                            💡 Enter the absolute folder path to your local Obsidian vault directory. The Apptify server will read/write markdown notes directly in this folder. Leaves blank to fallback to internal Supabase storage.
                        </p>
                    </div>
                </div>

                {/* Backup Card */}
                <div
                    className="p-8 rounded-[32px] animate-fade-in-up opacity-0"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                        animationDelay: '200ms'
                    }}
                >
                    <div className="flex items-center gap-3 mb-8">
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-blue-600"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                            }}
                        >
                            <Database size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-700">Data Management</h2>
                            <p className="text-sm text-gray-500 font-medium">Backup applies to MyWealth, GetNote & Settings</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button
                            onClick={handleFullBackup}
                            className="p-6 rounded-[24px] transition-all active:scale-95 group text-left relative overflow-hidden text-gray-600 hover:text-blue-600"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                            }}
                        >
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:-translate-y-1 text-gray-500 group-hover:text-blue-500"
                                style={{
                                    background: "#E0E5EC",
                                    boxShadow: "inset 4px 4px 8px #b8b9be, inset -4px -4px 8px #ffffff"
                                }}
                            >
                                <Download size={22} />
                            </div>
                            <h3 className="font-bold text-xl mb-1">Export Backup</h3>
                            <p className="text-xs text-gray-400 font-medium">Save all app data to a single JSON.</p>
                        </button>

                        <button
                            onClick={() => document.getElementById('global-restore')?.click()}
                            className="p-6 rounded-[24px] transition-all active:scale-95 group text-left relative overflow-hidden text-gray-600 hover:text-blue-600"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                            }}
                        >
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:-translate-y-1 text-gray-500 group-hover:text-blue-500"
                                style={{
                                    background: "#E0E5EC",
                                    boxShadow: "inset 4px 4px 8px #b8b9be, inset -4px -4px 8px #ffffff"
                                }}
                            >
                                <Upload size={22} />
                            </div>
                            <h3 className="font-bold text-xl mb-1">Restore Data</h3>
                            <p className="text-xs text-gray-400 font-medium">Restore from a backup file.</p>
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
            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
        </div>
    );
};

export default GlobalSettings;