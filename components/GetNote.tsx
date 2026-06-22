import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Grid,
    Plus,
    Trash2,
    Check,
    Clock,
    MessageSquare,
    Image as ImageIcon,
    X,
    Play,
    Pause,
    RotateCcw,
    CheckCircle2,
    FileText,
    LogOut,
    Paperclip,
    ChevronDown,
    ChevronUp,
    Sparkles,
    ArrowUpDown,
    ArrowRight,
    History,
    Triangle,
    Star,
    Calendar as CalendarIcon,
    MoreVertical,
    Eye,
    Edit2,
    Maximize2,
    Target,
    Bot,
    Mic,
    User,
    ArrowLeft,
    Database,
    Link as LinkIcon,
    File as FileIcon,
    FileText as FileTextIcon,
    Video as VideoIcon,
    Film,
    Send,
    Search,
    MoreHorizontal,
    Languages,
    ExternalLink,
    RefreshCw
} from 'lucide-react';
import { aiService, AIProvider } from '../services/aiService';
import { useAuth } from './AuthProvider'; // New
import { supabase } from '../services/supabaseClient'; // New

interface GetNoteProps {
    onExit: () => void;
}

// --- Types ---
interface Note {
    id: string;
    title: string;
    content: string;
    image?: string; // Base64 (Deprecated, use attachments)
    attachments?: Attachment[];
    date: string;
    // Threading
    // Threading becomes "Smart Data"
    isThread?: boolean;
    thread?: Note[]; // Mixed content: User Notes, AI Summaries, Q&A Pairs
    role?: 'user' | 'ai' | 'system'; // distinct roles in the thread
    type?: 'note' | 'qa' | 'image_analysis';
    
    // AI Enhancement Fields
    ai_summary?: string;
    ai_keywords?: string[];
    ai_category?: string;
    ai_processed?: boolean;
}

// Simple "Ding" Sound (Base64 MP3)
const NOTIFICATION_SOUND = "data:audio/mp3;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAG84AA0EAAA0016wAAA44AAANYCrHdcaAAAYAAAAAS0YFdgAAAH4AAAB6bT7j7%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%AAAAAAAAAAAAAAAB//uQZAUAB1WI0PuguAAAAHOM/O7gAAEc1TPjWQAAAA44g3gQAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/7kGQbAAfRiDduJ2AAAADHjbeBAAAB52JNy4nQAAAAOOIN4EAAAD///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////7kGQugAAAAAAAA0gAAAB5IAAAAEAAJAJQAAABJEAAABIAAAAAAA//uQZDIABAAAAA0gAAAB5IAAAAEAAJAJQAAABJEAAABIAAAAAAAAAAAAAAAA";

interface Attachment {
    id: string;
    type: 'image' | 'video' | 'pdf' | 'doc' | 'link' | 'audio';
    content: string; // Base64 or URL
    name?: string; // Filename or Title
    size?: string; // Display size (e.g. "1.2MB")
    scrapedText?: string; // Scraped content for links
}

type PriorityLevel = 'T0' | 'T1' | 'T2' | 'T3';

interface Todo {
    id: string;
    title: string;
    description?: string;
    deadline?: string; // ISO String or Local ISO 'YYYY-MM-DDTHH:mm'
    priority: PriorityLevel;
    attachments?: string[]; // Base64
    completed: boolean;
    completedAt?: string;
    createdAt: string;
}


interface Resource {
    id: string;
    type: 'url' | 'pdf' | 'doc' | 'image' | 'txt';
    content: string;
    name: string;
    extractedText?: string;
}

// --- Helpers ---
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                    resolve(dataUrl);
                } else {
                    resolve(readerEvent.target?.result as string);
                }
            };
            img.src = readerEvent.target?.result as string;
        };
        reader.readAsDataURL(file);
    });
};

const getPriorityColor = (p: PriorityLevel) => {
    switch (p) {
        case 'T0': return 'bg-red-500 text-white';
        case 'T1': return 'bg-orange-500 text-white';
        case 'T2': return 'bg-yellow-500 text-black';
        case 'T3': return 'bg-blue-500 text-white';
        default: return 'bg-gray-500 text-white';
    }
};

const calculatePriority = (dateStr: string): PriorityLevel => {
    if (!dateStr) return 'T3';
    const deadline = new Date(dateStr);
    const now = new Date();
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) return 'T0';
    if (diffDays <= 3) return 'T1';
    if (diffDays <= 5) return 'T2';
    return 'T3';
};

// --- Types ---
interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
}

