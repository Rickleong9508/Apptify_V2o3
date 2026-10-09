import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Send, X, Check, AlertTriangle, ArrowRight, 
  Wallet, FileText, CheckSquare, TrendingUp, RefreshCw, 
  Compass, ChevronRight, ChevronLeft, PieChart, ShieldCheck, Zap
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import { saveAllDataToDrive } from '../services/driveService';
import { aiService } from '../services/aiService';
import { Account, Expense, Loan, Stock, MonthlyData } from '../types';
import { skillRegistry } from '../services/skillRegistry';
import * as skillExecutor from '../services/skillExecutor';
import { Language, translations, getStoredLanguage } from '../utils/i18n';

interface AskApptifyProps {
  currentApp: string;
  setCurrentApp: (app: any) => void;
}

interface ActionPayload {
  intent: string;
  data: any;
  message?: string;
  confirmationRequired?: boolean;
  confirmationMessage?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
  actionResult?: {
    type: 'finance' | 'note' | 'task' | 'wealth' | 'nav';
    title: string;
    details: string[];
    badge?: string;
  };
  pendingAction?: ActionPayload;
}

export const AskApptify: React.FC<AskApptifyProps> = ({ currentApp, setCurrentApp }) => {
  const { session, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<ActionPayload | null>(null);

  // i18n language state
  const [lang, setLang] = useState<Language>(getStoredLanguage);

  useEffect(() => {
    const handleLang = () => setLang(getStoredLanguage());
    window.addEventListener('apptify_language_change', handleLang);
    return () => window.removeEventListener('apptify_language_change', handleLang);
  }, []);

  const t = translations[lang];

  // Draggable button coordinates state (supports X & Y adjustment, default right-docked)
  const [btnPos, setBtnPos] = useState<{ x: number | null; y: number }>({
    x: null, // null means auto-docked against right edge
    // Docked just above the bottom navigation so it never covers content.
    // Still fully draggable; a stored position always wins.
    y: typeof window !== 'undefined' ? Math.round(window.innerHeight - 212) : 380,
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    hasMoved: boolean;
  }>({ startX: 0, startY: 0, initialX: 0, initialY: 0, hasMoved: false });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('apptify_copilot_coords');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.y === 'number') {
          const maxY = window.innerHeight - 80;
          const clampedY = Math.max(70, Math.min(maxY, parsed.y));
          let clampedX = null;
          if (typeof parsed.x === 'number') {
            const maxX = window.innerWidth - 80;
            clampedX = Math.max(5, Math.min(maxX, parsed.x));
          }
          setBtnPos({ x: clampedX, y: clampedY });
        }
      }
    } catch (e) {}
  }, []);

  // Drag start handler
  const handleDragStart = (clientX: number, clientY: number) => {
    const btnEl = document.getElementById('apptify-copilot-trigger');
    const rect = btnEl?.getBoundingClientRect();
    const currentX = rect ? rect.left : (btnPos.x ?? (window.innerWidth - 75));
    const currentY = rect ? rect.top : btnPos.y;

    dragRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: currentX,
      initialY: currentY,
      hasMoved: false,
    };
    setIsDragging(true);
  };

  // Drag move handler
  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const deltaX = clientX - dragRef.current.startX;
    const deltaY = clientY - dragRef.current.startY;
    if (!dragRef.current.hasMoved && Math.hypot(deltaX, deltaY) > 5) {
      dragRef.current.hasMoved = true;
    }
    if (dragRef.current.hasMoved) {
      const maxX = window.innerWidth - 75;
      const maxY = window.innerHeight - 75;
      const newX = Math.max(4, Math.min(maxX, dragRef.current.initialX + deltaX));
      const newY = Math.max(65, Math.min(maxY, dragRef.current.initialY + deltaY));
      setBtnPos({ x: newX, y: newY });
    }
  };

  // Drag end handler
  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (!dragRef.current.hasMoved) {
      // Tap / Click without drag: open drawer
      setIsOpen(true);
    } else {
      // Snap to right edge if dropped near right margin
      let finalX = btnPos.x;
      if (finalX !== null && finalX > window.innerWidth - 95) {
        finalX = null;
      }
      const finalCoords = { x: finalX, y: btnPos.y };
      setBtnPos(finalCoords);
      localStorage.setItem('apptify_copilot_coords', JSON.stringify(finalCoords));
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY);
    };
    const onMouseUp = () => {
      handleDragEnd();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = () => {
      handleDragEnd();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging, btnPos]);

  // Model & Provider settings
  const [activeProvider, setActiveProvider] = useState<string>('google');
  const [activeModel, setActiveModel] = useState<string>('gemini-2.5-flash');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial welcome message
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content: translations[getStoredLanguage()].copilot.welcomeMsg,
      actionResult: {
        type: 'wealth',
        title: getStoredLanguage() === 'zh' ? '专属私人助理已就绪' : 'Personal Copilot Ready',
        details: getStoredLanguage() === 'zh' 
          ? ['全面联动 MyWealth 财富中心', '全面联动 NoteDown 便签与待办', '支持语音与自然语言命令实时更新']
          : ['Full integration with MyWealth Center', 'Connected to NoteDown workspace', 'Natural language commands supported'],
        badge: getStoredLanguage() === 'zh' ? '专属私人助理' : 'Private Copilot'
      }
    }
  ]);

  // Sync settings
  useEffect(() => {
    const syncSettings = () => {
      setActiveProvider(localStorage.getItem('app_global_ai_provider') || 'google');
      setActiveModel(localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash');
    };
    syncSettings();
    window.addEventListener('storage', syncSettings);
    return () => window.removeEventListener('storage', syncSettings);
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // The skill engine now lives in services/skillExecutor.ts so BingGo and this
  // component share one implementation. Navigation is handed in as a callback.
  const executeAction = (intent: string, data: any) =>
    skillExecutor.executeAction(intent, data, { navigate: (target) => setCurrentApp(target as any) });

  const tryLocalRuleParser = skillExecutor.tryLocalRuleParser;
  const { loadMyWealthData, loadTasks, loadNotes } = skillExecutor;


  // Main Handle Send
  const handleSend = async (textToSend: string = inputText) => {
    const query = textToSend.trim();
    if (!query || isProcessing) return;

    // Append user message
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsProcessing(true);

    // 1. Try local rule-based intent parser first (instant execution, zero API key required)
    const localAction = tryLocalRuleParser(query);
    if (localAction) {
      try {
        const { message, result } = await executeAction(localAction.intent, localAction.data);
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: message,
            actionResult: result
          }
        ]);
        setIsProcessing(false);
        return;
      } catch (err: any) {
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `⚠️ 执行出错: ${err.message}`,
            isError: true
          }
        ]);
        setIsProcessing(false);
        return;
      }
    }

    // 2. If no direct local rule matched, send to LLM (if API key available)
    const apiKey = localStorage.getItem('app_global_api_key');
    if (!apiKey) {
      // Friendly message guiding user
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `💡 你可以直接下达精准命令让我更新数据：\n• **记支出**：如 *“记一笔午餐 25 块”*\n• **存钱包**：如 *“存入 500 到 Maybank”*\n• **转账**：如 *“从 Maybank 转账 200 到 Cash”*\n• **加待办**：如 *“新建待办：准备周报”*\n• **记想法**：如 *“新建笔记：Apptify V3 架构”*\n• **查资产**：如 *“查资产”*\n\n若需进行深层自由对话，请点击右下角设置配置您的 **AI API Key**。`,
          actionResult: {
            type: 'wealth',
            title: '本地快速命令就绪',
            details: ['记账/存入/划转/待办/笔记均支持免 Key 毫秒级执行'],
            badge: '命令引擎'
          }
        }
      ]);
      setIsProcessing(false);
      return;
    }

    // Construct live context for LLM
    const mwData = loadMyWealthData();
    const tasks = loadTasks();
    const notes = loadNotes();

    const contextPrompt = `
You are the dedicated "Personal AI Executive Assistant" for Apptify (Apptify 专属私人 AI 助手).
Current Active Page: ${currentApp}

CURRENT LIVE APP STATE:
- Wallets: ${JSON.stringify(mwData.accounts.map((a: any) => ({ name: a.name, balance: a.balance })))}
- Current Month Total Expenses: RM${mwData.monthlyData.expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0)}
- Active Pending Tasks: ${JSON.stringify(tasks.filter(t => !t.completed).map(t => ({ id: t.id, title: t.title, priority: t.priority })))}
- Recent Notes: ${JSON.stringify(notes.slice(0, 5).map(n => ({ id: n.id, title: n.title })))}

CAPABILITIES:
You can directly update Apptify's database by returning a JSON action:
1. "WITHDRAW_MONEY" -> { "amount": number, "category": "Food"|"Transport"|"Utilities"|"Entertainment"|"Shopping"|"Health"|"Other", "description": string, "walletName": string }
2. "ADD_MONEY" -> { "amount": number, "description": string, "walletName": string }
3. "TRANSFER_MONEY" -> { "sourceWallet": string, "destinationWallet": string, "amount": number, "description": string }
4. "CREATE_NOTE" -> { "title": string, "content": string, "category": "work"|"idea"|"meeting"|"life" }
5. "CREATE_TASK" -> { "title": string, "priority": "high"|"medium"|"low", "deadline": string }
6. "UPDATE_TASK" -> { "taskTitle": string, "completed": boolean }
7. "QUERY_WEALTH" -> {}
8. "QUERY_TASKS" -> {}
9. "NAVIGATE" -> { "target": "mywealth"|"knowledgevault"|"newshub"|"launcher"|"settings" }
10. "CHAT" -> General conversational response.

OUTPUT SCHEMA (MUST BE VALID JSON ONLY, NO MARKDOWN, NO CODEBLOCKS):
{
  "intent": "WITHDRAW_MONEY" | "ADD_MONEY" | "TRANSFER_MONEY" | "CREATE_NOTE" | "CREATE_TASK" | "UPDATE_TASK" | "QUERY_WEALTH" | "QUERY_TASKS" | "NAVIGATE" | "CHAT",
  "data": { ... },
  "message": "Friendly and concise Chinese response to user"
}
`;

    try {
      const responseText = await aiService.generate(activeProvider as any, activeModel, apiKey, query, contextPrompt);
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedAction = JSON.parse(cleanJson);

      if (parsedAction.intent && parsedAction.intent !== 'CHAT') {
        const { message, result } = await executeAction(parsedAction.intent, parsedAction.data || {});
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: parsedAction.message || message,
            actionResult: result
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: parsedAction.message || responseText
          }
        ]);
      }
    } catch (err: any) {
      console.error("Ask Apptify AI generate error:", err);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `⚠️ 处理请求时出错: ${err.message || '网络或接口异常'}\n提示：常用记账和任务指令支持本地秒级执行，可尝试直接输入 *“记一笔午餐 25”*。`,
          isError: true
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick Action Chips with dynamic i18n
  const quickActions = [
    { label: t.copilot.quickExpense, query: lang === 'zh' ? '记一笔午餐 25 块' : 'Record lunch RM25' },
    { label: t.copilot.quickIncome, query: lang === 'zh' ? '存入 500 到 Maybank' : 'Deposit 500 into Maybank' },
    { label: t.copilot.quickNote, query: lang === 'zh' ? '新建笔记：关于 Apptify 全新 iOS 27 设计' : 'Create note: Apptify iOS 27 Redesign' },
    { label: t.copilot.quickTask, query: lang === 'zh' ? '新建待办：本周完成财务核算' : 'Add task: Weekly finance report' },
    { label: t.copilot.quickWealth, query: lang === 'zh' ? '查资产' : 'Check net worth' },
    { label: t.copilot.quickTasks, query: lang === 'zh' ? '查待办' : 'Check todos' }
  ];

  return (
    <>
      {/* 1. Draggable & Right-Docked Floating Assistant Tab (用户可自由上下/左右拖拽，默认靠右吸附) */}
      {!isOpen && (
        <div
          id="apptify-copilot-trigger"
          onMouseDown={(e) => {
            e.preventDefault();
            handleDragStart(e.clientX, e.clientY);
          }}
          onTouchStart={(e) => {
            if (e.touches.length > 0) {
              handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
            }
          }}
          style={{
            position: 'fixed',
            top: `${btnPos.y}px`,
            left: btnPos.x !== null ? `${btnPos.x}px` : undefined,
            right: btnPos.x === null ? '0px' : undefined,
            touchAction: 'none',
            userSelect: 'none',
            zIndex: 45,
          }}
          className={`flex items-center gap-1.5 py-2.5 bg-white/85 dark:bg-[#141416]/90 backdrop-blur-2xl border text-gray-800 dark:text-gray-100 shadow-[-4px_10px_30px_rgba(10,10,11,0.28)] transition-shadow duration-200 group cursor-grab active:cursor-grabbing select-none ${
            btnPos.x === null
              ? 'pl-2.5 pr-1.5 rounded-l-2xl rounded-r-none border-l border-t border-b border-r-0 border-white/60 dark:border-white/15'
              : 'px-3 rounded-full border-white/60 dark:border-white/15 shadow-xl'
          }`}
          title={lang === 'zh' ? "按住可拖动调节位置，点击展开私人助理" : "Drag to reposition, tap to open AI copilot"}
        >
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-1 flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 pointer-events-none">
            <img src="/icon.png" alt="Apptify" className="w-full h-full object-contain filter brightness-0 invert drop-shadow-sm" />
          </div>
          <div className="flex flex-col text-left pr-0.5 pointer-events-none">
            <span className="text-[11px] font-extrabold tracking-tight leading-none text-gray-900 dark:text-white">
              {t.copilot.tabTitle}
            </span>
            <span className="text-[8px] text-blue-600 dark:text-blue-400 font-bold mt-0.5 leading-none">
              {btnPos.x === null ? t.copilot.tabSub : (lang === 'zh' ? '点击展开' : 'Open')}
            </span>
          </div>
          {btnPos.x === null ? (
            <ChevronLeft size={13} className="text-gray-400 group-hover:-translate-x-0.5 transition-transform pointer-events-none" />
          ) : (
            <div className="flex flex-col gap-0.5 opacity-40 ml-0.5 pointer-events-none">
              <span className="w-1 h-1 rounded-full bg-gray-500" />
              <span className="w-1 h-1 rounded-full bg-gray-500" />
            </div>
          )}
        </div>
      )}

      {/* 2. Slide-out Copilot Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop blur */}
          <div 
            className="absolute inset-0 bg-black/25 dark:bg-black/50 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
            onClick={() => setIsOpen(false)}
          />

          {/* Liquid Glass Drawer Panel */}
          <div 
            className="w-full sm:w-[440px] h-full relative z-10 flex flex-col bg-white/80 dark:bg-[#141416]/90 backdrop-blur-3xl border-l border-white/40 dark:border-white/10 shadow-2xl animate-slide-in-right overflow-hidden"
            style={{
              boxShadow: '-15px 0 50px rgba(0, 0, 0, 0.25)'
            }}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-black/5 dark:border-white/10 bg-white/40 dark:bg-white/5 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-2 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
                  <img src="/icon.png" alt="Apptify" className="w-full h-full object-contain filter brightness-0 invert drop-shadow" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm text-gray-900 dark:text-white leading-none">
                      {t.copilot.drawerTitle}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {t.copilot.badge}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                      {t.copilot.status} · {activeModel.split('/').pop()}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors tap-scale"
                aria-label="关闭抽屉"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Action Chips Bar */}
            <div className="px-4 py-2.5 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5 overflow-x-auto no-scrollbar flex items-center gap-2">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(action.query)}
                  disabled={isProcessing}
                  className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/70 dark:bg-white/10 text-gray-700 dark:text-gray-200 border border-black/5 dark:border-white/10 hover:border-blue-500/40 hover:text-blue-600 dark:hover:text-blue-400 transition-all tap-scale shadow-sm disabled:opacity-50"
                >
                  {action.label}
                </button>
              ))}
            </div>

            {/* Messages Chat Feed */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}
                >
                  {/* Message Bubble */}
                  <div
                    className={`max-w-[88%] p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed transition-all shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none shadow-blue-500/20'
                        : msg.isError
                        ? 'bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-tl-none'
                        : 'ios-glass border border-white/60 dark:border-white/10 text-gray-800 dark:text-gray-100 rounded-tl-none bg-white/70 dark:bg-white/10'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Action Execution Result Card */}
                    {msg.actionResult && (
                      <div className="mt-3 p-3 rounded-xl bg-white/60 dark:bg-black/30 border border-black/5 dark:border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900 dark:text-white">
                            <Check size={14} className="text-emerald-500" />
                            <span>{msg.actionResult.title}</span>
                          </div>
                          {msg.actionResult.badge && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              {msg.actionResult.badge}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-[11px] text-gray-600 dark:text-gray-300">
                          {msg.actionResult.details.map((item, dIdx) => (
                            <div key={dIdx} className="flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-blue-500" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-gray-400 mt-1 px-1 font-medium">
                    {msg.role === 'user' ? (lang === 'zh' ? '你' : 'You') : 'Ask Apptify'}
                  </span>
                </div>
              ))}

              {isProcessing && (
                <div className="flex items-start gap-2 animate-pulse">
                  <div className="ios-glass p-3 rounded-2xl rounded-tl-none border border-white/40 dark:border-white/10 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Sparkles size={14} className="animate-spin text-blue-500" />
                    <span>{lang === 'zh' ? '专属 AI 正在解析指令并执行更新...' : 'Private AI is executing your instruction...'}</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 sm:p-4 border-t border-black/5 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-md">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <div className="flex-1 relative flex items-center">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={t.copilot.inputPlaceholder}
                    disabled={isProcessing}
                    className="w-full pl-4 pr-10 py-3 rounded-2xl bg-white/70 dark:bg-black/30 border border-black/5 dark:border-white/10 text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-inner"
                  />
                  {inputText && (
                    <button
                      type="button"
                      onClick={() => setInputText('')}
                      className="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!inputText.trim() || isProcessing}
                  className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/25 tap-scale disabled:opacity-40 disabled:scale-100 transition-all"
                  aria-label="发送指令"
                >
                  <Send size={16} />
                </button>
              </form>
              <div className="mt-2 text-center">
                <span className="text-[10px] text-gray-400">
                  {t.copilot.hint}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AskApptify;
