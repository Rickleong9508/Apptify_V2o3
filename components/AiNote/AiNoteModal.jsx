import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Mic, Link, FileText, Clipboard, Download, 
  RefreshCw, Check, AlertCircle, Play, Square, Settings, Sparkles 
} from 'lucide-react';
import useSpeech from './useSpeech';
import { VOICE_NOTE_SYSTEM_PROMPT, WEB_MEMO_SYSTEM_PROMPT } from './prompts';
import { aiService } from '../../services/aiService';
import { supabase } from '../../services/supabaseClient';

const CSS_STYLES = `
@keyframes breathe {
  0% {
    box-shadow: inset 6px 6px 12px rgb(163,177,198,0.4), inset -6px -6px 12px rgba(255,255,255,0.8), 0 0 10px rgba(239, 68, 68, 0.3);
    border-color: rgba(239, 68, 68, 0.4);
  }
  50% {
    box-shadow: inset 6px 6px 12px rgb(163,177,198,0.4), inset -6px -6px 12px rgba(255,255,255,0.8), 0 0 25px rgba(239, 68, 68, 0.8);
    border-color: rgba(239, 68, 68, 0.9);
  }
  100% {
    box-shadow: inset 6px 6px 12px rgb(163,177,198,0.4), inset -6px -6px 12px rgba(255,255,255,0.8), 0 0 10px rgba(239, 68, 68, 0.3);
    border-color: rgba(239, 68, 68, 0.4);
  }
}
.voice-btn-active {
  animation: breathe 2s infinite ease-in-out;
}
`;

// Helper component for markdown rendering
const MarkdownRenderer = ({ text }) => {
  if (!text) {
    return <p className="text-gray-400 italic text-sm text-center py-8">No content generated yet.</p>;
  }

  const lines = text.split('\n');
  
  // Custom parser for basic styles
  const parseInlineStyles = (txt) => {
    const parts = txt.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={index} className="italic text-gray-800">{part.slice(1, -1)}</em>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-3 text-gray-700 text-sm leading-relaxed text-left">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;

        // Headings
        if (trimmed.startsWith('# ')) {
          return (
            <h1 key={idx} className="text-2xl font-bold text-gray-800 border-b border-gray-300/40 pb-2 mt-4 mb-3">
              {trimmed.slice(2)}
            </h1>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={idx} className="text-lg font-bold text-gray-800 border-b border-gray-200/30 pb-1 mt-4 mb-2">
              {trimmed.slice(3)}
            </h2>
          );
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-base font-bold text-gray-800 mt-3 mb-1">
              {trimmed.slice(4)}
            </h3>
          );
        }

        // Bullet points
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-4">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
              <span className="flex-1">{parseInlineStyles(trimmed.slice(2))}</span>
            </div>
          );
        }

        // Standard paragraph
        return <p key={idx}>{parseInlineStyles(trimmed)}</p>;
      })}
    </div>
  );
};

