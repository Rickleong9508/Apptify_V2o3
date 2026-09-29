import React, { useState, useEffect } from 'react';
import {
    ArrowLeft,
    ChevronLeft,
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
    Info,
    Sun,
    Moon
} from 'lucide-react';
import { aiService, AIProvider, ModelMetadata } from '../services/aiService';
import { useAuth } from './AuthProvider';
import AuthModal from './AuthModal';
import { Language, translations, getStoredLanguage, setStoredLanguage } from '../utils/i18n';

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

    // --- Language & Theme State ---
    const [currentLang, setCurrentLang] = useState<Language>(getStoredLanguage);
    const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'auto'>(() => {
        const manual = localStorage.getItem('mw_theme_manual');
        if (!manual) return 'auto';
        return (localStorage.getItem('mw_theme') as 'light' | 'dark') || 'light';
    });

    useEffect(() => {
        const handleLang = () => setCurrentLang(getStoredLanguage());
        window.addEventListener('apptify_language_change', handleLang);
        return () => window.removeEventListener('apptify_language_change', handleLang);
    }, []);

    const handleLanguageChange = (newLang: Language) => {
        setCurrentLang(newLang);
        setStoredLanguage(newLang);
    };

    const handleThemeChange = (mode: 'light' | 'dark' | 'auto') => {
        setThemeMode(mode);
        if (mode === 'auto') {
            localStorage.removeItem('mw_theme_manual');
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            const target = prefersDark ? 'dark' : 'light';
            localStorage.setItem('mw_theme', target);
            const root = window.document.documentElement;
            const body = window.document.body;
            if (target === 'dark') {
                root.classList.add('dark');
                root.classList.remove('light');
                body?.classList.add('dark');
                body?.classList.remove('light');
            } else {
                root.classList.remove('dark');
                root.classList.add('light');
                body?.classList.remove('dark');
                body?.classList.add('light');
            }
        } else {
            localStorage.setItem('mw_theme_manual', 'true');
            localStorage.setItem('mw_theme', mode);
            const root = window.document.documentElement;
            const body = window.document.body;
            if (mode === 'dark') {
                root.classList.add('dark');
                root.classList.remove('light');
                body?.classList.add('dark');
                body?.classList.remove('light');
            } else {
                root.classList.remove('dark');
                root.classList.add('light');
                body?.classList.remove('dark');
                body?.classList.add('light');
            }
        }
        window.dispatchEvent(new Event('apptify_theme_change'));
    };

    // --- Backup State ---
    const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null);

    // Save keys per provider and sync active settings to local storage
    useEffect(() => {
        localStorage.setItem('app_global_ai_provider', aiProvider);
        const currentKey = apiKeys[aiProvider] || '';
        localStorage.setItem('app_global_api_key', currentKey);
        window.dispatchEvent(new Event('apptify_settings_change'));
    }, [aiProvider, apiKeys]);

    useEffect(() => {
        localStorage.setItem('app_global_ai_model', aiModel);
        if (aiModel && !recentModels.includes(aiModel)) {
            const updated = [aiModel, ...recentModels.slice(0, 4)];
            setRecentModels(updated);
            localStorage.setItem('app_ai_recent', JSON.stringify(updated));
        }
        window.dispatchEvent(new Event('apptify_settings_change'));
    }, [aiModel]);

    useEffect(() => {
        localStorage.setItem('app_ai_favorites', JSON.stringify(favorites));
        window.dispatchEvent(new Event('apptify_settings_change'));
    }, [favorites]);

    useEffect(() => {
        localStorage.setItem('app_obsidian_vault_path', obsidianPath);
    }, [obsidianPath]);

    // Load models for SiliconFlow
    const loadSiliconFlowModels = async (keyToUse = apiKeys.siliconflow, forceRefresh = false) => {
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
            if (!keyToUse) {
                setIsLoadingModels(false);
                return;
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
        if (aiProvider === 'siliconflow') {
            loadSiliconFlowModels(apiKeys.siliconflow, false);
        }
    }, [aiProvider, apiKeys.siliconflow]);

    // Reset model defaults when provider changes
    useEffect(() => {
        const defaults: Record<string, string> = {
            'google': 'gemini-2.5-flash',
            'deepseek': 'deepseek-flash',
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

            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                throw new Error('Obsidian folders can only be accessed when running Apptify locally. Please open http://localhost:3001 on your MacBook.');
            }
            
            const data = await res.json();
            if (res.ok && data.success) {
                setObsidianStatus('success');
                setObsidianStatusMsg('Successfully connected to local Obsidian vault.');
            } else {
                throw new Error(data.error || 'Path verification failed');
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
                window.dispatchEvent(new Event('apptify_settings_change'));

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
        <div className="min-h-screen pb-24 text-[var(--ios-label-primary)] flex flex-col items-center px-6 pb-6 pt-0 animate-fade-in font-sans">
            <div className="max-w-4xl w-full space-y-6 pb-20">
                {/* Header Back Button */}
                <div className="flex items-center justify-between pt-2">
                    <button
                        onClick={onExit}
                        className="flex items-center gap-1.5 text-blue-500 font-semibold text-sm tap-scale"
                    >
                        <ChevronLeft size={20} />
                        <span>Back to Launcher</span>
                    </button>
                    <span className="text-xs font-semibold text-[var(--ios-label-secondary)]">Apptify System Settings</span>
                </div>

                {/* Account Actions Section */}
                <div
                    className="ios-card p-6 sm:p-8 animate-scale-in"
                    style={{
                        background: "var(--ios-card-bg)",
                        boxShadow: "var(--ios-card-shadow)"
                    }}
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-red-500"
                            style={{
                                background: "var(--ios-card-bg)",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
                            }}
                        >
                            <Key size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-700">Account</h2>
                            <p className="text-sm text-gray-500 font-medium">Manage your session</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--ios-card-bg)]"
                        style={{ boxShadow: "none" }}>

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

                {/* Preferences & Appearance Card */}
                <div
                    className="ios-card p-6 sm:p-8 animate-scale-in"
                    style={{
                        background: "var(--ios-card-bg)",
                        boxShadow: "var(--ios-card-shadow)"
                    }}
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-blue-500"
                            style={{
                                background: "var(--ios-card-bg)",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
                            }}
                        >
                            <Globe size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                                {currentLang === 'zh' ? '偏好与外观' : 'Preferences & Display'}
                            </h2>
                            <p className="text-sm text-gray-500 font-medium">
                                {currentLang === 'zh' ? '多语言切换与系统主题自适应' : 'Language & system adaptive theme'}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Language Selection */}
                        <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 space-y-2">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                                {currentLang === 'zh' ? '应用显示语言' : 'App Display Language'}
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => handleLanguageChange('en')}
                                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                        currentLang === 'en'
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                            : 'bg-white/70 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/20'
                                    }`}
                                >
                                    <span>English (EN)</span>
                                    {currentLang === 'en' && <Check size={14} />}
                                </button>
                                <button
                                    onClick={() => handleLanguageChange('zh')}
                                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                        currentLang === 'zh'
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                            : 'bg-white/70 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/20'
                                    }`}
                                >
                                    <span>中文 (ZH)</span>
                                    {currentLang === 'zh' && <Check size={14} />}
                                </button>
                            </div>
                        </div>

                        {/* Theme Selection */}
                        <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 space-y-2">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                                {currentLang === 'zh' ? '外观主题' : 'Appearance Theme'}
                            </span>
                            <div className="grid grid-cols-3 gap-1.5">
                                <button
                                    onClick={() => handleThemeChange('auto')}
                                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                                        themeMode === 'auto'
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                            : 'bg-white/70 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/20'
                                    }`}
                                >
                                    <span>{currentLang === 'zh' ? '系统跟随' : 'Auto'}</span>
                                </button>
                                <button
                                    onClick={() => handleThemeChange('light')}
                                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                                        themeMode === 'light'
                                            ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                                            : 'bg-white/70 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/20'
                                    }`}
                                >
                                    <Sun size={13} />
                                    <span>{currentLang === 'zh' ? '浅色' : 'Light'}</span>
                                </button>
                                <button
                                    onClick={() => handleThemeChange('dark')}
                                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                                        themeMode === 'dark'
                                            ? 'bg-indigo-900 text-white shadow-md shadow-indigo-900/30'
                                            : 'bg-white/70 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/20'
                                    }`}
                                >
                                    <Moon size={13} />
                                    <span>{currentLang === 'zh' ? '深色' : 'Dark'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* AI Configuration Card */}
                <div
                    className="ios-card p-6 sm:p-8 animate-scale-in"
                    style={{
                        background: "var(--ios-card-bg)",
                        boxShadow: "var(--ios-card-shadow)"
                    }}
                >
                    <div className="flex items-center gap-3 mb-8">
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-purple-600"
                            style={{
                                background: "var(--ios-card-bg)",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
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
                                        background: "var(--ios-card-bg)",
                                        boxShadow: aiProvider === p.id
                                            ? "none"
                                            : "0 2px 8px rgba(0,0,0,0.06)"
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
                                className="flex-1 p-4 rounded-2xl font-mono text-sm outline-none text-gray-700 bg-[var(--ios-card-bg)]"
                                style={{
                                    boxShadow: "none"
                                }}
                            />
                            <button
                                onClick={checkConnection}
                                disabled={!apiKeys[aiProvider] || checkStatus === 'checking'}
                                className={`px-6 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 active:scale-95 ${checkStatus === 'success' ? 'text-green-500' : checkStatus === 'error' ? 'text-red-500' : 'text-gray-600'}`}
                                style={{
                                    background: "var(--ios-card-bg)",
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
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

                    {/* Unified Model Selection Block */}
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-4 pl-2 pr-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Model Selection</label>
                            {aiProvider === 'siliconflow' && (
                                <button
                                    onClick={() => loadSiliconFlowModels(apiKeys.siliconflow, true)}
                                    disabled={isLoadingModels || !apiKeys.siliconflow}
                                    className="px-3.5 py-1.5 rounded-xl text-[10px] font-extrabold bg-[var(--ios-card-bg)] hover:text-purple-600 transition flex items-center gap-1.5 active:scale-95"
                                    style={{
                                        boxShadow: "0 2px 6px rgba(0,0,0,0.05)"
                                    }}
                                >
                                    <RefreshCw size={10} className={isLoadingModels ? 'animate-spin' : ''} />
                                    Sync Catalog
                                </button>
                            )}
                        </div>

                        {aiProvider !== 'siliconflow' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {aiProvider === 'google' && [
                                    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Recommended: Default fast & efficient' },
                                    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Best for complex analysis & reasoning' },
                                    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', desc: 'Low latency speed and multimodal features' },
                                    { id: 'gemini-2.0-flash-thinking-exp-01-21', name: 'Gemini 2.0 Flash Thinking', desc: 'Thinking model for step-by-step logic' },
                                    { id: 'gemini-2.0-pro-exp-02-05', name: 'Gemini 2.0 Pro (Exp)', desc: 'Next-gen experimental Pro model for complex logic' },
                                    { id: 'gemini-2.0-flash-lite-preview-02-05', name: 'Gemini 2.0 Flash Lite', desc: 'Next-gen lightweight, cost-effective multimodal' }
                                ].map((m) => (
                                    <div
                                        key={m.id}
                                        onClick={() => setAiModel(m.id)}
                                        className={`p-5 rounded-2xl cursor-pointer transition-all active:scale-95 group ${aiModel === m.id ? 'text-purple-600 font-bold' : 'text-gray-600'}`}
                                        style={{
                                            background: "var(--ios-card-bg)",
                                            boxShadow: aiModel === m.id
                                                ? "none"
                                                : "var(--ios-card-shadow)"
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
                                    { id: 'deepseek-flash', name: 'DeepSeek-V4 Flash (推荐)', desc: '新一代极速首选：1M 超长上下文，超低延迟与使用成本，支持深度思考' },
                                    { id: 'deepseek-v4-pro', name: 'DeepSeek-V4 Pro (深度推理)', desc: '旗舰深度推理：1M 超长上下文，顶级数学/代码与复杂自主思考' },
                                    { id: 'deepseek-chat', name: 'DeepSeek V3 (Chat)', desc: '经典旗舰通用模型 (DeepSeek-V3 兼容别名)' },
                                    { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoner)', desc: '经典链式思考深度推理 (DeepSeek-R1 兼容别名)' }
                                ].map((m) => (
                                    <div
                                        key={m.id}
                                        onClick={() => setAiModel(m.id)}
                                        className={`p-5 rounded-2xl cursor-pointer transition-all active:scale-95 group ${aiModel === m.id ? 'text-purple-600 font-bold' : 'text-gray-600'}`}
                                        style={{
                                            background: "var(--ios-card-bg)",
                                            boxShadow: aiModel === m.id
                                                ? "none"
                                                : "var(--ios-card-shadow)"
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
                                            background: "var(--ios-card-bg)",
                                            boxShadow: aiModel === m.id
                                                ? "none"
                                                : "var(--ios-card-shadow)"
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
                                            background: "var(--ios-card-bg)",
                                            boxShadow: aiModel === m.id
                                                ? "none"
                                                : "var(--ios-card-shadow)"
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
                                                { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek-V4 Pro', provider: 'DeepSeek' },
                                                { id: 'deepseek/deepseek-flash', name: 'DeepSeek-V4 Flash', provider: 'DeepSeek' },
                                                { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek' },
                                                { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', provider: 'DeepSeek' },
                                                { id: 'deepseek/deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Llama-70B', provider: 'DeepSeek' },
                                                { id: 'deepseek/deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 Qwen-32B', provider: 'DeepSeek' },
                                                { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', provider: 'Anthropic' },
                                                { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
                                                { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
                                                { id: 'qwen/qwq-32b', name: 'Qwen QwQ 32B (Reasoning)', provider: 'Alibaba' },
                                                { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', provider: 'Alibaba' },
                                                { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', provider: 'Alibaba' },
                                                { id: 'moonshot/moonshot-v1-128k', name: 'Moonshot Kimi V1 128K', provider: 'Moonshot' }
                                            ].map(m => (
                                                <div
                                                    key={m.id}
                                                    onClick={() => setAiModel(m.id)}
                                                    className={`p-4 rounded-2xl cursor-pointer transition-all active:scale-95 ${aiModel === m.id ? 'text-purple-600 font-bold' : 'text-gray-600'}`}
                                                    style={{
                                                        background: "var(--ios-card-bg)",
                                                        boxShadow: aiModel === m.id
                                                            ? "none"
                                                            : "0 2px 8px rgba(0,0,0,0.06)"
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
                                                className="w-full p-4 rounded-2xl text-sm outline-none text-gray-700 bg-[var(--ios-card-bg)]"
                                                placeholder="Or enter custom OpenRouter model ID"
                                                value={aiModel}
                                                onChange={e => setAiModel(e.target.value)}
                                                style={{
                                                    boxShadow: "none"
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Search & Filters Panel */}
                                <div className="space-y-4">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            placeholder="Search by Model Name, Provider, Capability (e.g. qwen, deepseek, flux)..."
                                            className="w-full pl-12 pr-4 py-4 rounded-2xl text-sm outline-none text-gray-700 bg-[var(--ios-card-bg)]"
                                            style={{
                                                boxShadow: "none"
                                            }}
                                        />
                                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    </div>

                                    {/* Filter Controls */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-[var(--ios-card-bg)]"
                                         style={{ boxShadow: "none" }}>
                                        
                                        {/* Capability Filter */}
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 mb-2 block">Capability</label>
                                            <select
                                                value={selectedCapability}
                                                onChange={e => setSelectedCapability(e.target.value)}
                                                className="w-full p-2.5 rounded-xl text-xs bg-[var(--ios-card-bg)] outline-none text-gray-600 border border-gray-300/40"
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
                                                className="w-full p-2.5 rounded-xl text-xs bg-[var(--ios-card-bg)] outline-none text-gray-600 border border-gray-300/40"
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
                                                className="w-full p-2.5 rounded-xl text-xs bg-[var(--ios-card-bg)] outline-none text-gray-600 border border-gray-300/40"
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

                                {modelError && (
                                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-sm flex items-center gap-2">
                                        <AlertCircle size={16} />
                                        {modelError}
                                    </div>
                                )}

                                {/* Active Model Indicator */}
                                <div className="px-4 py-3 rounded-2xl bg-[var(--ios-card-bg)] flex justify-between items-center text-xs font-bold"
                                     style={{ boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}>
                                    <span className="text-gray-400">Currently Active Model:</span>
                                    <span className="text-purple-600 font-mono">{aiModel || 'None Selected'}</span>
                                </div>

                                {/* Catalog Model List */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
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
                                                        background: "var(--ios-card-bg)",
                                                        boxShadow: isSelected
                                                            ? "none"
                                                            : "0 2px 8px rgba(0,0,0,0.06)"
                                                    }}
                                                >
                                                    <div>
                                                        <div className="flex justify-between items-start gap-2 mb-2">
                                                            <div className="flex-1">
                                                                <h4 className="text-sm font-extrabold text-gray-800 leading-tight break-all">
                                                                    {m.name}
                                                                </h4>
                                                                <p className="text-[10px] text-gray-400 font-mono mt-0.5 break-all">
                                                                    {m.id}
                                                                </p>
                                                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mt-1.5 inline-block">
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
                                                                isSelected ? 'bg-purple-600 text-white shadow-md' : 'bg-[var(--ios-card-bg)] text-gray-500 hover:text-purple-600'
                                                            }`}
                                                            style={!isSelected ? {
                                                                boxShadow: "0 2px 6px rgba(0,0,0,0.05)"
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
                </div>

                {/* Obsidian Vault Integration Card */}
                <div
                    className="ios-card p-6 sm:p-8 animate-scale-in"
                    style={{
                        background: "var(--ios-card-bg)",
                        boxShadow: "var(--ios-card-shadow)"
                    }}
                >
                    <div className="flex items-center gap-3 mb-8">
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-emerald-600"
                            style={{
                                background: "var(--ios-card-bg)",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
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
                                className="flex-1 p-4 rounded-2xl text-sm outline-none text-gray-700 bg-[var(--ios-card-bg)]"
                                style={{
                                    boxShadow: "none"
                                }}
                            />
                            <button
                                onClick={checkObsidianConnection}
                                disabled={!obsidianPath || obsidianStatus === 'checking'}
                                className={`px-6 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 active:scale-95 ${
                                    obsidianStatus === 'success' ? 'text-green-500' : obsidianStatus === 'error' ? 'text-red-500' : 'text-gray-600'
                                }`}
                                style={{
                                    background: "var(--ios-card-bg)",
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
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
                    className="ios-card p-6 sm:p-8 animate-scale-in"
                    style={{
                        background: "var(--ios-card-bg)",
                        boxShadow: "var(--ios-card-shadow)"
                    }}
                >
                    <div className="flex items-center gap-3 mb-8">
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-blue-600"
                            style={{
                                background: "var(--ios-card-bg)",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
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
                                background: "var(--ios-card-bg)",
                                boxShadow: "var(--ios-card-shadow)"
                            }}
                        >
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:-translate-y-1 text-gray-500 group-hover:text-blue-500"
                                style={{
                                    background: "var(--ios-card-bg)",
                                    boxShadow: "none"
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
                                background: "var(--ios-card-bg)",
                                boxShadow: "var(--ios-card-shadow)"
                            }}
                        >
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:-translate-y-1 text-gray-500 group-hover:text-blue-500"
                                style={{
                                    background: "var(--ios-card-bg)",
                                    boxShadow: "none"
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