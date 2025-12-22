
import React, { useState, useEffect } from 'react';
import { Rss, ArrowLeft, RefreshCw, ExternalLink, Globe, Plus, Trash2, X, Image as ImageIcon } from 'lucide-react';

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
    { id: 'intl', name: 'International', icon: Globe, type: 'rss', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
    { id: 'malaysia', name: 'Malaysia News', icon: Globe, type: 'rss', url: 'https://www.thestar.com.my/rss/news/nation' },
    { id: 'us_stocks', name: 'US Stocks', icon: Globe, type: 'rss', url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html' },
    { id: 'my_stocks', name: 'Malaysia Stocks', icon: Globe, type: 'rss', url: 'https://www.thestar.com.my/rss/business/marketwatch' },
    { id: 'lifestyle', name: 'Lifestyle', icon: Globe, type: 'rss', url: 'https://www.thestar.com.my/rss/lifestyle' },
    { id: 'ai', name: 'AI News', icon: Globe, type: 'rss', url: 'https://wired.com/feed/tag/ai/latest/rss' },
];

// Chinese Presets (Sin Chew Daily & TechNode CN for authentic content)
const PRESET_SOURCES_CN: Source[] = [
    { id: 'intl', name: '国际新闻', icon: Globe, type: 'rss', url: 'https://www.sinchew.com.my/category/international/feed/' },
    { id: 'malaysia', name: '马来西亚新闻', icon: Globe, type: 'rss', url: 'https://www.sinchew.com.my/category/nation/feed/' },
    { id: 'us_stocks', name: '美股新闻', icon: Globe, type: 'rss', url: 'https://wallstreetcn.com/rss/global' }, // WallstreetCN for Global/US markets
    { id: 'my_stocks', name: '马股新闻', icon: Globe, type: 'rss', url: 'https://www.sinchew.com.my/category/business/feed/' },
    { id: 'lifestyle', name: '副刊', icon: Globe, type: 'rss', url: 'https://www.sinchew.com.my/category/vice/feed/' },
    { id: 'ai', name: 'AI 领域', icon: Globe, type: 'rss', url: 'https://cn.technode.com/feed/' }, // TechNode CN
];

const NewsHub: React.FC<NewsHubProps> = ({ onExit }) => {
    const [lang, setLang] = useState<'en' | 'cn'>('en');

    // Computed available sources based on lang + custom
    const [customSources, setCustomSources] = useState<Source[]>([]);
    const [sources, setSources] = useState<Source[]>(PRESET_SOURCES_EN);

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

    // Update effective sources list when lang or custom sources change
    useEffect(() => {
        const presets = lang === 'en' ? PRESET_SOURCES_EN : PRESET_SOURCES_CN;
        setSources([...presets, ...customSources]);

        // If active source is not in new list (and is a preset), reset to 'intl'
        // We check by ID. Presets share IDs ('intl', 'malaysia') so switching lang keeps same category if possible.
        // But name changes.
    }, [lang, customSources]);

    const fetchNews = async (sourceId: string) => {
        const source = sources.find(s => s.id === sourceId);
        if (!source) return;

        setLoading(true);
        setError('');
        setNews([]);

        try {
            const payload: any = {};
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
        fetchNews(activeSourceId);
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
        <div className="fixed inset-0 z-50 bg-[#E0E5EC] text-[#4A4A4A] flex flex-col font-sans">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#E0E5EC] z-10"
                style={{ boxShadow: "0 4px 6px -1px rgba(163,177,198,0.3)" }}>
                <button
                    onClick={onExit}
                    className="p-3 rounded-full hover:scale-105 active:scale-95 transition-all text-gray-600"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                    }}
                >
                    <ArrowLeft size={24} />
                </button>

                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold tracking-tight text-gray-700 hidden md:block">NewsHub Beta</h1>

                    {/* Language Toggle */}
                    <div className="flex items-center p-1 rounded-full bg-[#E0E5EC]"
                        style={{ boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}>
                        <button
                            onClick={() => setLang('en')}
                            className={`px-3 py-1 text-sm font-bold rounded-full transition-all ${lang === 'en' ? 'text-blue-600' : 'text-gray-400'}`}
                            style={lang === 'en' ? { background: "#E0E5EC", boxShadow: "3px 3px 6px #b8b9be, -3px -3px 6px #ffffff" } : {}}
                        >
                            EN
                        </button>
                        <button
                            onClick={() => setLang('cn')}
                            className={`px-3 py-1 text-sm font-bold rounded-full transition-all ${lang === 'cn' ? 'text-blue-600' : 'text-gray-400'}`}
                            style={lang === 'cn' ? { background: "#E0E5EC", boxShadow: "3px 3px 6px #b8b9be, -3px -3px 6px #ffffff" } : {}}
                        >
                            中
                        </button>
                    </div>
                </div>

                <button
                    onClick={() => fetchNews(activeSourceId)}
                    disabled={loading}
                    className={`p-3 rounded-full hover:scale-105 active:scale-95 transition-all text-gray-600 ${loading ? 'animate-spin' : ''}`}
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                    }}
                >
                    <RefreshCw size={24} />
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">

                {/* Sidebar (Desktop) */}
                <div className="hidden md:flex flex-col w-72 bg-[#E0E5EC] border-r border-gray-300/50 p-4 space-y-2 overflow-y-auto">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider px-2 mb-2">Sources ({lang.toUpperCase()})</h2>

                    {sources.map(source => (
                        <div key={source.id} className="relative group">
                            <button
                                onClick={() => setActiveSourceId(source.id)}
                                className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl transition-all text-left
                  ${activeSourceId === source.id
                                        ? 'text-blue-600 font-semibold'
                                        : 'text-gray-600 hover:text-gray-800'}`}
                                style={activeSourceId === source.id ? {
                                    background: "#E0E5EC",
                                    boxShadow: "inset 6px 6px 12px #b8b9be, inset -6px -6px 12px #ffffff"
                                } : {}}
                            >
                                <source.icon size={18} />
                                <span className="truncate">{source.name}</span>
                            </button>

                            {source.type === 'custom' && (
                                <button
                                    onClick={(e) => deleteSource(e, source.id)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    ))}

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left text-gray-500 hover:text-blue-500 mt-4 border border-dashed border-gray-400"
                    >
                        <Plus size={18} />
                        <span>Add Source</span>
                    </button>
                </div>

                {/* Mobile Source Selector */}
                <div className="md:hidden flex overflow-x-auto p-4 gap-3 bg-[#E0E5EC] border-b border-gray-300/50 shrink-0">
                    {sources.map(source => (
                        <button
                            key={source.id}
                            onClick={() => setActiveSourceId(source.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-all
                ${activeSourceId === source.id
                                    ? 'text-blue-600'
                                    : 'text-gray-600'}`}
                            style={activeSourceId === source.id ? {
                                background: "#E0E5EC",
                                boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff"
                            } : {
                                background: "#E0E5EC",
                                boxShadow: "3px 3px 6px #b8b9be, -3px -3px 6px #ffffff"
                            }}
                        >
                            {source.id.startsWith('custom_') ? <Rss size={14} /> : <source.icon size={14} />}
                            {source.name}
                        </button>
                    ))}
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium text-gray-500 border border-gray-400 border-dashed"
                    >
                        <Plus size={14} />
                        Add
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-4xl mx-auto space-y-6">

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 opacity-50 space-y-4">
                                <RefreshCw size={40} className="animate-spin text-blue-500" />
                                <p>Fetching latest stories...</p>
                            </div>
                        ) : error ? (
                            <div className="text-center py-20">
                                <p className="text-red-500 text-lg mb-4">{error}</p>
                                <button
                                    onClick={() => fetchNews(activeSourceId)}
                                    className="px-6 py-2 rounded-full bg-blue-500 text-white shadow-lg hover:bg-blue-600 transition"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : (
                            <>
                                {news.length === 0 && (
                                    <div className="text-center py-20 text-gray-500">
                                        No news items found.
                                    </div>
                                )}
                                {news.map((item, index) => (
                                    <div
                                        key={index}
                                        className="group rounded-2xl p-5 md:p-6 transition-all duration-300 hover:-translate-y-1 block bg-[#E0E5EC]"
                                        style={{
                                            boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                                        }}
                                    >
                                        <div className="flex flex-col md:flex-row gap-6">
                                            {/* Image Section (if exists) */}
                                            {item.image && (
                                                <div className="w-full md:w-48 h-32 md:h-auto shrink-0 rounded-xl overflow-hidden bg-gray-200">
                                                    <img
                                                        src={item.image}
                                                        alt={item.title}
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                                    />
                                                </div>
                                            )}

                                            <div className="flex-1 flex flex-col justify-between">
                                                <div>
                                                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
                                                        <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-2 leading-relaxed group-hover:text-blue-600 transition-colors">
                                                            {item.title}
                                                        </h3>
                                                    </a>
                                                    <p className="text-sm text-gray-400 line-clamp-2 md:line-clamp-3 mb-3">
                                                        {item.metadata}
                                                    </p>
                                                </div>

                                                <div className="flex items-center justify-between mt-auto">
                                                    <div className="flex items-center gap-3 text-xs md:text-sm text-gray-500 font-medium">
                                                        <span className="bg-gray-200/50 px-2 py-1 rounded text-gray-600 border border-gray-300/30">
                                                            {item.source}
                                                        </span>
                                                        <span>{item.time}</span>
                                                    </div>

                                                    <a
                                                        href={item.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="hidden md:flex p-2 rounded-lg items-center justify-center text-gray-400 group-hover:text-blue-500 transition-all active:scale-95"
                                                        style={{
                                                            background: "#E0E5EC",
                                                            boxShadow: "4px 4px 8px #b8b9be, -4px -4px 8px #ffffff"
                                                        }}
                                                    >
                                                        <ExternalLink size={18} />
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Source Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                    <div className="bg-[#E0E5EC] rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
                        <button
                            onClick={() => setShowAddModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                        >
                            <X size={24} />
                        </button>

                        <h3 className="text-xl font-bold text-gray-700 mb-6">Add Custom RSS Feed</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-500 mb-1">Source Name</label>
                                <input
                                    type="text"
                                    value={newSourceName}
                                    onChange={(e) => setNewSourceName(e.target.value)}
                                    placeholder="e.g. My Tech Blog"
                                    className="w-full bg-[#E0E5EC] rounded-xl p-3 outline-none text-gray-700 transition-all focus:ring-2 focus:ring-blue-400/50"
                                    style={{ boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-500 mb-1">RSS URL</label>
                                <input
                                    type="text"
                                    value={newSourceUrl}
                                    onChange={(e) => setNewSourceUrl(e.target.value)}
                                    placeholder="https://example.com/feed"
                                    className="w-full bg-[#E0E5EC] rounded-xl p-3 outline-none text-gray-700 transition-all focus:ring-2 focus:ring-blue-400/50"
                                    style={{ boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddSource}
                                    disabled={!newSourceName || !newSourceUrl}
                                    className="px-6 py-2 bg-blue-500 text-white rounded-xl font-bold shadow-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