export default function AiNoteModal({ isOpen, onClose, onNavigate }) {
  const [activeTab, setActiveTab] = useState('voice'); // 'voice' | 'web'
  const [webUrl, setWebUrl] = useState('');
  
  // AI config state loaded from localStorage
  const [aiConfig, setAiConfig] = useState({ provider: 'google', apiKey: '', model: '' });
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Output states
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  // Hook for voice speech recognition
  const speech = useSpeech('zh-CN');
  const canvasRef = useRef(null);

  // Reload AI configuration whenever modal opens or when component mounts
  const reloadAiConfig = () => {
    const provider = localStorage.getItem('app_global_ai_provider') || 'google';
    const apiKey = localStorage.getItem('app_global_api_key') || '';
    const model = localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash';
    setAiConfig({ provider, apiKey, model });
  };

  useEffect(() => {
    if (isOpen) {
      reloadAiConfig();
      setHasSaved(false);
      setHasCopied(false);
    } else {
      speech.stopListening();
    }
  }, [isOpen]);

  // Audio Waveform Animation Loop
  useEffect(() => {
    if (!speech.isListening || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;
    let phase = 0;

    const draw = () => {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      const width = canvas.width;
      const height = canvas.height;
      const midY = height / 2;
      
      // Volume level determines height of waveform
      const amp = (speech.volume / 100) * (height / 3.5) + 4;
      
      for (let x = 0; x < width; x++) {
        // Combine sine wave with envelope that pinches at the boundaries
        const y = midY + Math.sin(x * 0.04 + phase) * amp * Math.sin(x * Math.PI / width);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      phase += 0.12;
      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [speech.isListening, speech.volume]);

  if (!isOpen) return null;

  const handleVoiceToggle = () => {
    if (speech.isListening) {
      speech.stopListening();
    } else {
      speech.startListening();
    }
  };

  // Convert raw voice transcript to structured markdown note
  const handleVoiceFormat = async () => {
    if (!speech.transcript.trim()) {
      alert("Please record some voice transcription first.");
      return;
    }
    if (!aiConfig.apiKey) {
      alert("API Key is missing. Please configure it in Global Settings.");
      return;
    }

    setIsAiLoading(true);
    setHasSaved(false);
    try {
      const response = await aiService.generate(
        aiConfig.provider,
        aiConfig.model,
        aiConfig.apiKey,
        `Raw Voice Transcript: ${speech.transcript}`,
        VOICE_NOTE_SYSTEM_PROMPT
      );

      // Extract a title from the markdown response
      const titleMatch = response.match(/^#\s+(.+)$/m);
      const tempTitle = titleMatch ? titleMatch[1].trim() : `VoiceNote_${new Date().toLocaleDateString()}`;
      
      setNoteTitle(tempTitle);
      setNoteContent(response);
    } catch (err) {
      console.error(err);
      alert("AI Processing Failed: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Crawl and Summarize web page URLs
  const handleWebSubmit = async (e) => {
    e.preventDefault();
    if (!webUrl.trim()) {
      alert("Please enter a valid website URL.");
      return;
    }
    if (!aiConfig.apiKey) {
      alert("API Key is missing. Please configure it in Global Settings.");
      return;
    }

    setIsAiLoading(true);
    setHasSaved(false);
    setNoteContent('');
    setNoteTitle('');
    try {
      // 1. Fetch extracted html content from server
      const res = await fetch('/api/process_input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'url', content: webUrl })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Server failed to scrape the page content.");
      }

      const crawlData = await res.json();
      if (!crawlData.text) {
        throw new Error("No readable text content extracted from this URL.");
      }

      // 2. Request AI summarizing
      const summaryText = await aiService.generate(
        aiConfig.provider,
        aiConfig.model,
        aiConfig.apiKey,
        `URL: ${webUrl}\nRaw Web Text: ${crawlData.text}`,
        WEB_MEMO_SYSTEM_PROMPT
      );

      const titleMatch = summaryText.match(/^#\s+(.+)$/m);
      const tempTitle = titleMatch ? titleMatch[1].trim() : crawlData.metadata?.title || "Web Memo Summary";

      setNoteTitle(tempTitle);
      setNoteContent(summaryText);
    } catch (err) {
      console.error(err);
      alert("Failed to summarize URL: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Clipboard copy action
  const handleCopy = () => {
    if (!noteContent) return;
    navigator.clipboard.writeText(noteContent);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  // Save notes locally (Knowledge Vault / Obsidian Vault)
  const handleSaveToLocal = async () => {
    if (!noteContent) return;
    setIsSaving(true);
    try {
      const vaultPath = localStorage.getItem('app_obsidian_vault_path') || '';
      const docTitle = noteTitle || `AiNote_${new Date().toISOString().slice(0, 10)}`;

      if (vaultPath) {
        // Save to local Obsidian Vault
        const response = await fetch('/api/obsidian/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vaultPath,
            title: docTitle.replace(/[/\\?%*:|"<>]/g, '-').trim(),
            content: noteContent,
            category: 'AiNote',
            keywords: ['AiNote'],
            summary: noteContent.slice(0, 150) + '...',
            date: new Date().toISOString()
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to save note to Obsidian Vault.");
        }

        // Refresh KnowledgeVault state if mounted
        const kv = window.__apptify_knowledgevault;
        if (kv && kv.vaultPath === vaultPath && kv.setNotes) {
          const notesRes = await fetch('/api/obsidian/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vaultPath })
          });
          const notesData = await notesRes.json();
          if (notesRes.ok && notesData.notes) {
            kv.setNotes(notesData.notes);
          }
        }
      } else {
        // Fallback to internal storage / localStorage / Supabase
        const kv = window.__apptify_knowledgevault;
        let notes = [];
        if (kv && kv.notes) {
          notes = [...kv.notes];
        } else {
          notes = JSON.parse(localStorage.getItem('gn_notes') || '[]');
        }

        const newNote = {
          id: Date.now().toString(),
          title: docTitle,
          content: noteContent,
          date: new Date().toISOString(),
          ai_category: 'AiNote',
          ai_processed: true,
          ai_summary: noteContent.slice(0, 150) + '...',
          ai_keywords: ['AiNote']
        };

        const updatedNotes = [newNote, ...notes];

        if (kv && kv.setNotes) {
          kv.setNotes(updatedNotes);
        } else {
          localStorage.setItem('gn_notes', JSON.stringify(updatedNotes));
          localStorage.setItem('gn_meta', JSON.stringify({ lastUpdated: new Date().toISOString() }));
        }

        // Supabase Syncing
        const sessionRes = await supabase.auth.getSession();
        const user = sessionRes?.data?.session?.user;
        if (user) {
          const { data: existing } = await supabase.from('user_data').select('id, data').eq('user_id', user.id).single();
          let finalData = existing?.data || {};
          finalData.getnote = {
            notes: updatedNotes,
            todos: kv?.todos || JSON.parse(localStorage.getItem('gn_todos') || '[]'),
            lastUpdated: new Date().toISOString()
          };

          if (existing?.id) {
            await supabase.from('user_data').update({ data: finalData, updated_at: new Date().toISOString() }).eq('user_id', user.id);
          } else {
            await supabase.from('user_data').insert({ user_id: user.id, data: finalData, updated_at: new Date().toISOString() });
          }
        }
      }

      setHasSaved(true);
    } catch (err) {
      console.error(err);
      alert("Failed to save note: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/40 animate-fade-in font-sans">
      <style>{CSS_STYLES}</style>
      
      <div 
        className="w-full max-w-3xl rounded-[35px] bg-[#E0E5EC] p-6 md:p-8 flex flex-col max-h-[90vh] overflow-hidden text-gray-700 relative animate-scale-in"
        style={{
          boxShadow: "12px 12px 24px rgb(163,177,198,0.7), -12px -12px 24px rgba(255,255,255, 0.6)"
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-300/40 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-blue-500"
              style={{
                background: "#E0E5EC",
                boxShadow: "3px 3px 6px #b8b9be, -3px -3px 6px #ffffff"
              }}
            >
              {activeTab === 'voice' ? <Mic size={20} /> : <Link size={20} />}
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-gray-800 leading-tight">AiNote</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Voice & Web Memo</p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-2.5 rounded-full text-gray-500 hover:text-red-500 transition-colors"
            style={{
              background: "#E0E5EC",
              boxShadow: "3px 3px 6px #b8b9be, -3px -3px 6px #ffffff"
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* API Key configuration banner */}
        {!aiConfig.apiKey && (
          <div 
            className="mb-6 p-4 rounded-2xl flex items-center justify-between text-xs font-bold text-amber-700 bg-amber-100/60 border border-amber-200"
          >
            <span className="flex items-center gap-2">
              <AlertCircle size={16} />
              AI key not configured. Please add your API key.
            </span>
            <button 
              onClick={() => {
                onClose();
                if (onNavigate) onNavigate('settings');
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition"
            >
              Configure
            </button>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('voice')}
            className={`flex-1 py-3 px-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              activeTab === 'voice' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            style={{
              background: "#E0E5EC",
              boxShadow: activeTab === 'voice' 
                ? "inset 4px 4px 8px #b8b9be, inset -4px -4px 8px #ffffff"
                : "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
            }}
          >
            🎙️ Voice Note
          </button>
          <button
            onClick={() => setActiveTab('web')}
            className={`flex-1 py-3 px-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              activeTab === 'web' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            style={{
              background: "#E0E5EC",
              boxShadow: activeTab === 'web' 
                ? "inset 4px 4px 8px #b8b9be, inset -4px -4px 8px #ffffff"
                : "5px 5px 10px #b8b9be, -5px -5px 10px #ffffff"
            }}
          >
            🔗 Web Memo
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-6 max-h-[55vh]">
          {activeTab === 'voice' && (
            <div className="flex flex-col items-center justify-center py-6 gap-6">
              {/* Mic Language Selector */}
              <div className="flex gap-2 p-1 rounded-xl" style={{ boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}>
                {[
                  { id: 'zh-CN', name: 'Chinese' },
                  { id: 'en-US', name: 'English' }
                ].map((l) => (
                  <button
                    key={l.id}
                    onClick={() => speech.setLang(l.id)}
                    className={`px-3 py-1 text-xs font-extrabold rounded-lg transition ${
                      speech.lang === l.id ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500'
                    }`}
                  >
                    {l.name}
                  </button>
                ))}
              </div>

              {/* Huge Neomorphic Recording Button */}
              <button
                onClick={handleVoiceToggle}
                className={`w-28 h-28 rounded-full flex flex-col items-center justify-center border-4 border-transparent transition-all ${
                  speech.isListening ? 'voice-btn-active text-red-500' : 'text-gray-600'
                }`}
                style={{
                  background: "#E0E5EC",
                  boxShadow: speech.isListening
                    ? "inset 6px 6px 12px #b8b9be, inset -6px -6px 12px #ffffff"
                    : "8px 8px 16px #b8b9be, -8px -8px 16px #ffffff"
                }}
              >
                {speech.isListening ? <Square size={32} /> : <Mic size={36} />}
                <span className="text-[10px] font-extrabold uppercase mt-2">
                  {speech.isListening ? 'Stop' : 'Start'}
                </span>
              </button>

              {/* Dynamic Waveform Canvas / Transcribing status */}
              {speech.isListening ? (
                <div className="w-full flex flex-col items-center gap-2">
                  <canvas 
                    ref={canvasRef} 
                    width={400} 
                    height={50} 
                    className="w-full max-w-md h-12 rounded-xl"
                  />
                  <span className="text-xs font-bold text-blue-500 animate-pulse">Listening & Transcribing...</span>
                </div>
              ) : (
                <span className="text-xs font-bold text-gray-400">Click button to start recording</span>
              )}

              {/* Real-time raw transcript area */}
              {(speech.transcript || speech.interimTranscript) && (
                <div className="w-full space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase px-2">
                    <span>Raw Spoken Transcript</span>
                    <button 
                      onClick={speech.resetTranscript} 
                      className="text-red-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                  <div 
                    className="w-full min-h-[80px] max-h-[160px] overflow-y-auto p-4 rounded-2xl text-sm font-medium text-gray-700 bg-[#E0E5EC] text-left leading-relaxed"
                    style={{ boxShadow: "inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff" }}
                  >
                    {speech.transcript}
                    {speech.interimTranscript && (
                      <span className="text-blue-500/80 italic"> {speech.interimTranscript}</span>
                    )}
                  </div>
                  
                  {/* Format/Summarize CTA */}
                  <button
                    onClick={handleVoiceFormat}
                    disabled={isAiLoading || !speech.transcript.trim()}
                    className="w-full py-3 rounded-2xl font-bold text-sm text-white bg-blue-500 hover:bg-blue-600 transition shadow-md disabled:bg-gray-400/50 disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    {isAiLoading ? <RefreshCw className="animate-spin" size={16} /> : <Sparkles size={16} />}
                    Format & Summarize Note
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'web' && (
            <form onSubmit={handleWebSubmit} className="space-y-4 py-4 text-left">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2">Website URL</label>
                <div className="flex gap-4">
                  <input
                    type="url"
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    placeholder="https://example.com/article"
                    required
                    className="flex-1 p-4 rounded-2xl text-sm outline-none text-gray-700 bg-[#E0E5EC]"
                    style={{
                      boxShadow: "inset 4px 4px 8px #b8b9be, inset -4px -4px 8px #ffffff"
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isAiLoading || !webUrl}
                    className="px-6 rounded-2xl font-bold text-sm text-white bg-blue-500 hover:bg-blue-600 transition shadow-md disabled:bg-gray-400/50 disabled:shadow-none flex items-center gap-2"
                  >
                    {isAiLoading ? <RefreshCw className="animate-spin" size={16} /> : <Sparkles size={16} />}
                    Extract & Summarize
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Outputs / Results Panel */}
          {(isAiLoading || noteContent) && (
            <div className="space-y-3 text-left">
              <div className="h-px bg-gray-300/60 my-4" />
              <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase px-2">
                <span>📄 Rendered Markdown Output</span>
                {noteTitle && <span className="font-mono text-gray-500 font-medium lowercase">title: {noteTitle}</span>}
              </div>

              <div 
                className="w-full p-6 rounded-[28px] bg-[#E0E5EC] min-h-[150px] relative overflow-hidden transition-all duration-300"
                style={{ 
                  boxShadow: "inset 4px 4px 8px #b8b9be, inset -4px -4px 8px #ffffff",
                  border: "1px solid rgba(255, 255, 255, 0.4)"
                }}
              >
                {isAiLoading && !noteContent ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <RefreshCw className="animate-spin text-blue-500" size={32} />
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Generating memo note...</span>
                  </div>
                ) : (
                  <>
                    <MarkdownRenderer text={noteContent} />
                    
                    {/* Copy and Save Buttons */}
                    <div className="flex items-center gap-3 mt-6 border-t border-gray-300/40 pt-4">
                      <button
                        onClick={handleCopy}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 ${
                          hasCopied ? 'text-green-600' : 'text-gray-600'
                        }`}
                        style={{
                          background: "#E0E5EC",
                          boxShadow: "3px 3px 6px #b8b9be, -3px -3px 6px #ffffff"
                        }}
                      >
                        {hasCopied ? <Check size={14} /> : <Clipboard size={14} />}
                        {hasCopied ? 'Copied!' : 'Copy to Clipboard'}
                      </button>

                      <button
                        onClick={handleSaveToLocal}
                        disabled={isSaving || hasSaved}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs text-white transition flex items-center gap-1.5 ${
                          hasSaved ? 'bg-green-500' : 'bg-blue-500 hover:bg-blue-600'
                        }`}
                        style={{
                          boxShadow: hasSaved ? 'none' : '3px 3px 6px #b8b9be, -3px -3px 6px #ffffff'
                        }}
                      >
                        {isSaving ? (
                          <>
                            <RefreshCw className="animate-spin" size={14} /> Saving...
                          </>
                        ) : hasSaved ? (
                          <>
                            <Check size={14} /> Saved
                          </>
                        ) : (
                          <>
                            <Download size={14} /> Save to Knowledge Vault
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
