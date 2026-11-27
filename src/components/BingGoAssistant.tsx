import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ImagePlus,
  Phone,
  PhoneOff,
  Pause,
  Play,
  Check,
  AlertCircle,
  Maximize2,
  Minimize2,
  Globe,
  ExternalLink,
  RotateCcw,
  Sparkles,
  Search,
} from 'lucide-react';
import BingGo, { type BingGoMood } from './BingGo';
import { aiService, type AIProvider, type ChatTurn } from '../services/aiService';
import { voiceService, playCuteChime, type VoicePersonaMeta } from '../services/voiceService';
import { memoryService } from '../services/memoryService';
import {
  executeAction,
  tryLocalRuleParser,
  buildFullAppContextSnapshot,
  computeAppMetrics,
  searchAppData,
} from '../services/skillExecutor';
import {
  detectMessageLanguage,
  shouldAutoWebSearch,
  searchWeb,
  formatWebSearchContext,
  type WebSearchSource,
  type LiveQuote,
} from '../services/webSearchService';
import type { Translations, Language } from '../utils/i18n';
import './BingGoUI.css';

type Phase = 'idle' | 'thinking' | 'listening' | 'speaking';
type Mode = 'chat' | 'call';
type WebMode = 'auto' | 'on' | 'off';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  isError?: boolean;
  pending?: { intent: string; data: unknown; summary: string; replyLang?: Language };
  result?: { title: string; details: string[]; badge?: string };
  sources?: WebSearchSource[];
  liveQuote?: LiveQuote | null;
}

export interface BingGoAssistantProps {
  open: boolean;
  onClose: () => void;
  t: Translations['binggo'];
  lang: Language;
  /** Currently active screen/module in Apptify so BingGo knows what you are looking at */
  currentApp?: string;
  /** Optional first request, e.g. from a launcher chip. */
  seed?: string | null;
  /** Open directly in call mode, e.g. from the launcher's mic button. */
  initialMode?: Mode;
  onSeedConsumed?: () => void;
  /** Called for NAVIGATE intents. */
  onNavigate: (target: string) => void;
}

/* ------------------------------------------------------------------ Rich Markdown */
const renderInline = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const seg = match[0];
    if (/^\*\*[^*]+\*\*$/.test(seg)) {
      parts.push(<strong key={idx++} className="font-semibold text-[#0A0A0B]">{seg.slice(2, -2)}</strong>);
    } else if (/^`[^`]+`$/.test(seg)) {
      parts.push(
        <code key={idx++} className="font-mono text-[0.86em] bg-black/[0.06] px-1.5 py-0.5 rounded-md text-[#0A0A0B]">
          {seg.slice(1, -1)}
        </code>
      );
    } else if (/^\[[^\]]+\]\(https?:\/\/[^\s)]+\)$/.test(seg)) {
      const m = seg.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (m) {
        parts.push(
          <a
            key={idx++}
            href={m[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2600FD] underline underline-offset-2 hover:opacity-80 font-medium"
          >
            {m[1]}
          </a>
        );
      }
    } else if (/^https?:\/\//.test(seg)) {
      parts.push(
        <a
          key={idx++}
          href={seg}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#2600FD] underline underline-offset-2 hover:opacity-80 break-all"
        >
          {seg}
        </a>
      );
    }
    lastIndex = match.index + seg.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
};

const Rich: React.FC<{ text: string }> = ({ text }) => {
  const nodes = useMemo(() => {
    const out: React.ReactNode[] = [];
    const lines = text.split('\n');
    let inCodeBlock = false;
    let codeBuf: string[] = [];

    const flushCode = (key: string) => {
      if (codeBuf.length > 0) {
        out.push(
          <pre
            key={key}
            className="my-2 p-3 rounded-xl bg-[#0A0A0B] text-white/95 font-mono text-[12px] leading-relaxed overflow-x-auto"
          >
            <code>{codeBuf.join('\n')}</code>
          </pre>
        );
        codeBuf = [];
      }
    };

    lines.forEach((rawLine, i) => {
      if (rawLine.trim().startsWith('```')) {
        if (inCodeBlock) {
          flushCode(`code-${i}`);
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        return;
      }
      if (inCodeBlock) {
        codeBuf.push(rawLine);
        return;
      }

      const heading = rawLine.match(/^\s*#{1,3}\s+(.+)$/);
      if (heading) {
        out.push(
          <div key={i} className="font-bold text-[14px] text-[#0A0A0B] pt-1.5 pb-0.5 tracking-tight">
            {renderInline(heading[1])}
          </div>
        );
        return;
      }

      const bullet = /^\s*[•\-*]\s+/.test(rawLine);
      if (bullet) {
        const body = rawLine.replace(/^\s*[•\-*]\s+/, '');
        out.push(
          <div key={i} className="flex gap-2 items-start">
            <span className="text-[#2600FD] font-bold leading-relaxed select-none">•</span>
            <span className="flex-1">{renderInline(body)}</span>
          </div>
        );
        return;
      }

      const numbered = rawLine.match(/^\s*(\d+)\.\s+(.+)$/);
      if (numbered) {
        out.push(
          <div key={i} className="flex gap-2 items-start">
            <span className="font-mono text-[12px] font-bold text-[#2600FD] pt-[2px] select-none shrink-0">
              {numbered[1]}.
            </span>
            <span className="flex-1">{renderInline(numbered[2])}</span>
          </div>
        );
        return;
      }

      out.push(
        <div key={i} className={rawLine.trim() ? '' : 'h-2'}>
          {renderInline(rawLine)}
        </div>
      );
    });

    if (inCodeBlock) flushCode('code-end');
    return out;
  }, [text]);

  return <div className="text-[14px] leading-relaxed space-y-1 break-words">{nodes}</div>;
};