// --- Main Component ---
const GetNote: React.FC<GetNoteProps> = ({ onExit }) => {
    const [activeTab, setActiveTab] = useState<'notes' | 'todo' | 'focus'>('notes');

    // --- States ---
    const [notes, setNotes] = useState<Note[]>(() => {
        const saved = localStorage.getItem('gn_notes');
        return saved ? JSON.parse(saved) : [];
    });
    const [todos, setTodos] = useState<Todo[]>(() => {
        const saved = localStorage.getItem('gn_todos');
        return saved ? JSON.parse(saved) : [];
    });

    // --- Global AI State ---
    const [isGlobalChatOpen, setIsGlobalChatOpen] = useState(false);
    const [globalChatInput, setGlobalChatInput] = useState('');
    const [globalMessages, setGlobalMessages] = useState<Note[]>([]);
    const [isAiThinking, setIsAiThinking] = useState(false);
    const [globalResources, setGlobalResources] = useState<Resource[]>([]);
    const [isProcessingResource, setIsProcessingResource] = useState(false);
    const [aiMode, setAiMode] = useState<'general' | 'ask_notes'>('general');

    // Deep Linking State
    const [targetNoteId, setTargetNoteId] = useState<string | null>(null);

    // --- Voice Input State ---
    const [isListening, setIsListening] = useState(false);
    const [speechLang, setSpeechLang] = useState<'zh-CN' | 'en-US'>('zh-CN');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const recognitionRef = useRef<any>(null);

    // --- Confirmation State ---
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; action: () => void }>({ title: '', message: '', action: () => { } });

    const openConfirm = (title: string, message: string, action: () => void) => {
        setConfirmConfig({ title, message, action });
        setConfirmOpen(true);
    };

    // Adjust textarea height
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const nextHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${Math.min(nextHeight, 150)}px`;
        }
    }, [globalChatInput]);

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                const recognition = new SpeechRecognition();
                recognition.lang = speechLang;
                recognition.continuous = false; // Set to true if you want continuous dictation until stop
                recognition.interimResults = false;

                recognition.onstart = () => setIsListening(true);
                recognition.onend = () => setIsListening(false);
                recognition.onresult = (event: any) => {
                    const transcript = event.results[0][0].transcript;
                    setGlobalChatInput(prev => prev + (prev ? ' ' : '') + transcript);
                };
                recognition.onerror = (event: any) => {
                    console.error("Speech Error", event.error);
                    setIsListening(false);
                };
                recognitionRef.current = recognition;
                recognition.start();
            } else {
                alert("Speech recognition not supported in this browser.");
            }
        }
    };

    // Shared state for API
    const [aiProvider] = useState<AIProvider>(() => (localStorage.getItem('app_global_ai_provider') as AIProvider) || 'google');
    const [apiKey] = useState(() => localStorage.getItem('app_global_api_key') || '');
    const [aiModel] = useState(() => localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash');

    // --- Focus Timer State ---
    const [focusTimeLeft, setFocusTimeLeft] = useState(25 * 60);
    const [focusIsActive, setFocusIsActive] = useState(false);
    const [focusMode, setFocusMode] = useState<'FOCUS' | 'BREAK'>('FOCUS');

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (focusIsActive && focusTimeLeft > 0) interval = setInterval(() => setFocusTimeLeft(t => t - 1), 1000);
        else if (focusTimeLeft === 0 && focusIsActive) {
            setFocusIsActive(false);
            new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play().catch(() => { });
        }
        return () => clearInterval(interval);
    }, [focusIsActive, focusTimeLeft]);

    // --- Sync State ---
    const { session, user } = useAuth();
    const [isSyncing, setIsSyncing] = useState(false);
    const [showSyncSuccess, setShowSyncSuccess] = useState(false);
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    // --- Load Data (Local then Cloud) ---
    // --- Load Data (Local then Cloud) ---
    const fetchData = async () => {
        setIsDataLoaded(false);
        // 1. Load Local
        const savedNotes = localStorage.getItem('gn_notes');
        const savedTodos = localStorage.getItem('gn_todos');
        let localTime = 0;

        if (savedNotes) setNotes(JSON.parse(savedNotes));
        if (savedTodos) setTodos(JSON.parse(savedTodos));

        // Try to find local timestamp if we stored it
        const savedMeta = localStorage.getItem('gn_meta');
        if (savedMeta) {
            localTime = new Date(JSON.parse(savedMeta).lastUpdated).getTime();
        }

        // 2. Sync Cloud if Logged In
        if (session && user) {
            setIsSyncing(true);
            try {
                const { data, error } = await supabase
                    .from('user_data')
                    .select('data, updated_at')
                    .eq('user_id', user.id)
                    .single();

                if (data && data.data && data.data.getnote) {
                    const cloudApp = data.data.getnote;
                    const cloudTime = new Date(cloudApp.lastUpdated || data.updated_at).getTime();

                    console.log(`Sync Check - Local: ${localTime}, Cloud: ${cloudTime}`);

                    if (cloudTime > localTime) {
                        console.log("Sync: Cloud (GetNote) is newer, applying...");
                        setNotes(cloudApp.notes || []);
                        setTodos(cloudApp.todos || []);

                        // Update local storage to match cloud state immediately
                        localStorage.setItem('gn_notes', JSON.stringify(cloudApp.notes || []));
                        localStorage.setItem('gn_todos', JSON.stringify(cloudApp.todos || []));
                        localStorage.setItem('gn_meta', JSON.stringify({ lastUpdated: new Date(cloudTime).toISOString() }));
                    }
                }
            } catch (err) {
                console.error("Sync error:", err);
            } finally {
                setIsSyncing(false);
            }
        }
        setIsDataLoaded(true);
    };

    useEffect(() => {
        fetchData();
    }, [session, user]);

    const handleManualSync = () => {
        fetchData();
    };

    // --- Realtime Sync Subscription ---
    useEffect(() => {
        if (!user) return;

        const channel = supabase.channel(`getnote_sync_${user.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'user_data', filter: `user_id=eq.${user.id}` },
                (payload) => {
                    const newData = payload.new as any;
                    if (newData && newData.data && newData.data.getnote) {
                        const cloudApp = newData.data.getnote;
                        console.log("Realtime: Remote update received (GetNote)", cloudApp);

                        setNotes(cloudApp.notes || []);
                        setTodos(cloudApp.todos || []);

                        // Visual Sync Indicator
                        setIsSyncing(true);
                        setTimeout(() => setIsSyncing(false), 1000);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    // --- Save Data (Local & Cloud) ---
    useEffect(() => {
        if (!isDataLoaded) return;

        // Save Local
        try {
            localStorage.setItem('gn_notes', JSON.stringify(notes));
            localStorage.setItem('gn_todos', JSON.stringify(todos));
            localStorage.setItem('gn_meta', JSON.stringify({ lastUpdated: new Date().toISOString() }));
        } catch (e) {
            console.error("Local Save Error", e);
        }

        // Save Cloud (Debounced)
        if (session && user) {
            const pushToCloud = async () => {
                setIsSyncing(true);
                try {
                    const { data: existing } = await supabase.from('user_data').select('id, data').eq('user_id', user.id).single();

                    let finalData = existing?.data || {};
                    finalData.getnote = {
                        notes,
                        todos,
                        lastUpdated: new Date().toISOString()
                    };

                    if (existing?.id) {
                        await supabase.from('user_data').update({
                            data: finalData,
                            updated_at: new Date().toISOString()
                        }).eq('user_id', user.id);
                    } else {
                        await supabase.from('user_data').insert({
                            user_id: user.id,
                            data: finalData,
                            updated_at: new Date().toISOString()
                        });
                    }
                    setShowSyncSuccess(true);
                    setTimeout(() => setShowSyncSuccess(false), 2000);
                } catch (err) {
                    console.error("Cloud save failed", err);
                } finally {
                    setIsSyncing(false);
                }
            };
            const timer = setTimeout(pushToCloud, 2000);
            return () => clearTimeout(timer);
        }
    }, [notes, todos, isDataLoaded, session, user]);

    // --- Expose State to Window for Ask Apptify ---
    useEffect(() => {
        (window as any).__apptify_getnote = {
            notes,
            setNotes,
            todos,
            setTodos,
            activeTab,
            setActiveTab
        };
        return () => {
            (window as any).__apptify_getnote = null;
        };
    }, [notes, todos, activeTab]);

    // --- Deadline Notifications ---
    const notifiedTasksRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        // Request permission on mount
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }

        const checkDeadlines = () => {
            const now = new Date();
            const activeTodos = todos.filter(t => !t.completed && t.deadline);

            activeTodos.forEach(t => {
                if (!t.deadline) return;
                const due = new Date(t.deadline);
                const diff = now.getTime() - due.getTime();

                // If it's due (diff >= 0) and we haven't notified
                if (diff >= 0 && !notifiedTasksRef.current.has(t.id)) {
                    // Only notify if it became due recently (e.g. within last minute) 
                    // OR if the user just wants to know what's due. 
                    // Let's restrict to recent (60s) to be safe for now.
                    if (diff < 60000) {
                        // Trigger Alert
                        try {
                            const audio = new Audio(NOTIFICATION_SOUND);
                            audio.play().catch(e => console.warn("Audio play failed", e));
                        } catch (e) { console.error("Audio error", e); }

                        if (Notification.permission === 'granted') {
                            new Notification(`Task Due: ${t.title}`, {
                                body: `Priority: ${t.priority}`,
                                icon: '/favicon.ico' // fallback
                            });
                        } else {
                            console.warn("Notification permission NOT granted:", Notification.permission);
                        }

                        notifiedTasksRef.current.add(t.id);
                    } else {
                        // Mark as notified if it's too old so we don't re-eval it
                        notifiedTasksRef.current.add(t.id);
                    }
                }
            });
        };

        const interval = setInterval(checkDeadlines, 10000); // Check every 10s
        checkDeadlines(); // Initial check

        return () => clearInterval(interval);
    }, [todos]);

    const processResource = async (res: Resource): Promise<string> => {
        if (res.type === 'image') return ''; // Images handled natively if supported

        try {
            const response = await fetch('/api/process_input', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: res.type,
                    content: res.content,
                    // For URLs, content is URL. For files, content is base64 (stripped of prefix in logic or here? logic expects raw base64 usually, let's check)
                    // My helper returns data URL. I need to strip for the API if I wrote it that way.
                    // The API does: Buffer.from(content, 'base64'). So I should strip the data:image/xyz;base64, prefix.
                })
            });

            // Fix for base64 sending: fetch body content handling needs to be robust. 
            // Let's refine the body below in the actual call
            return "";
        } catch (e) { return ""; }
    };

    const handleResourceAdd = async (file: File | null, url?: string) => {
        if (!file && !url) return;

        setIsProcessingResource(true);
        try {
            let newRes: Resource;
            let extracted = "";

            if (url) {
                newRes = { id: Date.now().toString(), type: 'url', content: url, name: url };
                // Server-side extraction
                const apiRes = await fetch('/api/process_input', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'url', content: url })
                });
                const data = await apiRes.json();
                if (data.text) extracted = data.text;
                newRes.extractedText = extracted;

            } else if (file) {
                // Check DeepSeek Image Constraint
                if (file.type.startsWith('image/') && aiModel.toLowerCase().includes('deepseek')) {
                    alert("DeepSeek is text-focused. Please switch to Gemini for image analysis, or upload a document.");
                    setIsProcessingResource(false);
                    return;
                }

                const base64 = await fileToBase64(file);
                let type: Resource['type'] = 'doc';
                if (file.type.startsWith('image/')) type = 'image';
                else if (file.type === 'application/pdf') type = 'pdf';
                else if (file.type === 'text/plain') type = 'txt';

                // Strip prefix for API
                const rawBase64 = base64.split(',')[1];

                newRes = { id: Date.now().toString(), type, content: base64, name: file.name };

                if (type !== 'image') {
                    const apiRes = await fetch('/api/process_input', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type, content: rawBase64 })
                    });
                    const data = await apiRes.json();
                    if (data.text) extracted = data.text;
                    newRes.extractedText = extracted;
                }
            } else {
                setIsProcessingResource(false);
                return;
            }

            setGlobalResources(prev => [...prev, newRes]);

        } catch (e: any) {
            alert("Failed to process resource: " + e.message);
        } finally {
            setIsProcessingResource(false);
        }
    };

    const renderTextWithNoteLinks = (text: string) => {
        const parts = text.split(/(\[ID:\s*[^\]]+\])/g);
        return parts.map((part, idx) => {
            const match = part.match(/\[ID:\s*([^\]]+)\]/);
            if (match) {
                const noteId = match[1];
                let note = notes.find(n => n.id === noteId);
                if (!note) {
                    for (const n of notes) {
                        if (n.thread) {
                            const sub = n.thread.find(t => t.id === noteId);
                            if (sub) {
                                note = sub;
                                break;
                            }
                        }
                    }
                }
                if (note) {
                    return (
                        <button
                            key={idx}
                            onClick={() => {
                                setIsGlobalChatOpen(false);
                                setTargetNoteId(noteId);
                                setActiveTab('notes');
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 font-bold hover:bg-blue-100 transition-colors text-[11px] align-baseline shadow-sm border border-white/40"
                        >
                            {note.title || "Note"} <ExternalLink size={10} />
                        </button>
                    );
                }
                return <span key={idx} className="text-gray-400 italic text-xs">[ID: {noteId}]</span>;
            }
            return part;
        });
    };

    const renderFormattedContent = (content: string) => {
        if (!content) return null;
        const lines = content.split('\n');
        return (
            <div className="space-y-2">
                {lines.map((line, lineIdx) => {
                    const trimmed = line.trim();
                    if (!trimmed) return <div key={lineIdx} className="h-1.5" />;

                    if (trimmed.startsWith('## ')) {
                        return (
                            <h4 key={lineIdx} className="text-xs font-bold text-gray-800 border-b border-gray-300/30 pb-1 mt-4 first:mt-0 uppercase tracking-wider">
                                {trimmed.replace(/^## /, '')}
                            </h4>
                        );
                    }
                    if (trimmed.startsWith('### ')) {
                        return (
                            <h5 key={lineIdx} className="text-xs font-bold text-gray-700 mt-2">
                                {trimmed.replace(/^### /, '')}
                            </h5>
                        );
                    }

                    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                        const text = trimmed.replace(/^[-*]\s+/, '');
                        return (
                            <div key={lineIdx} className="flex items-start gap-2 pl-2">
                                <span className="text-blue-500 mt-1.5 shrink-0 w-1 h-1 rounded-full bg-blue-500" />
                                <span className="text-xs text-gray-600 leading-relaxed font-medium">{renderTextWithNoteLinks(text)}</span>
                            </div>
                        );
                    }

                    return (
                        <p key={lineIdx} className="text-xs text-gray-600 leading-relaxed font-medium">
                            {renderTextWithNoteLinks(trimmed)}
                        </p>
                    );
                })}
            </div>
        );
    };

    const searchNotes = (query: string, allNotes: Note[]): Note[] => {
        if (!query.trim()) return [];
        const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
        if (queryTokens.length === 0) return [];

        const scored = allNotes.map(note => {
            let score = 0;
            const title = (note.title || '').toLowerCase();
            const content = (note.content || '').toLowerCase();
            const category = (note.ai_category || '').toLowerCase();
            const keywords = (note.ai_keywords || []).map(k => k.toLowerCase());

            queryTokens.forEach(token => {
                if (title.includes(token)) score += 10;
                if (category.includes(token)) score += 8;
                keywords.forEach(keyword => {
                    if (keyword.includes(token) || token.includes(keyword)) {
                        score += 6;
                    }
                });
                if (content.includes(token)) score += 3;
            });

            if (note.thread) {
                note.thread.forEach(item => {
                    const subTitle = (item.title || '').toLowerCase();
                    const subContent = (item.content || '').toLowerCase();
                    queryTokens.forEach(token => {
                        if (subTitle.includes(token)) score += 2;
                        if (subContent.includes(token)) score += 1;
                    });
                });
            }

            return { note, score };
        });

        return scored
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.note)
            .slice(0, 20);
    };

    const handleGlobalAskAi = async () => {
        if (!globalChatInput.trim() && globalResources.length === 0) return;

        if (!apiKey) {
            setGlobalMessages(prev => [...prev, {
                id: Date.now().toString(),
                title: 'System',
                content: "⚠️ Configuration Error: Please set your AI API Key in 'Global Settings' (icon on main dashboard) to use the AI features.",
                date: new Date().toISOString(),
                role: 'system',
                type: 'note'
            }]);
            return;
        }

        const userQ = globalChatInput;
        setGlobalChatInput('');
        setIsAiThinking(true);

        // Branch by Mode
        if (aiMode === 'ask_notes') {
            const matchedNotes = searchNotes(userQ, notes);
            let retrievedNotesContext = "";

            if (matchedNotes.length > 0) {
                matchedNotes.forEach(n => {
                    retrievedNotesContext += `[ID: ${n.id}] Title: ${n.title || 'Untitled'}\n`;
                    if (n.ai_category) retrievedNotesContext += `Category: ${n.ai_category}\n`;
                    if (n.ai_summary) retrievedNotesContext += `Summary: ${n.ai_summary}\n`;
                    if (n.ai_keywords && n.ai_keywords.length > 0) retrievedNotesContext += `Keywords: ${n.ai_keywords.join(', ')}\n`;
                    retrievedNotesContext += `Content: ${n.content || '(Empty)'}\n`;
                    
                    if (n.thread && n.thread.length > 0) {
                        retrievedNotesContext += `Sub-notes:\n`;
                        n.thread.forEach(item => {
                            retrievedNotesContext += `- ${item.title || 'Note'}: ${item.content || ''}\n`;
                        });
                    }
                    retrievedNotesContext += `----------------------------------------\n\n`;
                });
            } else {
                retrievedNotesContext = "No notes matched this search query in the user's vault.";
            }

            const qNote: Note = {
                id: Date.now().toString(),
                title: 'You Asked',
                content: userQ,
                date: new Date().toISOString(),
                role: 'user',
                type: 'qa'
            };
            setGlobalMessages(prev => [...prev, qNote]);

            const systemInstruction = `You are an AI Knowledge Assistant.
The following are notes from the user's personal knowledge vault.
Your tasks:
1. Analyze all relevant notes.
2. Identify patterns and key ideas.
3. Generate a concise summary.
4. Provide actionable conclusions.
5. List source notes used.

You MUST follow this exact response format:
## Summary
[Your high-level overview here]

## Key Insights
- [Insight 1]
- [Insight 2]
- [etc.]

## Conclusion
[Your actionable recommendation here]

## Related Notes
- [List of note titles used, include their [ID: note_id] tag so the user can click and view them, e.g. "Prompt Engineering Guide [ID: 1718950]"]`;

            const prompt = `Question:
${userQ}

Notes:
${retrievedNotesContext}`;

            try {
                const answer = await aiService.generate(aiProvider, aiModel, apiKey, prompt, systemInstruction);
                const aNote: Note = {
                    id: (Date.now() + 1).toString(),
                    title: 'AI Answer (Notes)',
                    content: answer,
                    date: new Date().toISOString(),
                    role: 'ai',
                    type: 'qa'
                };
                setGlobalMessages(prev => [...prev, aNote]);
            } catch (e: any) {
                const errNote: Note = {
                    id: (Date.now() + 1).toString(),
                    title: 'Error',
                    content: "Error: " + e.message,
                    date: new Date().toISOString(),
                    role: 'system',
                    type: 'qa'
                };
                setGlobalMessages(prev => [...prev, errNote]);
            } finally {
                setIsAiThinking(false);
            }
            return;
        }

        // --- General Chat Mode ---
        // Prepare context from Resources
        let resourceContext = "";
        const imagesToAttach: string[] = [];

        globalResources.forEach(res => {
            if (res.type === 'image') {
                imagesToAttach.push(res.content);
            } else if (res.extractedText) {
                resourceContext += `\n[Context from ${res.name}]:\n${res.extractedText.slice(0, 5000)}\n... (truncated)\n`;
            } else {
                resourceContext += `\n[Attachment: ${res.name} (${res.type})] - Content not extracted.\n`;
            }
        });

        // --- AUTO-DETECT & PROCESS INLINE LINKS ---
        try {
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const foundUrls = userQ.match(urlRegex);

            if (foundUrls && foundUrls.length > 0) {
                for (const url of foundUrls) {
                    try {
                        const res = await fetch('/api/process_input', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: 'url', content: url })
                        });
                        const data = await res.json();
                        if (data.text) {
                            resourceContext += `\n[Analyzed Link: ${url}]\n${data.text.slice(0, 5000)}\n--------------------\n`;
                        }
                    } catch (e) {
                        console.error("Link scan failed", e);
                        resourceContext += `\n[Link Error: ${url}] - Failed to access content.\n`;
                    }
                }
            }
        } catch (e) { console.error("URL Scan Error", e); }

        setGlobalResources([]);

        const qNote: Note = {
            id: Date.now().toString(),
            title: 'You Asked',
            content: userQ + (resourceContext ? "\n\n(Attached Resources)" : ""),
            date: new Date().toISOString(),
            role: 'user',
            type: 'qa'
        };
        setGlobalMessages(prev => [...prev, qNote]);

        let context = "You are the 'GetNote' Intelligent Assistant. Your goal is to help the user manage their knowledge base by connecting dots, finding information, and providing deep insights.\n";
        context += "CORE INSTRUCTIONS:\n";
        context += "1. **Analyze Intent**: When the user asks a question, first think about what they *really* mean. If they say 'vacation', they might be looking for 'holiday', 'trip', 'flight', or 'hotel' notes. Use synonyms and concept matching.\n";
        context += "2. **Deep Search**: Look through the 'USER NOTES' provided below. Do not just look for exact title matches. Read the *content* of the notes to find answers.\n";
        context += "3. **Provide Direct Access**: When you find a relevant note (even if it's a partial match), you MUST include its ID tag `[ID: <note_id>]` immediately before or after the note's title in your response. This allows the user to click and view it.\n";
        context += "4. **Be Helpful**: If you can't find an exact match, say 'I couldn't find a note exactly confirming that, but here are some related notes:' and list the closest matches.\n";
        context += "5. **External Links**: If the 'ATTACHED RESOURCES' section below contains analyzed text from URLs the user provided, use that information to answer their questions.\n";
        context += "6. **Reasoning**: Don't just act as a database. If the user asks 'How much did I spend on food?', look for notes containing numbers and food items and try to sum them up or summarize them.\n\n";

        if (resourceContext) {
            context += "--- ATTACHED RESOURCES (High Priority) ---\n" + resourceContext + "\n----------------------------------------\n\n";
        }

        context += "--- USER NOTES (DATABASE) ---\n";
        notes.forEach(n => {
            if (n.title || n.content || (n.thread && n.thread.length > 0)) {
                context += `[ID: ${n.id}] Title: ${n.title || 'Untitled'}\nBody: ${n.content || '(Empty)'}\n`;
                if (n.thread && n.thread.length > 0) {
                    context += "Nested Thread/Conversation Content:\n";
                    n.thread.forEach(t => {
                        context += `- [ID: ${t.id}] [${t.role || 'User'}]: ${t.content}\n`;
                    });
                }
                context += "--------------------\n\n";
            }
        });

        context += "--- USER TASKS ---\n";
        todos.filter(t => !t.completed).forEach(t => {
            context += `Task: ${t.title} (Priority: ${t.priority}, Due: ${t.deadline || 'None'})\n`;
        });

        try {
            const answer = await aiService.generate(aiProvider, aiModel, apiKey, userQ, context, imagesToAttach);
            const aNote: Note = {
                id: (Date.now() + 1).toString(),
                title: 'AI Answer',
                content: answer,
                date: new Date().toISOString(),
                role: 'ai',
                type: 'qa'
            };
            setGlobalMessages(prev => [...prev, aNote]);
        } catch (e: any) {
            const errNote: Note = {
                id: (Date.now() + 1).toString(),
                title: 'Error',
                content: "Error: " + e.message,
                date: new Date().toISOString(),
                role: 'system',
                type: 'qa'
            };
            setGlobalMessages(prev => [...prev, errNote]);
        } finally {
            setIsAiThinking(false);
        }
    };

    const navItems = [
        { id: 'notes', icon: FileText, label: 'Notes' },
        { id: 'todo', icon: CheckCircle2, label: 'Tasks' },
        { id: 'focus', icon: Clock, label: 'Focus' }
    ];

    return (
        <div className="flex h-screen overflow-hidden bg-[#E0E5EC] text-[#4A4A4A] font-sans selection:bg-blue-500/20 transition-colors duration-300 relative">

            {/* Main Content Area */}
            <main className="flex-1 w-full h-full overflow-y-auto relative scroll-smooth">
                <div className="max-w-5xl mx-auto p-4 md:p-8 pb-40 animate-fade-in relative min-h-full">

                    {/* Header aka Dynamic Island Area */}
                    <div className="sticky top-4 z-30 mb-8 flex justify-between items-center px-2">
                        <div
                            onClick={onExit}
                            className="flex items-center gap-3 pl-2 opacity-60 hover:opacity-100 transition-all cursor-pointer group px-4 py-2 rounded-[20px]"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                            }}
                        >
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-gray-600 shadow-inner group-hover:scale-110 transition-transform">
                                <Triangle size={10} fill="currentColor" className="rotate-180" />
                            </div>
                            <span className="font-semibold text-sm tracking-tight text-gray-700">GetNote</span>
                        </div>

                        {/* Sync Status & Manual Trigger */}
                        <div className="flex items-center gap-4 mr-auto ml-4">
                            <button
                                onClick={handleManualSync}
                                disabled={isSyncing}
                                className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium text-gray-500 hover:text-blue-600 hover:bg-white/50 transition-all border border-transparent hover:border-blue-100"
                                title="Force Cloud Sync"
                            >
                                <RefreshCw size={12} className={isSyncing ? "animate-spin text-blue-500" : ""} />
                                {isSyncing ? "Syncing..." : "Cloud Sync"}
                            </button>

                            {showSyncSuccess && !isSyncing && (
                                <div className="flex items-center gap-1 text-xs text-green-500 font-medium animate-fade-in">
                                    <CheckCircle2 size={12} />
                                    <span>Saved</span>
                                </div>
                            )}
                        </div>

                    </div>

                    {/* View Renderer */}
                    <div className="animate-slide-up">
                        {activeTab === 'notes' && <NotesView notes={notes} setNotes={setNotes} openGlobalChat={() => {}} targetNoteId={targetNoteId} setTargetNoteId={setTargetNoteId} />}
                        {activeTab === 'todo' && <TodoView todos={todos} setTodos={setTodos} />}
                        {activeTab === 'focus' && (
                            <FocusView
                                timeLeft={focusTimeLeft}
                                setTimeLeft={setFocusTimeLeft}
                                isActive={focusIsActive}
                                setIsActive={setFocusIsActive}
                                mode={focusMode}
                                setMode={setFocusMode}
                            />
                        )}
                    </div>
                </div>
            </main>

            {/* FLOATING CLAY NAVIGATION DOCK */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-auto">
                <nav
                    className="rounded-[32px] px-2 py-2 flex items-center gap-4 transition-transform hover:scale-[1.02]"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                    }}
                >
                    {navItems.map((item) => {
                        const isActive = activeTab === item.id;
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id as any)}
                                className={`
                                    flex items-center justify-center w-14 h-14 rounded-[24px] transition-all duration-300 relative group
                                    ${isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}
                                `}
                                style={isActive ? {
                                    background: "#E0E5EC",
                                    boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                } : {}}
                            >
                                <Icon
                                    size={24}
                                    strokeWidth={isActive ? 2.5 : 2}
                                />
                            </button>
                        )
                    })}
                </nav>
            </div>

            {/* GLOBAL AI OVERLAY - CLAY STYLE */}
            {false && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/10 backdrop-blur-sm" onClick={() => setIsGlobalChatOpen(false)}></div>
                    <div className="w-full max-w-[450px] bg-[#E0E5EC] h-full shadow-2xl relative flex flex-col animate-slide-left border-l border-white/40">
                        <div
                            className="p-4 pt-6 sticky top-0 z-10 flex justify-between items-center z-50"
                            style={{ background: "#E0E5EC", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}
                        >
                            <h3 className="font-bold text-lg flex items-center gap-2 text-gray-700"><Sparkles size={18} className="text-purple-500" /> Intelligence</h3>
                            <button
                                onClick={() => setIsGlobalChatOpen(false)}
                                className="w-10 h-10 flex items-center justify-center rounded-full text-gray-500 hover:text-red-500 transition-colors active:scale-95"
                                style={{
                                    background: "#E0E5EC",
                                    boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Mode Selector */}
                        <div className="px-4 py-2 flex gap-2 border-b border-gray-200/20 pb-3" style={{ background: "#E0E5EC" }}>
                            <button
                                onClick={() => setAiMode('general')}
                                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${aiMode === 'general' ? 'text-blue-600 bg-white/40 shadow-inner' : 'text-gray-400 hover:text-gray-600 bg-transparent'}`}
                                style={aiMode === 'general' ? {
                                    boxShadow: "inset 2px 2px 5px #b8b9be, inset -2px -2px 5px #ffffff"
                                } : {}}
                            >
                                Chat Assistant
                            </button>
                            <button
                                onClick={() => setAiMode('ask_notes')}
                                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${aiMode === 'ask_notes' ? 'text-purple-600 bg-white/40 shadow-inner' : 'text-gray-400 hover:text-gray-600 bg-transparent'}`}
                                style={aiMode === 'ask_notes' ? {
                                    boxShadow: "inset 2px 2px 5px #b8b9be, inset -2px -2px 5px #ffffff"
                                } : {}}
                            >
                                Ask My Notes
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {globalMessages.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 opacity-60">
                                    <Bot size={48} className="mb-4 text-gray-300" />
                                    {aiMode === 'general' ? (
                                        <>
                                            <p className="text-sm font-bold text-gray-700">Chat Assistant</p>
                                            <p className="text-xs text-gray-500 mt-1 max-w-[280px]">Ask general questions, brainstorm ideas, or upload documents for custom insights.</p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-sm font-bold text-purple-700">Ask My Notes</p>
                                            <p className="text-xs text-gray-500 mt-1 max-w-[280px]">Search and synthesize patterns, facts, and conclusions directly from your personal knowledge vault.</p>
                                        </>
                                    )}
                                </div>
                            )}
                            {globalMessages.map((msg, i) => (
                                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white shadow-sm ${msg.role === 'user' ? 'bg-gray-700' : 'bg-blue-500'}`}
                                        style={{ boxShadow: "3px 3px 6px #b8b9be, -3px -3px 6px #ffffff" }}
                                    >
                                        {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
                                    </div>
                                    <div
                                        className={`p-5 rounded-[24px] max-w-[85%] text-sm leading-relaxed ${msg.role === 'user'
                                            ? 'bg-[#E0E5EC] text-gray-800 rounded-tr-md' // User Bubble
                                            : 'bg-[#E0E5EC] text-gray-800 rounded-tl-md' // AI Bubble
                                            }`}
                                        style={msg.role === 'user' ? {
                                            boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff"
                                        } : {
                                            background: "#E0E5EC",
                                            boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                        }}
                                    >
                                        {msg.role === 'user' ? (
                                            <p className="whitespace-pre-wrap">{msg.content}</p>
                                        ) : msg.content.includes('## ') ? (
                                            renderFormattedContent(msg.content)
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                {msg.content.split(/(\[ID:\s*[^\]]+\])/g).map((part, idx) => {
                                                    const match = part.match(/\[ID:\s*([^\]]+)\]/);
                                                    if (match) {
                                                        const noteId = match[1];

                                                        // 1. Try find top-level
                                                        let note = notes.find(n => n.id === noteId);

                                                        // 2. If not found, look for sub-note
                                                        if (!note) {
                                                            for (const n of notes) {
                                                                if (n.thread) {
                                                                    const sub = n.thread.find(t => t.id === noteId);
                                                                    if (sub) {
                                                                        note = sub;
                                                                        break;
                                                                    }
                                                                }
                                                            }
                                                        }

                                                        if (note) {
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    onClick={() => {
                                                                        setIsGlobalChatOpen(false);
                                                                        setTargetNoteId(note.id);
                                                                        setActiveTab('notes');
                                                                    }}
                                                                    className="mt-2 mb-2 p-3 rounded-xl bg-gray-50 border border-white cursor-pointer hover:bg-blue-50 transition-colors group relative overflow-hidden"
                                                                    style={{ boxShadow: "5px 5px 10px #d1d1d1, -5px -5px 10px #ffffff" }}
                                                                >
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <h4 className="font-bold text-blue-600 truncate pr-4">{note.title || "Untitled Note"}</h4>
                                                                        <ExternalLink size={14} className="text-gray-400 group-hover:text-blue-500" />
                                                                    </div>

                                                                    {/* Media Preview */}
                                                                    {note.attachments && note.attachments.length > 0 && (
                                                                        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 custom-scrollbar">
                                                                            {note.attachments.map(att => (
                                                                                <div key={att.id} className="shrink-0 relative">
                                                                                    {att.type === 'image' && <img src={att.content} className="h-16 w-16 object-cover rounded-lg shadow-sm" />}
                                                                                    {att.type === 'video' && (
                                                                                        <div className="h-16 w-16 bg-gray-800 rounded-lg flex items-center justify-center text-white shadow-sm">
                                                                                            <VideoIcon size={20} />
                                                                                        </div>
                                                                                    )}
                                                                                    {att.type === 'link' && (
                                                                                        <div className="h-16 w-16 bg-blue-100 rounded-lg flex items-center justify-center text-blue-500 shadow-sm border border-blue-200">
                                                                                            <LinkIcon size={20} />
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    <p className="text-xs text-gray-600 line-clamp-3 bg-white/50 p-2 rounded-lg">
                                                                        {note.content || "No text content..."}
                                                                    </p>
                                                                    <div className="mt-2 text-[10px] text-gray-400 text-right">
                                                                        ID: {note.id}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        return <span key={idx} className="text-gray-500 italic text-xs">[Note ID: {noteId} not found]</span>;
                                                    }
                                                    return <span key={idx} className="whitespace-pre-wrap">{part}</span>;
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {isAiThinking && (
                                <div className="flex gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#E0E5EC] flex items-center justify-center shrink-0 animate-pulse shadow-sm">
                                        <Sparkles size={16} className="text-blue-400" />
                                    </div>
                                    <div className="p-4 bg-[#E0E5EC] rounded-[20px] rounded-tl-sm text-xs font-bold text-gray-400 shadow-[5px_5px_10px_#b8b9be,-5px_-5px_10px_#ffffff]">
                                        Thinking...
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 pb-12 backdrop-blur-sm">
                            <div
                                className="relative rounded-[28px] focus-within:shadow-inner transition-all flex items-end p-2 mb-4"
                                style={{
                                    background: "#E0E5EC",
                                    boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                }}
                            >
                                <textarea
                                    ref={textareaRef}
                                    value={globalChatInput}
                                    onChange={e => setGlobalChatInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleGlobalAskAi();
                                        }
                                    }}
                                    placeholder={isListening ? "Listening..." : "Ask anything..."}
                                    rows={1}
                                    className="w-full bg-transparent px-4 py-3 text-sm font-medium text-gray-700 placeholder-gray-400 outline-none resize-none max-h-[150px] scrollbar-thin scrollbar-thumb-gray-300"
                                    style={{
                                        minHeight: '44px',
                                        overflowY: globalChatInput.length > 50 ? 'auto' : 'hidden'
                                    }}
                                />

                                {/* Active Resources Chips */}
                                {globalResources.length > 0 && (
                                    <div className="absolute bottom-full left-0 mb-2 px-2 flex gap-2 flex-wrap">
                                        {globalResources.map(res => (
                                            <div key={res.id} className="bg-gray-200 text-gray-700 text-xs px-3 py-1 rounded-full flex items-center gap-2 shadow-sm animate-slide-up border border-gray-300">
                                                <span className="max-w-[100px] truncate">{res.name}</span>
                                                <button onClick={() => setGlobalResources(p => p.filter(r => r.id !== res.id))} className="hover:text-red-500"><X size={12} /></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Controls Bar Below */}
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-3">
                                    {/* Mic & Lang */}
                                    <div className="flex items-center gap-1 bg-[#E0E5EC] rounded-full px-2 py-1.5 shadow-[4px_4px_8px_#b8b9be,-4px_-4px_8px_#ffffff]">
                                        <button
                                            onClick={() => setSpeechLang(prev => prev === 'zh-CN' ? 'en-US' : 'zh-CN')}
                                            className="text-[10px] font-bold text-gray-500 hover:text-black px-1.5 py-0.5 rounded transition-colors uppercase"
                                            title="Switch Language"
                                        >
                                            {speechLang === 'zh-CN' ? 'CN' : 'EN'}
                                        </button>
                                        <button
                                            onClick={toggleListening}
                                            className={`p-1.5 rounded-full transition-all ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-blue-500'}`}
                                            title="Voice Input"
                                        >
                                            <Mic size={16} />
                                        </button>
                                    </div>

                                    {/* Resource Actions */}
                                    <div className="flex items-center gap-1">
                                        {isProcessingResource ? (
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400 mx-2"></div>
                                        ) : (
                                            <label
                                                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-blue-500 rounded-full transition-all cursor-pointer active:scale-90"
                                                title="Upload File (PDF/Doc/Image)"
                                                style={{
                                                    background: "#E0E5EC",
                                                    boxShadow: "4px 4px 8px #b8b9be, -4px -4px 8px #ffffff"
                                                }}
                                            >
                                                <Paperclip size={18} />
                                                <input type="file" className="hidden" onChange={(e) => handleResourceAdd(e.target.files?.[0] || null)} />
                                            </label>
                                        )}
                                    </div>
                                </div>

                                {/* Send Button */}
                                <button
                                    onClick={handleGlobalAskAi}
                                    disabled={!globalChatInput.trim() && globalResources.length === 0}
                                    className="w-12 h-12 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-50 transition-all text-white"
                                    style={{
                                        background: globalChatInput.trim() || globalResources.length > 0 ? '#4F46E5' : '#E0E5EC',
                                        boxShadow: globalChatInput.trim() || globalResources.length > 0 ? "4px 4px 10px rgba(79, 70, 229, 0.4)" : "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff",
                                        color: globalChatInput.trim() || globalResources.length > 0 ? 'white' : '#9CA3AF'
                                    }}
                                >
                                    {globalChatInput.trim() || globalResources.length > 0 ? <Send size={20} /> : <Sparkles size={20} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};


// --- SUB-VIEWS ---

// 2. CALENDAR STRIP (Enhanced pinning)
const CalendarStrip = ({ selectedDate, setSelectedDate, todos }: { selectedDate: Date, setSelectedDate: (d: Date) => void, todos: Todo[] }) => {

    // Generates dates only once per day reference
    const dates = useMemo(() => {
        const dList = [];
        const today = new Date();
        // Generate +/- 30 days
        for (let i = -15; i <= 30; i++) {
            const d = new Date();
            d.setDate(today.getDate() + i);
            dList.push(d);
        }
        return dList;
    }, []);

    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    // Initial scroll to center "Today"
    useEffect(() => {
        if (scrollRef.current) {
            // Find the "Today" element logic if we had refs to items, but approximate math works generally
            // 46 items total (-15 to +30), Today is index 15. Item width ~ 80px.
            // 15 * 64px (min-w) + margins ~ 1000px.
            // Center roughly:
            const todayIndex = 15;
            const itemWidth = 70; // approx
            const centerPos = (todayIndex * itemWidth) - (scrollRef.current.clientWidth / 2) + (itemWidth / 2);
            scrollRef.current.scrollTo({ left: centerPos, behavior: 'smooth' });
        }
    }, []);

    const hasTask = (date: Date) => {
        const dateStr = date.toDateString();
        return todos.some(t => {
            if (!t.deadline) return false;
            return new Date(t.deadline).toDateString() === dateStr && !t.completed;
        });
    };

    // Drag-to-scroll logic
    const onMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartX(e.pageX - scrollRef.current.offsetLeft);
        setScrollLeft(scrollRef.current.scrollLeft);
    };
    const onMouseLeave = () => setIsDragging(false);
    const onMouseUp = () => setIsDragging(false);
    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 1.5; // Scroll speed
        scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    const jumpToToday = () => {
        const today = new Date();
        setSelectedDate(today);
        // Scroll Logic duplicate
        if (scrollRef.current) {
            const todayIndex = 15;
            const itemWidth = 70;
            const centerPos = (todayIndex * itemWidth) - (scrollRef.current.clientWidth / 2) + (itemWidth / 2);
            scrollRef.current.scrollTo({ left: centerPos, behavior: 'smooth' });
        }
    };

    return (
        <div
            className="rounded-[32px] p-6 mb-8 select-none relative overflow-hidden group/cal"
            style={{
                background: "#E0E5EC",
                boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
            }}
        >
            <div className="flex justify-between items-center mb-6 px-2">
                {/* Visual handle */}
                <button className="p-2 rounded-full text-gray-400"><div className="w-4 h-0.5 bg-gray-400 my-0.5"></div><div className="w-2 h-0.5 bg-gray-400 my-0.5"></div></button>
                <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-gray-700">{selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                    {/* Return to Today Button "Pinned" */}
                    {selectedDate.toDateString() !== new Date().toDateString() && (
                        <button
                            onClick={jumpToToday}
                            className="bg-[#E0E5EC] px-3 py-1 rounded-full text-[10px] font-bold animate-fade-in flex items-center gap-1 text-blue-600 transition-colors"
                            style={{ boxShadow: "3px 3px 6px #b8b9be, -3px -3px 6px #ffffff" }}
                        >
                            <Target size={10} /> Today
                        </button>
                    )}
                </div>
                <div className="w-8"></div>
            </div>

            {/* Scrollable Container */}
            <div
                ref={scrollRef}
                className="flex items-center gap-4 overflow-x-auto pb-4 px-2 scrollbar-none snap-x cursor-grab active:cursor-grabbing"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                onMouseDown={onMouseDown}
                onMouseLeave={onMouseLeave}
                onMouseUp={onMouseUp}
                onMouseMove={onMouseMove}
            >
                {dates.map((date, i) => {
                    const isSelected = date.toDateString() === selectedDate.toDateString();
                    const isToday = date.toDateString() === new Date().toDateString();
                    const dayLabel = date.toLocaleString('default', { weekday: 'short' });
                    const dayNum = date.getDate();
                    const showStar = hasTask(date);

                    return (
                        <div
                            key={i}
                            onClick={() => setSelectedDate(date)}
                            className={`flex flex-col items-center gap-3 min-w-[3.5rem] transition-all snap-center group ${isSelected ? 'scale-110 opacity-100' : 'opacity-50 hover:opacity-100'}`}
                        >
                            <span className={`text-xs font-bold ${isToday ? 'text-blue-500' : 'text-gray-500'}`}>{isToday ? 'TODAY' : dayLabel}</span>
                            <div
                                className={`
                                    w-12 h-12 flex items-center justify-center rounded-[16px] text-base font-bold transition-all relative
                                    ${isSelected ? 'text-blue-600' : 'text-gray-600'}
                                `}
                                style={isSelected ? {
                                    background: "#E0E5EC",
                                    boxShadow: "inset 4px 4px 8px #b8b9be, inset -4px -4px 8px #ffffff"
                                } : {
                                    background: "#E0E5EC",
                                    boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                }}
                            >
                                {dayNum}
                                {/* Star Indicator */}
                                {showStar && (
                                    <Star
                                        size={10}
                                        fill="currentColor"
                                        className={`absolute -top-1 -right-1 ${isSelected ? 'text-amber-400' : 'text-amber-500/50'}`}
                                    />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- SHARED COMPONENTS ---
const ConfirmModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
}> = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
            <div
                className="rounded-[24px] w-full max-w-sm overflow-hidden animate-scale-in p-6"
                style={{
                    background: "#E0E5EC",
                    boxShadow: "20px 20px 60px #bebebe, -20px -20px 60px #ffffff"
                }}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 text-red-500 flex items-center justify-center mb-4 shadow-inner">
                        <Trash2 size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-700 mb-2">{title}</h3>
                    <p className="text-gray-500 mb-6">{message}</p>
                    <div className="flex gap-4 w-full">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:text-gray-700 transition-colors"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => { onConfirm(); onClose(); }}
                            className="flex-1 py-3 rounded-xl font-bold text-red-500 hover:text-red-600 transition-colors"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                            }}
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 1. NOTES VIEW
const NotesView: React.FC<{
    notes: Note[],
    setNotes: any,
    openGlobalChat: () => void,
    targetNoteId: string | null,
    setTargetNoteId: (id: string | null) => void
}> = ({ notes, setNotes, openGlobalChat, targetNoteId, setTargetNoteId }) => {
    // Shared state like global settings
    const [aiProvider] = useState<AIProvider>(() => (localStorage.getItem('app_global_ai_provider') as AIProvider) || 'google');
    const [apiKey] = useState(() => localStorage.getItem('app_global_api_key') || '');
    const [aiModel] = useState(() => localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash');

    const [isEditing, setIsEditing] = useState(false);
    const [interactionMode, setInteractionMode] = useState<'VIEW' | 'EDIT'>('VIEW');
    const [editForm, setEditForm] = useState<Partial<Note>>({});
    const [isProcessingAi, setIsProcessingAi] = useState(false);

    const getCategoryColor = (cat?: string): string => {
        switch (cat) {
            case 'AI': return 'text-purple-600 bg-purple-500/10 border-purple-500/20';
            case 'Prompt Engineering': return 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20';
            case 'Design': return 'text-pink-600 bg-pink-500/10 border-pink-500/20';
            case 'Marketing': return 'text-amber-600 bg-amber-500/10 border-amber-500/20';
            case 'Business': return 'text-blue-600 bg-blue-500/10 border-blue-500/20';
            case 'Investment': return 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20';
            case 'Productivity': return 'text-teal-600 bg-teal-500/10 border-teal-500/20';
            case 'Learning': return 'text-cyan-600 bg-cyan-500/10 border-cyan-500/20';
            case 'Personal': return 'text-rose-600 bg-rose-500/10 border-rose-500/20';
            default: return 'text-gray-600 bg-gray-500/10 border-gray-500/20';
        }
    };

    const getRelatedNotes = (currentNote: Note, allNotes: Note[]): Note[] => {
        if (!currentNote.ai_category && (!currentNote.ai_keywords || currentNote.ai_keywords.length === 0)) {
            return [];
        }
        return allNotes.filter(other => {
            if (other.id === currentNote.id) return false;
            const categoryMatch = currentNote.ai_category && other.ai_category && currentNote.ai_category === other.ai_category;
            const keywordMatch = currentNote.ai_keywords && other.ai_keywords && 
                currentNote.ai_keywords.some(k => other.ai_keywords!.includes(k));
            return categoryMatch || keywordMatch;
        });
    };

    const handleOpenRelatedNote = (note: Note) => {
        setEditForm(note);
        setCurrentThread(note.thread || []);
        setInteractionMode('VIEW');
    };

    // --- Background AI Auto-Processing ---
    const processingNotesRef = useRef<Set<string>>(new Set());

    const triggerAiProcessing = async (note: Note) => {
        if (!apiKey) return;
        if (processingNotesRef.current.has(note.id)) return;
        processingNotesRef.current.add(note.id);

        let fullContent = `Title: ${note.title || 'Untitled Note'}\n`;
        if (note.content) {
            fullContent += `Content: ${note.content}\n`;
        }
        if (note.thread && note.thread.length > 0) {
            fullContent += `Additional Details:\n`;
            note.thread.forEach(item => {
                fullContent += `- [${item.title || 'Sub-Note'}]: ${item.content || ''}\n`;
                if (item.attachments && item.attachments.length > 0) {
                    item.attachments.forEach(att => {
                        if (att.name) fullContent += `  Attachment: ${att.name}\n`;
                        if (att.scrapedText) fullContent += `  Scraped Text: ${att.scrapedText}\n`;
                    });
                }
            });
        }

        try {
            const systemPrompt = `Analyze the note content.

Return:
1. A concise summary
2. A list of keywords (max 8)
3. A single category

Available Categories:
- AI
- Prompt Engineering
- Design
- Marketing
- Business
- Investment
- Productivity
- Learning
- Personal
- Other

Output JSON only.
Example:
{
  "summary": "A framework for creating structured prompts.",
  "keywords": ["Prompt", "AI", "LLM", "Agent"],
  "category": "AI"
}`;

            const response = await aiService.generate(aiProvider, aiModel, apiKey, fullContent, systemPrompt);
            const jsonStart = response.indexOf('{');
            const jsonEnd = response.lastIndexOf('}');
            
            if (jsonStart !== -1 && jsonEnd !== -1) {
                const jsonStr = response.slice(jsonStart, jsonEnd + 1);
                const parsed = JSON.parse(jsonStr);
                
                const updatedNote: Note = {
                    ...note,
                    ai_summary: parsed.summary || '',
                    ai_keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter(Boolean) : [],
                    ai_category: parsed.category || 'Other',
                    ai_processed: true
                };

                setNotes((prev: Note[]) => prev.map(n => n.id === note.id ? updatedNote : n));
                
                // If currently editing this note, update form state
                setEditForm(prev => prev.id === note.id ? updatedNote : prev);
            }
        } catch (error) {
            console.error("Auto processing failed for note:", note.id, error);
        } finally {
            processingNotesRef.current.delete(note.id);
        }
    };

    useEffect(() => {
        if (!apiKey) return;
        const unprocessed = notes.find(n => n.ai_processed === false && n.role !== 'ai' && n.role !== 'system');
        if (unprocessed) {
            triggerAiProcessing(unprocessed);
        }
    }, [notes, apiKey]);

    // Thread State
    const [currentThread, setCurrentThread] = useState<Note[]>([]);
    const [newThreadInput, setNewThreadInput] = useState('');
    const [isAiThinking, setIsAiThinking] = useState(false);

    // --- UI State ---
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);

    // Lightbox State
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    // Modal Form State
    const [modalTitle, setModalTitle] = useState('');
    const [modalAttachments, setModalAttachments] = useState<Attachment[]>([]);

    // --- Review Mode State ---
    const [reviewingItem, setReviewingItem] = useState<Note | null>(null);
    const [reviewEditMode, setReviewEditMode] = useState(false);
    const [reviewForm, setReviewForm] = useState<{ title: string; content: string; attachments: Attachment[] }>({ title: '', content: '', attachments: [] });

    // --- Confirmation State ---
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; action: () => void }>({ title: '', message: '', action: () => { } });

    const openConfirm = (title: string, message: string, action: () => void) => {
        setConfirmConfig({ title, message, action });
        setConfirmOpen(true);
    };

    const handleCreate = () => {
        setEditForm({ id: Date.now().toString(), title: '', content: '', date: new Date().toISOString(), isThread: false, thread: [] });
        setCurrentThread([]);
        setInteractionMode('EDIT');
        setIsEditing(true);
    };

    const handleEdit = (note: Note) => {
        setEditForm(note);
        setCurrentThread(note.thread || []);
        setInteractionMode('VIEW');
        setIsEditing(true);
    };

    // Handle Deep Linking
    useEffect(() => {
        if (targetNoteId) {
            // Updated Deep Linking Logic: Check Top Level AND Sub-notes
            const topLevelNote = notes.find(n => n.id === targetNoteId);
            if (topLevelNote) {
                handleEdit(topLevelNote);
            } else {
                // Check if it matches a sub-note (item inside a thread)
                let parent: Note | undefined;
                let child: Note | undefined;

                for (const note of notes) {
                    if (note.thread) {
                        const found = note.thread.find(t => t.id === targetNoteId);
                        if (found) {
                            parent = note;
                            child = found;
                            break;
                        }
                    }
                }

                if (parent && child) {
                    handleEdit(parent);
                    // Slight delay to ensure parent modal state is set before opening child
                    setTimeout(() => {
                        handleOpenReview(child!);
                    }, 100);
                }
            }
            setTargetNoteId(null);
        }
    }, [targetNoteId, notes]);
    const handleSave = () => {
        if (!editForm.title && !editForm.content && currentThread.length === 0) { setIsEditing(false); return; }

        // Construct final note object
        const noteToSave: Note = {
            ...editForm,
            title: editForm.title || (editForm.content ? editForm.content.slice(0, 30) + '...' : 'Untitled Topic'),
            content: editForm.content || '',
            date: editForm.date || new Date().toISOString(),
            isThread: currentThread.length > 0 || (!!editForm.thread && editForm.thread.length > 0),
            thread: currentThread
        } as Note;

        // Check if content has changed to trigger AI processing again
        const existingNote = notes.find(n => n.id === noteToSave.id);
        const hasChanged = !existingNote || 
            existingNote.title !== noteToSave.title || 
            existingNote.content !== noteToSave.content || 
            (existingNote.thread?.length !== noteToSave.thread?.length);

        if (hasChanged) {
            noteToSave.ai_processed = false;
        } else {
            noteToSave.ai_processed = existingNote.ai_processed;
            noteToSave.ai_summary = existingNote.ai_summary;
            noteToSave.ai_keywords = existingNote.ai_keywords;
            noteToSave.ai_category = existingNote.ai_category;
        }

        setNotes((prev: Note[]) => {
            const exists = prev.find(n => n.id === noteToSave.id);
            if (exists) return prev.map(n => n.id === noteToSave.id ? noteToSave : n);
            return [noteToSave, ...prev];
        });
        setIsEditing(false);
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        openConfirm(
            "Delete Note",
            "Are you sure you want to delete this note?",
            () => {
                const updated = notes.filter(n => n.id !== id);
                setNotes(updated);
            }
        );
    };

    const analyzeImage = async (base64Image: string) => {
        if (!apiKey) { alert("Please set your AI API Key in Global Settings first."); return; }
        setIsProcessingAi(true);
        try {
            const prompt = "Analyze this image and provide a concise summary. Capture key details, text, or visual elements.";
            const summary = await aiService.generate(aiProvider, aiModel, apiKey, prompt, undefined, [base64Image]);

            // Add as a new 'AI' note in the thread
            const aiNote: Note = {
                id: Date.now().toString(),
                title: 'AI Analysis',
                content: summary,
                date: new Date().toISOString(),
                role: 'ai',
                type: 'image_analysis'
            };

            setCurrentThread(prev => [...prev, aiNote]);

            // Also update main content if empty
            if (!editForm.content) {
                setEditForm(prev => ({ ...prev, content: summary }));
            }

        } catch (e: any) {
            alert("AI Error: " + e.message);
        } finally {
            setIsProcessingAi(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            alert("File too large for local storage (Max 2MB). Please use a link instead.");
            return;
        }

        let type: Attachment['type'] = 'doc';
        let content = '';

        try {
            if (file.type.startsWith('image/')) {
                type = 'image';
                content = await compressImage(file);
            } else {
                content = await fileToBase64(file);
                if (file.type.startsWith('video/')) type = 'video';
                else if (file.type === 'application/pdf') type = 'pdf';
                else if (file.type.startsWith('audio/')) type = 'audio';
            }

            const newAttachment: Attachment = {
                id: Date.now().toString(),
                type,
                content,
                name: file.name,
                size: (file.size / 1024).toFixed(1) + 'KB'
            };

            const newEntry: Note = {
                id: Date.now().toString(),
                title: file.name,
                content: '',
                attachments: [newAttachment],
                date: new Date().toISOString(),
                role: 'user',
                type: 'note'
            };

            setCurrentThread(prev => [...prev, newEntry]);

            if (type === 'image') {
                analyzeImage(content);
            }

        } catch (err) {
            alert("Failed to read file.");
        }
    };

    const fetchUrlContent = async (url: string): Promise<string> => {
        try {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            const res = await fetch(proxyUrl);
            const data = await res.json();
            if (data.contents) {
                const doc = new DOMParser().parseFromString(data.contents, 'text/html');
                const text = doc.body.textContent || "";
                return text.replace(/\s+/g, ' ').trim();
            }
        } catch (e) {
            console.error("Failed to scrape", e);
        }
        return "";
    };

    const handleAddLink = async () => {
        const url = prompt("Enter URL:");
        if (!url) return;
        setIsProcessingAi(true);
        const text = await fetchUrlContent(url);
        setIsProcessingAi(false);

        const newAttachment: Attachment = {
            id: Date.now().toString(),
            type: 'link',
            content: url,
            name: url,
            scrapedText: text.slice(0, 1000)
        };
        const newEntry: Note = {
            id: Date.now().toString(),
            title: 'Link',
            content: text ? `Summary of ${url}: ${text.slice(0, 200)}...` : url,
            attachments: [newAttachment],
            date: new Date().toISOString(),
            role: 'user',
            type: 'note'
        };
        setCurrentThread(prev => [...prev, newEntry]);
    };

    const addToThread = () => {
        if (!newThreadInput.trim() && modalAttachments.length === 0 && !modalTitle.trim()) return;

        const newEntry: Note = {
            id: Date.now().toString(),
            title: modalTitle || 'Note',
            content: newThreadInput,
            date: new Date().toISOString(),
            role: 'user',
            type: 'note',
            attachments: modalAttachments.length > 0 ? modalAttachments : undefined
        };
        setCurrentThread(prev => [...prev, newEntry]);

        // Reset
        setNewThreadInput('');
        setModalTitle('');
        setModalAttachments([]);
    };

    // Helper to add note from modal
    const handleAddFromModal = () => {
        if (!newThreadInput.trim() && modalAttachments.length === 0 && !modalTitle.trim()) return;
        addToThread();
        setIsAddNoteModalOpen(false);
    };

    const handleModalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            alert("File too large (Max 2MB).");
            return;
        }

        let type: Attachment['type'] = 'doc';
        let content = '';

        try {
            if (file.type.startsWith('image/')) {
                type = 'image';
                content = await compressImage(file);
            } else {
                content = await fileToBase64(file);
                if (file.type.startsWith('video/')) type = 'video';
                else if (file.type === 'application/pdf') type = 'pdf';
            }

            const newAttachment: Attachment = {
                id: Date.now().toString(),
                type,
                content,
                name: file.name,
                size: (file.size / 1024).toFixed(1) + 'KB'
            };

            setModalAttachments(prev => [...prev, newAttachment]);

        } catch (err) {
            alert("Failed to read file.");
        }
    };

    const handleModalAddLink = async () => {
        const url = prompt("Enter URL:");
        if (!url) return;

        // Optional: simple scrape or just add as link
        const newAttachment: Attachment = {
            id: Date.now().toString(),
            type: 'link',
            content: url,
            name: url
        };
        setModalAttachments(prev => [...prev, newAttachment]);
    };

    const removeModalAttachment = (id: string) => {
        setModalAttachments(prev => prev.filter(p => p.id !== id));
    };

    // --- Review Handlers ---
    // --- Review Handlers ---
    const handleOpenReview = (item: Note) => {
        setReviewingItem(item);
        setReviewEditMode(false);
        setReviewForm({
            title: item.title || '',
            content: item.content,
            attachments: item.attachments || []
        });
    };
    const handleSaveReview = () => {
        if (!reviewingItem) return;
        const updatedItem = {
            ...reviewingItem,
            title: reviewForm.title,
            content: reviewForm.content,
            attachments: reviewForm.attachments
        };
        const newThread = currentThread.map(item => item.id === reviewingItem.id ? updatedItem : item);
        setCurrentThread(newThread);

        // IMMEDIATE SAVE
        setNotes((prev: Note[]) => {
            return prev.map(n => n.id === editForm.id ? { ...n, thread: newThread, ai_processed: false } : n);
        });
        setEditForm(prev => prev.id === editForm.id ? { ...prev, thread: newThread, ai_processed: false } : prev);

        setReviewingItem(null);
        setReviewEditMode(false);
    };

    const handleReviewFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const b64 = await compressImage(file);
            const newAtt: Attachment = { id: Date.now().toString(), type: 'image', content: b64, name: file.name };
            setReviewForm(prev => ({ ...prev, attachments: [...(prev.attachments || []), newAtt] }));
        }
    };

    const removeReviewAttachment = (id: string) => {
        openConfirm(
            "Remove Attachment",
            "Are you sure you want to remove this attachment?",
            () => setReviewForm(prev => ({ ...prev, attachments: (prev.attachments || []).filter(a => a.id !== id) }))
        );
    };
    const handleDeleteReviewItem = () => {
        if (!reviewingItem) return;
        openConfirm(
            "Delete Note",
            "Are you sure you want to delete this note?",
            () => {
                const newThread = currentThread.filter(item => item.id !== reviewingItem.id);
                setCurrentThread(newThread);
                // IMMEDIATE SAVE FIX
                setNotes((prev: Note[]) => {
                    return prev.map(n => n.id === editForm.id ? { ...n, thread: newThread, ai_processed: false } : n);
                });
                setEditForm(prev => prev.id === editForm.id ? { ...prev, thread: newThread, ai_processed: false } : prev);
                setReviewingItem(null);
            }
        );
    };

    const handleReviewRemoveAttachment = (id: string) => {
        setReviewForm(prev => ({ ...prev, attachments: prev.attachments.filter(a => a.id !== id) }));
    };

    // --- RENDER ---

    // 1. EDIT MODE
    if (isEditing) {
        return (
            <div className="fixed inset-0 z-50 bg-[#E0E5EC] flex flex-col animate-slide-up">
                {/* Editor Header */}
                <div
                    className="backdrop-blur-xl px-6 py-4 flex justify-between items-center sticky top-0 z-10"
                    style={{ background: "#E0E5EC", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}
                >
                    <button onClick={handleSave} className="flex items-center gap-2 text-blue-600 font-bold hover:opacity-80 transition-opacity">
                        <ArrowLeft size={20} /> <span className="text-sm">Done</span>
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setInteractionMode(interactionMode === 'VIEW' ? 'EDIT' : 'VIEW')}
                            className="p-2 rounded-full text-gray-500 hover:text-blue-500 transition-colors"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                            }}
                        >
                            {interactionMode === 'VIEW' ? <Edit2 size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto w-full">
                    {/* Main Content Form */}
                    <div
                        className="rounded-[32px] p-8 mb-8"
                        style={{
                            background: "#E0E5EC",
                            boxShadow: "inset 9px 9px 16px #b8b9be, inset -9px -9px 16px #ffffff"
                        }}
                    >
                        <input
                            type="text"
                            value={editForm.title || ''}
                            onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Topic Title"
                            className="w-full text-4xl font-bold mb-6 outline-none placeholder-gray-400 bg-transparent text-gray-700"
                            readOnly={interactionMode === 'VIEW'}
                        />
                        <textarea
                            value={editForm.content || ''}
                            onChange={e => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                            placeholder="Topic Description (Optional)..."
                            className="w-full h-40 text-lg leading-relaxed text-gray-700 outline-none resize-none placeholder-gray-400 bg-transparent"
                            readOnly={interactionMode === 'VIEW'}
                        />
                    </div>

                    {/* AI Insights Card */}
                    {editForm.ai_processed ? (
                        <div
                            className="rounded-[28px] p-6 mb-8 border border-white/50 animate-scale-in"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "5px 5px 15px rgb(163,177,198,0.5), -5px -5px 15px rgba(255,255,255, 0.8)"
                            }}
                        >
                            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <Sparkles size={14} className="text-purple-500 animate-pulse" /> AI Vault Insights
                                </h4>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-sm ${getCategoryColor(editForm.ai_category)}`}>
                                    Category: {editForm.ai_category || 'Other'}
                                </span>
                            </div>
                            
                            {editForm.ai_summary && (
                                <p className="text-sm text-gray-600 bg-white/20 p-4 rounded-2xl border border-white/40 mb-4 leading-relaxed font-medium">
                                    "{editForm.ai_summary}"
                                </p>
                            )}
                            
                            {editForm.ai_keywords && editForm.ai_keywords.length > 0 && (
                                <div className="flex gap-1.5 flex-wrap mb-2">
                                    {editForm.ai_keywords.map((kw, i) => (
                                        <span key={i} className="text-[10px] font-bold text-gray-500 bg-white/45 px-2.5 py-1 rounded-full border border-white/60">
                                            #{kw}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <button
                                onClick={() => {
                                    if (editForm.id) {
                                        const noteToUpdate = notes.find(n => n.id === editForm.id);
                                        if (noteToUpdate) {
                                            triggerAiProcessing({ ...noteToUpdate, ai_processed: false });
                                            setEditForm(prev => ({ ...prev, ai_processed: false }));
                                        }
                                    }
                                }}
                                className="text-[10px] font-bold text-gray-400 hover:text-blue-500 flex items-center gap-1 mt-3 transition-colors duration-200"
                            >
                                <RefreshCw size={10} /> Re-analyze with AI
                            </button>
                        </div>
                    ) : (
                        <div
                            className="rounded-[28px] p-6 mb-8 border border-white/50 flex flex-col items-center justify-center py-8 text-center"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "5px 5px 15px rgb(163,177,198,0.5), -5px -5px 15px rgba(255,255,255, 0.8)"
                            }}
                        >
                            <Sparkles size={24} className="text-gray-300 animate-pulse mb-2" />
                            <h4 className="text-sm font-bold text-gray-600">AI Vault processing pending</h4>
                            <p className="text-xs text-gray-400 max-w-xs mt-1">Classification, keywords, and summary will update automatically in the background.</p>
                            {apiKey ? (
                                <button
                                    onClick={async () => {
                                        if (editForm.id) {
                                            const noteMock: Note = {
                                                ...editForm,
                                                thread: currentThread
                                            } as Note;
                                            setEditForm(prev => ({ ...prev, ai_processed: false }));
                                            await triggerAiProcessing(noteMock);
                                        }
                                    }}
                                    className="mt-4 px-4 py-2 text-xs font-bold text-blue-500 bg-white/40 border border-white rounded-xl shadow-sm hover:bg-blue-50 transition-colors"
                                >
                                    Analyze Now
                                </button>
                            ) : (
                                <p className="text-xs text-amber-500 mt-2 font-medium">Please add your AI API Key in settings to enable this feature.</p>
                            )}
                        </div>
                    )}

                    {/* Data / Reference Stream */}
                    <div className="mb-32">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 pl-4">Notes in this Topic</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {currentThread.map((entry) => (
                                <div
                                    key={entry.id}
                                    onClick={() => handleOpenReview(entry)}
                                    className="p-5 rounded-[24px] cursor-pointer transition-all active:scale-95 group relative overflow-hidden"
                                    style={{
                                        background: "#E0E5EC",
                                        boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                                    }}
                                >
                                    {/* Simple rendering for stream items */}
                                    {entry.image && <img src={entry.image} className="w-full h-32 object-cover rounded-xl mb-3" />}
                                    {entry.attachments?.map(att => att.type === 'image' && <img key={att.id} src={att.content} className="w-full h-32 object-cover rounded-xl mb-3" />)}
                                    {/* Content Rendering */}
                                    <h4 className="font-bold text-gray-800 mb-2 truncate">{entry.title || "Untitled Note"}</h4>
                                    <p className="line-clamp-3 text-sm text-gray-600 font-medium">
                                        {entry.content
                                            ? (entry.content.split(/\s+/).slice(0, 50).join(' ') + (entry.content.split(/\s+/).length > 50 ? '...' : ''))
                                            : "No textual content..."
                                        }
                                    </p>
                                    <div className="mt-3 flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">{entry.type}</span>
                                        <span className="text-[10px] text-gray-300">{new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>
                            ))}
                            {currentThread.length === 0 && (
                                <div className="col-span-full text-center py-10 text-gray-400 italic">No additional data. Add notes below.</div>
                            )}
                        </div>
                    </div>

                    {/* Related Notes Section */}
                    {editForm.id && (
                        <div className="mb-32">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 pl-4 flex items-center gap-1.5">
                                <LinkIcon size={12} className="text-blue-500" /> Related Knowledge
                            </h3>
                            
                            {(() => {
                                const related = getRelatedNotes(editForm as Note, notes);
                                if (related.length === 0) {
                                    return (
                                        <div className="text-center py-6 text-xs text-gray-400 italic bg-white/10 rounded-2xl border border-white/20">
                                            No related notes found in vault yet.
                                        </div>
                                    );
                                }
                                return (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {related.map(r => (
                                            <div
                                                key={r.id}
                                                onClick={() => handleOpenRelatedNote(r)}
                                                className="p-4 rounded-[24px] cursor-pointer transition-all active:scale-95 group border border-white/30 flex justify-between items-center"
                                                style={{
                                                    background: "#E0E5EC",
                                                    boxShadow: "5px 5px 12px rgb(163,177,198,0.5), -5px -5px 12px rgba(255,255,255, 0.8)"
                                                }}
                                            >
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border block w-max mb-1.5 ${getCategoryColor(r.ai_category)}`}>
                                                        {r.ai_category || 'Other'}
                                                    </span>
                                                    <h4 className="font-bold text-sm text-gray-700 truncate group-hover:text-blue-500 transition-colors">
                                                        {r.title || 'Untitled'}
                                                    </h4>
                                                    <span className="text-[10px] text-gray-400 mt-1 block">
                                                        {new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                </div>
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/40 shadow-inner group-hover:translate-x-1 transition-transform">
                                                    <ArrowRight size={14} className="text-gray-500" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>

                {/* Input Bar (Trigger Modal) - Keep same look */}
                <div
                    className="p-4 backdrop-blur-md sticky bottom-0 z-20 pb-8 safe-area-bottom"
                    style={{ background: "rgba(224, 229, 236, 0.9)" }}
                >
                    <div
                        className="max-w-4xl mx-auto flex items-center gap-3 p-2 rounded-[28px] pr-2 transition-all cursor-pointer"
                        style={{
                            background: "#E0E5EC",
                            boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                        }}
                        onClick={() => setIsAddNoteModalOpen(true)}
                    >
                        <button
                            className="p-3 text-gray-500 hover:text-blue-600 rounded-full cursor-pointer transition-colors hover:bg-gray-200"
                            onClick={(e) => { e.stopPropagation(); /* Keep file input native action */ }}
                        >
                            <div className="cursor-pointer flex items-center justify-center">
                                <Plus size={20} />
                                {/* Hidden input if they click strictly on plus, but main flow is modal */}
                            </div>
                        </button>

                        <div className="flex-1 bg-transparent text-base text-gray-400 px-2 select-none">
                            Add a quick note...
                        </div>

                        <button className="text-white rounded-full p-2 w-10 h-10 flex items-center justify-center transition-all opacity-30" style={{ background: '#E0E5EC', color: '#9CA3AF', boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff" }}> <ArrowLeft size={20} className="rotate-90 md:rotate-0" /> </button>
                    </div>
                </div>

                {/* ENHANCED ADD NOTE MODAL */}
                {isAddNoteModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setIsAddNoteModalOpen(false)}>
                        <div
                            className="rounded-[32px] w-full max-w-lg overflow-hidden animate-scale-in flex flex-col max-h-[90vh]"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "20px 20px 60px #bebebe, -20px -20px 60px #ffffff"
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-gray-200/50 flex justify-between items-center">
                                <h3 className="font-bold text-gray-700 text-lg">Add Note</h3>
                                <button onClick={() => setIsAddNoteModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto">
                                {/* Title Input */}
                                <input
                                    type="text"
                                    value={modalTitle}
                                    onChange={e => setModalTitle(e.target.value)}
                                    placeholder="Title (Optional)"
                                    className="w-full text-2xl font-bold mb-4 outline-none placeholder-gray-400 bg-transparent text-gray-700"
                                />

                                {/* Content Input */}
                                <textarea
                                    value={newThreadInput}
                                    onChange={e => setNewThreadInput(e.target.value)}
                                    placeholder="Write your note here..."
                                    className="w-full h-40 rounded-xl p-4 outline-none resize-none bg-[#E0E5EC] text-gray-700 text-lg placeholder-gray-400 mb-6 focus:shadow-inner transition-shadow"
                                    style={{ boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                    autoFocus
                                />

                                {/* Attachment Previews */}
                                {modalAttachments.length > 0 && (
                                    <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
                                        {modalAttachments.map(att => (
                                            <div key={att.id} className="relative group shrink-0 w-20 h-20 rounded-xl overflow-hidden shadow-md">
                                                {att.type === 'image' ? (
                                                    <img src={att.content} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
                                                        {att.type === 'video' ? <VideoIcon size={24} /> : <LinkIcon size={24} />}
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => removeModalAttachment(att.id)}
                                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Media Toolbar */}
                                <div className="flex gap-4 mb-6">
                                    <label className="p-3 rounded-xl text-gray-500 hover:text-blue-600 cursor-pointer transition-all active:scale-95 hover:bg-gray-200/50 flex flex-col items-center gap-1">
                                        <ImageIcon size={24} />
                                        <span className="text-[10px] font-bold">Image</span>
                                        <input type="file" accept="image/*" onChange={handleModalFileUpload} className="hidden" />
                                    </label>
                                    <label className="p-3 rounded-xl text-gray-500 hover:text-purple-600 cursor-pointer transition-all active:scale-95 hover:bg-gray-200/50 flex flex-col items-center gap-1">
                                        <VideoIcon size={24} />
                                        <span className="text-[10px] font-bold">Video</span>
                                        <input type="file" accept="video/*" onChange={handleModalFileUpload} className="hidden" />
                                    </label>
                                    <button onClick={handleModalAddLink} className="p-3 rounded-xl text-gray-500 hover:text-green-600 cursor-pointer transition-all active:scale-95 hover:bg-gray-200/50 flex flex-col items-center gap-1">
                                        <LinkIcon size={24} />
                                        <span className="text-[10px] font-bold">Link</span>
                                    </button>
                                </div>

                                <button
                                    onClick={handleAddFromModal}
                                    disabled={!newThreadInput.trim() && !modalTitle.trim() && modalAttachments.length === 0}
                                    className="w-full py-4 rounded-xl font-bold text-lg text-white transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
                                    style={{
                                        background: (newThreadInput.trim() || modalTitle.trim() || modalAttachments.length > 0) ? '#4F46E5' : '#ccc',
                                        boxShadow: (newThreadInput.trim() || modalTitle.trim() || modalAttachments.length > 0) ? "5px 5px 10px #a5a6aa, -5px -5px 10px #ffffff" : "none"
                                    }}
                                >
                                    <Check size={20} />
                                    Add Note
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* REVIEW MODAL - CLAY STYLE (Existing) */}
                {reviewingItem && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setReviewingItem(null)}>
                        <div
                            className="rounded-[32px] w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "20px 20px 60px #bebebe, -20px -20px 60px #ffffff"
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-4 flex justify-between items-center" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                                <h3 className="font-bold text-gray-500 uppercase tracking-wider text-xs">Review Item</h3>
                                <div className="flex gap-2">
                                    <button onClick={() => setReviewEditMode(!reviewEditMode)} className="p-2 hover:text-blue-500 text-gray-500 rounded-full transition-colors">
                                        {reviewEditMode ? <Eye size={18} /> : <Edit2 size={18} />}
                                    </button>
                                    <button onClick={handleDeleteReviewItem} className="p-2 hover:text-red-500 text-gray-400 rounded-full transition-colors"><Trash2 size={18} /></button>
                                    <button onClick={() => setReviewingItem(null)} className="p-2 hover:text-gray-700 text-gray-400 rounded-full transition-colors"><X size={18} /></button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
                                {reviewEditMode ? (
                                    <div className="space-y-4">
                                        <input
                                            type="text"
                                            value={reviewForm.title}
                                            onChange={e => setReviewForm(prev => ({ ...prev, title: e.target.value }))}
                                            placeholder="Title"
                                            className="w-full text-xl font-bold p-2 bg-transparent text-gray-800 outline-none border-b border-gray-300 focus:border-blue-500 transition-colors placeholder-gray-400"
                                        />
                                        <textarea
                                            value={reviewForm.content}
                                            onChange={e => setReviewForm(prev => ({ ...prev, content: e.target.value }))}
                                            className="w-full h-40 rounded-xl p-4 outline-none resize-none bg-[#E0E5EC] text-gray-700"
                                            style={{ boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                            placeholder="Content..."
                                        />

                                        {/* Image Management in Edit Mode */}
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Images</span>
                                                <label className="p-2 bg-gray-200 rounded-full cursor-pointer hover:bg-gray-300 transition-colors text-gray-600">
                                                    <Plus size={16} />
                                                    <input type="file" accept="image/*" onChange={handleReviewFileUpload} className="hidden" />
                                                </label>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                                {reviewForm.attachments?.map(att => (
                                                    <div key={att.id} className="relative group aspect-square rounded-xl overflow-hidden shadow-sm border border-white">
                                                        {att.type === 'image' ? (
                                                            <img src={att.content} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400"><LinkIcon /></div>
                                                        )}
                                                        <button
                                                            onClick={() => removeReviewAttachment(att.id)}
                                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-100 shadow-md hover:scale-110 transition-transform"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleSaveReview}
                                            className="w-full py-3 rounded-xl font-bold transition-transform active:scale-95 text-blue-600 mt-4"
                                            style={{
                                                background: "#E0E5EC",
                                                boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                            }}
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4 text-gray-700">
                                        {/* 1. Title Display */}
                                        <h3 className="text-xl font-bold text-gray-800 leading-tight">
                                            {reviewingItem.title || "Untitled Note"}
                                        </h3>

                                        {/* 2. Content Display */}
                                        <p className="text-lg leading-relaxed whitespace-pre-wrap text-gray-600">
                                            {reviewingItem.content || "No textual content."}
                                        </p>

                                        {/* 3. Thumbnail Grid for Images & Attachments */}
                                        {(reviewingItem.image || (reviewingItem.attachments && reviewingItem.attachments.length > 0)) && (
                                            <div className="grid grid-cols-3 gap-3 pt-2">
                                                {reviewingItem.image && (
                                                    <div
                                                        onClick={() => setLightboxImage(reviewingItem.image!)}
                                                        className="aspect-square rounded-xl overflow-hidden cursor-pointer hover:opacity-80 transition-opacity border-2 border-white shadow-sm"
                                                    >
                                                        <img src={reviewingItem.image} className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                {reviewingItem.attachments?.map(att => (
                                                    <div key={att.id} className="aspect-square rounded-xl overflow-hidden cursor-pointer hover:opacity-80 transition-opacity border-2 border-white shadow-sm bg-gray-100 flex items-center justify-center">
                                                        {att.type === 'image' ? (
                                                            <img
                                                                src={att.content}
                                                                className="w-full h-full object-cover"
                                                                onClick={() => setLightboxImage(att.content)}
                                                            />
                                                        ) : (
                                                            <div className="text-gray-400 flex flex-col items-center p-2 text-center">
                                                                {att.type === 'video' ? <VideoIcon size={24} /> : <LinkIcon size={24} />}
                                                                <span className="text-[9px] font-bold mt-1 line-clamp-1 break-all">{att.name || att.type}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {reviewingItem.type === 'qa' && reviewingItem.role === 'ai' && (
                                            <div className="mt-4 p-4 bg-purple-50 rounded-2xl text-purple-800 text-sm">
                                                <Sparkles size={16} className="mb-2" />
                                                AI Generated content
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* LIGHTBOX FOR NOTES VIEW */}
                {lightboxImage && (
                    <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex flex-col animate-fade-in" onClick={() => setLightboxImage(null)}>
                        <button className="absolute top-6 right-6 text-white p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors z-10"><X size={32} /></button>
                        <div className="flex-1 flex items-center justify-center p-4">
                            <img src={lightboxImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
                        </div>
                    </div>
                )}

                {/* CONFIRMATION DIALOG */}
                {confirmOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in">
                        <div
                            className="bg-[#E0E5EC] rounded-[24px] p-6 w-full max-w-sm m-4 shadow-2xl animate-scale-in"
                            style={{
                                boxShadow: "20px 20px 60px #bebebe, -20px -20px 60px #ffffff"
                            }}
                        >
                            <h3 className="text-xl font-bold text-gray-800 mb-2">{confirmConfig.title}</h3>
                            <p className="text-gray-600 mb-6">{confirmConfig.message}</p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setConfirmOpen(false)}
                                    className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-200 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        confirmConfig.action();
                                        setConfirmOpen(false);
                                    }}
                                    className="px-4 py-2 bg-red-500 text-white font-bold rounded-xl shadow-lg hover:bg-red-600 transition-colors"
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // 2. GRID / LIST MODE
    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center pb-4">
                <div>
                    <h2 className="text-[32px] font-bold tracking-tight leading-tight text-gray-700">My Notes</h2>
                    <p className="text-gray-400 font-medium mt-1">Capture ideas and organize your life.</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-95 group text-gray-600 hover:text-blue-500"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "6px 6px 12px #b8b9be, -6px -6px 12px #ffffff"
                    }}
                >
                    <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {notes.map((note, idx) => (
                    <div
                        key={note.id}
                        onClick={() => handleEdit(note)}
                        className="p-6 rounded-[32px] cursor-pointer group flex flex-col h-[280px] relative overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-xl animate-scale-in opacity-0"
                        style={{
                            background: "#E0E5EC",
                            boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
                            animationDelay: `${idx * 100}ms`
                        }}
                    >

                        {/* Image Preview */}
                        {note.image && (
                            <div className="absolute top-0 left-0 w-full h-32 opacity-80 group-hover:opacity-100 transition-opacity">
                                <img src={note.image} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#E0E5EC] via-[#E0E5EC]/50 to-transparent"></div>
                            </div>
                        )}

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex-1">
                                {/* Category Badge and AI Status */}
                                <div className="flex gap-2 items-center flex-wrap mb-1.5">
                                    {note.ai_category && (
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shadow-sm ${getCategoryColor(note.ai_category)}`}>
                                            {note.ai_category}
                                        </span>
                                    )}
                                    {note.ai_processed === false && apiKey && (
                                        <span className="text-[9px] text-amber-500 bg-amber-500/10 border border-amber-500/20 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                                            <RefreshCw size={8} className="animate-spin" /> AI Analyzing...
                                        </span>
                                    )}
                                </div>
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-xl leading-tight line-clamp-2 text-gray-700 group-hover:text-blue-600 transition-colors">{note.title || "Untitled Note"}</h3>
                                    {note.thread && note.thread.length > 0 && (
                                        <div className="text-gray-500 px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 bg-[#E0E5EC] shadow-inner shrink-0">
                                            <Database size={10} /> {note.thread.length}
                                        </div>
                                    )}
                                </div>
                                <p className="text-gray-500 text-sm line-clamp-3 leading-relaxed font-medium">
                                    {note.ai_summary || note.content || "No content..."}
                                </p>
                                {note.ai_keywords && note.ai_keywords.length > 0 && (
                                    <div className="flex gap-1.5 mt-2.5 flex-wrap">
                                        {note.ai_keywords.slice(0, 3).map((keyword, kid) => (
                                            <span key={kid} className="text-[9px] font-bold text-gray-400 bg-[#E0E5EC]/80 px-2 py-0.5 rounded-md shadow-inner border border-white/20">
                                                #{keyword}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 flex justify-between items-center pt-4 border-t border-gray-300/20">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{new Date(note.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                <button onClick={(e) => handleDelete(note.id, e)} className="p-2 text-gray-400 hover:text-red-500 rounded-full transition-all md:opacity-0 group-hover:opacity-100 hover:bg-gray-200">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Create New Card */}
                <div
                    onClick={handleCreate}
                    className="h-[280px] rounded-[32px] flex flex-col items-center justify-center text-gray-400 cursor-pointer transition-all gap-3 group opacity-70 hover:opacity-100"
                    style={{
                        border: "2px dashed #b8b9be"
                    }}
                >
                    <div
                        className="w-16 h-16 rounded-full flex items-center justify-center transition-colors text-gray-500 group-hover:text-blue-500"
                        style={{
                            background: "#E0E5EC",
                            boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                        }}
                    >
                        <Plus size={32} className="group-hover:scale-110 transition-transform" />
                    </div>
                    <span className="font-bold text-gray-500 group-hover:text-blue-600">Create New Topic</span>
                </div>
            </div>

            {/* CONFIRMATION DIALOG (GRID MODE) */}
            {confirmOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in">
                    <div
                        className="bg-[#E0E5EC] rounded-[24px] p-6 w-full max-w-sm m-4 shadow-2xl animate-scale-in"
                        style={{
                            boxShadow: "20px 20px 60px #bebebe, -20px -20px 60px #ffffff"
                        }}
                    >
                        <h3 className="text-xl font-bold text-gray-800 mb-2">{confirmConfig.title}</h3>
                        <p className="text-gray-600 mb-6">{confirmConfig.message}</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setConfirmOpen(false)}
                                className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    confirmConfig.action();
                                    setConfirmOpen(false);
                                }}
                                className="px-4 py-2 bg-red-500 text-white font-bold rounded-xl shadow-lg hover:bg-red-600 transition-colors"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// 3. TODO VIEW
const TodoView: React.FC<{ todos: Todo[], setTodos: any }> = ({ todos, setTodos }) => {
    const [viewMode, setViewMode] = useState<'active' | 'history' | 'timeline'>('timeline');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [previewTask, setPreviewTask] = useState<Todo | null>(null);
    const [viewingAttachment, setViewingAttachment] = useState<string | null>(null);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newDeadline, setNewDeadline] = useState('');
    const [newStartTime, setNewStartTime] = useState('');
    const [newPriority, setNewPriority] = useState<PriorityLevel>('T3');
    const [newAttachments, setNewAttachments] = useState<string[]>([]);

    // --- Confirmation State ---
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; action: () => void }>({ title: '', message: '', action: () => { } });

    const openConfirm = (title: string, message: string, action: () => void) => {
        setConfirmConfig({ title, message, action });
        setConfirmOpen(true);
    };

    useEffect(() => {
        setNewDeadline(selectedDate.toLocaleDateString('en-CA'));
    }, [selectedDate]);

    useEffect(() => {
        if (newDeadline) setNewPriority(calculatePriority(newDeadline));
    }, [newDeadline]);

    const handleSave = () => {
        if (!newTitle.trim()) return;
        let finalDeadline = newDeadline;
        if (newDeadline) {
            if (newStartTime) {
                finalDeadline = `${newDeadline}T${newStartTime}`;
            } else {
                finalDeadline = `${newDeadline}T00:00:00`;
            }
        }

        const taskData: Todo = {
            id: editingId || Date.now().toString(),
            title: newTitle,
            description: newDesc,
            deadline: finalDeadline,
            priority: newPriority,
            attachments: newAttachments,
            completed: false,
            createdAt: editingId ? (todos.find(t => t.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
        };

        if (editingId) {
            setTodos((prev: Todo[]) => prev.map(t => t.id === editingId ? { ...taskData, completed: t.completed } : t));
        } else {
            setTodos((prev: Todo[]) => [taskData, ...prev]);
        }
        resetForm();
    };

    const handleEditTask = (task: Todo) => {
        setPreviewTask(null);
        setEditingId(task.id);
        setNewTitle(task.title);
        setNewDesc(task.description || '');
        setNewPriority(task.priority);
        setNewAttachments(task.attachments || []);

        if (task.deadline) {
            if (task.deadline.includes('T')) {
                const [date, time] = task.deadline.split('T');
                setNewDeadline(date);
                setNewStartTime(time.substring(0, 5));
            } else {
                setNewDeadline(task.deadline);
                setNewStartTime('');
            }
        } else {
            setNewDeadline('');
            setNewStartTime('');
        }
        setIsFormOpen(true);
    };

    const resetForm = () => {
        setEditingId(null); setNewTitle(''); setNewDesc('');
        setNewDeadline(selectedDate.toLocaleDateString('en-CA'));
        setNewStartTime(''); setNewPriority('T3'); setNewAttachments([]); setIsFormOpen(false);
    };

    const toggleComplete = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setTodos((prev: Todo[]) => prev.map(t =>
            t.id === id ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined } : t
        ));
    };

    const deleteTask = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        openConfirm(
            "Delete Task",
            "Are you sure you want to delete this task?",
            () => {
                setTodos((prev: Todo[]) => prev.filter(t => t.id !== id));
                if (previewTask?.id === id) setPreviewTask(null);
            }
        );
    };

    const handleRemoveAttachment = (index: number) => {
        openConfirm(
            "Remove Attachment",
            "Remove this attachment?",
            () => setNewAttachments(prev => prev.filter((_, i) => i !== index))
        );
    };

    const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type.startsWith('image/')) {
                const b64 = await compressImage(file);
                setNewAttachments(prev => [...prev, b64]);
            } else {
                setNewAttachments(prev => [...prev, `FILE:${file.name}`]);
            }
        }
    };

    // Data Processing
    const activeTodos = todos.filter(t => !t.completed);
    const pOrder: Record<string, number> = { 'T0': 3, 'T1': 2, 'T2': 1, 'T3': 0 };
    const allActiveSorted = [...activeTodos].sort((a, b) => pOrder[b.priority] - pOrder[a.priority]);
    const activeSortedByDate = [...activeTodos].sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));

    const groupedTasks = useMemo(() => {
        const groups: Record<string, Todo[]> = {};
        activeSortedByDate.forEach(t => {
            const d = t.deadline ? new Date(t.deadline).toDateString() : "No Date";
            if (!groups[d]) groups[d] = [];
            groups[d].push(t);
        });
        return groups;
    }, [activeSortedByDate]);

    // Visually rich gradients
    const gradients = [
        'from-[#FF9A9E] to-[#FECFEF] shadow-pink-400/30 text-pink-900', // Pink
        'from-[#A18CD1] to-[#FBC2EB] shadow-purple-400/30 text-purple-900', // Purple
        'from-[#F6D365] to-[#FDA085] shadow-orange-400/30 text-orange-900', // Orange
        'from-[#84fab0] to-[#8fd3f4] shadow-green-400/30 text-teal-900',   // Green/Teal
    ];

    return (
        <div className="space-y-6 pb-20">
            {/* Calendar Strip with State */}
            <CalendarStrip selectedDate={selectedDate} setSelectedDate={setSelectedDate} todos={todos} />

            {/* View Switcher */}
            <div
                className="flex p-1 rounded-xl w-fit mb-6"
                style={{
                    background: "#E0E5EC",
                    boxShadow: "inset 6px 6px 12px #b8b9be, inset -6px -6px 12px #ffffff"
                }}
            >
                <button
                    onClick={() => setViewMode('active')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'active' ? 'text-blue-600' : 'text-gray-400'}`}
                    style={viewMode === 'active' ? {
                        background: "#E0E5EC",
                        boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                    } : {}}
                >
                    Cards
                </button>
                <button
                    onClick={() => setViewMode('timeline')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'timeline' ? 'text-blue-600' : 'text-gray-400'}`}
                    style={viewMode === 'timeline' ? {
                        background: "#E0E5EC",
                        boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                    } : {}}
                >
                    Timeline
                </button>
                <button
                    onClick={() => setViewMode('history')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'history' ? 'text-blue-600' : 'text-gray-400'}`}
                    style={viewMode === 'history' ? {
                        background: "#E0E5EC",
                        boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                    } : {}}
                >
                    History
                </button>
            </div>

            {/* MODE: GLOBAL TIMELINE (Grouped) */}
            {viewMode === 'timeline' && (
                <div className="animate-fade-in relative pl-4 space-y-8">
                    {/* Continuous Vertical Line */}
                    <div className="absolute left-[27px] top-4 bottom-0 w-1 bg-[#E0E5EC] shadow-[inset_2px_2px_4px_#b8b9be,inset_-2px_-2px_4px_#ffffff] rounded-full opacity-50"></div>

                    {Object.entries(groupedTasks).map(([dateLabel, tasks]) => (
                        <div key={dateLabel}>
                            {/* Sticky Header */}
                            <div className="sticky top-0 z-20 py-3 mb-4 pl-12 -ml-2 transition-all">
                                <span className={`text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full
                                    ${dateLabel === new Date().toDateString()
                                        ? 'text-blue-600'
                                        : 'text-gray-500'
                                    }
                                `}
                                    style={{
                                        background: "#E0E5EC",
                                        boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                    }}>
                                    {dateLabel === new Date().toDateString() ? 'Today' : dateLabel}
                                </span>
                            </div>

                            <div className="space-y-6">
                                {(tasks as Todo[]).map((task, idx) => {
                                    const dateObj = task.deadline ? new Date(task.deadline) : new Date();
                                    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    const thumbnail = task.attachments?.find(a => a.startsWith('data:image'));

                                    return (
                                        <div key={task.id} className="relative pl-12 group animate-slide-in-right opacity-0" style={{ animationDelay: `${idx * 100}ms` }}>
                                            {/* Timeline Node */}
                                            <div
                                                className="absolute left-[5px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full z-10 transition-transform group-hover:scale-125 border border-white/20"
                                                style={{
                                                    background: "#E0E5EC",
                                                    boxShadow: "2px 2px 4px #b8b9be, -2px -2px 4px #ffffff"
                                                }}
                                            ></div>

                                            {/* Clay Card */}
                                            <div
                                                onClick={() => setPreviewTask(task)}
                                                className="relative p-5 rounded-[24px] cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 text-gray-700"
                                                style={{
                                                    background: "#E0E5EC",
                                                    boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                                                }}
                                            >
                                                <div className="flex justify-between items-start mb-2 relative z-10">
                                                    <h3 className="font-bold text-lg text-gray-800">{task.title}</h3>
                                                    <span className="text-xs font-bold text-gray-500">{timeStr}</span>
                                                </div>

                                                <div className="flex items-start gap-3 relative z-10">
                                                    {thumbnail && (
                                                        <img src={thumbnail} className="w-16 h-16 rounded-xl object-cover shadow-sm" />
                                                    )}
                                                    <p className="text-sm mb-4 line-clamp-2 mt-1 text-gray-600 font-medium">
                                                        {task.description || "No details"}
                                                    </p>
                                                </div>

                                                <div className="flex items-center justify-between relative z-10">
                                                    <div className="flex -space-x-2">
                                                        <div
                                                            className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-600"
                                                            style={{
                                                                background: "#E0E5EC",
                                                                boxShadow: "3px 3px 6px #b8b9be, -3px -3px 6px #ffffff"
                                                            }}
                                                        >Me</div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={(e) => toggleComplete(task.id, e)}
                                                            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors text-gray-500 hover:text-green-500"
                                                            style={{
                                                                background: "#E0E5EC",
                                                                boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                                            }}
                                                        >
                                                            <CheckCircle2 size={20} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}

                    {Object.keys(groupedTasks).length === 0 && (
                        <div className="text-center py-10 pl-8 opacity-50">
                            <p className="text-gray-400 font-bold">No upcoming active tasks.</p>
                        </div>
                    )}
                </div>
            )}

            {/* MODE: ACTIVE / HISTORY (Unchanged) */}
            {viewMode === 'active' && (
                <div className="animate-fade-in px-1">
                    <div className="flex justify-between items-end mb-4 px-1">
                        <h2 className="text-2xl font-bold text-gray-800">Card Grid</h2>
                        <button onClick={() => setViewMode('history')} className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors">History</button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
                        {allActiveSorted.map((task, idx) => {
                            const grad = gradients[idx % gradients.length];
                            const thumbnail = task.attachments?.find(a => a.startsWith('data:image'));
                            const dateStr = task.deadline ? new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No Date';

                            return (
                                <div key={task.id} className="group relative w-full h-48 [perspective:1000px] cursor-pointer animate-fade-in-up opacity-0" onClick={() => setPreviewTask(task)} style={{ animationDelay: `${idx * 100}ms` }}>
                                    <div className="relative w-full h-full transition-all duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] rounded-[24px]">
                                        {/* Front */}
                                        <div
                                            className="absolute inset-0 w-full h-full [backface-visibility:hidden] rounded-[24px] p-5 flex flex-col justify-between overflow-hidden"
                                            style={{
                                                background: "#E0E5EC",
                                                boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                                            }}
                                        >
                                            <div className="flex justify-between items-start z-10">
                                                <div
                                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-600"
                                                    style={{
                                                        background: "#E0E5EC",
                                                        boxShadow: "inset 4px 4px 8px #b8b9be, inset -4px -4px 8px #ffffff"
                                                    }}
                                                >
                                                    {thumbnail
                                                        ? <img src={thumbnail} className="w-full h-full object-cover rounded-xl" />
                                                        : <CheckCircle2 size={20} />
                                                    }
                                                </div>
                                                <span
                                                    className="text-[10px] font-black uppercase px-2 py-1 rounded-full text-gray-500"
                                                    style={{
                                                        background: "#E0E5EC",
                                                        boxShadow: "3px 3px 6px #b8b9be, -3px -3px 6px #ffffff"
                                                    }}
                                                >
                                                    {task.priority}
                                                </span>
                                            </div>
                                            <div className="z-10">
                                                <h3 className="font-bold text-lg leading-tight mb-1 line-clamp-2 text-gray-800">{task.title}</h3>
                                                <div className="flex items-center gap-1 opacity-60 font-bold text-xs uppercase text-gray-500">
                                                    <CalendarIcon size={10} />
                                                    {dateStr}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Back */}
                                        <div
                                            className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-[24px] p-5 flex flex-col justify-between"
                                            style={{
                                                background: "#E0E5EC",
                                                boxShadow: "inset 9px 9px 16px #b8b9be, inset -9px -9px 16px #ffffff"
                                            }}
                                        >
                                            <div>
                                                <h3 className="font-bold text-gray-700 text-sm mb-2">Details</h3>
                                                <p className="text-xs text-gray-500 line-clamp-4 leading-relaxed">
                                                    {task.description || "No description provided."}
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-gray-400">Click to Preview</span>
                                                <div
                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-blue-500"
                                                    style={{
                                                        background: "#E0E5EC",
                                                        boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                                    }}
                                                >
                                                    <Eye size={14} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                        <button
                            onClick={() => setIsFormOpen(true)}
                            className="w-full h-48 rounded-[24px] flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-blue-500 transition-all"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "inset 6px 6px 12px #b8b9be, inset -6px -6px 12px #ffffff"
                            }}
                        >
                            <Plus size={32} />
                            <span className="text-sm font-bold">New Task</span>
                        </button>
                    </div>
                </div>
            )}

            {viewMode === 'history' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-end mb-2 px-2">
                        <h2 className="text-2xl font-bold text-gray-800">Completed</h2>
                        <button onClick={() => setViewMode('active')} className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors">Back</button>
                    </div>
                    {todos.filter(t => t.completed).map(task => (
                        <div
                            key={task.id}
                            className="p-5 rounded-[24px] flex items-center gap-4 transition-all group opacity-60 hover:opacity-100"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "inset 6px 6px 12px #b8b9be, inset -6px -6px 12px #ffffff"
                            }}
                        >
                            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-gray-400">
                                <Check size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-gray-600 text-lg line-through">{task.title}</h3>
                                <p className="text-xs text-gray-400 font-bold">Completed on {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : ''}</p>
                            </div>
                            <button onClick={() => deleteTask(task.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Floating FAB */}
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30">
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="w-16 h-16 rounded-full flex items-center justify-center text-blue-600 hover:scale-105 active:scale-95 transition-all"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                    }}
                >
                    <Plus size={32} />
                </button>
            </div>

            {/* PREVIEW MODAL */}
            {previewTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setPreviewTask(null)} />
                    <div
                        className="w-full max-w-lg rounded-[32px] relative z-10 animate-scale-in overflow-hidden flex flex-col max-h-[85vh]"
                        style={{
                            background: "#E0E5EC",
                            boxShadow: "20px 20px 60px #bebebe, -20px -20px 60px #ffffff"
                        }}
                    >
                        <div className={`h-40 shrink-0 relative bg-[#E0E5EC] flex items-center justify-center overflow-hidden`}>
                            {previewTask.attachments?.find(a => a.startsWith('data:image')) ? (
                                <img src={previewTask.attachments.find(a => a.startsWith('data:image'))} className="w-full h-full object-cover cursor-pointer" onClick={() => setViewingAttachment(previewTask.attachments?.find(a => a.startsWith('data:image')) || null)} />
                            ) : (
                                <div className="text-gray-300"><ImageIcon size={48} /></div>
                            )}
                            <button
                                onClick={() => setPreviewTask(null)}
                                className="absolute top-4 right-4 text-gray-500 p-2 rounded-full hover:text-gray-700 transition-colors"
                                style={{
                                    background: "#E0E5EC",
                                    boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 md:p-8 overflow-y-auto">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-700 leading-tight mb-2">{previewTask.title}</h3>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold text-gray-500 shadow-inner bg-[#E0E5EC]`}>{previewTask.priority}</span>
                                        <span className="text-xs font-bold text-gray-400 flex items-center gap-1"><CalendarIcon size={12} />{previewTask.deadline ? new Date(previewTask.deadline).toLocaleString() : 'No Deadline'}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => toggleComplete(previewTask.id)}
                                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${previewTask.completed ? 'text-green-500' : 'text-gray-400 hover:text-green-500'}`}
                                    style={previewTask.completed ? {
                                        background: "#E0E5EC",
                                        boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                                    } : {
                                        background: "#E0E5EC",
                                        boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                    }}
                                >
                                    <Check size={24} />
                                </button>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Description</h4>
                                    <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{previewTask.description || "No additional details provided."}</p>
                                </div>
                                {previewTask.attachments && previewTask.attachments.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Attachments</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            {previewTask.attachments.map((att, i) => (
                                                <div
                                                    key={i}
                                                    onClick={() => setViewingAttachment(att)}
                                                    className="relative rounded-xl overflow-hidden aspect-video group cursor-pointer hover:shadow-lg transition-all"
                                                    style={{
                                                        background: "#E0E5EC",
                                                        boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff"
                                                    }}
                                                >
                                                    {att.startsWith('data:image') ? <img src={att} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 p-2 text-center text-xs font-bold break-all"><FileText size={24} className="mb-2" />{att.replace('FILE:', '')}</div>}
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"><Maximize2 className="text-white drop-shadow-md" size={24} /></div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 flex justify-between gap-4">
                            <button onClick={() => deleteTask(previewTask.id)} className="px-6 py-3 rounded-xl font-bold text-red-500 hover:text-red-600 transition-colors flex items-center gap-2"><Trash2 size={18} /> Delete</button>
                            <button
                                onClick={() => handleEditTask(previewTask)}
                                className="flex-1 text-gray-600 px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 hover:text-blue-500"
                                style={{
                                    background: "#E0E5EC",
                                    boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                }}
                            >
                                <Edit2 size={18} /> Edit Task
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* LIGHTBOX */}
            {viewingAttachment && (
                <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center animate-fade-in p-4" onClick={() => setViewingAttachment(null)}>
                    <img src={viewingAttachment} className="max-w-full max-h-full rounded-lg shadow-2xl animate-scale-in" />
                    <button className="absolute top-4 right-4 text-white hover:text-red-500 transition-colors">
                        <X size={32} />
                    </button>
                </div>
            )}

            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={confirmConfig.action}
                title={confirmConfig.title}
                message={confirmConfig.message}
            />

            {/* FORM MODAL (Unchanged) */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={resetForm} />
                    <div
                        className="w-full max-w-lg rounded-[32px] relative z-10 animate-scale-in p-6 max-h-[90vh] overflow-y-auto"
                        style={{
                            background: "#E0E5EC",
                            boxShadow: "20px 20px 60px #bebebe, -20px -20px 60px #ffffff"
                        }}
                    >
                        <h3 className="font-bold text-xl text-gray-700 mb-6">{editingId ? 'Edit Task' : 'New Task'}</h3>
                        <input
                            className="w-full rounded-2xl px-5 py-4 font-bold text-gray-700 focus:ring-0 outline-none mb-4 text-xl placeholder-gray-400"
                            placeholder="What do you want to do?"
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            autoFocus
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                            }}
                        />
                        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                            {['T0', 'T1', 'T2', 'T3'].map(p => (
                                <button
                                    key={p}
                                    onClick={() => setNewPriority(p as PriorityLevel)}
                                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${newPriority === p ? 'text-blue-600' : 'text-gray-400'}`}
                                    style={newPriority === p ? {
                                        background: "#E0E5EC",
                                        boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff"
                                    } : {
                                        background: "#E0E5EC",
                                        boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                    }}
                                >
                                    {p === 'T0' ? 'Urgent' : p}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <input
                                type="date"
                                className="rounded-xl p-3 text-sm font-bold text-gray-700 outline-none"
                                value={newDeadline}
                                onChange={e => setNewDeadline(e.target.value)}
                                style={{
                                    background: "#E0E5EC",
                                    boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff"
                                }}
                            />
                            <input
                                type="time"
                                className="rounded-xl p-3 text-sm font-bold text-gray-700 outline-none"
                                value={newStartTime}
                                onChange={e => setNewStartTime(e.target.value)}
                                style={{
                                    background: "#E0E5EC",
                                    boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff"
                                }}
                            />
                        </div>
                        <textarea
                            placeholder="Description"
                            className="w-full rounded-xl p-3 text-sm font-bold text-gray-700 outline-none mb-4 resize-none h-24"
                            value={newDesc}
                            onChange={e => setNewDesc(e.target.value)}
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff"
                            }}
                        />
                        {/* Attachments */}
                        <div className="flex gap-4 mb-6">
                            <label
                                className="flex flex-col items-center justify-center w-20 h-20 rounded-xl cursor-pointer transition-transform hover:scale-105 active:scale-95"
                                style={{
                                    background: "#E0E5EC",
                                    boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                }}
                            >
                                <ImageIcon size={20} className="text-gray-500 mb-1" /><span className="text-[10px] text-gray-500 font-bold">Image</span><input type="file" accept="image/*" className="hidden" onChange={handleFileAttach} />
                            </label>
                            <label
                                className="flex flex-col items-center justify-center w-20 h-20 rounded-xl cursor-pointer transition-transform hover:scale-105 active:scale-95"
                                style={{
                                    background: "#E0E5EC",
                                    boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                }}
                            >
                                <Play size={20} className="text-gray-500 mb-1" /><span className="text-[10px] text-gray-500 font-bold">Video</span><input type="file" accept="video/*" className="hidden" onChange={handleFileAttach} />
                            </label>
                            <label
                                className="flex flex-col items-center justify-center w-20 h-20 rounded-xl cursor-pointer transition-transform hover:scale-105 active:scale-95"
                                style={{
                                    background: "#E0E5EC",
                                    boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                                }}
                            >
                                <FileText size={20} className="text-gray-500 mb-1" /><span className="text-[10px] text-gray-500 font-bold">Doc</span><input type="file" className="hidden" onChange={handleFileAttach} />
                            </label>
                        </div>
                        {newAttachments.length > 0 && (
                            <div className="flex gap-2 mb-6 overflow-x-auto">
                                {newAttachments.map((att, idx) => (
                                    <div
                                        key={idx}
                                        className="w-16 h-16 rounded-xl shrink-0 overflow-hidden relative"
                                        style={{
                                            background: "#E0E5EC",
                                            boxShadow: "inset 2px 2px 4px #b8b9be, inset -2px -2px 4px #ffffff"
                                        }}
                                    >
                                        {att.startsWith('data:image') ? <img src={att} className="w-full h-full object-cover opacity-80" /> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 font-bold p-1 text-center break-all">{att.substring(0, 10)}...</div>}
                                        <button onClick={(e) => { e.stopPropagation(); handleRemoveAttachment(idx); }} className="absolute top-1 right-1 bg-gray-500/50 text-white rounded-full p-0.5 hover:bg-red-500"><X size={10} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button
                            onClick={handleSave}
                            className="w-full py-4 rounded-2xl font-bold transition-transform active:scale-98 text-blue-600"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                            }}
                        >
                            {editingId ? 'Save Changes' : 'Create Task'}
                        </button>
                    </div>
                </div>
            )
            }
        </div >
    );
};
// 4. FOCUS VIEW (Unchanged)
interface FocusViewProps {
    timeLeft: number;
    setTimeLeft: (t: number | ((prev: number) => number)) => void;
    isActive: boolean;
    setIsActive: (b: boolean) => void;
    mode: 'FOCUS' | 'BREAK';
    setMode: (m: 'FOCUS' | 'BREAK') => void;
}

const FocusView: React.FC<FocusViewProps> = ({ timeLeft, setTimeLeft, isActive, setIsActive, mode, setMode }) => {
    const totalTime = mode === 'FOCUS' ? 25 * 60 : 5 * 60;
    const progress = (timeLeft / totalTime) * 100;

    // SVG Circular Progress Constants
    const size = 280;
    const strokeWidth = 8;
    const center = size / 2;
    const radius = center - strokeWidth * 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    const toggle = () => setIsActive(!isActive);
    const reset = () => {
        setIsActive(false);
        setTimeLeft(mode === 'FOCUS' ? 25 * 60 : 5 * 60);
    };
    const switchMode = (m: 'FOCUS' | 'BREAK') => {
        setMode(m);
        setIsActive(false);
        setTimeLeft(m === 'FOCUS' ? 25 * 60 : 5 * 60);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col items-center justify-center py-6 min-h-[70vh] animate-fade-in">
            {/* Mode Selector */}
            <div className="flex justify-center gap-2 mb-12 bg-[#E0E5EC] p-1.5 rounded-full w-fit shadow-[inset_4px_4px_8px_#b8b9be,inset_-4px_-4px_8px_#ffffff]">
                <button
                    onClick={() => switchMode('FOCUS')}
                    className={`px-6 py-2 rounded-full text-xs font-black transition-all duration-300 ${mode === 'FOCUS' ? 'text-gray-800 shadow-[4px_4px_8px_#b8b9be,-4px_-4px_8px_#ffffff]' : 'text-gray-400 opacity-60'}`}
                    style={mode === 'FOCUS' ? { background: '#E0E5EC' } : {}}
                >
                    Focus
                </button>
                <button
                    onClick={() => switchMode('BREAK')}
                    className={`px-6 py-2 rounded-full text-xs font-black transition-all duration-300 ${mode === 'BREAK' ? 'text-gray-800 shadow-[4px_4px_8px_#b8b9be,-4px_-4px_8px_#ffffff]' : 'text-gray-400 opacity-60'}`}
                    style={mode === 'BREAK' ? { background: '#E0E5EC' } : {}}
                >
                    Break
                </button>
            </div>

            {/* Main Timer Circle */}
            <div
                className="relative flex items-center justify-center rounded-full mb-12 transition-all duration-500"
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    background: "#E0E5EC",
                    boxShadow: "20px 20px 60px #bebebe, -20px -20px 60px #ffffff"
                }}
            >
                {/* Inner Recessed Circle */}
                <div
                    className="absolute inset-4 rounded-full flex flex-col items-center justify-center"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "inset 10px 10px 20px #b8b9be, inset -10px -10px 20px #ffffff"
                    }}
                >
                    <div className="text-[5.5rem] font-bold text-gray-700 tracking-tighter leading-none mb-2 tabular-nums">
                        {formatTime(timeLeft)}
                    </div>
                </div>

                {/* SVG Progress Ring */}
                <svg
                    width={size}
                    height={size}
                    className="absolute inset-0 transform -rotate-90 pointer-events-none"
                >
                    <circle
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="transparent"
                        stroke="#b8b9be"
                        strokeWidth={4}
                        strokeOpacity={0.2}
                    />
                    <circle
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="transparent"
                        stroke="#4A4A4A"
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        style={{
                            strokeDashoffset: offset,
                            transition: 'stroke-dashoffset 1s linear',
                            strokeLinecap: 'round'
                        }}
                    />
                </svg>
            </div>

            {/* Control Buttons */}
            <div className="flex gap-4 items-center">
                <button
                    onClick={() => setIsActive(true)}
                    disabled={isActive}
                    className={`
                        px-8 py-3 rounded-[20px] font-black text-sm transition-all duration-300 active:scale-95
                        ${isActive ? 'text-gray-300 cursor-default' : 'text-gray-600 hover:text-blue-600'}
                    `}
                    style={{
                        background: "#E0E5EC",
                        boxShadow: isActive
                            ? "inset 4px 4px 10px #b8b9be, inset -4px -4px 10px #ffffff"
                            : "8px 8px 16px #b8b9be, -8px -8px 16px #ffffff"
                    }}
                >
                    Start
                </button>
                <button
                    onClick={() => setIsActive(false)}
                    disabled={!isActive}
                    className={`
                        px-8 py-3 rounded-[20px] font-black text-sm transition-all duration-300 active:scale-95
                        ${!isActive ? 'text-gray-300 cursor-default' : 'text-gray-600 hover:text-red-500'}
                    `}
                    style={{
                        background: "#E0E5EC",
                        boxShadow: !isActive
                            ? "inset 4px 4px 10px #b8b9be, inset -4px -4px 10px #ffffff"
                            : "8px 8px 16px #b8b9be, -8px -8px 16px #ffffff"
                    }}
                >
                    Pause
                </button>
                <button
                    onClick={reset}
                    className="px-8 py-3 rounded-[20px] font-black text-sm text-gray-600 hover:text-gray-900 transition-all duration-300 active:scale-95"
                    style={{
                        background: "#E0E5EC",
                        boxShadow: "8px 8px 16px #b8b9be, -8px -8px 16px #ffffff"
                    }}
                >
                    Reset
                </button>
            </div>

            <p className="mt-12 text-gray-400 font-black uppercase text-[10px] tracking-widest opacity-60">
                {isActive ? (mode === 'FOCUS' ? 'Stay Focused' : 'Relax & Recharge') : 'Ready to begin?'}
            </p>
        </div>
    );
};

export default GetNote;
