import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Send, Mic, MicOff, Volume2, VolumeX, ImagePlus, Phone, PhoneOff,
  Pause, Play, Check, AlertCircle,
} from 'lucide-react';
import BingGo, { type BingGoMood } from './BingGo';
import { aiService, type AIProvider } from '../services/aiService';
import { voiceService, playCuteChime, type VoicePersonaMeta } from '../services/voiceService';
import { memoryService } from '../services/memoryService';
import {
  executeAction,
  tryLocalRuleParser,
  buildFullAppContextSnapshot,
  computeAppMetrics,
} from '../services/skillExecutor';
import type { Translations, Language } from '../utils/i18n';
import './BingGoUI.css';

type Phase = 'idle' | 'thinking' | 'listening' | 'speaking';
type Mode = 'chat' | 'call';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  isError?: boolean;
  pending?: { intent: string; data: unknown; summary: string };
  result?: { title: string; details: string[]; badge?: string };
}

export interface BingGoAssistantProps {
  open: boolean;
  onClose: () => void;
  t: Translations['binggo'];
  lang: Language;
  /** Optional first request, e.g. from a launcher chip. */
  seed?: string | null;
  /** Open directly in call mode, e.g. from the launcher's mic button. */
  initialMode?: Mode;
  onSeedConsumed?: () => void;
  /** Called for NAVIGATE intents. */
  onNavigate: (target: string) => void;
}

