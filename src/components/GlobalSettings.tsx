import React, { useState, useEffect } from 'react';
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
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
    Moon,
    Cloud
} from 'lucide-react';
import { aiService, AIProvider, ModelMetadata } from '../services/aiService';
import { useAuth } from './AuthProvider';
import AuthModal from './AuthModal';
import { Language, translations, getStoredLanguage, setStoredLanguage } from '../utils/i18n';

interface GlobalSettingsProps {
    onExit: () => void;
}

/**
 * Section header in the Ink & Signal language: a mono micro label over a
 * 15px section title, with an optional right-aligned micro note. Purely
 * presentational — it carries no state.
 */
const SectionHead: React.FC<{ label: string; title: string; meta?: string }> = ({ label, title, meta }) => (
    <div className="flex items-baseline justify-between gap-3 mb-3.5">
        <div className="min-w-0">
            <span className="signal-label block text-black/40 dark:text-white/40">{label}</span>
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] mt-1 text-[var(--ios-label-primary)]">{title}</h2>
        </div>
        {meta && <span className="signal-label text-black/40 dark:text-white/40 shrink-0">{meta}</span>}
    </div>
);

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

    const { isConnected, user, isSyncing, lastSyncedTime, syncNow, disconnectGoogleDrive } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [confirmLogout, setConfirmLogout] = useState(false);

    return (
        <div className="min-h-screen pb-28 text-[var(--ios-label-primary)] animate-fade-in font-sans">
            <div className="max-w-3xl mx-auto w-full px-5 sm:px-6 space-y-9 pb-20">
                {/* Page header — module identity, no back-to-launcher affordance (the dock navigates) */}
                <div className="flex items-start justify-between gap-4 pt-4">
                    <div>
                        <span className="signal-label block text-black/40 dark:text-white/40">
                            {currentLang === 'zh' ? '模块' : 'MODULE'}
                        </span>
                        <h1 className="text-[27px] font-semibold tracking-[-0.038em] leading-[1.05] mt-1.5 text-[var(--ios-label-primary)]">
                            {currentLang === 'zh' ? '设置' : 'Settings'}
                        </h1>
                    </div>
                    <span className="signal-label text-black/40 dark:text-white/40 mt-1 text-right">
                        INK &amp; SIGNAL
                    </span>
                </div>

                {/* Google Drive sync — a blue panel: this is a primary / connected state */}
                <section className="blue-panel p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                        <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.16] text-white shrink-0">
                            <Cloud size={19} />
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-semibold shrink-0 ${
                            isConnected ? 'bg-[#FFBF00] text-[#0A0A0B]' : 'bg-white/[0.16] text-white/80'
                        }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[#0A0A0B]' : 'bg-white/60'}`} />
                            {isConnected ? (currentLang === 'zh' ? '已连接 Google Drive' : 'Connected to Google Drive') : (currentLang === 'zh' ? '本地离线模式' : 'Local Offline Mode')}
                        </span>
                    </div>

                    <h2 className="mt-4 text-[17px] font-semibold tracking-[-0.02em] text-white">
                        {currentLang === 'zh' ? '云端多端同步' : 'Google Drive sync'}
                    </h2>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">
                        {currentLang === 'zh' ? '基于 Google Drive 的去中心化私有云存储' : 'Decentralized private cloud storage powered by Google Drive'}
                    </p>

                    {isConnected && user ? (
                        <div className="mt-5 pt-5 border-t border-white/[0.16] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5 min-w-0">
                                {user.picture ? (
                                    <img src={user.picture} alt={user.name} className="w-11 h-11 rounded-full object-cover border border-white/25" />
                                ) : (
                                    <div className="w-11 h-11 rounded-full bg-white/[0.16] text-white flex items-center justify-center font-semibold text-base shrink-0">
                                        {user.name?.charAt(0) || user.email?.charAt(0) || 'G'}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <div className="font-semibold text-sm text-white truncate">{user.name}</div>
                                    <div className="text-xs font-mono text-white/60 truncate">{user.email}</div>
                                    {lastSyncedTime && (
                                        <div className="text-[11px] text-white/45 mt-0.5">
                                            {currentLang === 'zh' ? '最后同步：' : 'Last synced: '}{new Date(lastSyncedTime).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={async () => {
                                        try {
                                            await syncNow();
                                        } catch (e: any) {
                                            alert((currentLang === 'zh' ? "同步失败：" : "Sync failed: ") + e.message);
                                        }
                                    }}
                                    disabled={isSyncing}
                                    className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white text-[#2600FD] font-semibold text-xs active:scale-95 transition-transform disabled:opacity-50 cursor-pointer"
                                >
                                    <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                                    <span>{isSyncing ? (currentLang === 'zh' ? '同步中...' : 'Syncing...') : (currentLang === 'zh' ? '立即同步' : 'Sync Now')}</span>
                                </button>

                                <button
                                    onClick={() => {
                                        if (confirmLogout) {
                                            disconnectGoogleDrive();
                                            setConfirmLogout(false);
                                        } else {
                                            setConfirmLogout(true);
                                            setTimeout(() => setConfirmLogout(false), 3000);
                                        }
                                    }}
                                    className={`inline-flex items-center h-10 px-4 rounded-full font-semibold text-xs border active:scale-95 transition-transform cursor-pointer ${
                                        confirmLogout
                                            ? 'bg-[#0A0A0B] border-transparent text-[#FFBF00]'
                                            : 'bg-white/[0.15] border-white/20 text-white hover:bg-white/[0.22]'
                                    }`}
                                >
                                    {confirmLogout ? (currentLang === 'zh' ? "确认断开？" : "Confirm Disconnect?") : (currentLang === 'zh' ? "断开连接" : "Disconnect")}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-5 pt-5 border-t border-white/[0.16] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1 min-w-0">
                                <h4 className="font-semibold text-sm text-white">
                                    {currentLang === 'zh' ? '尚未连接 Google Drive 云端' : 'Google Drive Not Connected'}
                                </h4>
                                <p className="text-xs text-white/70 max-w-lg leading-relaxed">
                                    {currentLang === 'zh' 
                                        ? '连接后，数据将以隐私文件形式保存在您的个人 Google 云端硬盘中，可在电脑、手机或平板间全自动实时漫游。'
                                        : 'Once connected, your data will be securely synced to your personal Google Drive for cross-device access.'}
                                </p>
                            </div>

                            <button
                                onClick={() => setShowAuthModal(true)}
                                className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full bg-white text-[#2600FD] font-semibold text-xs shrink-0 active:scale-95 transition-transform cursor-pointer"
                            >
                                <Cloud size={15} />
                                <span>{currentLang === 'zh' ? '连接 Google Drive' : 'Connect Google Drive'}</span>
                            </button>
                        </div>
                    )}
                </section>

                {/* Preferences & Display */}
                <section>
                    <SectionHead
                        label={currentLang === 'zh' ? '偏好' : 'PREFERENCES'}
                        title={currentLang === 'zh' ? '偏好与外观' : 'Preferences & Display'}
                    />

                    {/* Language */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="min-w-0">
                            <span className="block text-[14px] font-semibold">{currentLang === 'zh' ? '应用显示语言' : 'App Display Language'}</span>
                            <span className="block text-xs text-[var(--ios-label-secondary)] mt-0.5">
                                {currentLang === 'zh' ? '界面与 AI 输出语言' : 'Interface & AI output language'}
                            </span>
                        </div>
                        <div className="seg w-full sm:w-[210px] shrink-0">
                            <button
                                onClick={() => handleLanguageChange('en')}
                                className={`seg__item flex-1 min-w-0 text-center !px-2 ${currentLang === 'en' ? 'is-on' : ''}`}
                            >
                                English (EN)
                            </button>
                            <button
                                onClick={() => handleLanguageChange('zh')}
                                className={`seg__item flex-1 min-w-0 text-center !px-2 ${currentLang === 'zh' ? 'is-on' : ''}`}
                            >
                                中文 (ZH)
                            </button>
                        </div>
                    </div>

                    <div className="hairline my-4" />

                    {/* Theme */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="min-w-0">
                            <span className="block text-[14px] font-semibold">{currentLang === 'zh' ? '外观主题' : 'Appearance Theme'}</span>
                            <span className="block text-xs text-[var(--ios-label-secondary)] mt-0.5">
                                {currentLang === 'zh' ? '跟随系统或手动指定' : 'Follow the system, or set it manually'}
                            </span>
                        </div>
                        <div className="seg w-full sm:w-[250px] shrink-0">
                            <button
                                onClick={() => handleThemeChange('auto')}
                                className={`seg__item flex-1 min-w-0 inline-flex items-center justify-center gap-1 !px-2 ${themeMode === 'auto' ? 'is-on' : ''}`}
                            >
                                <span className="truncate">{currentLang === 'zh' ? '系统跟随' : 'Auto'}</span>
                            </button>
                            <button
                                onClick={() => handleThemeChange('light')}
                                className={`seg__item flex-1 min-w-0 inline-flex items-center justify-center gap-1 !px-2 ${themeMode === 'light' ? 'is-on' : ''}`}
                            >
                                <Sun size={13} />
                                <span className="truncate">{currentLang === 'zh' ? '浅色' : 'Light'}</span>
                            </button>
                            <button
                                onClick={() => handleThemeChange('dark')}
                                className={`seg__item flex-1 min-w-0 inline-flex items-center justify-center gap-1 !px-2 ${themeMode === 'dark' ? 'is-on' : ''}`}
                            >
                                <Moon size={13} />
                                <span className="truncate">{currentLang === 'zh' ? '深色' : 'Dark'}</span>
                            </button>
                        </div>
                    </div>
                </section>

                {/* AI Intelligence */}
                <section>
                    <SectionHead
                        label={currentLang === 'zh' ? '智能' : 'INTELLIGENCE'}
                        title="AI Intelligence Providers"
                        meta={currentLang === 'zh' ? '自备密钥' : 'BYO KEY'}
                    />

                    {/* Provider Select */}
                    <div>
                        <span className="signal-label block text-black/40 dark:text-white/40 mb-2.5">
                            {currentLang === 'zh' ? '选择服务商' : 'SELECT AI PROVIDER'}
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                                    className={`h-11 px-2 rounded-full text-[12.5px] font-semibold border transition-colors active:scale-95 ${
                                        aiProvider === p.id
                                            ? 'bg-[#2600FD] border-transparent text-white'
                                            : 'bg-white dark:bg-transparent border-black/[0.14] dark:border-white/[0.15] text-black/60 dark:text-white/60 hover:border-black/30 dark:hover:border-white/30'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="hairline my-5" />

                    {/* API Key */}
                    <div>
                        <span className="signal-label block text-black/40 dark:text-white/40 mb-2.5">
                            {aiProvider === 'google' && 'Google AI Studio API Key'}
                            {aiProvider === 'openai' && 'OpenAI API Key'}
                            {aiProvider === 'anthropic' && 'Anthropic API Key'}
                            {aiProvider === 'deepseek' && 'DeepSeek API Key'}
                            {aiProvider === 'siliconflow' && 'SiliconFlow API Key'}
                            {aiProvider === 'openrouter' && 'OpenRouter API Key'}
                        </span>
                        <div className="flex items-stretch gap-2">
                            <input
                                type="password"
                                value={apiKeys[aiProvider] || ''}
                                onChange={(e) => {
                                    handleKeyChange(e.target.value);
                                    setCheckStatus('idle');
                                }}
                                placeholder="sk-... / AIzaSy..."
                                className="ios-input flex-1 min-w-0 px-4 py-3 font-mono text-sm text-gray-700 dark:text-gray-200"
                            />
                            <button
                                onClick={checkConnection}
                                disabled={!apiKeys[aiProvider] || checkStatus === 'checking'}
                                className={`ios-button shrink-0 px-4 rounded-[14px] font-semibold text-xs whitespace-nowrap active:scale-95 transition-all flex items-center gap-2 ${
                                    checkStatus === 'success' ? 'text-green-500' : checkStatus === 'error' ? 'text-red-500' : 'text-gray-600'
                                }`}
                            >
                                {checkStatus === 'checking' ? <Activity className="animate-spin" size={18} /> :
                                    checkStatus === 'success' ? <Check size={18} /> :
                                        checkStatus === 'error' ? <AlertCircle size={18} /> :
                                            "Test Connection"}
                            </button>
                        </div>
                        {statusMsg && (
                            <p className={`text-xs font-semibold mt-2.5 ${checkStatus === 'success' ? 'text-green-600' : checkStatus === 'error' ? 'text-red-600' : 'text-gray-400'}`}>
                                {statusMsg}
                            </p>
                        )}
                    </div>

                    <div className="hairline my-5" />

                    {/* Unified Model Selection Block */}
                    <div>
                        <div className="flex items-center justify-between gap-3 mb-2.5">
                            <span className="signal-label text-black/40 dark:text-white/40">
                                {currentLang === 'zh' ? '模型选择' : 'MODEL SELECTION'}
                            </span>
                            {aiProvider === 'siliconflow' && (
                                <button
                                    onClick={() => loadSiliconFlowModels(apiKeys.siliconflow, true)}
                                    disabled={isLoadingModels || !apiKeys.siliconflow}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/[0.14] dark:border-white/[0.15] text-[10.5px] font-semibold text-black/60 dark:text-white/60 hover:text-[#2600FD] dark:hover:text-blue-400 transition-colors active:scale-95 disabled:opacity-50"
                                >
                                    <RefreshCw size={10} className={isLoadingModels ? 'animate-spin' : ''} />
                                    Sync Catalog
                                </button>
                            )}
                        </div>

                        {aiProvider !== 'siliconflow' ? (
                            <div className="divide-y divide-black/[0.08] dark:divide-white/[0.09]">

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
                                        className="flex items-start gap-3 py-3.5 cursor-pointer active:opacity-70 transition-opacity"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[13.5px] font-semibold ${aiModel === m.id ? 'text-purple-600' : 'text-[var(--ios-label-primary)]'}`}>
                                                    {m.name}
                                                </span>
                                                {aiModel === m.id && <CheckCircle2 size={14} className="shrink-0 text-purple-600" />}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">{m.desc}</div>
                                        </div>
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
                                        className="flex items-start gap-3 py-3.5 cursor-pointer active:opacity-70 transition-opacity"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[13.5px] font-semibold ${aiModel === m.id ? 'text-purple-600' : 'text-[var(--ios-label-primary)]'}`}>
                                                    {m.name}
                                                </span>
                                                {aiModel === m.id && <CheckCircle2 size={14} className="shrink-0 text-purple-600" />}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">{m.desc}</div>
                                        </div>
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
                                        className="flex items-start gap-3 py-3.5 cursor-pointer active:opacity-70 transition-opacity"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[13.5px] font-semibold ${aiModel === m.id ? 'text-purple-600' : 'text-[var(--ios-label-primary)]'}`}>
                                                    {m.name}
                                                </span>
                                                {aiModel === m.id && <CheckCircle2 size={14} className="shrink-0 text-purple-600" />}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">{m.desc}</div>
                                        </div>
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
                                        className="flex items-start gap-3 py-3.5 cursor-pointer active:opacity-70 transition-opacity"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[13.5px] font-semibold ${aiModel === m.id ? 'text-purple-600' : 'text-[var(--ios-label-primary)]'}`}>
                                                    {m.name}
                                                </span>
                                                {aiModel === m.id && <CheckCircle2 size={14} className="shrink-0 text-purple-600" />}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">{m.desc}</div>
                                        </div>
                                    </div>
                                ))}

                                {aiProvider === 'openrouter' && (
                                    <div className="pt-2 space-y-4">
                                        <div className="divide-y divide-black/[0.08] dark:divide-white/[0.09]">
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
                                                    className="flex items-center justify-between gap-3 py-3.5 cursor-pointer active:opacity-70 transition-opacity"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-semibold text-[13.5px] truncate">
                                                            {m.name}
                                                        </div>
                                                        <div className="text-[10.5px] text-gray-400 font-mono">{m.provider}</div>
                                                    </div>
                                                    {aiModel === m.id && <CheckCircle2 size={15} className="shrink-0 text-purple-600" />}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="relative pt-1">
                                            <input
                                                className="ios-input w-full px-4 py-3 text-sm text-gray-700 dark:text-gray-200"
                                                placeholder="Or enter custom OpenRouter model ID"
                                                value={aiModel}
                                                onChange={e => setAiModel(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {/* Search & Filters Panel */}
                                <div className="space-y-5">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            placeholder="Search by Model Name, Provider, Capability (e.g. qwen, deepseek, flux)..."
                                            className="ios-input w-full pl-11 pr-4 py-3 text-sm text-gray-700 dark:text-gray-200"
                                        />
                                        <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    </div>

                                    {/* Filter Controls */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        
                                        {/* Capability Filter */}
                                        <div>
                                            <label className="signal-label text-black/40 dark:text-white/40 mb-2 block">Capability</label>
                                            <select
                                                value={selectedCapability}
                                                onChange={e => setSelectedCapability(e.target.value)}
                                                className="ios-input w-full px-3 py-2.5 text-xs text-gray-600 dark:text-gray-300"
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
                                            <label className="signal-label text-black/40 dark:text-white/40 mb-2 block">Sub-Provider</label>
                                            <select
                                                value={selectedSubProvider}
                                                onChange={e => setSelectedSubProvider(e.target.value)}
                                                className="ios-input w-full px-3 py-2.5 text-xs text-gray-600 dark:text-gray-300"
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
                                            <label className="signal-label text-black/40 dark:text-white/40 mb-2 block">Context Size</label>
                                            <select
                                                value={selectedContextLength}
                                                onChange={e => setSelectedContextLength(e.target.value)}
                                                className="ios-input w-full px-3 py-2.5 text-xs text-gray-600 dark:text-gray-300"
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
                                    <div className="flex items-center gap-2 text-sm text-red-600">
                                        <AlertCircle size={16} className="shrink-0" />
                                        {modelError}
                                    </div>
                                )}

                                {/* Active Model Indicator — ink mass */}
                                <div className="ink-panel px-4 py-3.5 flex items-center justify-between gap-3">
                                    <span className="signal-label text-white/45 relative z-10">Currently Active Model</span>
                                    <span className="relative z-10 text-xs font-mono text-white truncate">{aiModel || 'None Selected'}</span>
                                </div>

                                {/* Catalog Model List — hairline separated rows */}
                                <div className="divide-y divide-black/[0.08] dark:divide-white/[0.09] max-h-[420px] overflow-y-auto no-scrollbar">
                                    {sortedModels.length > 0 ? (
                                        sortedModels.map((m) => {
                                            const isSelected = aiModel === m.id;
                                            const isFav = favorites.includes(m.id);
                                            return (
                                                <div
                                                    key={m.id}
                                                    className="py-4"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="text-[13.5px] font-semibold text-gray-800 dark:text-gray-100 leading-tight break-all">
                                                                {m.name}
                                                            </h4>
                                                            <p className="text-[10.5px] text-gray-400 font-mono mt-0.5 break-all">
                                                                {m.id}
                                                            </p>
                                                            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full mt-1.5 inline-block">
                                                                {m.provider}
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleFavorite(m.id);
                                                            }}
                                                            className={`p-1.5 rounded-full active:scale-95 transition-colors shrink-0 ${
                                                                isFav ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'
                                                            }`}
                                                        >
                                                            <Star size={16} fill={isFav ? "currentColor" : "none"} />
                                                        </button>
                                                    </div>

                                                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                                                        {m.description}
                                                    </p>

                                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                                        <div className="flex flex-wrap gap-1">
                                                            {m.context_length > 0 ? (
                                                                <span className="text-[9.5px] font-semibold text-gray-500 dark:text-gray-400 bg-black/[0.05] dark:bg-white/[0.08] px-2 py-0.5 rounded-full">
                                                                    Context: {m.context_length >= 1048576 ? `${(m.context_length / 1048576).toFixed(0)}M` : `${(m.context_length / 1024).toFixed(0)}K`}
                                                                </span>
                                                            ) : null}
                                                            {m.capabilities.map(cap => (
                                                                <span key={cap} className="text-[9.5px] font-semibold text-purple-500 dark:text-blue-400 bg-purple-500/10 px-2 py-0.5 rounded-full uppercase">
                                                                    {cap}
                                                                </span>
                                                            ))}
                                                        </div>

                                                        <button
                                                            onClick={() => setAiModel(m.id)}
                                                            className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors active:scale-95 shrink-0 ${
                                                                isSelected
                                                                    ? 'bg-[#2600FD] text-white'
                                                                    : 'border border-black/[0.14] dark:border-white/[0.15] text-gray-500 dark:text-gray-400 hover:text-[#2600FD]'
                                                            }`}
                                                        >
                                                            {isSelected ? 'Active' : 'Select'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="py-8 text-center text-gray-400 text-sm">
                                            No models match your search/filter parameters.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </section>


                {/* Data management — rows on hairlines, no card walls */}
                <section>
                    <SectionHead
                        label={currentLang === 'zh' ? '数据' : 'DATA'}
                        title={currentLang === 'zh' ? '数据管理' : 'Data Management'}
                    />
                    <p className="text-xs text-[var(--ios-label-secondary)] -mt-1 mb-2">
                        Backup applies to MyWealth, GetNote &amp; Settings
                    </p>

                    <div className="divide-y divide-black/[0.08] dark:divide-white/[0.09]">
                        <button
                            onClick={handleFullBackup}
                            className="w-full flex items-center gap-3.5 py-4 text-left active:opacity-70 transition-opacity"
                        >
                            <span className="w-10 h-10 rounded-full bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center text-gray-500 shrink-0">
                                <Download size={18} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[14px] font-semibold">{currentLang === 'zh' ? '导出备份' : 'Export Backup'}</span>
                                <span className="block text-xs text-[var(--ios-label-secondary)] mt-0.5">Save all app data to a single JSON.</span>
                            </span>
                            <ChevronRight size={16} className="text-gray-400 shrink-0" />
                        </button>

                        <button
                            onClick={() => document.getElementById('global-restore')?.click()}
                            className="w-full flex items-center gap-3.5 py-4 text-left active:opacity-70 transition-opacity"
                        >
                            <span className="w-10 h-10 rounded-full bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center text-gray-500 shrink-0">
                                <Upload size={18} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[14px] font-semibold">{currentLang === 'zh' ? '恢复数据' : 'Restore Data'}</span>
                                <span className="block text-xs text-[var(--ios-label-secondary)] mt-0.5">Restore from a backup file.</span>
                            </span>
                            <ChevronRight size={16} className="text-gray-400 shrink-0" />
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
                </section>

            </div>
            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
        </div>
    );
};

export default GlobalSettings;