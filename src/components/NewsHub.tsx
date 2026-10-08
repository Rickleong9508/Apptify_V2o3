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

const NewsCard: React.FC<{ item: NewsItem; lang: 'en' | 'cn'; lead?: boolean }> = ({ item, lang, lead = false }) => {
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

    /** Row of per-article actions — the same three handlers in both layouts. */
    const actions = (onInk: boolean) => (
        <div className="flex items-center gap-1">
            <button
                onClick={handleGetAiSummary}
                disabled={isSummarizing}
                className={`p-2 rounded-full tap-scale transition-colors ${
                    showSummary
                        ? onInk
                            ? 'bg-white/15 text-white'
                            : 'bg-blue-500/15 text-blue-500 dark:text-blue-400'
                        : onInk
                            ? 'text-white/60 hover:text-white hover:bg-white/10'
                            : 'text-gray-400 hover:text-blue-500 hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="AI Insight Summary"
            >
                <Sparkles size={15} />
            </button>

            <button
                onClick={handleTranslate}
                disabled={isTranslating}
                className={`p-2 rounded-full tap-scale transition-colors ${
                    hasTranslated
                        ? onInk
                            ? 'bg-white/15 text-white'
                            : 'bg-blue-500/15 text-blue-500 dark:text-blue-400'
                        : onInk
                            ? 'text-white/60 hover:text-white hover:bg-white/10'
                            : 'text-gray-400 hover:text-blue-500 hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Translate"
            >
                {isTranslating ? <RefreshCw size={15} className="animate-spin text-blue-500" /> : <Globe size={15} />}
            </button>

            <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`p-2 rounded-full tap-scale transition-colors ${
                    onInk
                        ? 'text-white/60 hover:text-white hover:bg-white/10'
                        : 'text-gray-400 hover:text-blue-500 hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Read Full Story"
            >
                <ExternalLink size={15} />
            </a>
        </div>
    );

    /** AI takeaway — rendered on ink for the lead story, on paper for feed rows. */
    const summaryBlock = (onInk: boolean) => (
        <div
            className={`mt-3 p-3.5 rounded-2xl text-xs leading-relaxed space-y-1.5 ${
                onInk
                    ? 'bg-white/[0.07] border border-white/10 text-white/85'
                    : 'bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/10 text-gray-800 dark:text-gray-200'
            }`}
        >
            <span className={`text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 ${onInk ? 'text-white/70' : 'text-blue-500 dark:text-blue-400'}`}>
                <Sparkles size={12} />
                <span>AI 核心提炼 (Takeaway)</span>
            </span>
            {isSummarizing ? (
                <div className={`flex items-center gap-2 py-1 italic font-medium ${onInk ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`}>
                    <RefreshCw size={12} className="animate-spin text-blue-500" />
                    <span>Distilling real-time insights...</span>
                </div>
            ) : (
                <div className={`whitespace-pre-line font-medium ${onInk ? 'text-white/90' : 'text-gray-800 dark:text-gray-100'}`}>
                    {aiSummary}
                </div>
            )}
        </div>
    );

    /* ---- Lead story: an ink mass carrying the editorial headline ---------- */
    if (lead) {
        return (
            <article className="ink-panel p-5 sm:p-6">
                <div className="relative z-10">
                    <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFBF00] text-[#0A0A0B] text-[10px] font-semibold uppercase tracking-[0.08em]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0A0A0B]" />
                            {lang === 'cn' ? '头条' : 'Lead'}
                        </span>
                        <span className="signal-label text-white/45">{item.time}</span>
                    </div>

                    {item.image && (
                        <div className="mt-4 w-full h-40 sm:h-56 rounded-[20px] overflow-hidden bg-white/[0.06]">
                            <img
                                src={item.image}
                                alt={item.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => { e.currentTarget.parentElement!.style.display = 'none'; }}
                            />
                        </div>
                    )}

                    <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-4 text-[19px] sm:text-[21px] font-semibold leading-[1.24] tracking-[-0.022em] text-white hover:text-white/80 transition-colors"
                    >
                        {translatedTitle}
                    </a>

                    {translatedMeta && (
                        <p className="mt-2.5 text-[13px] text-white/70 line-clamp-3 leading-relaxed">
                            {translatedMeta}
                        </p>
                    )}

                    {showSummary && summaryBlock(true)}

                    <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
                        <span className="signal-label text-white/45 truncate">{item.source || 'LIVE'}</span>
                        {actions(true)}
                    </div>
                </div>
            </article>
        );
    }

    /* ---- Feed row: hairline separated, never a nested card ---------------- */
    return (
        <article className="flex gap-3.5 pt-4 pb-4 border-t border-black/[0.08] dark:border-white/[0.09]">
            <div className="w-[74px] h-[74px] shrink-0 rounded-2xl overflow-hidden bg-black/[0.04] dark:bg-white/[0.06]">
                {item.image ? (
                    <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <ImageIcon size={22} className="opacity-40" />
                    </div>
                )}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="signal-label text-black/45 dark:text-white/45 truncate">{item.source || 'LIVE'}</span>
                    <span className="text-[10px] font-mono text-gray-400 shrink-0">{item.time}</span>
                </div>

                <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-1 text-[14.5px] font-semibold leading-snug tracking-[-0.012em] text-gray-900 dark:text-white line-clamp-2 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                >
                    {translatedTitle}
                </a>

                {translatedMeta && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                        {translatedMeta}
                    </p>
                )}

                {showSummary && summaryBlock(false)}

                <div className="mt-1.5 flex items-center justify-between gap-3">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium truncate">
                        {lang === 'cn' ? '点击可查看原文' : 'Tap to read full article'}
                    </span>
                    {actions(false)}
                </div>
            </div>
        </article>
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
            <div className="max-w-6xl mx-auto space-y-5 px-gutter">
                
                {/* Page header — module identity + live signal. Navigation belongs to the dock. */}
                <div className="flex items-start justify-between gap-3 pt-4">
                    <div className="min-w-0">
                        <button
                            onClick={() => setLiveSync(!liveSync)}
                            className={`signal-label flex items-center gap-2 transition-opacity active:opacity-70 ${
                                liveSync ? 'text-black/50 dark:text-white/50' : 'text-black/30 dark:text-white/30'
                            }`}
                            title="点击切换是否开启实时自动更新"
                        >
                            <span className="signal-dot" />
                            <span>{liveSync ? (lang === 'cn' ? '实时动态流' : 'STREAMING') : (lang === 'cn' ? '已暂停' : 'PAUSED')}</span>
                        </button>
                        <h1 className="text-[27px] font-semibold tracking-[-0.038em] leading-[1.05] mt-1.5 text-gray-900 dark:text-white">
                            NewsHub
                        </h1>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Last updated badge */}
                        <div className="hidden md:flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                            <Clock size={12} />
                            <span>{lang === 'cn' ? '上次刷新' : 'Updated'}: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>

                        {/* Language segmented control */}
                        <div className="seg">
                            <button
                                onClick={() => setLang('en')}
                                className={`seg__item !px-3 ${lang === 'en' ? 'is-on' : ''}`}
                            >
                                EN
                            </button>
                            <button
                                onClick={() => setLang('cn')}
                                className={`seg__item !px-3 ${lang === 'cn' ? 'is-on' : ''}`}
                            >
                                中文
                            </button>
                        </div>

                        {/* Force Refresh Button */}
                        <button
                            onClick={() => fetchNews(activeSourceId, true, false)}
                            disabled={loading}
                            className="circle-btn w-10 h-10 tap-scale disabled:opacity-50"
                            title={lang === 'cn' ? '强制拉取一手最新动态' : 'Force Refresh News'}
                        >
                            <RefreshCw size={15} className={loading || isSilentSync ? 'animate-spin text-[#2600FD]' : ''} />
                        </button>
                    </div>
                </div>

                {/* Source rail — horizontal chips, ink marks the active source */}
                <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto no-scrollbar">
                        {sources.map(source => {
                            const isSelected = activeSourceId === source.id;
                            // Custom sources are persisted through JSON, so their lucide icon
                            // arrives as a plain object on reload — fall back to a real component.
                            const Icon = typeof source.icon === 'function' ? source.icon : Globe;
                            return (
                                <div key={source.id} className="relative group shrink-0">
                                    <button
                                        onClick={() => setActiveSourceId(source.id)}
                                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border whitespace-nowrap active:scale-95 transition-transform ${
                                            isSelected
                                                ? 'bg-[#0A0A0B] border-transparent text-white dark:bg-white dark:text-[#0A0A0B]'
                                                : 'bg-white border-black/[0.14] text-black/70 hover:border-black/30 dark:bg-white/[0.06] dark:border-white/[0.15] dark:text-white/70'
                                        }`}
                                    >
                                        <Icon size={14} className={isSelected ? '' : 'text-[#2600FD]'} />
                                        <span>{source.name}</span>
                                    </button>

                                    {source.type === 'custom' && (
                                        <button
                                            onClick={(e) => deleteSource(e, source.id)}
                                            className="absolute -top-1 -right-1 w-4 h-4 bg-[#0A0A0B] dark:bg-white dark:text-[#0A0A0B] text-white rounded-full flex items-center justify-center text-[10px]"
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
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-semibold border border-dashed border-black/[0.18] dark:border-white/[0.2] text-black/45 dark:text-white/45 hover:text-[#2600FD] hover:border-[#2600FD] shrink-0 active:scale-95 transition-transform"
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
                    <div className="animate-fade-in">
                        {/* Lead story — an ink mass, editorial scale */}
                        <NewsCard item={news[0]} lang={lang} lead />

                        {/* Following — hairline separated rows, never nested cards */}
                        {news.length > 1 && (
                            <div className="mt-7">
                                <div className="flex items-baseline justify-between gap-3">
                                    <span className="signal-label text-black/45 dark:text-white/45">
                                        {lang === 'cn' ? '后续报道' : 'FOLLOWING'}
                                    </span>
                                    <span className="signal-label text-black/45 dark:text-white/45">{news.length - 1}</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                                    {news.slice(1).map((item, idx) => (
                                        <NewsCard key={item.id || idx} item={item} lang={lang} />
                                    ))}
                                </div>
                            </div>
                        )}
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
                                        className="ios-input w-full px-3.5 py-3 text-sm"
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
                                        className="ios-input w-full px-3.5 py-3 text-sm"
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

                            {/* Clearance for the fixed bottom navigation dock (mobile sheet only) */}
                            <div className="h-[92px] sm:hidden" aria-hidden="true" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NewsHub;
