
import React, { useState, useEffect } from 'react';
import { Rss, ArrowLeft, RefreshCw, ExternalLink, Globe, Plus, Trash2, X, Image as ImageIcon, Sparkles } from 'lucide-react';

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

// English Presets
const PRESET_SOURCES_EN: Source[] = [
    { id: 'intl', name: 'International', icon: Globe, type: 'rss', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
    { id: 'malaysia', name: 'Malaysia News', icon: Globe, type: 'rss', url: 'https://www.malaymail.com/feed/rss/malaysia' },
    { id: 'us_stocks', name: 'US Stocks', icon: Globe, type: 'rss', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
    { id: 'my_stocks', name: 'Malaysia Stocks', icon: Globe, type: 'rss', url: 'https://www.malaymail.com/feed/rss/money' },
    { id: 'lifestyle', name: 'Lifestyle', icon: Globe, type: 'rss', url: 'https://www.malaymail.com/feed/rss/life' },
    { id: 'ai', name: 'AI News', icon: Globe, type: 'rss', url: 'https://www.wired.com/feed/tag/ai/latest/rss' },
];

// Chinese Presets (Sin Chew Daily & TechNode CN for authentic content)
const PRESET_SOURCES_CN: Source[] = [
    { id: 'intl', name: '国际新闻', icon: Globe, type: 'rss', url: 'https://www.orientaldaily.com.my/feeds/rss/international' },
    { id: 'malaysia', name: '马来西亚新闻', icon: Globe, type: 'rss', url: 'https://www.orientaldaily.com.my/feeds/rss/nation' },
    { id: 'us_stocks', name: '美股新闻', icon: Globe, type: 'rss', url: 'http://www.ftchinese.com/rss/news' }, // FT Chinese News
    { id: 'my_stocks', name: '马股新闻', icon: Globe, type: 'rss', url: 'https://www.orientaldaily.com.my/feeds/rss/business' },
    { id: 'lifestyle', name: '副刊', icon: Globe, type: 'rss', url: 'https://www.orientaldaily.com.my/feeds/rss/lifestyle' },
    { id: 'ai', name: 'AI 领域', icon: Globe, type: 'rss', url: 'https://cn.technode.com/feed/' }, // TechNode CN
];

import { aiService, AIProvider } from '../services/aiService';

const NewsCard: React.FC<{ item: NewsItem; lang: 'en' | 'cn' }> = ({ item, lang }) => {
    const [translatedTitle, setTranslatedTitle] = useState(item.title);
    const [translatedMeta, setTranslatedMeta] = useState(item.metadata);
    const [isTranslating, setIsTranslating] = useState(false);
    const [hasTranslated, setHasTranslated] = useState(false);

    // AI Summary State
    const [aiSummary, setAiSummary] = useState('');
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [showSummary, setShowSummary] = useState(false);

    // Auto-translate / Manual translate handler
    const handleTranslate = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (hasTranslated) {
            // Revert
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

    // AI Summary Takeaway handler
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
            setAiSummary("Failed to generate AI insights. Please check your API Settings.");
        } finally {
            setIsSummarizing(false);
        }
    };

    return (
        <div
            className="group rounded-3xl p-5 flex flex-col justify-between transition-all duration-500 hover:scale-[1.02] bg-[#E0E5EC] h-full"
            style={{
                boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
            }}
        >
            <div className="flex flex-col h-full">
                {/* Image Section / Fallback Placeholder */}
                <div className="w-full h-44 rounded-2xl overflow-hidden mb-4 relative bg-gray-200 shadow-[inset_2px_2px_5px_#b8b9be,inset_-2px_-2px_5px_#ffffff]">
                    {item.image ? (
                        <img
                            src={item.image}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center">
                            <ImageIcon size={32} className="text-gray-400/50" />
                        </div>
                    )}
                    {/* Source Tag */}
                    <span className="absolute top-3 left-3 bg-[#E0E5EC]/90 backdrop-blur-sm text-[9px] font-extrabold text-blue-600 uppercase tracking-widest px-2.5 py-1 rounded-full shadow-sm border border-white/20">
                        {item.source}
                    </span>
                </div>

                {/* Text Content */}
                <div className="flex-1 flex flex-col justify-between">
                    <div className="mb-4">
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="block mb-2">
                            <h3 className="text-sm md:text-base font-extrabold text-gray-800 leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">
                                {translatedTitle}
                            </h3>
                        </a>
                        <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed font-medium">
                            {translatedMeta}
                        </p>
                    </div>

                    {/* AI Summary Box */}
                    {showSummary && (
                        <div className="mb-4 p-3 rounded-2xl bg-[#E0E5EC] text-[11px] text-gray-600 leading-relaxed animate-fade-in-up" style={{ boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}>
                            <p className="font-extrabold text-[9px] text-purple-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Sparkles size={11} /> AI Insights
                            </p>
                            {isSummarizing ? (
                                <div className="flex items-center gap-2 py-1.5 italic text-gray-400 animate-pulse font-bold">
                                    <RefreshCw size={11} className="animate-spin" />
                                    <span>Generating takeaway summary...</span>
                                </div>
                            ) : (
                                <div className="space-y-1 font-bold whitespace-pre-line text-gray-500 leading-snug">
                                    {aiSummary}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-300/40 mt-auto">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{item.time}</span>
                
                <div className="flex gap-2">
                    {/* Sparkles Summary Button */}
                    <button
                        onClick={handleGetAiSummary}
                        disabled={isSummarizing}
                        className={`p-2 rounded-xl flex items-center justify-center transition-all active:scale-95 ${showSummary ? 'text-purple-600' : 'text-gray-400 hover:text-purple-600'}`}
                        style={{
                            background: "#E0E5EC",
                            boxShadow: showSummary
                                ? "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff"
                                : "4px 4px 8px #b8b9be, -4px -4px 8px #ffffff"
                        }}
                        title="AI Insight Takeaways"
                    >
                        <Sparkles size={14} />
                    </button>

                    {/* Translate Button */}
                    <button
                        onClick={handleTranslate}
                        disabled={isTranslating}
                        className={`p-2 rounded-xl flex items-center justify-center transition-all active:scale-95 ${hasTranslated ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500'}`}
                        style={{
                            background: "#E0E5EC",
                            boxShadow: hasTranslated
                                ? "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff"
                                : "4px 4px 8px #b8b9be, -4px -4px 8px #ffffff"
                        }}
                        title="Translate Language"
                    >
                        {isTranslating ? <RefreshCw size={14} className="animate-spin" /> : <Globe size={14} />}
                    </button>

                    {/* Link Button */}
                    <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl flex items-center justify-center text-gray-400 hover:text-blue-500 transition-all active:scale-95"
                        style={{
                            background: "#E0E5EC",
                            boxShadow: "4px 4px 8px #b8b9be, -4px -4px 8px #ffffff"
                        }}
                        title="Read Full Story"
                    >
                        <ExternalLink size={14} />
                    </a>
                </div>
            </div>
        </div>
    );
};

const NewsHub: React.FC<NewsHubProps> = ({ onExit }) => {
    const [lang, setLang] = useState<'en' | 'cn'>('en');

    // Computed available sources based on lang + custom
    const [customSources, setCustomSources] = useState<Source[]>([]);
    const sources = React.useMemo(() => {
        const presets = lang === 'en' ? PRESET_SOURCES_EN : PRESET_SOURCES_CN;
        return [...presets, ...customSources];
    }, [lang, customSources]);

    const [activeSourceId, setActiveSourceId] = useState('intl');
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [newSourceName, setNewSourceName] = useState('');
    const [newSourceUrl, setNewSourceUrl] = useState('');

    // Load custom sources on mount
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
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNews(activeSourceId, false);
    }, [activeSourceId, lang]); // Re-fetch if lang changes (presets URLs change)

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
        if (!confirm('Delete this source?')) return;

        const updatedCustom = customSources.filter(s => s.id !== id);
        setCustomSources(updatedCustom);
        localStorage.setItem('app_custom_news_sources', JSON.stringify(updatedCustom));

        if (activeSourceId === id) {
            setActiveSourceId('intl');
        }
    };

    return (
        <div className="flex h-[calc(100vh-6rem)] overflow-hidden bg-[#E0E5EC] text-[#4A4A4A] flex-col font-sans relative">
            
            {/* Header */}
            <div 
                className="flex items-center justify-between px-4 md:px-8 py-4 bg-[#E0E5EC] z-10 sticky top-0 shrink-0"
                style={{ boxShadow: "0 4px 6px -1px rgba(163,177,198,0.2)" }}
            >
                <div className="flex items-center gap-4 flex-1">
                    <h2 className="text-xl font-black text-gray-800 tracking-tight">NewsHub</h2>
                    
                    {/* Language Toggle */}
                    <div 
                        className="flex items-center p-1 rounded-full bg-[#E0E5EC]"
                        style={{ boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}
                    >
                        <button
                            onClick={() => setLang('en')}
                            className={`px-3.5 py-1 text-xs font-black rounded-full transition-all ${lang === 'en' ? 'text-blue-600' : 'text-gray-400'}`}
                            style={lang === 'en' ? { background: "#E0E5EC", boxShadow: "3px 3px 6px #b8b9be, -3px -3px 6px #ffffff" } : {}}
                        >
                            EN
                        </button>
                        <button
                            onClick={() => setLang('cn')}
                            className={`px-3.5 py-1 text-xs font-black rounded-full transition-all ${lang === 'cn' ? 'text-blue-600' : 'text-gray-400'}`}
                            style={lang === 'cn' ? { background: "#E0E5EC", boxShadow: "3px 3px 6px #b8b9be, -3px -3px 6px #ffffff" } : {}}
                        >
                            中
                        </button>
                    </div>
                </div>

                <button
                    onClick={() => fetchNews(activeSourceId, true)}
                    disabled={loading}
                    className={`p-3 rounded-full hover:scale-105 active:scale-95 transition-all text-gray-600 ${loading ? 'animate-spin' : ''}`}
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                    }}
                    title="Force Refresh Latest News"
                >
                    <RefreshCw size={18} />
                </button>
            </div>

            {/* Horizontal Scrollable Category Bar */}
            <div className="px-4 md:px-8 py-3 bg-[#E0E5EC] border-b border-gray-300/30 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar shrink-0">
                <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
                    {sources.map(source => (
                        <div key={source.id} className="relative group shrink-0">
                            <button
                                onClick={() => setActiveSourceId(source.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all
                                    ${activeSourceId === source.id ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}
                                `}
                                style={activeSourceId === source.id ? {
                                    background: "#E0E5EC",
                                    boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff"
                                } : {
                                    background: "#E0E5EC",
                                    boxShadow: "3px 3px 6px #b8b9be, -3px -3px 6px #ffffff"
                                }}
                            >
                                <source.icon size={12} />
                                <span>{source.name}</span>
                            </button>

                            {source.type === 'custom' && (
                                <button
                                    onClick={(e) => deleteSource(e, source.id)}
                                    className="absolute -top-1 -right-1 p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full shadow transition-all duration-300 active:scale-90"
                                >
                                    <X size={10} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black text-gray-500 hover:text-blue-600 transition-all border border-dashed border-gray-400 hover:border-blue-500 bg-[#E0E5EC] shrink-0"
                >
                    <Plus size={14} />
                    <span>Add Feed</span>
                </button>
            </div>

            {/* Content Responsive Grid */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-7xl mx-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-50 space-y-4">
                            <RefreshCw size={40} className="animate-spin text-blue-500" />
                            <p className="text-sm font-semibold text-gray-500">Fetching latest stories...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-20">
                            <p className="text-red-500 text-sm mb-4 font-bold">{error}</p>
                            <button
                                onClick={() => fetchNews(activeSourceId, true)}
                                className="px-6 py-2.5 rounded-full bg-blue-500 text-white shadow-lg hover:bg-blue-600 transition font-bold"
                            >
                                Retry
                            </button>
                        </div>
                    ) : (
                        <>
                            {news.length === 0 ? (
                                <div className="text-center py-20 text-gray-500 italic">
                                    No news items found.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
                                    {news.map((item, index) => (
                                        <NewsCard
                                            key={index}
                                            item={item}
                                            lang={lang}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Add Custom Feed Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                    <div className="bg-[#E0E5EC] rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
                        <button
                            onClick={() => setShowAddModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                        >
                            <X size={24} />
                        </button>

                        <h3 className="text-lg font-black text-gray-700 mb-6 uppercase tracking-wider">Add Custom RSS Feed</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Source Name</label>
                                <input
                                    type="text"
                                    value={newSourceName}
                                    onChange={(e) => setNewSourceName(e.target.value)}
                                    placeholder="e.g. Financial Times Feed"
                                    className="w-full bg-[#E0E5EC] rounded-xl p-3 outline-none text-gray-700 transition-all text-xs font-bold focus:shadow-inner"
                                    style={{ boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">RSS URL</label>
                                <input
                                    type="text"
                                    value={newSourceUrl}
                                    onChange={(e) => setNewSourceUrl(e.target.value)}
                                    placeholder="https://example.com/rss.xml"
                                    className="w-full bg-[#E0E5EC] rounded-xl p-3 outline-none text-gray-700 transition-all text-xs font-bold focus:shadow-inner"
                                    style={{ boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 text-gray-500 hover:text-gray-700 font-bold text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddSource}
                                    disabled={!newSourceName || !newSourceUrl}
                                    className="px-6 py-2 bg-blue-500 text-white rounded-xl font-bold shadow-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-xs"
                                >
                                    Add Source
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewsHub;
