import React, { useState, useEffect, useRef } from 'react';
import { Mic, Send, Bot, Sparkles, X, ChevronDown, User, Maximize2, Minimize2 } from 'lucide-react';

interface WealthAiAssistantProps {
    onProcessCommand: (text: string) => Promise<string>;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    isError?: boolean;
}

const WealthAiAssistant: React.FC<WealthAiAssistantProps> = ({ onProcessCommand }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [inputText, setInputText] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        { id: 'welcome', role: 'assistant', content: 'Hi! I\'m your Wealth AI. Describe a transaction or trade to record it instantly. e.g., "Bought coffee for $5" or "Buy 10 AAPL at 150".' }
    ]);
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    // Speech Recognition Setup
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInputText(transcript);
                handleSend(transcript);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
            };
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert("Voice recognition is not supported in this browser.");
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const handleSend = async (text: string = inputText) => {
        if (!text.trim() || isProcessing) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setIsProcessing(true);

        try {
            const response = await onProcessCommand(text);
            const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: response };
            setMessages(prev => [...prev, aiMsg]);
        } catch (error: any) {
            const errorMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: "Sorry, I encountered an error: " + error.message, isError: true };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-24 right-6 z-50 w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-110 transition-transform animate-bounce-custom"
            >
                <Sparkles size={24} />
            </button>
        );
    }

    return (
        <div className={`fixed z-50 transition-all duration-300 shadow-2xl overflow-hidden flex flex-col bg-surface/95 backdrop-blur-xl border border-white/20 dark:border-white/10 ${isExpanded ? 'inset-4 rounded-[32px]' : 'bottom-24 right-6 w-96 h-[500px] rounded-[32px]'}`}>

            {/* Header */}
            <div className="p-4 border-b border-border flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                        <Bot size={16} />
                    </div>
                    <div>
                        <h3 className="font-bold text-text-main text-sm">Wealth Assistant</h3>
                        <p className="text-[10px] text-text-muted font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Online
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 text-text-muted hover:text-text-main hover:bg-white/10 rounded-full transition-colors">
                        {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                    <button onClick={() => setIsOpen(false)} className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors">
                        <ChevronDown size={20} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-black/20">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : msg.isError
                                    ? 'bg-red-500/10 text-red-600 border border-red-500/20 rounded-bl-none'
                                    : 'bg-white dark:bg-[#2a2a2a] text-text-main border border-border rounded-bl-none'
                            }`}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                {isProcessing && (
                    <div className="flex justify-start w-full">
                        <div className="bg-white dark:bg-[#2a2a2a] p-4 rounded-2xl rounded-bl-none border border-border flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-surface border-t border-border">
                <div className="relative flex items-center gap-2">
                    <button
                        onClick={toggleListening}
                        className={`p-3 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse shadow-red-500/50 shadow-lg' : 'bg-input-bg text-text-muted hover:text-primary hover:bg-primary/10'}`}
                    >
                        <Mic size={20} />
                    </button>
                    <input
                        type="text"
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder="Type or speak..."
                        className="flex-1 p-3 bg-input-bg rounded-xl border-none focus:ring-2 focus:ring-primary/20 font-medium text-text-main placeholder-text-muted"
                        disabled={isProcessing}
                    />
                    <button
                        onClick={() => handleSend()}
                        disabled={!inputText.trim() || isProcessing}
                        className="p-3 bg-text-main text-surface rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                        <Send size={18} />
                    </button>
                </div>
                {isListening && <p className="text-xs text-center text-red-500 mt-2 font-bold animate-pulse">Listening...</p>}
            </div>

        </div>
    );
};

export default WealthAiAssistant;
