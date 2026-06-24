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
    MessageSquare,
    Star,
    RefreshCw,
    Search,
    Sliders,
    Info
} from 'lucide-react';
import { aiService, AIProvider, ModelMetadata } from '../services/aiService';
import { useAuth } from './AuthProvider';
import AuthModal from './AuthModal';

interface GlobalSettingsProps {
    onExit: () => void;
}

const GlobalSettings: React.FC<GlobalSettingsProps> = ({ onExit }) => {
    // --- AI Provider & Key State ---
    const [aiProvider, setAiProvider] = useState<AIProvider>(() => (localStorage.getItem('app_global_ai_provider') as AIProvider) || 'google');
    
    const [apiKeys, setApiKeys] = useState<Record<string, string>>(() => {
        return {
            google: localStorage.getItem('app_api_key_google') || localStorage.getItem('app_global_api_key') || '',
            deepseek: localStorage.getItem('app_api_key_deepseek') || '',
            openai: localStorage.getItem('app_api_key_openai') || '',
            anthropic: localStorage.getItem('app_api_key_anthropic') || '',
            siliconflow: localStorage.getItem('app_api_key_siliconflow') || '',
            openrouter: localStorage.getItem('app_api_key_openrouter') || ''
        };
    });

    const [aiModel, setAiModel] = useState(() => localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash');

    // Connection Check State
    const [checkStatus, setCheckStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
    const [statusMsg, setStatusMsg] = useState('');

    // --- SiliconFlow Model Hub Catalog State ---
    const [siliconFlowModels, setSiliconFlowModels] = useState<ModelMetadata[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [modelError, setModelError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Filters
    const [selectedCapability, setSelectedCapability] = useState<string>('all');
    const [selectedSubProvider, setSelectedSubProvider] = useState<string>('all');
    const [selectedContextLength, setSelectedContextLength] = useState<string>('all');

    // Favorites & Recent
    const [favorites, setFavorites] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('app_ai_favorites') || '[]');
        } catch (e) {
            return [];
        }
    });

    const [recentModels, setRecentModels] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('app_ai_recent') || '[]');
        } catch (e) {
            return [];
        }
    });

    // --- Obsidian Integration State ---
    const [obsidianPath, setObsidianPath] = useState(() => localStorage.getItem('app_obsidian_vault_path') || '');
    const [obsidianStatus, setObsidianStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
    const [obsidianStatusMsg, setObsidianStatusMsg] = useState('');

    // --- Backup State ---
    const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null);

    // Save keys per provider and sync active settings to local storage
    useEffect(() => {
        localStorage.setItem('app_global_ai_provider', aiProvider);
        const currentKey = apiKeys[aiProvider] || '';
        localStorage.setItem('app_global_api_key', currentKey);
    }, [aiProvider, apiKeys]);

    useEffect(() => {
        localStorage.setItem('app_global_ai_model', aiModel);
        if (aiModel && !recentModels.includes(aiModel)) {
            const updated = [aiModel, ...recentModels.slice(0, 4)];
            setRecentModels(updated);
            localStorage.setItem('app_ai_recent', JSON.stringify(updated));
        }
    }, [aiModel]);

    useEffect(() => {
        localStorage.setItem('app_ai_favorites', JSON.stringify(favorites));
    }, [favorites]);

    useEffect(() => {
        localStorage.setItem('app_obsidian_vault_path', obsidianPath);
    }, [obsidianPath]);

    // Load models for SiliconFlow
    const loadSiliconFlowModels = async (keyToUse = apiKeys.siliconflow, forceRefresh = false) => {
        if (!keyToUse) return;
        setIsLoadingModels(true);
        setModelError('');
        try {
            if (!forceRefresh) {
                const cached = localStorage.getItem('app_siliconflow_models_cache');
                if (cached) {
                    setSiliconFlowModels(JSON.parse(cached));
                    setIsLoadingModels(false);
                    return;
                }
            }
            const models = await aiService.getModels('siliconflow', keyToUse);
            setSiliconFlowModels(models);
            localStorage.setItem('app_siliconflow_models_cache', JSON.stringify(models));
        } catch (e: any) {
            console.error("Error loading SiliconFlow models:", e);
            setModelError(e.message || "Failed to load SiliconFlow models. Please verify API key.");
        } finally {
            setIsLoadingModels(false);
        }
    };

    useEffect(() => {
        if (aiProvider === 'siliconflow' && apiKeys.siliconflow) {
            loadSiliconFlowModels(apiKeys.siliconflow, false);
        }
    }, [aiProvider]);

    // Reset model defaults when provider changes
    useEffect(() => {
        const defaults: Record<string, string> = {
            'google': 'gemini-2.5-flash',
            'deepseek': 'deepseek-chat',
            'openai': 'gpt-4o-mini',
            'anthropic': 'claude-3-5-sonnet-20241022',
            'siliconflow': 'deepseek-ai/DeepSeek-V3',
            'openrouter': 'anthropic/claude-3.7-sonnet'
        };
        const currentModel = localStorage.getItem('app_global_ai_model') || '';
        
        // Reset only if the current model doesn't belong to the selected provider
        let needsReset = false;
        if (aiProvider === 'google' && !currentModel.startsWith('gemini-')) needsReset = true;
        if (aiProvider === 'deepseek' && !currentModel.startsWith('deepseek-')) needsReset = true;
        if (aiProvider === 'openai' && !currentModel.startsWith('gpt-') && !currentModel.startsWith('o1') && !currentModel.startsWith('o3')) needsReset = true;
        if (aiProvider === 'anthropic' && !currentModel.startsWith('claude-')) needsReset = true;
        if (aiProvider === 'siliconflow' && !currentModel.includes('/')) needsReset = true;
        if (aiProvider === 'openrouter' && !currentModel.includes('/')) needsReset = true;

        if (needsReset) {
            setAiModel(defaults[aiProvider]);
        }
    }, [aiProvider]);

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

    const checkConnection = async () => {
        const activeKey = apiKeys[aiProvider];
        if (!activeKey) {
            setCheckStatus('error');
            setStatusMsg('API Key is missing');
            return;
        }

        setCheckStatus('checking');
        setStatusMsg('Testing API connection...');
        try {
            if (aiProvider === 'siliconflow') {
                const models = await aiService.getModels('siliconflow', activeKey);
                if (models.length === 0) throw new Error("No models retrieved.");
                setSiliconFlowModels(models);
                localStorage.setItem('app_siliconflow_models_cache', JSON.stringify(models));
                setCheckStatus('success');
                setStatusMsg(`Connected! Retrieved ${models.length} models.`);
            } else {
                const testModel = aiModel;
                await aiService.generate(aiProvider, testModel, activeKey, "Hi");
                setCheckStatus('success');
                setStatusMsg('Connected Successfully');
            }
        } catch (e: any) {
            setCheckStatus('error');
            setStatusMsg(e.message || "Connection Failed");
        }
        setTimeout(() => { if (checkStatus !== 'error') setCheckStatus('idle'); }, 4000);
    };

    const handleKeyChange = (val: string) => {
        const updated = { ...apiKeys, [aiProvider]: val };
        setApiKeys(updated);
        localStorage.setItem(`app_api_key_${aiProvider}`, val);
    };

    const toggleFavorite = (modelId: string) => {
        if (favorites.includes(modelId)) {
            setFavorites(favorites.filter(id => id !== modelId));
        } else {
            setFavorites([...favorites, modelId]);
        }
    };

    // Filter Logic for SiliconFlow Models
    const filteredModels = siliconFlowModels.filter(m => {
        const matchesSearch = m.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              m.provider.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesCapability = selectedCapability === 'all' || m.capabilities.includes(selectedCapability);
        const matchesProvider = selectedSubProvider === 'all' || m.provider.toLowerCase().includes(selectedSubProvider.toLowerCase());
        
        let matchesContext = true;
        if (selectedContextLength !== 'all') {
            const len = m.context_length;
            if (selectedContextLength === '32k') matchesContext = len >= 32768;
            else if (selectedContextLength === '128k') matchesContext = len >= 131072;
            else if (selectedContextLength === '256k') matchesContext = len >= 262144;
            else if (selectedContextLength === '1m') matchesContext = len >= 1048576;
        }

        return matchesSearch && matchesCapability && matchesProvider && matchesContext;
    });

    const sortedModels = [...filteredModels].sort((a, b) => {
        const aFav = favorites.includes(a.id) ? 1 : 0;
        const bFav = favorites.includes(b.id) ? 1 : 0;
        if (aFav !== bFav) return bFav - aFav; // Favorites first
        return a.id.localeCompare(b.id);
    });

    // --- Backup Functions ---
    const handleFullBackup = () => {
        const backupData = {
            meta: {
                version: 2,
                date: new Date().toISOString(),
                app: "Apptify Global"
            },
            data: {
                app_global_ai_provider: localStorage.getItem('app_global_ai_provider'),
                app_global_ai_model: localStorage.getItem('app_global_ai_model'),
                app_api_key_google: localStorage.getItem('app_api_key_google'),
                app_api_key_openai: localStorage.getItem('app_api_key_openai'),
                app_api_key_anthropic: localStorage.getItem('app_api_key_anthropic'),
                app_api_key_deepseek: localStorage.getItem('app_api_key_deepseek'),
                app_api_key_siliconflow: localStorage.getItem('app_api_key_siliconflow'),
                app_api_key_openrouter: localStorage.getItem('app_api_key_openrouter'),
                app_ai_favorites: localStorage.getItem('app_ai_favorites'),
                app_ai_recent: localStorage.getItem('app_ai_recent'),
                gn_notes: localStorage.getItem('gn_notes'),
                gn_todos: localStorage.getItem('gn_todos'),
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

                Object.keys(json.data).forEach(key => {
                    if (json.data[key] !== null) {
                        localStorage.setItem(key, json.data[key]);
                    }
                });

                // Reload local state
                setAiProvider((localStorage.getItem('app_global_ai_provider') as AIProvider) || 'google');
                setAiModel(localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash');
                setApiKeys({
                    google: localStorage.getItem('app_api_key_google') || '',
                    deepseek: localStorage.getItem('app_api_key_deepseek') || '',
                    openai: localStorage.getItem('app_api_key_openai') || '',
                    anthropic: localStorage.getItem('app_api_key_anthropic') || '',
                    siliconflow: localStorage.getItem('app_api_key_siliconflow') || '',
                    openrouter: localStorage.getItem('app_api_key_openrouter') || ''
                });
                setFavorites(JSON.parse(localStorage.getItem('app_ai_favorites') || '[]'));
                setRecentModels(JSON.parse(localStorage.getItem('app_ai_recent') || '[]'));

                alert("Restore Successful! Please restart applications to sync properly.");
            } catch (err) {
                alert("Failed to restore: Invalid file format.");
                console.error(err);
            }
            if (fileInput) fileInput.value = '';
        };
        reader.readAsText(file);
    };

    const { session, user, signOut } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [confirmLogout, setConfirmLogout] = useState(false);

    return (
        <div className="min-h-screen bg-[#E0E5EC] text-gray-700 flex flex-col items-center p-6 animate-fade-in font-sans">
            <div className="max-w-4xl w-full space-y-8 pb-20">
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

                {/* Account Actions Section */}
                <div
                    className="p-8 rounded-[32px] animate-scale-in"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
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
                    className="p-8 rounded-[32px] animate-scale-in"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
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
                        <h2 className="text-2xl font-bold text-gray-700">AI Intelligence Providers</h2>
                    </div>

                    {/* Provider Select Grid */}
                    <div className="mb-8">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 block pl-2">Select AI Provider</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {[
                                { id: 'google', label: 'Google Gemini' },
                                { id: 'openai', label: 'OpenAI' },
                                { id: 'anthropic', label: 'Anthropic Claude' },
                                { id: 'deepseek', label: 'DeepSeek' },
                                { id: 'siliconflow', label: 'SiliconFlow Model Hub' },
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
                    </div>

                    {/* API Key */}
                    <div className="mb-8">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 block pl-2">
                            {aiProvider === 'google' && 'Google AI Studio API Key'}
                            {aiProvider === 'openai' && 'OpenAI API Key'}
                            {aiProvider === 'anthropic' && 'Anthropic API Key'}
                            {aiProvider === 'deepseek' && 'DeepSeek API Key'}
                            {aiProvider === 'siliconflow' && 'SiliconFlow API Key'}
                            {aiProvider === 'openrouter' && 'OpenRouter API Key'}
                        </label>
                        <div className="flex gap-4">
                            <input
                                type="password"
                                value={apiKeys[aiProvider] || ''}
                                onChange={(e) => {
                                    handleKeyChange(e.target.value);
                                    setCheckStatus('idle');
                                }}
                                placeholder="sk-... / AIzaSy..."
                                className="flex-1 p-4 rounded-2xl font-mono text-sm outline-none text-gray-700 bg-[#E0E5EC]"
                                style={{
                                    boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                }}
                            />
                            <button
                                onClick={checkConnection}
                                disabled={!apiKeys[aiProvider] || checkStatus === 'checking'}
                                className={`px-6 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 active:scale-95 ${checkStatus === 'success' ? 'text-green-500' : checkStatus === 'error' ? 'text-red-500' : 'text-gray-600'}`}
                                style={{
                                    background: "#E0E5EC",
                                    boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                }}
                            >
                                {checkStatus === 'checking' ? <Activity className="animate-spin" size={18} /> :
                                    checkStatus === 'success' ? <Check size={18} /> :
                                        checkStatus === 'error' ? <AlertCircle size={18} /> :
                                            "Test Connection"}
                            </button>
                        </div>
                        {statusMsg && (
                            <p className={`text-xs font-bold mt-3 pl-2 ${checkStatus === 'success' ? 'text-green-600' : checkStatus === 'error' ? 'text-red-600' : 'text-gray-400'}`}>
                                {statusMsg}
                            </p>
                        )}
                    </div>

                    {/* Standard Providers model selector (Google, DeepSeek, OpenAI, Anthropic, OpenRouter) */}
                    {aiProvider !== 'siliconflow' && (
                        <div className="mb-4">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 block pl-2">Model Selection</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {aiProvider === 'google' && [
                                    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Recommended: Default fast & efficient' },
                                    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Best for complex analysis & reasoning' },
                                    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', desc: 'Low latency speed and multimodal features' },
                                    { id: 'gemini-2.0-flash-thinking-exp-01-21', name: 'Gemini 2.0 Flash Thinking', desc: 'Thinking model for step-by-step logic' }
                                ].map((m) => (
                                    <div
                                        key={m.id}
                                        onClick={() => setAiModel(m.id)}
                                        className={`p-5 rounded-2xl cursor-pointer transition-all active:scale-95 group ${aiModel === m.id ? 'text-purple-600 font-bold' : 'text-gray-600'}`}
                                        style={{
                                            background: "#E0E5EC",
                                            boxShadow: aiModel === m.id
                                                ? "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                                : "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                                        }}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-bold">{m.name}</span>
                                            {aiModel === m.id && <CheckCircle2 size={16} />}
                                        </div>
                                        <div className="text-xs text-gray-400">{m.desc}</div>
                                    </div>
                                ))}

                                {aiProvider === 'deepseek' && [
                                    { id: 'deepseek-chat', name: 'DeepSeek V3 (Chat)', desc: 'Standard high-performance chat model' },
                                    { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoner)', desc: 'Specialized in logic, math, and coding reasoning' }
                                ].map((m) => (
                                    <div
                                        key={m.id}
                                        onClick={() => setAiModel(m.id)}
                                        className={`p-5 rounded-2xl cursor-pointer transition-all active:scale-95 group ${aiModel === m.id ? 'text-purple-600 font-bold' : 'text-gray-600'}`}
                                        style={{
                                            background: "#E0E5EC",
                                            boxShadow: aiModel === m.id
                                                ? "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                                : "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                                        }}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-bold">{m.name}</span>
                                            {aiModel === m.id && <CheckCircle2 size={16} />}
                                        </div>
                                        <div className="text-xs text-gray-400">{m.desc}</div>
                                    </div>
                                ))}

                                {aiProvider === 'openai' && [
                                    { id: 'gpt-4o', name: 'GPT-4o', desc: 'Flagship multimodal chat model' },
                                    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', desc: 'Fast, lightweight multimodal model' },
                                    { id: 'o3-mini', name: 'o3-mini', desc: 'Reasoning model optimized for coding & logic' },
                                    { id: 'o1', name: 'o1', desc: 'Flagship reasoning model for complex tasks' }
                                ].map((m) => (
                                    <div
                                        key={m.id}
                                        onClick={() => setAiModel(m.id)}
                                        className={`p-5 rounded-2xl cursor-pointer transition-all active:scale-95 group ${aiModel === m.id ? 'text-purple-600 font-bold' : 'text-gray-600'}`}
                                        style={{
                                            background: "#E0E5EC",
                                            boxShadow: aiModel === m.id
                                                ? "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                                : "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                                        }}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-bold">{m.name}</span>
                                            {aiModel === m.id && <CheckCircle2 size={16} />}
                                        </div>
                                        <div className="text-xs text-gray-400">{m.desc}</div>
                                    </div>
                                ))}

                                {aiProvider === 'anthropic' && [
                                    { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', desc: 'State of the art model with hybrid reasoning' },
                                    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', desc: 'Highly intelligent model, programming wizard' },
                                    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', desc: 'Fast, cost-effective text intelligence' }
                                ].map((m) => (
                                    <div
                                        key={m.id}
                                        onClick={() => setAiModel(m.id)}
                                        className={`p-5 rounded-2xl cursor-pointer transition-all active:scale-95 group ${aiModel === m.id ? 'text-purple-600 font-bold' : 'text-gray-600'}`}
                                        style={{
                                            background: "#E0E5EC",
                                            boxShadow: aiModel === m.id
                                                ? "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                                : "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                                        }}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-bold">{m.name}</span>
                                            {aiModel === m.id && <CheckCircle2 size={16} />}
                                        </div>
                                        <div className="text-xs text-gray-400">{m.desc}</div>
                                    </div>
                                ))}

                                {aiProvider === 'openrouter' && (
                                    <div className="col-span-full space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {[
                                                { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek' },
                                                { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', provider: 'Anthropic' },
                                                { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' }
                                            ].map(m => (
                                                <div
                                                    key={m.id}
                                                    onClick={() => setAiModel(m.id)}
                                                    className={`p-4 rounded-2xl cursor-pointer transition-all active:scale-95 ${aiModel === m.id ? 'text-purple-600 font-bold' : 'text-gray-600'}`}
                                                    style={{
                                                        background: "#E0E5EC",
                                                        boxShadow: aiModel === m.id
                                                            ? "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                                            : "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                                    }}
                                                >
                                                    <div className="font-bold text-sm flex items-center justify-between">
                                                        {m.name}
                                                        {aiModel === m.id && <CheckCircle2 size={16} />}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400">{m.provider}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="relative">
                                            <input
                                                className="w-full p-4 rounded-2xl text-sm outline-none text-gray-700 bg-[#E0E5EC]"
                                                placeholder="Or enter custom OpenRouter model ID"
                                                value={aiModel}
                                                onChange={e => setAiModel(e.target.value)}
                                                style={{
                                                    boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* SiliconFlow Dynamic Model Hub */}
                    {aiProvider === 'siliconflow' && (
                        <div className="mt-8 border-t border-gray-300/40 pt-8">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-700 flex items-center gap-2">
                                        SiliconFlow Model Hub Catalog
                                        {isLoadingModels && <Activity className="animate-spin text-purple-500" size={16} />}
                                    </h3>
                                    <p className="text-xs text-gray-400">Discover and switch models dynamically from SiliconFlow API</p>
                                </div>
                                <button
                                    onClick={() => loadSiliconFlowModels(apiKeys.siliconflow, true)}
                                    disabled={isLoadingModels || !apiKeys.siliconflow}
                                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#E0E5EC] hover:text-purple-600 transition flex items-center gap-2 active:scale-95"
                                    style={{
                                        boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                    }}
                                >
                                    <RefreshCw size={12} className={isLoadingModels ? 'animate-spin' : ''} />
                                    Sync Models
                                </button>
                            </div>

                            {modelError && (
                                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-sm mb-6 flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    {modelError}
                                </div>
                            )}

                            {/* Search & Filters Panel */}
                            <div className="space-y-4 mb-6">
                                {/* Search Bar */}
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Search by Model Name, Provider, Capability (e.g. qwen, deepseek, flux)..."
                                        className="w-full pl-12 pr-4 py-4 rounded-2xl text-sm outline-none text-gray-700 bg-[#E0E5EC]"
                                        style={{
                                            boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                        }}
                                    />
                                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                </div>

                                {/* Filter Controls */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-[#E0E5EC]"
                                     style={{ boxShadow: "inset 4px 4px 8px #b8b9be, inset -4px -4px 8px #ffffff" }}>
                                    
                                    {/* Capability Filter */}
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 mb-2 block">Capability</label>
                                        <select
                                            value={selectedCapability}
                                            onChange={e => setSelectedCapability(e.target.value)}
                                            className="w-full p-2.5 rounded-xl text-xs bg-[#E0E5EC] outline-none text-gray-600 border border-gray-300/40"
                                        >
                                            <option value="all">All Capabilities</option>
                                            <option value="chat">General Chat</option>
                                            <option value="reasoning">Reasoning Models</option>
                                            <option value="coding">Coding Models</option>
                                            <option value="vision">Vision Models</option>
                                            <option value="image">Image Generation</option>
                                            <option value="video">Video Generation</option>
                                            <option value="audio">Audio Processing</option>
                                            <option value="embedding">Embeddings</option>
                                        </select>
                                    </div>

                                    {/* Sub-Provider Filter */}
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 mb-2 block">Sub-Provider</label>
                                        <select
                                            value={selectedSubProvider}
                                            onChange={e => setSelectedSubProvider(e.target.value)}
                                            className="w-full p-2.5 rounded-xl text-xs bg-[#E0E5EC] outline-none text-gray-600 border border-gray-300/40"
                                        >
                                            <option value="all">All Sub-Providers</option>
                                            <option value="deepseek">DeepSeek</option>
                                            <option value="qwen">Qwen / Alibaba</option>
                                            <option value="glm">GLM / THUDM</option>
                                            <option value="meta">Meta Llama</option>
                                            <option value="mistral">Mistral AI</option>
                                            <option value="kimi">Kimi / Moonshot</option>
                                        </select>
                                    </div>

                                    {/* Context Length Filter */}
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 mb-2 block">Context Size</label>
                                        <select
                                            value={selectedContextLength}
                                            onChange={e => setSelectedContextLength(e.target.value)}
                                            className="w-full p-2.5 rounded-xl text-xs bg-[#E0E5EC] outline-none text-gray-600 border border-gray-300/40"
                                        >
                                            <option value="all">Any Context Length</option>
                                            <option value="32k">32K+ Tokens</option>
                                            <option value="128k">128K+ Tokens</option>
                                            <option value="256k">256K+ Tokens</option>
                                            <option value="1m">1M+ Tokens</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Active Model Indicator */}
                            <div className="mb-4 px-4 py-3 rounded-2xl bg-[#E0E5EC] flex justify-between items-center text-xs font-bold"
                                 style={{ boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}>
                                <span className="text-gray-400">Currently Active Model:</span>
                                <span className="text-purple-600 font-mono">{aiModel || 'None Selected'}</span>
                            </div>

                            {/* Catalog Model List */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 no-scrollbar">
                                {sortedModels.length > 0 ? (
                                    sortedModels.map((m) => {
                                        const isSelected = aiModel === m.id;
                                        const isFav = favorites.includes(m.id);
                                        return (
                                            <div
                                                key={m.id}
                                                className={`p-5 rounded-2xl transition-all relative flex flex-col justify-between border ${
                                                    isSelected ? 'border-purple-300/60 shadow-clay-inner' : 'border-white/20'
                                                }`}
                                                style={{
                                                    background: "#E0E5EC",
                                                    boxShadow: isSelected
                                                        ? "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                                        : "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                                }}
                                            >
                                                {/* Card Header */}
                                                <div>
                                                    <div className="flex justify-between items-start gap-2 mb-2">
                                                        <div className="flex-1">
                                                            <h4 className="text-sm font-extrabold text-gray-800 leading-tight break-all">
                                                                {m.name}
                                                            </h4>
                                                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mt-1 inline-block">
                                                                {m.provider}
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleFavorite(m.id);
                                                            }}
                                                            className={`p-1.5 rounded-lg active:scale-95 transition-all text-amber-500`}
                                                        >
                                                            <Star size={16} fill={isFav ? "currentColor" : "none"} />
                                                        </button>
                                                    </div>

                                                    <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                                                        {m.description}
                                                    </p>
                                                </div>

                                                {/* Card Footer */}
                                                <div className="mt-4 pt-3 border-t border-gray-300/40 flex justify-between items-center">
                                                    <div className="space-y-1">
                                                        <span className="text-[9px] font-extrabold text-gray-400 uppercase block">Specs</span>
                                                        <div className="flex flex-wrap gap-1">
                                                            {m.context_length > 0 ? (
                                                                <span className="text-[9px] font-bold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                                                                    Context: {m.context_length >= 1048576 ? `${(m.context_length / 1048576).toFixed(0)}M` : `${(m.context_length / 1024).toFixed(0)}K`}
                                                                </span>
                                                            ) : null}
                                                            {m.capabilities.map(cap => (
                                                                <span key={cap} className="text-[9px] font-bold text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded uppercase">
                                                                    {cap}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={() => setAiModel(m.id)}
                                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                                                            isSelected ? 'bg-purple-600 text-white shadow-md' : 'bg-[#E0E5EC] text-gray-500 hover:text-purple-600'
                                                        }`}
                                                        style={!isSelected ? {
                                                            boxShadow: "3px 3px 6px #b8b9be, -3px -3px 6px #ffffff"
                                                        } : {}}
                                                    >
                                                        {isSelected ? 'Active' : 'Select'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="col-span-full py-8 text-center text-gray-400 text-sm">
                                        No models match your search/filter parameters.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Obsidian Vault Integration Card */}
                <div
                    className="p-8 rounded-[32px] animate-scale-in"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
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
                    className="p-8 rounded-[32px] animate-scale-in"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
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