const plain = (text: string): string =>
  text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^\s*#{1,3}\s+/gm, '')
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

interface ParsedButlerResponse {
  message: string;
  action: { intent: string; data?: any; actions?: Array<{ intent: string; data?: any }> } | null;
}

/**
 * Supports BOTH:
 * 1) Natural Markdown reply + optional `<binggo_action>{...}</binggo_action>` tag (preferred — lets LLM think & write like ChatGPT/Gemini!)
 * 2) Legacy pure JSON `{"intent":"...","data":{...},"message":"..."}` (fallback safety)
 */
const parseButlerResponse = (raw: string): ParsedButlerResponse => {
  const clean = stripReasoning(raw);

  // 1. Tagged action block: <binggo_action>{...}</binggo_action>
  const tagMatch = clean.match(/<binggo_action>([\s\S]*?)<\/binggo_action>/i);
  if (tagMatch) {
    const prose = clean.replace(/<binggo_action>[\s\S]*?<\/binggo_action>/gi, '').trim();
    try {
      const jsonText = tagMatch[1].replace(/```json/gi, '').replace(/```/g, '').trim();
      const obj = JSON.parse(jsonText);
      const intent = String(obj.intent || (obj.actions ? 'BATCH_ACTIONS' : '')).toUpperCase();
      return {
        message: prose || obj.message || '',
        action: intent ? { intent, data: obj.actions ? { actions: obj.actions } : obj.data || {} } : null,
      };
    } catch {
      return { message: prose || clean, action: null };
    }
  }

  // 2. Fallback: raw JSON response (if a model wrapped everything in JSON)
  const trimmed = clean.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}') && (/"intent"\s*:/.test(trimmed) || /"actions"\s*:/.test(trimmed))) {
    try {
      const obj = JSON.parse(trimmed);
      const intent = String(obj.intent || (obj.actions ? 'BATCH_ACTIONS' : 'CHAT')).toUpperCase();
      if (intent === 'CHAT') {
        return { message: obj.message || clean, action: null };
      }
      return {
        message: obj.message || '',
        action: { intent, data: obj.actions ? { actions: obj.actions } : obj.data || {} },
      };
    } catch {
      // fall through to plain markdown
    }
  }

  return { message: clean, action: null };
};

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
 * Smart offline / zero-API-key fallback butler that still matches user language,
 * reads full App data (including fixedExpenses & subItems), and even supports live web search!
 */
