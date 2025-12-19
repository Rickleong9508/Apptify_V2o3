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
    Languages
} from 'lucide-react';
import { aiService, AIProvider } from '../services/aiService';

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
}

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

    // --- Voice Input State ---
    const [isListening, setIsListening] = useState(false);
    const [speechLang, setSpeechLang] = useState<'zh-CN' | 'en-US'>('zh-CN');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const recognitionRef = useRef<any>(null);

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

    // Persist Data
    useEffect(() => {
        try { localStorage.setItem('gn_notes', JSON.stringify(notes)); }
        catch (e) { alert("Storage full! Remove images to save."); }
    }, [notes]);

    useEffect(() => {
        try { localStorage.setItem('gn_todos', JSON.stringify(todos)); }
        catch (e) { alert("Storage full! Remove attachments to save."); }
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

    const handleGlobalAskAi = async () => {
        if (!globalChatInput.trim() && globalResources.length === 0) return;

        if (!apiKey) {
            // Show error in chat instead of alert
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
                // Notify user we are scanning (optional visual cue could be added to UI, but acting implicitly for now)
                // console.log("Scanning URLs:", foundUrls);

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

        // Clear resources after sending (or keep them? usually clear like attachments)
        const usedResources = [...globalResources]; // Snapshot for display if needed
        setGlobalResources([]); // Clear UI

        const qNote: Note = {
            id: Date.now().toString(),
            title: 'You Asked',
            content: userQ + (resourceContext ? "\n\n(Attached Resources)" : ""),
            date: new Date().toISOString(),
            role: 'user',
            type: 'qa'
        };
        setGlobalMessages(prev => [...prev, qNote]);

        // Build Context from ALL notes
        let context = "You are the 'GetNote' Manager. Your scope is to manage the user's Notes, Tasks, and analyzed Resources provided below.\n";
        context += "IMPORTANT: If the user provides a link or URL, I have already analyzed it for you in the 'ATTACHED RESOURCES' section. Your task is to READ that analyzed content and answer the user's questions about it, or summarize it if asked. Do NOT say you cannot access the internet; instead, use the analyzed text provided to you.\n";
        context += "Do NOT answer general knowledge questions using external info not provided here, unless the user explicitly provided a link for you to read. If asked about something unrelated to notes/tasks/links, politely decline.\n";
        context += "You can analyze attached images and video links (metadata) to help the user manage their knowledge base.\n\n";

        if (resourceContext) {
            context += "--- ATTACHED RESOURCES (High Priority) ---\n" + resourceContext + "\n----------------------------------------\n\n";
        }

        context += "--- USER NOTES ---\n";
        notes.forEach(n => {
            if (n.title || n.content) {
                context += `Note: ${n.title || 'Untitled'}\nContent: ${n.content?.slice(0, 500)}\n\n`;
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
                            <span className="font-semibold text-sm tracking-tight text-gray-700">Apptify OS</span>
                        </div>

                        {/* Global AI Trigger */}
                        <button
                            onClick={() => setIsGlobalChatOpen(true)}
                            className="text-gray-700 px-5 py-2.5 rounded-[20px] flex items-center gap-2 transition-all active:scale-95 group hover:text-blue-600"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
                            }}
                        >
                            <Sparkles size={16} className="text-amber-500 group-hover:rotate-12 transition-transform" />
                            <span className="font-bold text-sm">Ask AI</span>
                        </button>
                    </div>

                    {/* View Renderer */}
                    <div className="animate-slide-up">
                        {activeTab === 'notes' && <NotesView notes={notes} setNotes={setNotes} openGlobalChat={() => setIsGlobalChatOpen(true)} />}
                        {activeTab === 'todo' && <TodoView todos={todos} setTodos={setTodos} />}
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
            {isGlobalChatOpen && (
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

                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {globalMessages.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                                    <Bot size={48} className="mb-4 text-gray-300" />
                                    <p className="text-sm font-medium">How can I help you today?</p>
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
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
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

                        <div className="p-4 pb-8 backdrop-blur-sm">
                            <div
                                className="relative rounded-[28px] focus-within:shadow-inner transition-all flex items-end p-2"
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
                                    className="w-full bg-transparent px-4 py-3 pb-3 pr-20 text-sm font-medium text-gray-700 placeholder-gray-400 outline-none resize-none max-h-[150px] scrollbar-thin scrollbar-thumb-gray-300"
                                    style={{
                                        minHeight: '44px',
                                        overflowY: globalChatInput.length > 50 ? 'auto' : 'hidden'
                                    }}
                                />

                                {/* Controls Container */}
                                <div className="absolute right-3 bottom-2 flex items-center gap-2">

                                    {/* Mic & Lang */}
                                    <div className="flex items-center gap-1 bg-[#E0E5EC] rounded-full px-1 py-1 shadow-[2px_2px_4px_#b8b9be,-2px_-2px_4px_#ffffff]">
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
                                            <Mic size={14} />
                                        </button>
                                    </div>

                                    {/* Resource Actions */}
                                    <div className="flex items-center gap-1">
                                        {isProcessingResource ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mx-2"></div>
                                        ) : (
                                            <>
                                                <label className="p-2 text-gray-400 hover:text-blue-500 rounded-full transition-colors cursor-pointer active:scale-90" title="Upload File (PDF/Doc/Image)">
                                                    <Paperclip size={18} />
                                                    <input type="file" className="hidden" onChange={(e) => handleResourceAdd(e.target.files?.[0] || null)} />
                                                </label>
                                            </>
                                        )}
                                    </div>

                                    {/* Send Button */}
                                    <button
                                        onClick={handleGlobalAskAi}
                                        disabled={!globalChatInput.trim()}
                                        className="w-10 h-10 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-50 transition-all text-white"
                                        style={{
                                            background: globalChatInput.trim() ? '#4F46E5' : '#E0E5EC',
                                            boxShadow: globalChatInput.trim() ? "3px 3px 6px rgba(79, 70, 229, 0.4)" : "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff",
                                            color: globalChatInput.trim() ? 'white' : '#9CA3AF'
                                        }}
                                    >
                                        {globalChatInput.trim() ? <ArrowLeft size={16} className="rotate-90 md:rotate-0" /> : <Sparkles size={16} />}
                                    </button>
                                </div>

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
    )
}

// 1. NOTES VIEW
const NotesView: React.FC<{ notes: Note[], setNotes: any, openGlobalChat: () => void }> = ({ notes, setNotes, openGlobalChat }) => {
    // Shared state like global settings
    const [aiProvider] = useState<AIProvider>(() => (localStorage.getItem('app_global_ai_provider') as AIProvider) || 'google');
    const [apiKey] = useState(() => localStorage.getItem('app_global_api_key') || '');
    const [aiModel] = useState(() => localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash');

    const [isEditing, setIsEditing] = useState(false);
    const [interactionMode, setInteractionMode] = useState<'VIEW' | 'EDIT'>('VIEW');
    const [editForm, setEditForm] = useState<Partial<Note>>({});
    const [isProcessingAi, setIsProcessingAi] = useState(false);

    // Thread State
    const [currentThread, setCurrentThread] = useState<Note[]>([]);
    const [newThreadInput, setNewThreadInput] = useState('');
    const [isAiThinking, setIsAiThinking] = useState(false);

    // UI State
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

    // --- Review Mode State ---
    const [reviewingItem, setReviewingItem] = useState<Note | null>(null);
    const [reviewEditMode, setReviewEditMode] = useState(false);
    const [reviewForm, setReviewForm] = useState<{ content: string; attachments: Attachment[] }>({ content: '', attachments: [] });

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

    const handleSave = () => {
        if (!editForm.title && !editForm.content && currentThread.length === 0) { setIsEditing(false); return; }

        // Construct final note object
        const noteToSave: Note = {
            ...editForm,
            title: editForm.title || (editForm.content ? editForm.content.slice(0, 30) + '...' : 'Untitled Topic'),
            content: editForm.content || '',
            date: editForm.date || new Date().toISOString(),
            // If we have sub-notes, treat as thread
            isThread: currentThread.length > 0 || (!!editForm.thread && editForm.thread.length > 0),
            thread: currentThread
        } as Note;

        setNotes((prev: Note[]) => {
            const exists = prev.find(n => n.id === noteToSave.id);
            if (exists) return prev.map(n => n.id === noteToSave.id ? noteToSave : n);
            return [noteToSave, ...prev];
        });
        setIsEditing(false);
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        // Native confirm might be blocked or failing in some views. 
        // Direct delete for now to ensure functionality.
        setNotes((prev: Note[]) => prev.filter(n => n.id !== id));
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
        if (!newThreadInput.trim()) return;

        const newEntry: Note = {
            id: Date.now().toString(),
            title: 'Note',
            content: newThreadInput,
            date: new Date().toISOString(),
            role: 'user',
            type: 'note'
        };
        setCurrentThread(prev => [...prev, newEntry]);
        setNewThreadInput('');
    };

    // --- Review Handlers ---
    const handleOpenReview = (item: Note) => {
        setReviewingItem(item);
        setReviewEditMode(false);
        setReviewForm({ content: item.content, attachments: item.attachments || [] });
    };

    const handleSaveReview = () => {
        if (!reviewingItem) return;
        const updatedItem = { ...reviewingItem, content: reviewForm.content, attachments: reviewForm.attachments };
        const newThread = currentThread.map(item => item.id === reviewingItem.id ? updatedItem : item);
        setCurrentThread(newThread);

        // IMMEDIATE SAVE
        setNotes((prev: Note[]) => {
            return prev.map(n => n.id === editForm.id ? { ...n, thread: newThread } : n);
        });

        setReviewingItem(null);
        setReviewEditMode(false);
    };

    const handleDeleteReviewItem = () => {
        if (!reviewingItem) return;
        const newThread = currentThread.filter(item => item.id !== reviewingItem.id);
        setCurrentThread(newThread);

        // IMMEDIATE SAVE FIX
        setNotes((prev: Note[]) => {
            return prev.map(n => n.id === editForm.id ? { ...n, thread: newThread } : n);
        });

        setReviewingItem(null);
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
                            placeholder="Title"
                            className="w-full text-4xl font-bold mb-6 outline-none placeholder-gray-400 bg-transparent text-gray-700"
                            readOnly={interactionMode === 'VIEW'}
                        />
                        <textarea
                            value={editForm.content || ''}
                            onChange={e => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                            placeholder="Start typing..."
                            className="w-full h-40 text-lg leading-relaxed text-gray-700 outline-none resize-none placeholder-gray-400 bg-transparent"
                            readOnly={interactionMode === 'VIEW'}
                        />
                    </div>

                    {/* Data / Reference Stream */}
                    <div className="mb-32">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 pl-4">Knowledge Stream</h3>
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
                                    <p className="line-clamp-3 text-sm text-gray-700 font-medium">{entry.content || entry.title}</p>
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
                </div>

                {/* Input Bar */}
                <div
                    className="p-4 backdrop-blur-md sticky bottom-0 z-20 pb-8 safe-area-bottom"
                    style={{ background: "rgba(224, 229, 236, 0.9)" }}
                >
                    <div
                        className="max-w-4xl mx-auto flex items-center gap-3 p-2 rounded-[28px] pr-2 transition-all"
                        style={{
                            background: "#E0E5EC",
                            boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)"
                        }}
                    >
                        <label className="p-3 text-gray-500 hover:text-blue-600 rounded-full cursor-pointer transition-colors hover:bg-gray-200">
                            <Plus size={20} />
                            <input type="file" onChange={handleFileUpload} className="hidden" multiple />
                        </label>
                        <button onClick={handleAddLink} className="p-3 text-gray-500 hover:text-blue-600 rounded-full cursor-pointer transition-colors hover:bg-gray-200">
                            <LinkIcon size={20} />
                        </button>
                        <input
                            value={newThreadInput}
                            onChange={e => setNewThreadInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addToThread(); }}
                            placeholder="Add a quick note, image, or link..."
                            className="flex-1 bg-transparent outline-none text-base text-gray-700 placeholder-gray-400 px-2"
                        />
                        <button
                            onClick={addToThread}
                            disabled={!newThreadInput.trim()}
                            className="text-white rounded-full p-2 w-10 h-10 flex items-center justify-center disabled:opacity-30 transition-all active:scale-95"
                            style={{
                                background: newThreadInput.trim() ? '#4F46E5' : '#E0E5EC',
                                boxShadow: newThreadInput.trim() ? "3px 3px 6px rgba(79, 70, 229, 0.4)" : "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff",
                                color: newThreadInput.trim() ? 'white' : '#9CA3AF'
                            }}
                        >
                            <ArrowLeft size={20} className="rotate-90 md:rotate-0" />
                        </button>
                    </div>
                </div>

                {/* REVIEW MODAL - CLAY STYLE */}
                {reviewingItem && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-fade-in">
                        <div
                            className="rounded-[32px] w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
                            style={{
                                background: "#E0E5EC",
                                boxShadow: "20px 20px 60px #bebebe, -20px -20px 60px #ffffff"
                            }}
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
                                        <textarea
                                            value={reviewForm.content}
                                            onChange={e => setReviewForm(prev => ({ ...prev, content: e.target.value }))}
                                            className="w-full h-40 rounded-xl p-4 outline-none resize-none bg-[#E0E5EC] text-gray-700"
                                            style={{ boxShadow: "inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff" }}
                                        />
                                        <button
                                            onClick={handleSaveReview}
                                            className="w-full py-3 rounded-xl font-bold transition-transform active:scale-95 text-blue-600"
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
                                        {reviewingItem.image && <img src={reviewingItem.image} className="w-full rounded-2xl" />}
                                        {reviewingItem.attachments?.map(att => att.type === 'image' && <img key={att.id} src={att.content} className="w-full rounded-2xl" />)}
                                        <p className="text-lg leading-relaxed whitespace-pre-wrap">{reviewingItem.content}</p>
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
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-xl leading-tight line-clamp-2 text-gray-700 group-hover:text-blue-600 transition-colors">{note.title || "Untitled Note"}</h3>
                                    {note.thread && note.thread.length > 0 && (
                                        <div className="text-gray-500 px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 bg-[#E0E5EC] shadow-inner">
                                            <Database size={10} /> {note.thread.length}
                                        </div>
                                    )}
                                </div>
                                <p className="text-gray-500 text-sm line-clamp-4 leading-relaxed font-medium">
                                    {note.content || "No content..."}
                                </p>
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
                    <span className="font-bold text-gray-500 group-hover:text-blue-600">Create New Note</span>
                </div>
            </div>
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

    const deleteTask = (id: string) => {
        setTodos((prev: Todo[]) => prev.filter(t => t.id !== id));
        if (previewTask?.id === id) setPreviewTask(null);
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
                                                className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full z-10 transition-transform group-hover:scale-125 border border-white/20"
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
                <div className="fixed inset-0 z-[60] bg-black flex flex-col animate-fade-in" onClick={() => setViewingAttachment(null)}>
                    <button className="absolute top-6 right-6 text-white p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors z-10"><X size={32} /></button>
                    <div className="flex-1 flex items-center justify-center p-4">
                        {viewingAttachment.startsWith('data:image') ? <img src={viewingAttachment} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} /> : <div className="text-white text-center" onClick={(e) => e.stopPropagation()}><FileText size={64} className="mx-auto mb-4 opacity-70" /><h3 className="text-2xl font-bold">{viewingAttachment.replace('FILE:', '')}</h3><p className="mt-4 text-gray-400">Preview not available for this file type.</p></div>}
                    </div>
                </div>
            )}

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
                                        <button onClick={() => setNewAttachments(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 bg-gray-500/50 text-white rounded-full p-0.5 hover:bg-red-500"><X size={10} /></button>
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
            )}
        </div>
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
    useEffect(() => { }, []);
    const toggle = () => setIsActive(!isActive);
    const reset = () => { setIsActive(false); setTimeLeft(mode === 'FOCUS' ? 25 * 60 : 5 * 60); };
    const switchMode = (m: 'FOCUS' | 'BREAK') => { setMode(m); setIsActive(false); setTimeLeft(m === 'FOCUS' ? 25 * 60 : 5 * 60); };
    const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    return (
        <div className="flex flex-col items-center justify-center py-10 min-h-[60vh]">
            <div className="bg-surface w-full max-w-md p-10 rounded-[40px] shadow-2xl border border-border text-center relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-2 ${mode === 'FOCUS' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                <div className="flex justify-center gap-2 mb-8 bg-input-bg p-1 rounded-full w-fit mx-auto">
                    <button onClick={() => switchMode('FOCUS')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${mode === 'FOCUS' ? 'bg-surface shadow-sm text-red-500' : 'text-text-muted'}`}>Focus</button>
                    <button onClick={() => switchMode('BREAK')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${mode === 'BREAK' ? 'bg-surface shadow-sm text-green-500' : 'text-text-muted'}`}>Break</button>
                </div>
                <div className="text-[6rem] md:text-[7rem] font-bold text-text-main leading-none font-mono tracking-tighter mb-8 tabular-nums">{formatTime(timeLeft)}</div>
                <div className="flex justify-center gap-6">
                    <button onClick={toggle} className="w-20 h-20 bg-text-main text-surface rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg">{isActive ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}</button>
                    <button onClick={reset} className="w-20 h-20 bg-input-bg text-text-muted rounded-full flex items-center justify-center hover:bg-border transition-colors"><RotateCcw size={28} /></button>
                </div>
                <p className="mt-8 text-text-muted font-bold uppercase text-xs tracking-widest">{isActive ? (mode === 'FOCUS' ? 'Stay Focused' : 'Relax & Recharge') : 'Ready?'}</p>
            </div>
        </div>
    );
};

export default GetNote;
