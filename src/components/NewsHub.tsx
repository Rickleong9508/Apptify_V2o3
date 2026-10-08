import React, { useState, useEffect, useRef } from 'react';
import { Rss, RefreshCw, ExternalLink, Globe, Plus, Trash2, X, Image as ImageIcon, Sparkles, ChevronLeft, Flame, TrendingUp, Cpu, Radio, Clock } from 'lucide-react';
import { aiService, AIProvider } from '../services/aiService';

interface NewsItem {
    id: string;
    title: string;
    url: string;
    source: string;
    metadata: string;
    time: string;
    timestamp?: number;
    image?: string;
}

interface Source {
    id: string;
    name: string;
    icon: any;
    type: 'preset' | 'custom' | 'rss';
    url?: string;
    presetId?: string;
    category?: string;
}

interface NewsHubProps {
    onExit: () => void;
}

// High-frequency, real-time updated RSS sources
const PRESET_SOURCES_EN: Source[] = [
    { id: 'breaking', name: 'Breaking News', icon: Flame, type: 'rss', url: 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en', category: 'Breaking' },
    { id: 'us_stocks', name: 'Markets & Finance', icon: TrendingUp, type: 'rss', url: 'https://finance.yahoo.com/news/rssindex', category: 'Finance' },
    { id: 'ai', name: 'AI & Frontier Tech', icon: Sparkles, type: 'rss', url: 'https://news.google.com/rss/search?q=Artificial+Intelligence+OR+OpenAI+OR+Anthropic+OR+NVIDIA&hl=en-US&gl=US&ceid=US:en', category: 'AI' },
    { id: 'tech', name: 'Technology', icon: Cpu, type: 'rss', url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en', category: 'Tech' },
    { id: 'malaysia', name: 'Malaysia Live', icon: Globe, type: 'rss', url: 'https://news.google.com/rss/search?q=Malaysia+news&hl=en-MY&gl=MY&ceid=MY:en', category: 'Local' },
    { id: 'world_bbc', name: 'BBC Global', icon: Globe, type: 'rss', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'World' },
];

const PRESET_SOURCES_CN: Source[] = [
    { id: 'breaking', name: '实时头条', icon: Flame, type: 'rss', url: 'https://news.google.com/rss?hl=zh-CN&gl=CN&ceid=CN:zh-Hans', category: '热点' },
    { id: 'us_stocks', name: '全球与美股财经', icon: TrendingUp, type: 'rss', url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=zh-CN&gl=CN&ceid=CN:zh-Hans', category: '财经' },
    { id: 'ai', name: 'AI 科技前沿', icon: Sparkles, type: 'rss', url: 'https://news.google.com/rss/search?q=人工智能+OR+AI大模型+OR+英伟达&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', category: 'AI' },
    { id: 'tech', name: '科技数码', icon: Cpu, type: 'rss', url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=zh-CN&gl=CN&ceid=CN:zh-Hans', category: '数码' },
    { id: 'malaysia', name: '大马即时要闻', icon: Globe, type: 'rss', url: 'https://www.orientaldaily.com.my/feeds/rss/nation', category: '大马' },
    { id: 'my_stocks', name: '马股要闻', icon: TrendingUp, type: 'rss', url: 'https://www.orientaldaily.com.my/feeds/rss/business', category: '商业' },
];

const NewsCard: React.FC<{ item: NewsItem; lang: 'en' | 'cn' }> = ({ item, lang }) => {
    const [translatedTitle, setTranslatedTitle] = useState(item.title);
    const [translatedMeta, setTranslatedMeta] = useState(item.metadata);
    const [isTranslating, setIsTranslating] = useState(false);
    const [hasTranslated, setHasTranslated] = useState(false);

    const [aiSummary, setAiSummary] = useState('');
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [showSummary, setShowSummary] = useState(false);

    // Sync when item title changes
    useEffect(() => {
        setTranslatedTitle(item.title);
        setTranslatedMeta(item.metadata);
        setHasTranslated(false);
    }, [item.title, item.metadata]);

    const handleTranslate = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (hasTranslated) {
            setTranslatedTitle(item.title);
            setTranslatedMeta(item.metadata);
            setHasTranslated(false);
            return;
        }

        setIsTranslating(true);
        try {
            const apiKey = localStorage.getItem('app_global_api_key') || '';
            const provider = (localStorage.getItem('app_global_ai_provider') as AIProvider) || 'google';
            const model = localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash';

            const prompt = `Translate the following news title and summary to ${lang === 'cn' ? 'Simplified Chinese (zh-CN)' : 'English'}. Return JSON: { "title": "...", "summary": "..." }
            
            Title: ${item.title}
            Summary: ${item.metadata}`;

            const res = await aiService.generate(provider, model, apiKey, prompt);
            const jsonStr = res.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(jsonStr);

            setTranslatedTitle(data.title || item.title);
            setTranslatedMeta(data.summary || item.metadata);
            setHasTranslated(true);
        } catch (e) {
            console.error("Translation failed", e);
            alert("Translation failed. Please verify API Settings.");
        } finally {
            setIsTranslating(false);
        }
    };

    const handleGetAiSummary = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (aiSummary) {
            setShowSummary(!showSummary);
            return;
        }

        setIsSummarizing(true);
        setShowSummary(true);
        try {
            const apiKey = localStorage.getItem('app_global_api_key') || '';
            const provider = (localStorage.getItem('app_global_ai_provider') as AIProvider) || 'google';
            const model = localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash';

            const prompt = `Based on the following news title and excerpt, generate exactly 3 key bullet points summarizing the insights (in ${lang === 'cn' ? 'Simplified Chinese (zh-CN)' : 'English'}). Keep it short, actionable, and impactful. Output only the 3 bullet points separated by newlines, no markdown headers.
            
            Title: ${item.title}
            Summary: ${item.metadata}`;

            const res = await aiService.generate(provider, model, apiKey, prompt);
            setAiSummary(res.trim());
        } catch (e) {
            console.error("AI summary failed", e);
            setAiSummary("Failed to generate AI insights. Please check API Settings.");
        } finally {
            setIsSummarizing(false);
        }
    };

    return (
        <div className="ios-glass p-4 sm:p-5 rounded-3xl border border-white/60 dark:border-white/10 flex flex-col justify-between transition-all group shadow-md hover:shadow-2xl hover:border-blue-500/40 hover:scale-[1.01] duration-300 relative overflow-hidden bg-white/75 dark:bg-[#141416]/80 backdrop-blur-3xl">
            {/* Top glass reflection specular line */}
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/70 dark:via-white/20 to-transparent pointer-events-none" />

            <div>
                {/* Media Image Thumbnail or Placeholder */}
                <div className="w-full h-36 sm:h-40 rounded-2xl overflow-hidden mb-3.5 relative bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-white/5 dark:to-white/10">
                    {item.image ? (
                        <img
                            src={item.image}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-600 bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-purple-500/5">
                            <ImageIcon size={30} className="opacity-40" />
                        </div>
                    )}

                    {/* Source Pill */}
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[10px] font-bold text-white shadow-sm flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        <span className="truncate max-w-[120px]">{item.source || 'LIVE'}</span>
                    </div>

                    {/* Time Pill */}
                    <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md text-[10px] font-medium text-white/90">
                        {item.time}
                    </div>
                </div>

                {/* Title & Excerpt */}
                <div className="space-y-1.5">
                    <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block font-bold text-sm sm:text-base text-gray-900 dark:text-white hover:text-blue-500 dark:hover:text-blue-400 transition-colors line-clamp-2 leading-snug tracking-tight"
                    >
                        {translatedTitle}
                    </a>
                    {translatedMeta && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                            {translatedMeta}
                        </p>
                    )}
                </div>

                {/* AI Insights Card */}
                {showSummary && (
                    <div className="mt-3 p-3.5 rounded-2xl bg-purple-500/10 dark:bg-purple-500/15 border border-purple-500/20 text-xs text-gray-800 dark:text-gray-200 leading-relaxed space-y-1.5 animate-slide-up">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1">
                            <Sparkles size={12} />
                            <span>AI 核心提炼 (Takeaway)</span>
                        </span>
                        {isSummarizing ? (
                            <div className="flex items-center gap-2 py-1 italic font-medium text-gray-500 dark:text-gray-400">
                                <RefreshCw size={12} className="animate-spin text-purple-500" />
                                <span>Distilling real-time insights...</span>
                            </div>
                        ) : (
                            <div className="whitespace-pre-line font-medium text-gray-800 dark:text-gray-100">
                                {aiSummary}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer Row */}
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100 dark:border-white/10">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                    {lang === 'cn' ? '点击可查看原文' : 'Tap to read full article'}
                </span>

                <div className="flex items-center gap-1">
                    <button
                        onClick={handleGetAiSummary}
                        disabled={isSummarizing}
                        className={`p-2 rounded-xl tap-scale transition-colors ${
                            showSummary
                                ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                                : 'text-gray-400 hover:text-purple-500 hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                        title="AI Insight Summary"
                    >
                        <Sparkles size={15} />
                    </button>

                    <button
                        onClick={handleTranslate}
                        disabled={isTranslating}
                        className={`p-2 rounded-xl tap-scale transition-colors ${
                            hasTranslated
                                ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                : 'text-gray-400 hover:text-blue-500 hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                        title="Translate"
                    >
                        {isTranslating ? <RefreshCw size={15} className="animate-spin text-blue-500" /> : <Globe size={15} />}
                    </button>

                    <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl tap-scale transition-colors"
                        title="Read Full Story"
                    >
                        <ExternalLink size={15} />
                    </a>
                </div>
            </div>
        </div>
    );
};

const NewsHub: React.FC<NewsHubProps> = ({ onExit }) => {
    const [lang, setLang] = useState<'en' | 'cn'>(() => {
        return (localStorage.getItem('apptify_language') as 'en' | 'cn') || 'cn';
    });
    const [customSources, setCustomSources] = useState<Source[]>([]);
    
    const sources = React.useMemo(() => {
        const presets = lang === 'en' ? PRESET_SOURCES_EN : PRESET_SOURCES_CN;
        return [...presets, ...customSources];
    }, [lang, customSources]);

    const [activeSourceId, setActiveSourceId] = useState('breaking');
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [isSilentSync, setIsSilentSync] = useState(false);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [liveSync, setLiveSync] = useState<boolean>(true); // Real-time auto sync toggle

    const [showAddModal, setShowAddModal] = useState(false);
    const [newSourceName, setNewSourceName] = useState('');
    const [newSourceUrl, setNewSourceUrl] = useState('');

    useEffect(() => {
        const saved = localStorage.getItem('app_custom_news_sources');
        if (saved) {
            try {
                setCustomSources(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load custom sources", e);
            }
        }
    }, []);

    // Primary fetch with dual-engine fallback (Server API + Client RSS Proxy)
    const fetchNews = async (sourceId: string, force = false, silent = false) => {
        const source = sources.find(s => s.id === sourceId);
        if (!source) return;

        if (!silent) {
            setLoading(true);
            setError('');
        } else {
            setIsSilentSync(true);
        }

        try {
            const payload: any = { forceRefresh: force };
            if (source.type === 'preset') {
                payload.source = source.presetId;
            } else {
                payload.source = 'rss';
                payload.url = source.url;
            }

            let fetchedNews: NewsItem[] = [];

            // 1. Try local Express backend API
            try {
                const response = await fetch('/api/news', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data) && data.length > 0) {
                        fetchedNews = data;
                    }
                }
            } catch (backendErr) {
                console.warn("Backend /api/news unavailable, trying fallback...", backendErr);
            }

            // 2. Client-side Fallback (Dual-Engine Resilience)
            if (fetchedNews.length === 0 && source.url) {
                try {
                    const fallbackUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(source.url)}`;
                    const res = await fetch(fallbackUrl);
                    if (res.ok) {
                        const json = await res.json();
                        if (json.items && json.items.length > 0) {
                            fetchedNews = json.items.map((it: any, i: number) => ({
                                id: it.link || `fb_${i}`,
                                title: it.title,
                                url: it.link,
                                source: it.author || source.name,
                                metadata: it.description ? it.description.replace(/<[^>]*>?/gm, '').substring(0, 100) + '...' : '',
                                time: it.pubDate ? new Date(it.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '刚刚',
                                image: it.thumbnail || it.enclosure?.link || ''
                            }));
                        }
                    }
                } catch (fallbackErr) {
                    console.error("Fallback RSS parser failed", fallbackErr);
                }
            }

            if (fetchedNews.length > 0) {
                setNews(fetchedNews);
                setLastUpdated(new Date());
                setError('');
            } else if (!silent) {
                setError('暂未获取到此频道的最新资讯，请稍后刷新重试。');
            }
        } catch (err: any) {
            console.error(err);
            if (!silent) setError(err.message || '获取新闻资讯失败，请检查网络。');
        } finally {
            setLoading(false);
            setIsSilentSync(false);
        }
    };

    // Trigger fetch on category or language switch
    useEffect(() => {
        fetchNews(activeSourceId, false, false);
    }, [activeSourceId, lang]);

    // Continuous Real-Time Auto-Refresh Loop (every 60 seconds)
    useEffect(() => {
        if (!liveSync) return;

        const interval = setInterval(() => {
            fetchNews(activeSourceId, false, true);
        }, 60000); // 60s live poll

        return () => clearInterval(interval);
    }, [activeSourceId, liveSync, sources]);

    const handleAddSource = () => {
        if (!newSourceName || !newSourceUrl) return;

        const newSource: Source = {
            id: `custom_${Date.now()}`,
            name: newSourceName,
            icon: Rss,
            type: 'rss',
            url: newSourceUrl,
            category: 'Custom'
        };

        const updatedCustom = [...customSources, newSource];
        setCustomSources(updatedCustom);
        localStorage.setItem('app_custom_news_sources', JSON.stringify(updatedCustom));

        setShowAddModal(false);
        setNewSourceName('');
        setNewSourceUrl('');
        setActiveSourceId(newSource.id);
    };

    const deleteSource = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('确定删除此自定义订阅源吗？')) return;

        const updatedCustom = customSources.filter(s => s.id !== id);
        setCustomSources(updatedCustom);
        localStorage.setItem('app_custom_news_sources', JSON.stringify(updatedCustom));

        if (activeSourceId === id) {
            setActiveSourceId('breaking');
        }
    };

    return (
        <div className="min-h-screen pb-24 animate-fade-in text-gray-900 dark:text-white">
            <div className="max-w-6xl mx-auto space-y-5 px-3 sm:px-4">
                
                {/* Header Navigation & Live Control Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onExit}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/70 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 text-blue-600 dark:text-blue-400 font-semibold text-xs sm:text-sm tap-scale transition-all border border-black/5 dark:border-white/10 shadow-sm"
                        >
                            <ChevronLeft size={18} />
                            <span>{lang === 'cn' ? '返回主页' : 'Back to Launcher'}</span>
                        </button>

                        {/* Live Sync Status Pill */}
                        <button
                            onClick={() => setLiveSync(!liveSync)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                                liveSync
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 shadow-sm'
                                    : 'bg-gray-100 dark:bg-white/5 text-gray-400 border-gray-200 dark:border-white/10'
                            }`}
                            title="点击切换是否开启实时自动更新"
                        >
                            <span className={`w-2 h-2 rounded-full ${liveSync ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                            <span>{liveSync ? (lang === 'cn' ? '实时动态流' : 'Live Syncing') : (lang === 'cn' ? '已暂停自动流' : 'Paused')}</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        {/* Last updated badge */}
                        <div className="hidden md:flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                            <Clock size={12} />
                            <span>{lang === 'cn' ? '上次刷新' : 'Updated'}: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>

                        {/* Language Segmented Control */}
                        <div className="p-1 rounded-full bg-white/60 dark:bg-white/10 backdrop-blur-md border border-black/5 dark:border-white/10 flex items-center shadow-sm">
                            <button
                                onClick={() => setLang('en')}
                                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                                    lang === 'en'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                EN
                            </button>
                            <button
                                onClick={() => setLang('cn')}
                                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                                    lang === 'cn'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                中文
                            </button>
                        </div>

                        {/* Force Refresh Button */}
                        <button
                            onClick={() => fetchNews(activeSourceId, true, false)}
                            disabled={loading}
                            className="p-2.5 rounded-full bg-white/70 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 text-gray-700 dark:text-gray-200 border border-black/5 dark:border-white/10 tap-scale shadow-sm"
                            title={lang === 'cn' ? '强制拉取一手最新动态' : 'Force Refresh News'}
                        >
                            <RefreshCw size={15} className={loading || isSilentSync ? 'animate-spin text-blue-500' : ''} />
                        </button>
                    </div>
                </div>

                {/* Horizontal Category Carousel */}
                <div className="flex items-center justify-between gap-3 overflow-x-auto no-scrollbar py-1">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        {sources.map(source => {
                            const isSelected = activeSourceId === source.id;
                            const Icon = source.icon || Globe;
                            return (
                                <div key={source.id} className="relative group shrink-0">
                                    <button
                                        onClick={() => setActiveSourceId(source.id)}
                                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all tap-scale ${
                                            isSelected
                                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                                                : 'bg-white/70 dark:bg-white/5 hover:bg-white/90 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 border border-black/5 dark:border-white/10'
                                        }`}
                                    >
                                        <Icon size={14} className={isSelected ? 'text-white' : 'text-blue-500'} />
                                        <span>{source.name}</span>
                                    </button>

                                    {source.type === 'custom' && (
                                        <button
                                            onClick={(e) => deleteSource(e, source.id)}
                                            className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] shadow"
                                        >
                                            <X size={10} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-1 px-3 py-2 rounded-2xl text-xs font-bold border border-dashed border-gray-300 dark:border-white/20 text-gray-500 hover:text-blue-500 hover:border-blue-500 shrink-0 tap-scale bg-white/40 dark:bg-white/5"
                    >
                        <Plus size={14} />
                        <span>{lang === 'cn' ? '添加订阅' : 'Add Feed'}</span>
                    </button>
                </div>

                {/* News Cards Grid or Status States */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                            <RefreshCw size={24} className="animate-spin text-blue-500" />
                        </div>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                            {lang === 'cn' ? '正在快速同步一手新闻源...' : 'Streaming latest real-time headlines...'}
                        </span>
                    </div>
                ) : error ? (
                    <div className="text-center py-16 ios-card space-y-3 max-w-md mx-auto">
                        <p className="text-rose-500 text-xs sm:text-sm font-semibold">{error}</p>
                        <button
                            onClick={() => fetchNews(activeSourceId, true, false)}
                            className="ios-button-primary text-xs tap-scale px-4 py-2"
                        >
                            {lang === 'cn' ? '重新刷新' : 'Retry Loading'}
                        </button>
                    </div>
                ) : news.length === 0 ? (
                    <div className="text-center py-20 ios-card">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {lang === 'cn' ? '当前频道暂无新动态。' : 'No news items found for this feed.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 animate-fade-in">
                        {news.map((item, idx) => (
                            <NewsCard key={item.id || idx} item={item} lang={lang} />
                        ))}
                    </div>
                )}

                {/* Add Custom RSS Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                        <div className="w-full sm:max-w-md ios-card rounded-t-3xl sm:rounded-3xl p-6 space-y-5 animate-slide-up sm:animate-scale-in">
                            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-white/10">
                                <h3 className="font-bold text-base text-gray-900 dark:text-white">
                                    {lang === 'cn' ? '添加自定义 RSS 新闻源' : 'Add Custom RSS Feed'}
                                </h3>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 tap-scale"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="space-y-3.5">
                                <div>
                                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">
                                        {lang === 'cn' ? '媒体名称' : 'Source Name'}
                                    </label>
                                    <input
                                        className="ios-input"
                                        placeholder="e.g. 华尔街见闻 / Bloomberg"
                                        value={newSourceName}
                                        onChange={e => setNewSourceName(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">
                                        {lang === 'cn' ? 'RSS 订阅链接' : 'RSS Endpoint URL'}
                                    </label>
                                    <input
                                        className="ios-input"
                                        placeholder="https://example.com/rss.xml"
                                        value={newSourceUrl}
                                        onChange={e => setNewSourceUrl(e.target.value)}
                                    />
                                </div>

                                <button
                                    onClick={handleAddSource}
                                    disabled={!newSourceName || !newSourceUrl}
                                    className="w-full ios-button-primary py-3.5 text-sm tap-scale disabled:opacity-40"
                                >
                                    {lang === 'cn' ? '立即添加' : 'Add RSS Source'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NewsHub;