const buildOfflineButlerReply = async (
  text: string,
  replyLang: Language,
  webRes?: { results: WebSearchSource[]; liveQuote?: LiveQuote | null } | null
): Promise<{ message: string; result?: Msg['result']; sources?: WebSearchSource[]; liveQuote?: LiveQuote | null }> => {
  const q = text.toLowerCase();
  const isZh = replyLang === 'zh';
  const m = computeAppMetrics();

  if (webRes && (webRes.liveQuote || webRes.results.length > 0)) {
    const lines: string[] = [];
    if (webRes.liveQuote) {
      const lq = webRes.liveQuote;
      const sign = lq.change >= 0 ? '+' : '';
      lines.push(
        isZh
          ? `**实时行情 · ${lq.name} (${lq.symbol})**：**${lq.price} ${lq.currency}**（${sign}${lq.change} / ${sign}${lq.changePct}%）`
          : `**Live Quote · ${lq.name} (${lq.symbol})**: **${lq.price} ${lq.currency}** (${sign}${lq.change} / ${sign}${lq.changePct}%)`
      );
    }
    if (webRes.results.length > 0) {
      lines.push(isZh ? '\n我帮你联网查到了以下最新资料：' : '\nHere are the latest web results I found:');
      webRes.results.slice(0, 4).forEach((r, idx) => {
        lines.push(`${idx + 1}. **${r.title}** — ${r.snippet}`);
      });
    }
    lines.push(
      isZh
        ? '\n（提示：在 Settings 中填入 AI API Key 后，我可以帮你深度总结这些网页并像 ChatGPT/Gemini 一样自由对话。）'
        : '\n*(Tip: Add an AI API key in Settings so I can synthesize web results and chat freely like ChatGPT/Gemini.)*'
    );
    return {
      message: lines.join('\n'),
      sources: webRes.results,
      liveQuote: webRes.liveQuote,
    };
  }

  if (/分析|体检|诊断|建议|怎么样|健康|状况|report|analyze|health|status|overview|summary/.test(q)) {
    return await executeAction('ANALYZE_APP_DATA', { focus: 'all' }, replyLang);
  }
  if (/资产|净值|余额|多少钱|钱包|账户|wealth|balance|wallet|money|cash/.test(q)) {
    return await executeAction('QUERY_WEALTH', { aspect: 'all' }, replyLang);
  }
  if (/待办|任务|清单|todo|task/.test(q)) {
    return await executeAction('QUERY_TASKS', { status: 'pending' }, replyLang);
  }
  if (/笔记|便签|记事|note/.test(q)) {
    return await executeAction('QUERY_NOTES', {}, replyLang);
  }
  if (/股票|投资|持仓|盈亏|portfolio|stock|invest/.test(q)) {
    const details = m.stockSummaries.length > 0
      ? m.stockSummaries.map((s: any) => `${s.symbol}: ${s.quantity} · RM ${s.marketValueMyr.toFixed(2)} (${s.pnlMyr >= 0 ? '+' : ''}${s.pnlPct.toFixed(1)}%)`)
      : [isZh ? '当前暂无股票持仓记录' : 'No stock holdings recorded yet'];
    return {
      message: isZh
        ? `你的投资组合总市值为 **RM ${m.totalInvestmentMyr.toFixed(2)}**（股票 RM ${m.totalStockValueMyr.toFixed(2)}，投资现金池 RM ${m.totalInvestCashMyr.toFixed(2)}）。`
        : `Your investment portfolio totals **RM ${m.totalInvestmentMyr.toFixed(2)}** (Stocks: RM ${m.totalStockValueMyr.toFixed(2)}, Cash Pool: RM ${m.totalInvestCashMyr.toFixed(2)}).`,
      result: {
        badge: isZh ? '投资组合概览' : 'PORTFOLIO SNAPSHOT',
        title: `RM ${m.totalInvestmentMyr.toFixed(2)}`,
        details,
      },
    };
  }
  if (/预算|开销|支出|花销|月收入|储蓄|账单|budget|expense|spending|income|bill/.test(q)) {
    return {
      message: isZh
        ? `本月收入 **RM ${m.monthlyIncome.toFixed(2)}**，预算总支出 **RM ${m.totalMonthlyExpenses.toFixed(2)}**（固定账单 RM ${m.totalFixedExpenses.toFixed(2)}，浮动支出 RM ${m.totalVariableExpenses.toFixed(2)}），预计结余 **RM ${m.netMonthlySurplus.toFixed(2)}**（储蓄率 **${m.savingsRatePct}%**）。`
        : `Monthly income is **RM ${m.monthlyIncome.toFixed(2)}**, total budget expenses **RM ${m.totalMonthlyExpenses.toFixed(2)}** (Fixed: RM ${m.totalFixedExpenses.toFixed(2)}, Variable: RM ${m.totalVariableExpenses.toFixed(2)}), leaving **RM ${m.netMonthlySurplus.toFixed(2)}** (${m.savingsRatePct}% savings rate).`,
      result: {
        badge: isZh ? '月度预算诊断' : 'MONTHLY BUDGET',
        title: isZh ? `结余 RM ${m.netMonthlySurplus.toFixed(2)} (${m.savingsRatePct}%)` : `Surplus RM ${m.netMonthlySurplus.toFixed(2)} (${m.savingsRatePct}%)`,
        details: Object.entries(m.categoryTotals).map(([k, v]) => `${k}: RM ${Number(v).toFixed(2)}`),
      },
    };
  }

  // Deep local app search fallback if user asked about a specific item name (e.g. "Telcom" / "Maybank")
  const appHits = searchAppData(text);
  const hitCount = appHits.matchedExpenses.length + appHits.matchedTransactions.length + appHits.matchedNotes.length + appHits.matchedTasks.length;
  if (hitCount > 0) {
    return await executeAction('SEARCH_APP_DATA', { query: text }, replyLang);
  }

  return {
    message: isZh
      ? `你好！我是你的 Apptify 专属管家 **BingGo**。目前我实时掌握你的 **RM ${m.grossNetWorth.toFixed(2)}** 总资产、**${m.expenses.length}** 笔月度预算项、**${m.pendingTasks.length}** 项待办和 **${m.notes.length}** 篇笔记。\n\n你可以直接问我 App 里的数据、让我帮你记账，或点亮下方 **「联网」** 按钮查最新实时资讯！（在 Settings 中配置 AI API Key 即可解锁完整 ChatGPT/Gemini 级自由对话与深度推理。）`
      : `Hi! I'm **BingGo**, your personal Apptify assistant. I'm tracking **RM ${m.grossNetWorth.toFixed(2)}** in net worth, **${m.expenses.length}** budget items, **${m.pendingTasks.length}** pending tasks, and **${m.notes.length}** notes.\n\nAsk me anything about your data, log expenses, or toggle **Web** below for live internet info! *(Add an AI API key in Settings to unlock full ChatGPT/Gemini-level reasoning & free chat.)*`,
  };
};