const Rich: React.FC<{ text: string }> = ({ text }) => {
  const nodes = useMemo(() => {
    const out: React.ReactNode[] = [];
    text.split('\n').forEach((line, i) => {
      const bullet = /^\s*[•\-*]\s+/.test(line);
      const body = bullet ? line.replace(/^\s*[•\-*]\s+/, '') : line;
      const parts: React.ReactNode[] = [];
      body.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).forEach((seg, j) => {
        if (/^\*\*[^*]+\*\*$/.test(seg)) parts.push(<strong key={j} className="font-semibold">{seg.slice(2, -2)}</strong>);
        else if (/^`[^`]+`$/.test(seg)) parts.push(<code key={j} className="font-mono text-[0.9em] bg-black/[0.05] px-1 py-0.5 rounded">{seg.slice(1, -1)}</code>);
        else if (seg) parts.push(seg);
      });
      out.push(
        bullet
          ? <div key={i} className="flex gap-2"><span className="text-[#2600FD] leading-relaxed">—</span><span className="flex-1">{parts}</span></div>
          : <div key={i} className={body.trim() ? '' : 'h-2'}>{parts}</div>
      );
    });
    return out;
  }, [text]);
  return <div className="text-[14.5px] leading-relaxed space-y-0.5">{nodes}</div>;
};

const plain = (text: string): string =>
  text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^\s*[•\-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

const stripReasoning = (raw: string): string => {
  let text = raw;
  text = text.replace(/<(thinking|reasoning|analysis)>[\s\S]*?<\/\1>/gi, '');
  text = text.replace(/^(?:\s*>.*\n?)+/g, '');
  text = text.replace(/^\s*(?:推理思考过程|思考过程|Thinking|Reasoning)\s*[:：]\s*$/gim, '');
  return text.trim();
};

const extractAction = (
  raw: string
): { intent?: string; data?: unknown; actions?: Array<{ intent: string; data?: unknown }>; message?: string } | null => {
  const text = raw.replace(/```json/gi, '').replace(/```/g, '');
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') { if (depth === 0) start = i; depth++; continue; }
    if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        const slice = text.slice(start, i + 1);
        if (/"intent"\s*:/.test(slice) || /"actions"\s*:/.test(slice)) {
          try { return JSON.parse(slice); } catch { /* keep scanning */ }
        }
        start = -1;
      }
    }
  }
  return null;
};

/**
 * Resolve active provider, model, and API key across all stored provider slots
 * so the assistant never fails just because `app_global_api_key` was out of sync.
 */
const resolveActiveAIConfig = (): { provider: AIProvider; model: string; apiKey: string } => {
  const preferredProvider = (localStorage.getItem('app_global_ai_provider') || 'google') as AIProvider;
  const preferredModel = localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash';
  const directKey = (
    localStorage.getItem(`app_api_key_${preferredProvider}`) ||
    localStorage.getItem('app_global_api_key') ||
    ''
  ).trim();

  if (directKey) {
    return { provider: preferredProvider, model: preferredModel, apiKey: directKey };
  }

  const fallbacks: Array<{ provider: AIProvider; defaultModel: string }> = [
    { provider: 'google', defaultModel: 'gemini-2.5-flash' },
    { provider: 'deepseek', defaultModel: 'deepseek-chat' },
    { provider: 'openai', defaultModel: 'gpt-4o-mini' },
    { provider: 'openrouter', defaultModel: 'deepseek/deepseek-chat' },
    { provider: 'anthropic', defaultModel: 'claude-3-5-sonnet-20241022' },
    { provider: 'siliconflow', defaultModel: 'Qwen/Qwen2.5-7B-Instruct' },
  ];

  for (const fb of fallbacks) {
    const key = (localStorage.getItem(`app_api_key_${fb.provider}`) || '').trim();
    if (key) {
      return { provider: fb.provider, model: fb.defaultModel, apiKey: key };
    }
  }

  return { provider: preferredProvider, model: preferredModel, apiKey: '' };
};

/**
 * Smart offline butler answerer when no external LLM API key is configured.
 * Allows the user to chat with BingGo and ask about their finances, tasks, notes,
 * or app features even before adding an API key.
 */
const buildOfflineButlerReply = async (text: string, lang: Language): Promise<{ message: string; result?: Msg['result']; navigateTarget?: string }> => {
  const q = text.toLowerCase();
  const isZh = lang === 'zh';
  const m = computeAppMetrics();

  if (/分析|体检|诊断|建议|怎么样|健康|状况|report|analyze|health|status|overview|summary/.test(q)) {
    return await executeAction('ANALYZE_APP_DATA', { focus: 'all' });
  }
  if (/资产|净值|余额|多少钱|钱包|账户|wealth|balance|wallet|money|cash/.test(q)) {
    return await executeAction('QUERY_WEALTH', { aspect: 'all' });
  }
  if (/待办|任务|清单|todo|task/.test(q)) {
    return await executeAction('QUERY_TASKS', { status: 'pending' });
  }
  if (/笔记|便签|记事|note/.test(q)) {
    return await executeAction('QUERY_NOTES', {});
  }
  if (/股票|投资|持仓|盈亏|portfolio|stock|invest/.test(q)) {
    const details = m.stockSummaries.length > 0
      ? m.stockSummaries.map((s: any) => `${s.symbol}: ${s.quantity} 股 · 市值 RM ${s.marketValueMyr.toFixed(2)} (盈亏 RM ${s.pnlMyr >= 0 ? '+' : ''}${s.pnlMyr.toFixed(2)} / ${s.pnlPct.toFixed(1)}%)`)
      : [isZh ? '当前暂无股票持仓记录' : 'No stock holdings recorded yet'];
    return {
      message: isZh
        ? `你的投资组合总市值为 RM ${m.totalInvestmentMyr.toFixed(2)}，其中股票市值 RM ${m.totalStockValueMyr.toFixed(2)}（浮动盈亏 RM ${m.totalStockPnlMyr.toFixed(2)}），投资现金池折合 RM ${m.totalInvestCashMyr.toFixed(2)}。`
        : `Your investment portfolio totals RM ${m.totalInvestmentMyr.toFixed(2)}, with RM ${m.totalStockValueMyr.toFixed(2)} in stocks (P&L RM ${m.totalStockPnlMyr.toFixed(2)}) and RM ${m.totalInvestCashMyr.toFixed(2)} in cash.`,
      result: {
        badge: isZh ? '投资组合概览' : 'PORTFOLIO SNAPSHOT',
        title: `RM ${m.totalInvestmentMyr.toFixed(2)}`,
        details,
      },
    };
  }
  if (/贷款|负债|欠款|月供|车贷|房贷|loan|debt|mortgage/.test(q)) {
    return {
      message: isZh
        ? `你目前有 ${m.loanSummaries.length} 笔贷款，剩余未还本金共 RM ${m.totalDebt.toFixed(2)}，每月总月供 RM ${m.totalMonthlyLoanPayment.toFixed(2)}。`
        : `You have ${m.loanSummaries.length} active loan(s) with RM ${m.totalDebt.toFixed(2)} remaining principal and RM ${m.totalMonthlyLoanPayment.toFixed(2)} monthly payment.`,
      result: {
        badge: isZh ? '负债概览' : 'LOAN SUMMARY',
        title: `RM ${m.totalDebt.toFixed(2)}`,
        details: m.loanSummaries.length
          ? m.loanSummaries.map((l: any) => `${l.name}: 剩余 RM ${l.remainingAmount.toFixed(2)} (月供 RM ${l.monthlyPayment.toFixed(2)}, 剩 ${l.remainingMonths} 期)`)
          : [isZh ? '当前无贷款负债记录' : 'No active loans'],
      },
    };
  }
  if (/预算|开销|支出|花销|月收入|储蓄|budget|expense|spending|income/.test(q)) {
    return {
      message: isZh
        ? `本月总收入设为 RM ${m.monthlyIncome.toFixed(2)}，已记录总支出 RM ${m.totalMonthlyExpenses.toFixed(2)}（固定支出 RM ${m.totalFixedExpenses.toFixed(2)}，日常支出 RM ${m.totalVariableExpenses.toFixed(2)}，贷款月供 RM ${m.totalMonthlyLoanPayment.toFixed(2)}），月度结余 RM ${m.netMonthlySurplus.toFixed(2)}（储蓄率 ${m.savingsRatePct}%）。`
        : `Monthly income is RM ${m.monthlyIncome.toFixed(2)}, total expenses RM ${m.totalMonthlyExpenses.toFixed(2)}, leaving a surplus of RM ${m.netMonthlySurplus.toFixed(2)} (${m.savingsRatePct}% savings rate).`,
      result: {
        badge: isZh ? '月度预算诊断' : 'MONTHLY BUDGET',
        title: isZh ? `结余 RM ${m.netMonthlySurplus.toFixed(2)} (${m.savingsRatePct}%)` : `Surplus RM ${m.netMonthlySurplus.toFixed(2)} (${m.savingsRatePct}%)`,
        details: Object.entries(m.categoryTotals).map(([k, v]) => `${k}: RM ${Number(v).toFixed(2)}`),
      },
    };
  }
  if (/你好|嗨|在吗|你是谁|功能|能做什么|管家|hello|hi|hey|what can you do|help/.test(q)) {
    return {
      message: isZh
        ? `你好！我是你的 Apptify 专属全能管家 BingGo。我目前掌握着你 RM ${m.grossNetWorth.toFixed(2)} 的总资产、${m.walletSummaries.length} 个钱包、${m.pendingTasks.length} 项待办任务和 ${m.notes.length} 篇便签。\n\n你可以随时对我说：\n• 「帮我全面分析一下财务状况」\n• 「记一笔午餐 25」或「存入 500 到 Maybank」\n• 「把月收入设为 8500」\n• 「新建待办：周五提交报告」\n（提示：在设置中填入 AI API Key 后，还能解锁任意自由对话与复杂多步推理。）`
        : `Hi! I am BingGo, your personal Apptify Butler. Right now I am tracking RM ${m.grossNetWorth.toFixed(2)} in net worth across ${m.walletSummaries.length} wallets, ${m.pendingTasks.length} pending tasks, and ${m.notes.length} notes.\n\nTry asking me:\n• "Analyze my finances"\n• "Spent RM25 on lunch"\n• "Set monthly income to 8500"\n• "Add task: Submit Friday report"`,
    };
  }

  return {
    message: isZh
      ? `我是你的 Apptify 管家 BingGo（当前处于本地离线管家模式，你可在「设置」中填入 API Key 开启完整大模型自由对话）。\n\n我依然可以直接为你查询或操作数据，试试说：\n• 「帮我分析财务数据」\n• 「查一下我的总资产」或「查看我的待办」\n• 「记一笔晚餐 35」或「存入 1000 到 Maybank」\n• 「把月收入设为 8000」\n• 「新建待办：明天下午开会」`
      : `I am in local offline butler mode (add an API key in Settings for unrestricted LLM chat). You can still ask me right now:\n• "Analyze my finances"\n• "Check my net worth" or "Show my tasks"\n• "Spent RM35 on dinner"\n• "Set monthly income to 8000"\n• "Add task: Team meeting tomorrow"`,
  };
};

const BingGoAssistant: React.FC<BingGoAssistantProps> = ({
  open, onClose, t, lang, seed, initialMode = 'chat', onSeedConsumed, onNavigate,
}) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [mode, setMode] = useState<Mode>(initialMode);
  const [voiceOut, setVoiceOut] = useState(initialMode === 'call');
  const [micNotice, setMicNotice] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [flash, setFlash] = useState<'happy' | 'sad' | null>(null);
  const [closing, setClosing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [persona, setPersona] = useState<VoicePersonaMeta>(() => voiceService.getCurrentPersona());

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const listenRef = useRef<{ stop: () => void } | null>(null);
  const flashTimer = useRef<number | null>(null);
  const callLoopTimer = useRef<number | null>(null);
  const bootedRef = useRef(false);

  // Refs to avoid stale closures during continuous voice call turn-taking
  const openRef = useRef(open);
  const modeRef = useRef<Mode>(mode);
  const pausedRef = useRef(paused);
  const voiceOutRef = useRef(voiceOut);
  const phaseRef = useRef<Phase>(phase);
  const startListeningRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { voiceOutRef.current = voiceOut; }, [voiceOut]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      modeRef.current = initialMode;
      if (initialMode === 'call') {
        setVoiceOut(true);
        voiceOutRef.current = true;
        setPaused(false);
        pausedRef.current = false;
      }
    }
  }, [open, initialMode]);

  const speechOn = voiceService.isSpeechSupported();
  const micOn = voiceService.isRecognitionSupported();
  const locale = voiceService.localeFor(lang);

  const mood: BingGoMood = flash ?? (
    phase === 'thinking' ? 'think'
    : phase === 'listening' ? 'listen'
    : phase === 'speaking' ? 'speak'
    : 'idle'
  );

  const ping = useCallback((m: 'happy' | 'sad') => {
    setFlash(m);
    if (m === 'happy') playCuteChime('happy');
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1500);
  }, []);

  const handleCyclePersona = useCallback(() => {
    const next = voiceService.cyclePersona();
    setPersona(next);
    setVoiceOut(true);
    voiceOutRef.current = true;
    listenRef.current?.stop();
    setPhase('speaking');
    const sample = lang === 'zh' ? next.sampleZh : next.sampleEn;
    voiceService.speak(sample, {
      lang: locale,
      persona: next.id,
      onEnd: () => {
        setPhase('idle');
        if (openRef.current && modeRef.current === 'call' && !pausedRef.current) {
          window.setTimeout(() => { void startListeningRef.current(); }, 250);
        }
      },
      onError: () => setPhase('idle'),
    });
  }, [lang, locale]);

  useEffect(() => {
    if (!open || bootedRef.current) return;
    bootedRef.current = true;
    const past = memoryService.recent(12);
    if (past.length) {
      setMessages(past.map((r) => ({ id: r.id, role: r.role, content: r.text, images: r.images })));
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setClosing(false);
      setMode('chat');
      setLiveTranscript('');
      return;
    }
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages, phase]);

  useEffect(() => () => {
    voiceService.stopSpeaking();
    listenRef.current?.stop();
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    if (callLoopTimer.current) window.clearTimeout(callLoopTimer.current);
  }, []);

  const close = useCallback(() => {
    openRef.current = false;
    if (callLoopTimer.current) window.clearTimeout(callLoopTimer.current);
    voiceService.stopSpeaking();
    listenRef.current?.stop();
    setLiveTranscript('');
    setPhase('idle');
    setClosing(true);
    window.setTimeout(onClose, 240);
  }, [onClose]);

  const push = useCallback((m: Msg) => setMessages((p) => [...p, m]), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const goTo = useCallback((target: string) => {
    onNavigate(target);
    close();
  }, [onNavigate, close]);

  /**
   * Speak a reply (if in call mode or voiceOut is enabled) and, when in Call Mode,
   * automatically resume listening as soon as speaking finishes.
   */
  const speakAndResumeIfCall = useCallback((content: string) => {
    const shouldSpeak = (modeRef.current === 'call' || voiceOutRef.current) && speechOn && !pausedRef.current;
    if (!shouldSpeak) {
      setPhase('idle');
      if (openRef.current && modeRef.current === 'call' && !pausedRef.current) {
        if (callLoopTimer.current) window.clearTimeout(callLoopTimer.current);
        callLoopTimer.current = window.setTimeout(() => {
          if (openRef.current && modeRef.current === 'call' && !pausedRef.current) {
            void startListeningRef.current();
          }
        }, 350);
      }
      return;
    }

    // Stop active mic while BingGo speaks so it doesn't transcribe its own TTS voice
    listenRef.current?.stop();
    setPhase('speaking');

    const onDoneSpeaking = () => {
      if (!openRef.current) return;
      setPhase('idle');
      // Continuous phone call turn-taking: automatically re-open the mic!
      if (modeRef.current === 'call' && !pausedRef.current) {
        if (callLoopTimer.current) window.clearTimeout(callLoopTimer.current);
        callLoopTimer.current = window.setTimeout(() => {
          if (openRef.current && modeRef.current === 'call' && !pausedRef.current) {
            void startListeningRef.current();
          }
        }, 280);
      }
    };

    voiceService.speak(content, {
      lang: locale,
      onEnd: onDoneSpeaking,
      onError: onDoneSpeaking,
    });
  }, [speechOn, locale]);

  /* ------------------------------------------------------------------ send */
  const send = useCallback(async (raw?: string, opts?: { fromCall?: boolean }) => {
    const text = (raw ?? input).trim();
    if ((!text && images.length === 0) || phaseRef.current === 'thinking') return;

    const isCallTurn = Boolean(opts?.fromCall || modeRef.current === 'call');
    const attached = images;
    setInput('');
    setLiveTranscript('');
    setImages([]);
    listenRef.current?.stop();

    push({ id: `u${Date.now()}`, role: 'user', content: text, images: attached.length ? attached : undefined });
    memoryService.append({ role: 'user', text, images: attached.length ? attached : undefined });
    setPhase('thinking');

    const reply = (content: string, extra?: Partial<Msg>) => {
      push({ id: `a${Date.now()}`, role: 'assistant', content, ...extra });
      memoryService.append({ role: 'assistant', text: content });
      speakAndResumeIfCall(content);
    };

    // 1. Fast path: local rule parser for unambiguous commands
    const local = tryLocalRuleParser(text);
    if (local && local.intent !== 'NAVIGATE') {
      try {
        const { message, result } = await executeAction(local.intent, local.data);
        ping('happy');
        reply(message, { result: result as Msg['result'] });
      } catch (e) {
        ping('sad');
        reply(`${t.errorState}: ${(e as Error).message}`, { isError: true });
      }
      return;
    }
    if (local?.intent === 'NAVIGATE') {
      goTo((local.data as { target: string }).target);
      ping('happy');
      reply(lang === 'zh' ? '好的，已经帮你打开了。' : 'Opened it for you.');
      return;
    }

    // 2. Resolve AI Provider & Key across all stored slots
    const { provider, model, apiKey } = resolveActiveAIConfig();

    // If no API key is configured, use the smart offline butler fallback
    // so both Chat and Voice Call still answer and analyze app data naturally!
    if (!apiKey) {
      try {
        const fallback = await buildOfflineButlerReply(text, lang);
        if (fallback.navigateTarget) {
          goTo(fallback.navigateTarget);
        }
        ping('happy');
        reply(fallback.message, fallback.result ? { result: fallback.result } : undefined);
      } catch (e) {
        ping('sad');
        reply(`${t.errorState}: ${(e as Error).message}`, { isError: true });
      }
      return;
    }

    const recalled = await memoryService.search(text, 4, { provider, model, apiKey }).catch(() => []);
    const older = recalled.filter((r) => !memoryService.recent(12).some((x) => x.id === r.id));
    const recentChat = memoryService.recent(6);

    const appSnapshot = buildFullAppContextSnapshot(lang);

    const system = `You are BingGo, the lively, cute, and intelligent Personal Butler (元气可爱全能管家) inside Apptify.
Reply in ${lang === 'zh' ? 'Simplified Chinese (简体中文)' : 'English'}.
Voice Persona: ${lang === 'zh' ? persona.labelZh : persona.labelEn}.
${isCallTurn
  ? 'IMPORTANT: You are currently in a LIVE VOICE PHONE CALL with the user. Speak in a lively, adorable, warm, and natural spoken tone (e.g. using natural particles like "好嘞～", "交给我吧！", "搞定啦～", "我帮我看了一下喔"). Keep your "message" to 2-4 spoken sentences max (no markdown tables or code blocks) while staying 100% accurate with numbers.'
  : 'Speak in a lively, warm, cute, and helpful butler tone while remaining concise and structured.'}

${appSnapshot}
${older.length ? `\nRELEVANT EARLIER MEMORY:\n${memoryService.buildContext(older, 1200)}` : ''}
${recentChat.length ? `\nRECENT CONVERSATION TURNS:\n${memoryService.buildContext(recentChat, 1200)}` : ''}

=== YOUR BUTLER CAPABILITIES & JSON OUTPUT FORMAT ===
You must return ONE valid JSON object and nothing else (no markdown fence).
Shape:
{"intent":"<INTENT_NAME>","data":{...},"message":"<your spoken/written reply to the user>"}

Or for multiple actions in one request:
{"intent":"BATCH_ACTIONS","data":{"actions":[{"intent":"...","data":{...}},{"intent":"...","data":{...}}]},"message":"<your reply summarizing what you did>"}

Available Intents:
1. WITHDRAW_MONEY {amount:number, category:"Self Maintenance"|"Family Expenses"|"Loan"|"Saving"|"Other", description:string, walletName?:string}
2. ADD_MONEY {amount:number, description:string, walletName:string}
3. TRANSFER_MONEY {sourceWallet:string, destinationWallet:string, amount:number, description?:string}
4. CREATE_WALLET {name:string, balance?:number, interestRate?:number}
5. UPDATE_WALLET {walletName:string, newBalance?:number, newName?:string, interestRate?:number}
6. DELETE_WALLET {walletName:string}
7. ADD_RESERVATION {walletName:string, amount:number, reason:string}
8. REMOVE_RESERVATION {walletName?:string, reason:string}
9. SET_MONTHLY_INCOME {amount:number}
10. ADD_BUDGET {name:string, amount:number, category?:string, isFixed?:boolean}
11. UPDATE_BUDGET {name:string, amount:number, category?:string, isFixed?:boolean}
12. DELETE_BUDGET {name:string}
13. ADD_LOAN {name:string, totalAmount:number, monthlyPayment:number, remainingAmount?:number, months?:number}
14. REPAY_LOAN {loanName:string, amount?:number, walletName?:string}
15. UPDATE_LOAN {loanName:string, remainingAmount?:number, monthlyPayment?:number, remainingMonths?:number}
16. DELETE_LOAN {loanName:string}
17. ADD_STOCK {symbol:string, name?:string, quantity:number, buyPrice:number, currentPrice?:number, currency?:"USD"|"MYR"}
18. UPDATE_STOCK {symbol:string, quantity?:number, buyPrice?:number, currentPrice?:number}
19. DELETE_STOCK {symbol:string}
20. UPDATE_INVEST_CASH {myr?:number, usd?:number, hkd?:number, exchangeRate?:number}
21. CREATE_NOTE {title:string, content:string, category?:"work"|"idea"|"meeting"|"life", pinned?:boolean}
22. UPDATE_NOTE {title:string, content?:string, newTitle?:string, category?:string, append?:boolean}
23. PIN_NOTE {title:string, pinned:boolean}
24. DELETE_NOTE {title:string}
25. SEARCH_NOTES {query:string}
26. QUERY_NOTES {}
27. CREATE_TASK {title:string, priority?:"high"|"medium"|"low", deadline?:string, category?:"work"|"personal"}
28. UPDATE_TASK {taskTitle:string, completed?:boolean, priority?:"high"|"medium"|"low", deadline?:string, newTitle?:string}
29. DELETE_TASK {taskTitle:string}
30. CLEAR_COMPLETED_TASKS {}
31. QUERY_TASKS {status?:"all"|"pending"|"completed"}
32. QUERY_WEALTH {aspect?:"all"|"networth"|"wallets"|"budget"|"loans"|"investments"}
33. ANALYZE_APP_DATA {focus?:"all"|"finance"|"budget"|"investment"|"productivity"}
34. NAVIGATE {target:"mywealth"|"knowledgevault"|"newshub"|"launcher"|"settings"}
35. BATCH_ACTIONS {actions:[{intent:string, data:object}]}
36. CHAT {}

Butler Rules:
- When the user asks to analyze their data, finances, spending, investments, loans, or tasks, you have the FULL LIVE USER DATA SNAPSHOT above! You can either return intent "CHAT" with a tailored, deeply insightful analysis in "message", or return "ANALYZE_APP_DATA" with your personalized commentary in "message".
- When the user asks about any feature of Apptify, explain clearly how it works and offer to execute actions or navigate there for them.
- Output strictly valid JSON only.`;

    try {
      const responseText = await aiService.generate(provider, model, apiKey, text || '(image attached)', system, attached.length ? attached : undefined);
      const clean = stripReasoning(responseText);
      const parsed = extractAction(clean) ?? { intent: 'CHAT', message: clean };

      const intent = (parsed.intent || (parsed.actions ? 'BATCH_ACTIONS' : 'CHAT')).toUpperCase();
      const actionData = parsed.actions ? { actions: parsed.actions } : (parsed.data || {});
      const llmMessage = parsed.message || clean;

      if (intent === 'CHAT') {
        ping('happy');
        reply(llmMessage);
        return;
      }

      if (intent === 'NAVIGATE') {
        goTo((actionData as { target: string })?.target || 'launcher');
        ping('happy');
        reply(llmMessage);
        return;
      }

      if (intent.startsWith('QUERY_') || intent === 'SEARCH_NOTES' || intent === 'ANALYZE_APP_DATA') {
        const { message: execMsg, result } = await executeAction(intent, actionData);
        ping('happy');
        // Prefer the LLM's tailored analytical message if it wrote a detailed one, otherwise use execMsg
        const finalMsg = (llmMessage && llmMessage.length > 24) ? llmMessage : (execMsg || llmMessage);
        reply(finalMsg, { result: result as Msg['result'] });
        return;
      }

      // In Voice Call mode (or for direct butler task execution), execute immediately
      // and speak the confirmation aloud so the call never stalls on a hidden button!
      const isDestructive = intent.startsWith('DELETE_') && !isCallTurn;
      if (!isDestructive) {
        const { message: execMsg, result } = await executeAction(intent, actionData);
        ping('happy');
        memoryService.append({ role: 'assistant', text: execMsg || llmMessage, action: intent });
        push({
          id: `a${Date.now()}`,
          role: 'assistant',
          content: execMsg || llmMessage,
          result: result as Msg['result'],
        });
        speakAndResumeIfCall(execMsg || llmMessage);
        return;
      }

      // Destructive delete in chat mode: ask for confirmation
      setPhase('idle');
      push({
        id: `a${Date.now()}`,
        role: 'assistant',
        content: llmMessage,
        pending: { intent, data: actionData, summary: llmMessage },
      });
      memoryService.append({ role: 'assistant', text: llmMessage });
    } catch (e) {
      ping('sad');
      reply(`${t.errorState}: ${(e as Error).message}`, { isError: true });
    }
  }, [input, images, push, t, lang, goTo, ping, speakAndResumeIfCall]);

  /* Seed from a launcher chip */
  useEffect(() => {
    if (!open || !seed) return;
    onSeedConsumed?.();
    void send(seed);
  }, [open, seed, send, onSeedConsumed]);

  /* --------------------------------------------------------------- confirm */
  const confirm = useCallback(async (m: Msg, ok: boolean) => {
    setMessages((p) => p.map((x) => (x.id === m.id ? { ...x, pending: undefined } : x)));
    if (!ok || !m.pending) return;
    setPhase('thinking');
    try {
      const { message, result } = await executeAction(m.pending.intent, m.pending.data);
      ping('happy');
      push({ id: `a${Date.now()}`, role: 'assistant', content: message, result: result as Msg['result'] });
      memoryService.append({ role: 'assistant', text: message, action: m.pending.intent });
    } catch (e) {
      ping('sad');
      push({ id: `a${Date.now()}`, role: 'assistant', content: `${t.errorState}. ${(e as Error).message}`, isError: true });
    }
    setPhase('idle');
  }, [push, t, ping]);

  /* ------------------------------------------------------------------ mic */
  const startListening = useCallback(async () => {
    if (!openRef.current || pausedRef.current) return;
    setMicNotice(null);

    if (!micOn) {
      setMicNotice(t.micUnsupported);
      setPhase('idle');
      ping('sad');
      return;
    }

    const failure = await voiceService.requestMicPermission();
    if (failure) {
      const msg = failure === 'denied' ? t.micDenied
        : failure === 'no-device' ? t.micNoDevice
        : failure === 'insecure' ? t.micInsecure
        : failure === 'unsupported' ? t.micUnsupported
        : t.micUnknown;
      setMicNotice(msg);
      setPhase('idle');
      ping('sad');
      return;
    }

    voiceService.stopSpeaking();
    listenRef.current?.stop();
    setLiveTranscript('');
    setPhase('listening');

    listenRef.current = voiceService.listen({
      lang: locale,
      silenceMs: 1450,
      initialWaitMs: modeRef.current === 'call' ? 60_000 : 20_000,
      onResult: (text, isFinal) => {
        if (modeRef.current === 'call') {
          setLiveTranscript(text);
        } else {
          setInput(text);
        }
        if (isFinal && text.trim()) {
          setPhase('idle');
          void send(text, { fromCall: modeRef.current === 'call' });
        }
      },
      onError: (err) => {
        const code = String(err);
        if (code.includes('not-allowed') || code.includes('service-not-allowed')) {
          setMicNotice(t.micDenied);
          setPhase('idle');
          ping('sad');
          return;
        }
        if (code.includes('not supported')) {
          setMicNotice(t.micUnsupported);
          setPhase('idle');
          ping('sad');
        }
      },
      onEnd: () => {
        setPhase((p) => (p === 'listening' ? 'idle' : p));
      },
    });
  }, [micOn, locale, send, ping, t]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const toggleMic = useCallback(() => {
    if (pausedRef.current) {
      setPaused(false);
      pausedRef.current = false;
    }
    // If BingGo is currently speaking, tapping the mic button barges in (interrupts TTS and listens immediately)
    if (phase === 'speaking') {
      voiceService.stopSpeaking();
      void startListening();
      return;
    }
    if (phase === 'listening') {
      listenRef.current?.stop();
      setPhase('idle');
      return;
    }
    void startListening();
  }, [phase, startListening]);

  // Entering Call Mode turns voice replies on and immediately starts listening
  useEffect(() => {
    if (!open || mode !== 'call') return;
    setVoiceOut(true);
    voiceOutRef.current = true;
    setPaused(false);
    pausedRef.current = false;
    const timer = window.setTimeout(() => {
      if (openRef.current && modeRef.current === 'call' && !pausedRef.current) {
        void startListeningRef.current();
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [open, mode]);

  const pickImage = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 3).forEach((f) => {
      const r = new FileReader();
      r.onload = () => setImages((p) => [...p, String(r.result)].slice(0, 3));
      r.readAsDataURL(f);
    });
  };

  if (!open) return null;

  /* ------------------------------------------------------------------ call */
  if (mode === 'call') {
    const lastMsg = messages.length ? plain(messages[messages.length - 1].content) : t.emptyBody;
    const displaySubtitles = phase === 'listening' && liveTranscript.trim()
      ? `“${liveTranscript.trim()}”`
      : lastMsg;

    const status = paused
      ? (lang === 'zh' ? '通话已暂停' : 'Call on hold')
      : phase === 'listening'
        ? (liveTranscript.trim() ? (lang === 'zh' ? '正在识别你的话…' : 'Hearing you…') : (lang === 'zh' ? '请直接说话，我在听…' : 'Listening — speak anytime…'))
        : phase === 'speaking'
          ? (lang === 'zh' ? 'BingGo 正在回答（点击麦克风可打断）' : 'BingGo speaking (tap mic to interrupt)')
          : phase === 'thinking'
            ? t.thinking
            : t.ready;

    return (
      <div
        className="binggo-call"
        role="dialog"
        aria-modal="true"
        aria-label={t.name}
        data-live={phase === 'listening' || phase === 'speaking' ? 'true' : 'false'}
      >
        <header className="shrink-0 px-gutter pt-[calc(16px+env(safe-area-inset-top,0px))] pb-2 flex items-center gap-3">
          <button
            type="button"
            className="binggo-call__btn"
            onClick={() => {
              listenRef.current?.stop();
              voiceService.stopSpeaking();
              setMode('chat');
            }}
            aria-label={t.back}
            style={{ flexDirection: 'row', gap: 0 }}
            title={lang === 'zh' ? '切换到文字对话' : 'Switch to chat'}
          >
            <i style={{ width: 42, height: 42, background: 'rgba(255,255,255,0.16)' }}>
              <X size={17} strokeWidth={2.3} />
            </i>
          </button>

          <div className="flex-1 text-center">
            <div className="text-[15px] font-semibold tracking-tight leading-tight flex items-center justify-center gap-2">
              <span>{t.name}</span>
              <button
                type="button"
                onClick={handleCyclePersona}
                className="px-2.5 py-0.5 rounded-full bg-white/18 hover:bg-white/28 text-[11px] font-medium text-white flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                title={lang === 'zh' ? '点击切换可爱音色' : 'Tap to switch cute voice'}
              >
                <span>{persona.badge}</span>
                <span>{lang === 'zh' ? persona.labelZh : persona.labelEn}</span>
              </button>
            </div>
            <div className="binggo-call__meta" style={{ color: 'rgba(255,255,255,0.72)' }}>
              {status}
            </div>
          </div>

          {speechOn ? (
            <button
              type="button"
              className="binggo-call__btn"
              onClick={() => {
                if (voiceOut) voiceService.stopSpeaking();
                setVoiceOut((v) => !v);
              }}
              aria-label={voiceOut ? t.voiceOn : t.voiceOff}
              style={{ flexDirection: 'row', gap: 0 }}
            >
              <i style={{ width: 42, height: 42, background: voiceOut ? '#fff' : 'rgba(255,255,255,0.16)', color: voiceOut ? '#2600FD' : '#fff' }}>
                {voiceOut ? <Volume2 size={17} strokeWidth={2.2} /> : <VolumeX size={17} strokeWidth={2.2} />}
              </i>
            </button>
          ) : <span style={{ width: 42 }} />}
        </header>

        <div className="flex-1 flex flex-col items-center justify-center gap-8 px-gutter relative">
          <div
            className="relative flex items-center justify-center cursor-pointer"
            onClick={toggleMic}
            title={phase === 'speaking' ? (lang === 'zh' ? '点击打断并开始说话' : 'Tap to interrupt & speak') : undefined}
          >
            <span className="binggo-call__halo" />
            <span className="binggo-call__halo" />
            <span className="binggo-call__halo" />
            <BingGo size={190} mood={mood} ghost autoBlink={phase === 'idle'} label={t.name} />
          </div>

          {micNotice && (
            <p className="text-[13px] leading-relaxed text-white/90 bg-black/25 rounded-2xl py-2 px-4 text-center max-w-[36ch]">
              {micNotice}
            </p>
          )}

          <div className="space-y-2 text-center max-w-[38ch] px-3">
            {phase === 'listening' && liveTranscript.trim() && (
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#FFBF00]">
                {lang === 'zh' ? '实时语音识别' : 'LIVE TRANSCRIPT'}
              </div>
            )}
            <p className="binggo-call__said text-center">
              {displaySubtitles.length > 220 ? `${displaySubtitles.slice(0, 220).trimEnd()}…` : displaySubtitles}
            </p>
          </div>
        </div>

        <div className="shrink-0 px-gutter pb-[calc(28px+env(safe-area-inset-bottom,0px))] pt-2 flex items-center justify-center gap-12">
          <button
            type="button"
            className="binggo-call__btn"
            onClick={() => {
              const nextPaused = !paused;
              setPaused(nextPaused);
              pausedRef.current = nextPaused;
              if (nextPaused) {
                voiceService.stopSpeaking();
                listenRef.current?.stop();
                setPhase('idle');
              } else {
                void startListening();
              }
            }}
          >
            <i>{paused ? <Play size={21} strokeWidth={2.2} /> : <Pause size={21} strokeWidth={2.2} />}</i>
            {paused ? t.resume : t.hold}
          </button>

          <button
            type="button"
            className="binggo-call__btn binggo-call__btn--speak"
            onClick={toggleMic}
          >
            <i>{phase === 'listening' ? <MicOff size={21} strokeWidth={2.2} /> : <Mic size={21} strokeWidth={2.2} />}</i>
            {phase === 'listening'
              ? t.listening
              : phase === 'speaking'
                ? (lang === 'zh' ? '打断说话' : 'Interrupt')
                : t.speakNow}
          </button>

          <button type="button" className="binggo-call__btn binggo-call__btn--end" onClick={close}>
            <i><PhoneOff size={21} strokeWidth={2.2} /></i>
            {t.endCall}
          </button>
        </div>
      </div>
    );
  }

  const empty = messages.length === 0;
  const butlerQuickChips = lang === 'zh'
    ? ['帮我全面分析财务数据', t.quickExpense, t.quickNote, '查看我的待办']
    : ['Analyze my finances', t.quickExpense, t.quickNote, 'Show my tasks'];

  return (
    <div className={`binggo-sheet ${closing ? 'binggo-sheet--closing' : ''}`} role="dialog" aria-modal="true" aria-label={t.name}>
      {/* ------------------------------------------------------------ head */}
      <header className="shrink-0 px-gutter pt-[calc(12px+env(safe-area-inset-top,0px))] pb-3 flex items-center gap-3 border-b border-black/[0.08]">
        <button type="button" className="binggo-iconbtn" onClick={close} aria-label={t.back}>
          <X size={18} strokeWidth={2.2} />
        </button>

        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <BingGo size={30} mood={mood} autoBlink={mode === 'chat'} label={undefined} />
          <div className="min-w-0">
            <div className="text-[14px] font-semibold tracking-tight leading-tight">
              {t.name} <span className="text-[11px] font-mono text-[#2600FD] font-normal">{lang === 'zh' ? '· 全能管家' : '· Butler'}</span>
            </div>
            <div className="binggo-live">
              <span className="binggo-live__dot" />
              {phase === 'thinking' ? t.thinking
                : phase === 'listening' ? t.listening
                : phase === 'speaking' ? t.speaking
                : t.ready}
            </div>
          </div>
        </div>

        {speechOn && (
          <button
            type="button"
            onClick={handleCyclePersona}
            className="px-2.5 py-1.5 rounded-full border border-black/[0.1] hover:border-[#2600FD]/40 bg-black/[0.03] text-[11.5px] font-medium text-[#0A0A0B] flex items-center gap-1 active:scale-95 transition-all cursor-pointer shrink-0"
            title={lang === 'zh' ? '点击切换 BingGo 音色并试听' : 'Switch BingGo voice persona'}
          >
            <span>{persona.badge}</span>
            <span>{lang === 'zh' ? persona.labelZh : persona.labelEn}</span>
          </button>
        )}

        {speechOn && (
          <button
            type="button"
            className={`binggo-iconbtn ${voiceOut ? 'binggo-iconbtn--on' : ''}`}
            onClick={() => { if (voiceOut) voiceService.stopSpeaking(); setVoiceOut((v) => !v); }}
            aria-label={voiceOut ? t.voiceOn : t.voiceOff}
            title={voiceOut ? t.voiceOn : t.voiceOff}
          >
            {voiceOut ? <Volume2 size={17} strokeWidth={2.1} /> : <VolumeX size={17} strokeWidth={2.1} />}
          </button>
        )}

        <button
          type="button"
          className={`binggo-iconbtn ${mode === 'call' ? 'binggo-iconbtn--on' : ''}`}
          onClick={() => {
            setMode('call');
            modeRef.current = 'call';
          }}
          aria-label={t.call}
          title={t.call}
        >
          <Phone size={17} strokeWidth={2.1} />
        </button>
      </header>

      {/* ------------------------------------------------------------ body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-gutter py-4 space-y-4">
        {empty ? (
          <div className="min-h-full flex flex-col items-center justify-center text-center gap-4">
            <BingGo size={96} mood="idle" label={undefined} />
            <div className="space-y-1.5 max-w-[36ch]">
              <h2 className="text-[17px] font-semibold tracking-tight">{t.emptyTitle}</h2>
              <p className="text-[13.5px] leading-relaxed text-[#0A0A0B]/55">{t.emptyBody}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              {butlerQuickChips.map((q) => (
                <button key={q} type="button" className="binggo-chip" onClick={() => void send(q)}>{q}</button>
              ))}
            </div>
            <p className="binggo-live pt-2">{t.memoryNote}</p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="binggo-msg">
              {m.role === 'user' ? (
                <div className="flex flex-col items-end gap-1.5">
                  {m.images?.length ? (
                    <div className="flex gap-1.5 justify-end flex-wrap">
                      {m.images.map((src, i) => (
                        <img key={i} src={src} alt="" className="w-20 h-20 object-cover rounded-2xl border border-black/10" />
                      ))}
                    </div>
                  ) : null}
                  {m.content ? <div className="binggo-msg--user">{m.content}</div> : null}
                </div>
              ) : (
                <div className="binggo-msg--assistant space-y-2">
                  {m.isError ? (
                    <div className="flex gap-2 items-start text-[14px] leading-relaxed">
                      <AlertCircle size={16} className="text-[#0A0A0B]/50 mt-0.5 shrink-0" strokeWidth={2.2} />
                      <span>{m.content}</span>
                    </div>
                  ) : (
                    <Rich text={m.content} />
                  )}

                  {m.result ? (
                    <div className="rounded-2xl border border-black/[0.09] p-3">
                      <div className="font-mono text-[9px] tracking-[0.12em] uppercase text-[#0A0A0B]/40">
                        {m.result.badge || 'done'}
                      </div>
                      <div className="text-[13px] font-semibold mt-0.5">{m.result.title}</div>
                      <div className="mt-1 space-y-0.5">
                        {m.result.details.map((d, i) => (
                          <div key={i} className="text-[12px] text-[#0A0A0B]/60">{d}</div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {m.pending ? (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => void confirm(m, true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2600FD] text-white text-[12px] font-semibold active:scale-95 transition-transform"
                      >
                        <Check size={13} strokeWidth={2.6} /> {t.confirm}
                      </button>
                      <button
                        type="button"
                        onClick={() => void confirm(m, false)}
                        className="px-3.5 py-2 rounded-xl border border-black/[0.14] text-[12px] font-medium active:scale-95 transition-transform"
                      >
                        {t.cancel}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))
        )}

        {micNotice && (
          <div className="binggo-msg flex items-start gap-2 rounded-2xl border border-black/[0.09] px-3.5 py-3">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#0A0A0B]/50" strokeWidth={2.2} />
            <span className="text-[13px] leading-relaxed text-[#0A0A0B]/70">{micNotice}</span>
          </div>
        )}

        {phase === 'thinking' && (
          <div className="binggo-msg flex items-center gap-2.5">
            <BingGo size={26} mood="think" still label={undefined} />
            <span className="text-[14.5px] text-[#0A0A0B]/55">{t.thinking}</span>
            <span className="binggo-dots"><i /><i /><i /></span>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------- composer */}
      <div className="shrink-0 px-gutter pb-[calc(14px+env(safe-area-inset-bottom,0px))] pt-2 border-t border-black/[0.06] space-y-2">
        {images.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {images.map((src, i) => (
              <div key={i} className="relative">
                <img src={src} alt="" className="w-14 h-14 object-cover rounded-xl border border-black/10" />
                <button
                  type="button"
                  onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#0A0A0B] text-white flex items-center justify-center"
                  aria-label="remove"
                >
                  <X size={11} strokeWidth={2.6} />
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          className="binggo-composer"
          onSubmit={(e) => { e.preventDefault(); void send(); }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
            }}
            rows={1}
            placeholder={phase === 'listening' ? t.listeningHint : t.inputPlaceholder}
            aria-label={t.inputPlaceholder}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { pickImage(e.target.files); e.target.value = ''; }}
          />
          <button type="button" className="binggo-iconbtn" onClick={() => fileRef.current?.click()} aria-label={t.attachImage} title={t.attachImage}>
            <ImagePlus size={17} strokeWidth={2.1} />
          </button>
          <button
            type="button"
            className={`binggo-iconbtn ${phase === 'listening' ? 'binggo-iconbtn--on' : ''}`}
            onClick={toggleMic}
            aria-label={t.listening}
            title={micOn ? t.listening : t.unsupportedVoice}
          >
            {phase === 'listening' ? <MicOff size={17} strokeWidth={2.1} /> : <Mic size={17} strokeWidth={2.1} />}
          </button>
          <button
            type="submit"
            className="binggo-iconbtn binggo-iconbtn--send"
            disabled={(!input.trim() && images.length === 0) || phase === 'thinking'}
            aria-label={t.send}
          >
            <Send size={15} strokeWidth={2.4} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default BingGoAssistant;
