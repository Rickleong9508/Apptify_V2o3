import React, { useState, useEffect } from 'react';
import { Rss, RefreshCw, ExternalLink, Globe, Plus, Trash2, X, Image as ImageIcon, Sparkles, ChevronLeft } from 'lucide-react';
import { aiService, AIProvider } from '../services/aiService';

interface NewsItem {
    id: string;
    title: string;
    url: string;
    source: string;
    metadata: string;
    time: string;
    image?: string;
}

interface Source {
    id: string;
    name: string;
    icon: any;
    type: 'preset' | 'custom' | 'rss';
    url?: string;
    presetId?: string;
}

interface NewsHubProps {
    onExit: () => void;
}

const PRESET_SOURCES_EN: Source[] = [
    { id: 'intl', name: 'World', icon: Globe, type: 'rss', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
    { id: 'us_stocks', name: 'US Markets', icon: Globe, type: 'rss', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
    { id: 'ai', name: 'AI & Tech', icon: Globe, type: 'rss', url: 'https://www.wired.com/feed/tag/ai/latest/rss' },
    { id: 'malaysia', name: 'Malaysia', icon: Globe, type: 'rss', url: 'https://www.malaymail.com/feed/rss/malaysia' },
    { id: 'my_stocks', name: 'MY Finance', icon: Globe, type: 'rss', url: 'https://www.malaymail.com/feed/rss/money' },
    { id: 'lifestyle', name: 'Lifestyle', icon: Globe, type: 'rss', url: 'https://www.malaymail.com/feed/rss/life' },
];

const PRESET_SOURCES_CN: Source[] = [
    { id: 'intl', name: '国际新闻', icon: Globe, type: 'rss', url: 'https://www.orientaldaily.com.my/feeds/rss/international' },
    { id: 'us_stocks', name: '美股财经', icon: Globe, type: 'rss', url: 'http://www.ftchinese.com/rss/news' },
    { id: 'ai', name: 'AI 科技', icon: Globe, type: 'rss', url: 'https://cn.technode.com/feed/' },
    { id: 'malaysia', name: '大马热点', icon: Globe, type: 'rss', url: 'https://www.orientaldaily.com.my/feeds/rss/nation' },
    { id: 'my_stocks', name: '马股要闻', icon: Globe, type: 'rss', url: 'https://www.orientaldaily.com.my/feeds/rss/business' },
    { id: 'lifestyle', name: '生活副刊', icon: Globe, type: 'rss', url: 'https://www.orientaldaily.com.my/feeds/rss/lifestyle' },
];

const NewsCard: React.FC<{ item: NewsItem; lang: 'en' | 'cn' }> = ({ item, lang }) => {
    const [translatedTitle, setTranslatedTitle] = useState(item.title);
    const [translatedMeta, setTranslatedMeta] = useState(item.metadata);
    const [isTranslating, setIsTranslating] = useState(false);
    const [hasTranslated, setHasTranslated] = useState(false);

    const [aiSummary, setAiSummary] = useState('');
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [showSummary, setShowSummary] = useState(false);

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

            setTranslatedTitle(data.title);
            setTranslatedMeta(data.summary);
            setHasTranslated(true);
        } catch (e) {
            console.error("Translation failed", e);
            alert("Translation failed. Check API Settings.");
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

            const prompt = `Based on the following news title and summary, generate exactly 3 key bullet points summarizing the insights (in ${lang === 'cn' ? 'Simplified Chinese (zh-CN)' : 'English'}). Keep it short and impactful. Do not output markdown, just the raw text of 3 bullet points separated by newlines.
            
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
        <div className="ios-card p-4 sm:p-5 flex flex-col justify-between transition-all group">
            <div>
                {/* Media Image Thumbnail */}
                <div className="w-full h-40 sm:h-44 rounded-2xl overflow-hidden mb-3.5 relative bg-[var(--ios-fill-tertiary)]">
                    {item.image ? (
                        <img
                            src={item.image}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--ios-label-tertiary)]">
                            <ImageIcon size={32} />
                        </div>
                    )}
                    <span className="absolute top-2.5 left-2.5 ios-glass text-[10px] font-bold text-blue-500 uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">
                        {item.source}
                    </span>
                </div>

                {/* Title & Excerpt */}
                <div className="space-y-2">
                    <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block font-bold text-sm sm:text-base text-[var(--ios-label-primary)] hover:text-blue-500 transition-colors line-clamp-2 leading-snug"
                    >
                        {translatedTitle}
                    </a>
                    <p className="text-xs text-[var(--ios-label-secondary)] line-clamp-3 leading-relaxed">
                        {translatedMeta}
                    </p>
                </div>

                {/* AI Insights Card */}
                {showSummary && (
                    <div className="mt-3 p-3.5 rounded-2xl bg-[var(--ios-fill-tertiary)] text-xs text-[var(--ios-label-secondary)] leading-relaxed space-y-1.5 animate-slide-up">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500 flex items-center gap-1">
                            <Sparkles size={12} />
                            <span>AI Takeaway</span>
                        </span>
                        {isSummarizing ? (
                            <div className="flex items-center gap-2 py-1 italic font-medium text-[var(--ios-label-tertiary)]">
                                <RefreshCw size={12} className="animate-spin text-purple-500" />
                                <span>Distilling key insights...</span>
                            </div>
                        ) : (
                            <div className="whitespace-pre-line font-medium text-[var(--ios-label-primary)]">
                                {aiSummary}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer Row */}
            <div className="flex items-center justify-between pt-3 mt-4 border-t border-[var(--ios-separator)]">
                <span className="text-[10px] text-[var(--ios-label-tertiary)] font-semibold uppercase">
                    {item.time}
                </span>

                <div className="flex items-center gap-1">
                    <button
                        onClick={handleGetAiSummary}
                        disabled={isSummarizing}
                        className={`p-2 rounded-xl tap-scale transition-colors ${
                            showSummary
                                ? 'bg-purple-500/15 text-purple-500'
                                : 'text-[var(--ios-label-secondary)] hover:text-purple-500 hover:bg-[var(--ios-fill-tertiary)]'
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
                                ? 'bg-blue-500/15 text-blue-500'
                                : 'text-[var(--ios-label-secondary)] hover:text-blue-500 hover:bg-[var(--ios-fill-tertiary)]'
                        }`}
                        title="Translate"
                    >
                        {isTranslating ? <RefreshCw size={15} className="animate-spin text-blue-500" /> : <Globe size={15} />}
                    </button>

                    <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-[var(--ios-label-secondary)] hover:text-blue-500 hover:bg-[var(--ios-fill-tertiary)] rounded-xl tap-scale transition-colors"
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
    const [lang, setLang] = useState<'en' | 'cn'>('en');
    const [customSources, setCustomSources] = useState<Source[]>([]);
    
    const sources = React.useMemo(() => {
        const presets = lang === 'en' ? PRESET_SOURCES_EN : PRESET_SOURCES_CN;
        return [...presets, ...customSources];
    }, [lang, customSources]);

    const [activeSourceId, setActiveSourceId] = useState('intl');
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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

    const fetchNews = async (sourceId: string, force = false) => {
        const source = sources.find(s => s.id === sourceId);
        if (!source) return;

        setLoading(true);
        setError('');
        setNews([]);

        try {
            const payload: any = { forceRefresh: force };
            if (source.type === 'preset') {
                payload.source = source.presetId;
            } else {
                payload.source = 'rss';
                payload.url = source.url;
            }

            const response = await fetch('/api/news', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error('Failed to fetch news');

            const data = await response.json();
            setNews(data);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'An error occurred fetching stories.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNews(activeSourceId, false);
    }, [activeSourceId, lang]);

    const handleAddSource = () => {
        if (!newSourceName || !newSourceUrl) return;

        const newSource: Source = {
            id: `custom_${Date.now()}`,
            name: newSourceName,
            icon: Rss,
            type: 'rss',
            url: newSourceUrl
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
        if (!confirm('Delete this feed?')) return;

        const updatedCustom = customSources.filter(s => s.id !== id);
        setCustomSources(updatedCustom);
        localStorage.setItem('app_custom_news_sources', JSON.stringify(updatedCustom));

        if (activeSourceId === id) {
            setActiveSourceId('intl');
        }
    };

    return (
        <div className="min-h-screen pb-24 animate-fade-in text-[var(--ios-label-primary)]">
            <div className="max-w-6xl mx-auto space-y-5">
                {/* Header Row */}
                <div className="flex items-center justify-between gap-4">
                    <button
                        onClick={onExit}
                        className="flex items-center gap-1.5 text-blue-500 font-semibold text-sm tap-scale"
                    >
                        <ChevronLeft size={20} />
                        <span>Back to Launcher</span>
                    </button>

                    <div className="flex items-center gap-2">
                        {/* Segmented language toggle */}
                        <div className="p-1 rounded-full bg-[var(--ios-fill-tertiary)] flex items-center">
                            <button
                                onClick={() => setLang('en')}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                                    lang === 'en'
                                        ? 'bg-blue-500 text-white shadow-sm'
                                        : 'text-[var(--ios-label-secondary)] hover:text-[var(--ios-label-primary)]'
                                }`}
                            >
                                English
                            </button>
                            <button
                                onClick={() => setLang('cn')}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                                    lang === 'cn'
                                        ? 'bg-blue-500 text-white shadow-sm'
                                        : 'text-[var(--ios-label-secondary)] hover:text-[var(--ios-label-primary)]'
                                }`}
                            >
                                中文
                            </button>
                        </div>

                        {/* Force Refresh */}
                        <button
                            onClick={() => fetchNews(activeSourceId, true)}
                            disabled={loading}
                            className="p-2.5 rounded-full ios-button-secondary tap-scale text-[var(--ios-label-primary)]"
                            title="Force Refresh"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin text-blue-500' : ''} />
                        </button>
                    </div>
                </div>

                {/* Horizontal Category Carousel */}
                <div className="flex items-center justify-between gap-3 overflow-x-auto no-scrollbar py-1">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        {sources.map(source => {
                            const isSelected = activeSourceId === source.id;
                            return (
                                <div key={source.id} className="relative group shrink-0">
                                    <button
                                        onClick={() => setActiveSourceId(source.id)}
                                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all tap-scale ${
                                            isSelected
                                                ? 'bg-blue-500 text-white shadow-sm'
                                                : 'bg-[var(--ios-fill-tertiary)] hover:bg-[var(--ios-fill-secondary)] text-[var(--ios-label-secondary)]'
                                        }`}
                                    >
                                        <source.icon size={13} />
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
                        className="flex items-center gap-1 px-3 py-2 rounded-full text-xs font-bold border border-dashed border-[var(--ios-separator)] text-[var(--ios-label-secondary)] hover:text-blue-500 hover:border-blue-500 shrink-0 tap-scale"
                    >
                        <Plus size={14} />
                        <span>Add Feed</span>
                    </button>
                </div>

                {/* Stories Grid */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 space-y-3">
                        <RefreshCw size={32} className="animate-spin text-blue-500" />
                        <span className="text-xs font-semibold text-[var(--ios-label-secondary)]">
                            Curating latest headlines...
                        </span>
                    </div>
                ) : error ? (
                    <div className="text-center py-20 ios-card space-y-3">
                        <p className="text-rose-500 text-xs sm:text-sm font-semibold">{error}</p>
                        <button
                            onClick={() => fetchNews(activeSourceId, true)}
                            className="ios-button-primary text-xs tap-scale"
                        >
                            Retry Loading
                        </button>
                    </div>
                ) : news.length === 0 ? (
                    <div className="text-center py-20 ios-card">
                        <p className="text-xs text-[var(--ios-label-secondary)]">No news items found for this feed.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 animate-fade-in">
                        {news.map((item, index) => (
                            <NewsCard key={index} item={item} lang={lang} />
                        ))}
                    </div>
                )}

                {/* Add RSS Feed Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                        <div className="w-full sm:max-w-md ios-card rounded-t-3xl sm:rounded-3xl p-6 space-y-5 animate-slide-up sm:animate-scale-in">
                            <div className="flex items-center justify-between pb-2 border-b border-[var(--ios-separator)]">
                                <h3 className="font-bold text-base text-[var(--ios-label-primary)]">Add Custom RSS Feed</h3>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="w-8 h-8 rounded-full bg-[var(--ios-fill-tertiary)] flex items-center justify-center text-[var(--ios-label-secondary)] tap-scale"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="space-y-3.5">
                                <div>
                                    <label className="text-[10px] font-semibold text-[var(--ios-label-secondary)] uppercase block mb-1">
                                        Source Name
                                    </label>
                                    <input
                                        className="ios-input"
                                        placeholder="e.g. Bloomberg Tech Feed"
                                        value={newSourceName}
                                        onChange={(e) => setNewSourceName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold text-[var(--ios-label-secondary)] uppercase block mb-1">
                                        RSS Endpoint URL
                                    </label>
                                    <input
                                        className="ios-input"
                                        placeholder="https://example.com/rss.xml"
                                        value={newSourceUrl}
                                        onChange={(e) => setNewSourceUrl(e.target.value)}
                                    />
                                </div>

                                <button
                                    onClick={handleAddSource}
                                    disabled={!newSourceName || !newSourceUrl}
                                    className="w-full ios-button-primary py-3.5 text-sm tap-scale disabled:opacity-40"
                                >
                                    Add RSS Source
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