const BingGoAssistant: React.FC<BingGoAssistantProps> = ({
  open,
  onClose,
  t,
  lang,
  currentApp = 'launcher',
  seed,
  initialMode = 'chat',
  onSeedConsumed,
  onNavigate,
}) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [thinkingLabel, setThinkingLabel] = useState<string>('');
  const [mode, setMode] = useState<Mode>(initialMode);
  const [expanded, setExpanded] = useState(false);
  const [webMode, setWebMode] = useState<WebMode>('auto');
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

  const openRef = useRef(open);
  const modeRef = useRef<Mode>(mode);
  const pausedRef = useRef(paused);
  const voiceOutRef = useRef(voiceOut);
  const phaseRef = useRef<Phase>(phase);
  const messagesRef = useRef<Msg[]>(messages);
  const startListeningRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { voiceOutRef.current = voiceOut; }, [voiceOut]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

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
  }, [open, messages, phase, thinkingLabel]);

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
    setThinkingLabel('');
    setClosing(true);
    window.setTimeout(onClose, 210);
  }, [onClose]);

  const push = useCallback((m: Msg) => setMessages((p) => [...p, m]), []);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    memoryService.clear();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const goTo = useCallback((target: string) => {
    onNavigate(target);
    if (expanded) setExpanded(false);
  }, [onNavigate, expanded]);

  const speakAndResumeIfCall = useCallback((content: string, speechLocale?: string) => {
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

    listenRef.current?.stop();
    setPhase('speaking');

    const onDoneSpeaking = () => {
      if (!openRef.current) return;
      setPhase('idle');
      if (modeRef.current === 'call' && !pausedRef.current) {
        if (callLoopTimer.current) window.clearTimeout(callLoopTimer.current);
        callLoopTimer.current = window.setTimeout(() => {
          if (openRef.current && modeRef.current === 'call' && !pausedRef.current) {
            void startListeningRef.current();
          }
        }, 280);
      }
    };

    voiceService.speak(plain(content), {
      lang: speechLocale || locale,
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
    const detected = detectMessageLanguage(text, lang);
    const replyLang: Language = detected.uiLang;

    setInput('');
    setLiveTranscript('');
    setImages([]);
    listenRef.current?.stop();

    const priorHistory: ChatTurn[] = messagesRef.current
      .filter((m) => !m.isError && m.content.trim())
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }));

    push({ id: `u${Date.now()}`, role: 'user', content: text, images: attached.length ? attached : undefined });
    memoryService.append({ role: 'user', text, images: attached.length ? attached : undefined });
    setPhase('thinking');
    setThinkingLabel(replyLang === 'zh' ? '正在思考…' : 'Thinking…');

    const reply = (content: string, extra?: Partial<Msg>) => {
      setThinkingLabel('');
      push({ id: `a${Date.now()}`, role: 'assistant', content, ...extra });
      memoryService.append({ role: 'assistant', text: content });
      speakAndResumeIfCall(content, detected.speechLocale);
    };

    // 1. Resolve AI Provider & Key first so we know whether full LLM intelligence is available
    const { provider, model, apiKey } = resolveActiveAIConfig();

    // 2. Fast-path ONLY for direct imperative mutations/navigation when web search isn't forced.
    //    Analytical/query questions go to the LLM when an API key is present so replies are ChatGPT/Gemini-smart!
    const local = webMode !== 'on' ? tryLocalRuleParser(text, replyLang) : null;
    const isDirectCommand =
      local &&
      (!apiKey || !['ANALYZE_APP_DATA', 'QUERY_WEALTH', 'QUERY_TASKS'].includes(local.intent));

    if (isDirectCommand && local) {
      if (local.intent === 'NAVIGATE') {
        goTo((local.data as { target: string }).target);
        ping('happy');
        reply(replyLang === 'zh' ? '好的，已经帮你切换到对应页面啦。' : 'Opened it for you.');
        return;
      }
      try {
        const { message, result } = await executeAction(local.intent, local.data, replyLang);
        ping('happy');
        reply(message, { result: result as Msg['result'] });
      } catch (e) {
        ping('sad');
        reply(`${t.errorState}: ${(e as Error).message}`, { isError: true });
      }
      return;
    }

    // 3. Decide if we should pre-fetch live web search results
    let webData: Awaited<ReturnType<typeof searchWeb>> | null = null;
    const wantPreWebSearch = webMode === 'on' || (webMode === 'auto' && shouldAutoWebSearch(text));

    if (wantPreWebSearch && text) {
      setThinkingLabel(replyLang === 'zh' ? '正在联网搜索最新资料…' : 'Searching the web…');
      webData = await searchWeb(text, replyLang, 6);
    }

    // 4. Offline smart butler fallback if no external LLM API key is configured
    if (!apiKey) {
      try {
        const fallback = await buildOfflineButlerReply(text, replyLang, webData);
        ping('happy');
        reply(fallback.message, {
          result: fallback.result,
          sources: fallback.sources,
          liveQuote: fallback.liveQuote,
        });
      } catch (e) {
        ping('sad');
        reply(`${t.errorState}: ${(e as Error).message}`, { isError: true });
      }
      return;
    }

    setThinkingLabel(replyLang === 'zh' ? '正在结合应用数据思考…' : 'Analyzing your data…');

    const recalled = await memoryService.search(text, 4, { provider, model, apiKey }).catch(() => []);
    const older = recalled.filter((r) => !memoryService.recent(12).some((x) => x.id === r.id));
    const appSnapshot = buildFullAppContextSnapshot(replyLang, currentApp);
    const webContextBlock = webData && (webData.liveQuote || webData.results.length > 0)
      ? `\n\n=== LIVE INTERNET DATA JUST FETCHED ===\n${formatWebSearchContext(webData)}\nUse these real-time web facts directly when answering and cite sources naturally where helpful.`
      : '';

    const system = `You are BingGo, an exceptionally smart, warm, conversational AI companion & personal butler inside Apptify — combining the general intelligence, depth, and conversational fluency of ChatGPT/Gemini with complete live awareness of the user's Apptify personal OS.

=== CRITICAL LANGUAGE RULE ===
ALWAYS detect and reply in the EXACT SAME language as the user's latest message!
Detected language for this turn: ${detected.promptName}.
- If the user writes in Chinese (even mixed with English app terms like "Maybank", "Budget", "Telcom"), reply in natural Chinese.
- If the user writes in English, reply in natural English.
- If the user writes in Malay, Japanese, Korean, or another language, reply in that exact language.
- NEVER force the UI language if the user wrote in a different language.

=== STYLE & INTELLIGENCE ===
${isCallTurn
  ? 'You are in a LIVE VOICE CALL. Speak naturally, warmly, and concisely (2-4 spoken sentences, no markdown tables or code blocks) while staying 100% accurate with exact numbers.'
  : 'Write naturally in clean Markdown (like ChatGPT / Gemini): clear structure, sharp financial & personal insights, helpful follow-ups, and friendly casual conversation when the user just wants to chat.'}
- You know EVERY module, feature, number, wallet transaction, fixed/variable budget entry (including itemized outflow/inflow sub-items), 12-month reconciliation history, loan, stock holding, NoteDown note, and task in Apptify.
- When answering personal questions, cite exact numbers from the LIVE USER DATA SNAPSHOT below — never invent numbers.
- When the user just wants to chat, brainstorm, learn, write, or ask world-knowledge questions, engage deeply and naturally like a top-tier AI assistant.

${appSnapshot}
${older.length ? `\n=== RELEVANT EARLIER MEMORY ===\n${memoryService.buildContext(older, 1200)}` : ''}${webContextBlock}

=== OPTIONAL TOOL / ACTION PROTOCOL ===
For normal chat, Q&A, analysis, coaching, or answers already covered by the snapshot/web data above:
-> Reply directly in natural Markdown! Do NOT wrap normal chat in JSON.

ONLY when you need to MODIFY app data, NAVIGATE, or run an extra SEARCH tool, append ONE block at the very end of your reply:
<binggo_action>{"intent":"<INTENT>","data":{...}}</binggo_action>

Available Tools & Intents:
- WEB_SEARCH {query:string} — Use this when you need live internet facts, current prices, news, or external info that was NOT fetched yet${webMode === 'off' ? ' (currently disabled by user)' : ''}.
- SEARCH_APP_DATA {query:string} — Deep search older wallet transactions, budget sub-items, full note text, or specific month records if not obvious in the summary.
- WITHDRAW_MONEY {amount:number, category:"Self Maintenance"|"Family Expenses"|"Loan"|"Saving"|"Other", description:string, walletName?:string}
- ADD_MONEY {amount:number, description:string, walletName:string}
- TRANSFER_MONEY {sourceWallet:string, destinationWallet:string, amount:number, description?:string}
- CREATE_WALLET {name:string, balance?:number, interestRate?:number}
- UPDATE_WALLET {walletName:string, newBalance?:number, newName?:string, interestRate?:number}
- DELETE_WALLET {walletName:string}
- ADD_RESERVATION {walletName:string, amount:number, reason:string}
- REMOVE_RESERVATION {walletName?:string, reason:string}
- SET_MONTHLY_INCOME {amount:number}
- ADD_BUDGET {name:string, amount:number, category?:string, isFixed?:boolean}
- UPDATE_BUDGET {name:string, amount:number, category?:string, isFixed?:boolean}
- DELETE_BUDGET {name:string}
- ADD_LOAN {name:string, totalAmount:number, monthlyPayment:number, remainingAmount?:number, months?:number}
- REPAY_LOAN {loanName:string, amount?:number, walletName?:string}
- UPDATE_LOAN {loanName:string, remainingAmount?:number, monthlyPayment?:number, remainingMonths?:number}
- DELETE_LOAN {loanName:string}
- ADD_STOCK {symbol:string, name?:string, quantity:number, buyPrice:number, currentPrice?:number, currency?:"USD"|"MYR"}
- UPDATE_STOCK {symbol:string, quantity?:number, buyPrice?:number, currentPrice?:number}
- DELETE_STOCK {symbol:string}
- UPDATE_INVEST_CASH {myr?:number, usd?:number, hkd?:number, exchangeRate?:number}
- CREATE_NOTE {title:string, content:string, category?:"work"|"idea"|"meeting"|"life", pinned?:boolean}
- UPDATE_NOTE {title:string, content?:string, newTitle?:string, category?:string, append?:boolean}
- PIN_NOTE {title:string, pinned:boolean}
- DELETE_NOTE {title:string}
- CREATE_TASK {title:string, priority?:"high"|"medium"|"low", deadline?:string, category?:"work"|"personal"}
- UPDATE_TASK {taskTitle:string, completed?:boolean, priority?:"high"|"medium"|"low", deadline?:string, newTitle?:string}
- DELETE_TASK {taskTitle:string}
- CLEAR_COMPLETED_TASKS {}
- NAVIGATE {target:"mywealth"|"knowledgevault"|"newshub"|"launcher"|"settings"}
- BATCH_ACTIONS {actions:[{intent:string, data:object}]}`;

    const useGeminiNativeSearch = provider === 'google' && webMode !== 'off' && wantPreWebSearch && (!webData || webData.results.length === 0);

    try {
      const responseText = await aiService.generate(
        provider,
        model,
        apiKey,
        text || '(image attached)',
        system,
        attached.length ? attached : undefined,
        { history: priorHistory, enableGoogleSearch: useGeminiNativeSearch }
      );

      let parsed = parseButlerResponse(responseText);
      let finalSources: WebSearchSource[] | undefined = webData?.results?.length ? webData.results : undefined;
      let finalQuote: LiveQuote | null | undefined = webData?.liveQuote || undefined;

      // Agentic Step 2A: Model requested live WEB_SEARCH on its own
      if (parsed.action?.intent === 'WEB_SEARCH' && webMode !== 'off') {
        const searchQuery = String(parsed.action.data?.query || text).trim();
        setThinkingLabel(replyLang === 'zh' ? `正在联网搜索「${searchQuery}」…` : `Searching web for "${searchQuery}"…`);
        const liveRes = await searchWeb(searchQuery, replyLang, 6);
        finalSources = liveRes.results.length ? liveRes.results : finalSources;
        finalQuote = liveRes.liveQuote || finalQuote;

        const synthesisPrompt = `${text}\n\n[LIVE WEB RESULTS FOR "${searchQuery}"]\n${formatWebSearchContext(liveRes) || 'No web results returned.'}\n\nNow synthesize a clear, accurate, helpful final answer in ${detected.promptName}. Do NOT emit WEB_SEARCH again.`;
        setThinkingLabel(replyLang === 'zh' ? '正在整理联网结果…' : 'Synthesizing answer…');
        const step2Text = await aiService.generate(provider, model, apiKey, synthesisPrompt, system, undefined, { history: priorHistory });
        parsed = parseButlerResponse(step2Text);
      }

      // Agentic Step 2B: Model requested deep SEARCH_APP_DATA
      if (parsed.action?.intent === 'SEARCH_APP_DATA') {
        const appQuery = String(parsed.action.data?.query || text).trim();
        setThinkingLabel(replyLang === 'zh' ? `正在深度检索应用数据「${appQuery}」…` : `Searching app data for "${appQuery}"…`);
        const found = searchAppData(appQuery);
        const synthesisPrompt = `${text}\n\n[DEEP APP DATA SEARCH RESULTS FOR "${appQuery}"]\n${JSON.stringify(found)}\n\nAnswer the user's question accurately in ${detected.promptName} using these exact records. Do NOT emit SEARCH_APP_DATA again.`;
        const step2Text = await aiService.generate(provider, model, apiKey, synthesisPrompt, system, undefined, { history: priorHistory });
        parsed = parseButlerResponse(step2Text);
      }

      // Pure conversational / analytical / web-grounded answer
      if (!parsed.action || parsed.action.intent === 'CHAT') {
        ping('happy');
        reply(parsed.message || stripReasoning(responseText), {
          sources: finalSources,
          liveQuote: finalQuote,
        });
        return;
      }

      const intent = parsed.action.intent;
      const actionData = parsed.action.data || {};

      if (intent === 'NAVIGATE') {
        goTo((actionData as { target: string })?.target || 'launcher');
        ping('happy');
        reply(parsed.message || (replyLang === 'zh' ? '好的，已经帮你打开啦。' : 'Opened it for you.'));
        return;
      }

      const isDestructive = intent.startsWith('DELETE_') && !isCallTurn;
      if (!isDestructive) {
        const { message: execMsg, result } = await executeAction(intent, actionData, replyLang);
        ping('happy');
        const finalMsg = parsed.message && parsed.message.length > 16 ? parsed.message : (execMsg || parsed.message);
        reply(finalMsg, {
          result: result as Msg['result'],
          sources: finalSources,
          liveQuote: finalQuote,
        });
        return;
      }

      // Destructive delete in chat mode: ask confirmation in user's language
      setPhase('idle');
      setThinkingLabel('');
      const confirmPrompt =
        parsed.message ||
        (replyLang === 'zh' ? '此操作将删除数据，请确认是否继续？' : 'This will delete data. Please confirm to proceed.');
      push({
        id: `a${Date.now()}`,
        role: 'assistant',
        content: confirmPrompt,
        pending: { intent, data: actionData, summary: confirmPrompt, replyLang },
      });
      memoryService.append({ role: 'assistant', text: confirmPrompt });
    } catch (e) {
      ping('sad');
      reply(`${t.errorState}: ${(e as Error).message}`, { isError: true });
    }
  }, [input, images, push, t, lang, currentApp, webMode, goTo, ping, speakAndResumeIfCall]);

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
      const { message, result } = await executeAction(m.pending.intent, m.pending.data, m.pending.replyLang);
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

  const cycleWebMode = () => {
    setWebMode((prev) => (prev === 'auto' ? 'on' : prev === 'on' ? 'off' : 'auto'));
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
            ? (thinkingLabel || t.thinking)
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

  /* ------------------------------------------------------------------ floating chat panel */
  const empty = messages.length === 0;
  const quickChips = lang === 'zh'
    ? ['分析我这个月的预算和支出', '我现在的总资产和钱包余额？', '查一下今天 USD/MYR 汇率', '陪我聊聊理财建议']
    : ['Analyze my monthly budget', 'Check my net worth & wallets', 'Latest USD/MYR exchange rate', 'Chat & brainstorm ideas'];

  const webLabel =
    webMode === 'on'
      ? (lang === 'zh' ? '联网 开' : 'Web On')
      : webMode === 'off'
        ? (lang === 'zh' ? '联网 关' : 'Web Off')
        : (lang === 'zh' ? '联网 自动' : 'Web Auto');

  return (
    <>
      {/* Backdrop: shown on mobile drawer OR desktop expanded mode (compact desktop stays non-blocking!) */}
      <div
        className={`binggo-backdrop ${expanded ? 'block' : 'block sm:hidden'}`}
        onClick={close}
        aria-hidden="true"
      />

      <div
        className={`binggo-sheet ${expanded ? 'binggo-sheet--expanded' : ''} ${closing ? 'binggo-sheet--closing' : ''}`}
        role="dialog"
        aria-modal={expanded}
        aria-label={t.name}
      >
        {/* Mobile grab handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-0.5 shrink-0">
          <span className="w-9 h-1 rounded-full bg-black/15" />
        </div>

        {/* ------------------------------------------------------------ header */}
        <header className="shrink-0 px-4 py-3 flex items-center gap-2 border-b border-black/[0.08] bg-white">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <BingGo size={30} mood={mood} autoBlink={mode === 'chat'} label={undefined} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-bold tracking-tight leading-tight text-[#0A0A0B]">
                  {t.name}
                </span>
                <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-[#2600FD]/10 text-[#2600FD]">
                  AI 2.0
                </span>
              </div>
              <div className="binggo-live mt-0.5">
                <span className="binggo-live__dot" />
                <span className="truncate">
                  {phase === 'thinking'
                    ? (thinkingLabel || t.thinking)
                    : phase === 'listening'
                      ? t.listening
                      : phase === 'speaking'
                        ? t.speaking
                        : (lang === 'zh' ? '全应用感知 · 自动语言 · 可联网' : 'App-aware · Auto-lang · Web')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {messages.length > 0 && (
              <button
                type="button"
                className="binggo-iconbtn"
                onClick={handleClearChat}
                aria-label={t.clear}
                title={lang === 'zh' ? '清空当前对话' : 'New chat'}
              >
                <RotateCcw size={15} strokeWidth={2.1} />
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
                {voiceOut ? <Volume2 size={16} strokeWidth={2.1} /> : <VolumeX size={16} strokeWidth={2.1} />}
              </button>
            )}

            <button
              type="button"
              className="binggo-iconbtn"
              onClick={() => {
                setMode('call');
                modeRef.current = 'call';
              }}
              aria-label={t.call}
              title={t.call}
            >
              <Phone size={15} strokeWidth={2.1} />
            </button>

            <button
              type="button"
              className="binggo-iconbtn"
              onClick={() => setExpanded((e) => !e)}
              aria-label={expanded ? 'Compact' : 'Expand'}
              title={expanded ? (lang === 'zh' ? '还原浮窗' : 'Compact floating view') : (lang === 'zh' ? '放大窗口' : 'Expand window')}
            >
              {expanded ? <Minimize2 size={15} strokeWidth={2.1} /> : <Maximize2 size={15} strokeWidth={2.1} />}
            </button>

            <button
              type="button"
              className="binggo-iconbtn"
              onClick={close}
              aria-label={t.back}
              title={lang === 'zh' ? '关闭' : 'Close'}
            >
              <X size={17} strokeWidth={2.2} />
            </button>
          </div>
        </header>

        {/* ------------------------------------------------------------ messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {empty ? (
            <div className="min-h-full flex flex-col items-center justify-center text-center gap-3.5 py-4">
              <BingGo size={76} mood="idle" label={undefined} />
              <div className="space-y-1 max-w-[34ch]">
                <h2 className="text-[16px] font-bold tracking-tight text-[#0A0A0B]">
                  {lang === 'zh' ? '嗨，我是升级版 BingGo' : 'Hey, I’m BingGo'}
                </h2>
                <p className="text-[12.5px] leading-relaxed text-[#0A0A0B]/55">
                  {lang === 'zh'
                    ? '懂你 App 里的每一笔账与笔记、自动用你的语言回复，也能陪你自由聊天或联网查最新信息。'
                    : 'I know all your Apptify data, automatically match your language, chat freely, and search the live web.'}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5 pt-1 max-w-[360px]">
                {quickChips.map((q) => (
                  <button key={q} type="button" className="binggo-chip" onClick={() => void send(q)}>
                    <Sparkles size={11} className="text-[#2600FD] shrink-0" />
                    <span>{q}</span>
                  </button>
                ))}
              </div>
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
                    {m.content ? <div className="binggo-msg--user text-[14px] leading-relaxed">{m.content}</div> : null}
                  </div>
                ) : (
                  <div className="binggo-msg--assistant space-y-2.5">
                    {m.isError ? (
                      <div className="flex gap-2 items-start text-[13.5px] leading-relaxed text-zinc-700 bg-zinc-100 rounded-2xl p-3">
                        <AlertCircle size={15} className="text-[#0A0A0B]/60 mt-0.5 shrink-0" strokeWidth={2.2} />
                        <span>{m.content}</span>
                      </div>
                    ) : (
                      <Rich text={m.content} />
                    )}

                    {/* Live Market Quote Pill (if fetched) */}
                    {m.liveQuote && (
                      <a
                        href={m.liveQuote.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-[#0A0A0B] text-white hover:opacity-95 transition-opacity"
                      >
                        <div className="min-w-0">
                          <div className="font-mono text-[9px] uppercase tracking-wider text-[#FFBF00]">
                            LIVE QUOTE · {m.liveQuote.symbol}
                          </div>
                          <div className="text-xs font-medium text-white/75 truncate">{m.liveQuote.name}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-black font-mono-numbers">
                            {m.liveQuote.price} {m.liveQuote.currency}
                          </div>
                          <div className="text-[10px] font-mono font-bold text-[#FFBF00] font-mono-numbers">
                            {m.liveQuote.change >= 0 ? '+' : ''}{m.liveQuote.changePct}%
                          </div>
                        </div>
                      </a>
                    )}

                    {/* Action / App Data Result Card */}
                    {m.result ? (
                      <div className="rounded-2xl border border-black/[0.09] bg-zinc-50/70 p-3">
                        <div className="font-mono text-[9px] tracking-[0.12em] uppercase text-[#2600FD] font-bold">
                          {m.result.badge || 'done'}
                        </div>
                        <div className="text-[13px] font-bold text-[#0A0A0B] mt-0.5">{m.result.title}</div>
                        {m.result.details.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {m.result.details.map((d, i) => (
                              <div key={i} className="text-[12px] text-[#0A0A0B]/65">{d}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* Web Search Source Citations */}
                    {m.sources && m.sources.length > 0 && (
                      <div className="pt-1 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-wider text-zinc-400 font-bold">
                          <Globe size={11} className="text-[#2600FD]" />
                          <span>{lang === 'zh' ? '联网参考来源' : 'WEB SOURCES'}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {m.sources.slice(0, 4).map((src, idx) => (
                            <a
                              key={`${src.url}-${idx}`}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-xl border border-black/[0.1] bg-white hover:border-[#2600FD]/50 hover:text-[#2600FD] text-[11px] text-zinc-700 transition-colors"
                              title={src.title}
                            >
                              <span className="font-mono text-[10px] font-bold text-[#2600FD] shrink-0">
                                {src.domain || `S${idx + 1}`}
                              </span>
                              <span className="truncate max-w-[165px]">{src.title}</span>
                              <ExternalLink size={10} className="shrink-0 opacity-50" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Destructive confirmation */}
                    {m.pending ? (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => void confirm(m, true)}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2600FD] text-white text-[12px] font-semibold active:scale-95 transition-transform cursor-pointer"
                        >
                          <Check size={13} strokeWidth={2.6} /> {t.confirm}
                        </button>
                        <button
                          type="button"
                          onClick={() => void confirm(m, false)}
                          className="px-3.5 py-2 rounded-xl border border-black/[0.14] text-[12px] font-medium active:scale-95 transition-transform cursor-pointer"
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
              <span className="text-[12.5px] leading-relaxed text-[#0A0A0B]/70">{micNotice}</span>
            </div>
          )}

          {phase === 'thinking' && (
            <div className="binggo-msg flex items-center gap-2.5 py-1">
              <BingGo size={24} mood="think" still label={undefined} />
              <span className="text-[13px] font-medium text-[#0A0A0B]/60 flex items-center gap-1.5">
                {thinkingLabel.includes('搜索') || thinkingLabel.toLowerCase().includes('search') ? (
                  <Search size={12} className="text-[#2600FD] animate-pulse" />
                ) : null}
                {thinkingLabel || t.thinking}
              </span>
              <span className="binggo-dots"><i /><i /><i /></span>
            </div>
          )}
        </div>

        {/* ----------------------------------------------------- composer */}
        <div className="shrink-0 px-3.5 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-2 border-t border-black/[0.06] bg-white space-y-2">
          {/* Toolbar strip: Web Search toggle + Language auto badge */}
          <div className="flex items-center justify-between gap-2 px-1">
            <button
              type="button"
              onClick={cycleWebMode}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold transition-all cursor-pointer active:scale-95 ${
                webMode === 'on'
                  ? 'bg-[#2600FD] text-white shadow-xs'
                  : webMode === 'auto'
                    ? 'bg-[#2600FD]/10 text-[#2600FD] border border-[#2600FD]/25'
                    : 'bg-zinc-100 text-zinc-400 border border-zinc-200'
              }`}
              title={
                lang === 'zh'
                  ? '点击切换联网模式：自动判断 / 强制联网 / 关闭'
                  : 'Cycle Web Search: Auto / Always On / Off'
              }
            >
              <Globe size={11} />
              <span>{webLabel}</span>
            </button>

            <span className="font-mono text-[10px] text-zinc-400 truncate">
              {lang === 'zh' ? '自动识别对话语言' : 'Auto language match'}
            </span>
          </div>

          {images.length > 0 && (
            <div className="flex gap-2 flex-wrap px-1">
              {images.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt="" className="w-12 h-12 object-cover rounded-xl border border-black/10" />
                  <button
                    type="button"
                    onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#0A0A0B] text-white flex items-center justify-center cursor-pointer"
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
              <ImagePlus size={16} strokeWidth={2.1} />
            </button>
            <button
              type="button"
              className={`binggo-iconbtn ${phase === 'listening' ? 'binggo-iconbtn--on' : ''}`}
              onClick={toggleMic}
              aria-label={t.listening}
              title={micOn ? t.listening : t.unsupportedVoice}
            >
              {phase === 'listening' ? <MicOff size={16} strokeWidth={2.1} /> : <Mic size={16} strokeWidth={2.1} />}
            </button>
            <button
              type="submit"
              className="binggo-iconbtn binggo-iconbtn--send"
              disabled={(!input.trim() && images.length === 0) || phase === 'thinking'}
              aria-label={t.send}
            >
              <Send size={14} strokeWidth={2.4} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default BingGoAssistant;
