import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Send, Mic, MicOff, Volume2, VolumeX, ImagePlus, Phone, PhoneOff,
  Pause, Play, Check, AlertCircle,
} from 'lucide-react';
import BingGo, { type BingGoMood } from './BingGo';
import { aiService, type AIProvider } from '../services/aiService';
import { voiceService } from '../services/voiceService';
import { memoryService, type BingGoTurn } from '../services/memoryService';
import { executeAction, tryLocalRuleParser, loadMyWealthData, loadTasks, loadNotes } from '../services/skillExecutor';
import type { Translations, Language } from '../utils/i18n';
import './BingGoUI.css';

/* ==========================================================================
   BingGo — the assistant surface
   ==========================================================================

   Two modes, one state machine:

     chat   a transcript with a composer, for typing and for images
     call   the character alone on the screen with a live status line, for
            talking

   Both drive the same `phase`, and the character's face is derived from it, so
   the assistant always looks like it is doing whatever it is actually doing.

   Deliberately light. The reference was a dark full-bleed call screen, but this
   app has a white-canvas four-pigment system and a dark sheet would read as a
   different product bolted on. The call mode gets its own room by clearing the
   chrome instead of by inverting the palette.
   ========================================================================== */

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
  onSeedConsumed?: () => void;
  /** Called for NAVIGATE intents. */
  onNavigate: (target: string) => void;
}

/* --------------------------------------------------------------------------
   A deliberately small markdown renderer. The assistant replies in light
   markdown, and pulling in a full parser for bold and bullets would be more
   surface than the job needs.
   -------------------------------------------------------------------------- */
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

/** Strip the light markdown the assistant replies in, for one-line previews. */
const plain = (text: string): string =>
  text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^\s*[•\-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

const BingGoAssistant: React.FC<BingGoAssistantProps> = ({
  open, onClose, t, lang, seed, onSeedConsumed, onNavigate,
}) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [mode, setMode] = useState<Mode>('chat');
  const [voiceOut, setVoiceOut] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [flash, setFlash] = useState<'happy' | 'sad' | null>(null);
  const [closing, setClosing] = useState(false);
  const [paused, setPaused] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const listenRef = useRef<{ stop: () => void } | null>(null);
  const flashTimer = useRef<number | null>(null);
  const bootedRef = useRef(false);

  const speechOn = voiceService.isSpeechSupported();
  const micOn = voiceService.isRecognitionSupported();
  const locale = voiceService.localeFor(lang);

  /* The face follows the work. A brief flash lets a finished task read as
     pleased and a failure read as sorry without a separate state. */
  const mood: BingGoMood = flash ?? (
    phase === 'thinking' ? 'think'
    : phase === 'listening' ? 'listen'
    : phase === 'speaking' ? 'speak'
    : 'idle'
  );

  const ping = useCallback((m: 'happy' | 'sad') => {
    setFlash(m);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1500);
  }, []);

  /* Restore what BingGo already knows. This is the difference between an
     assistant and a text box. */
  useEffect(() => {
    if (!open || bootedRef.current) return;
    bootedRef.current = true;
    const past = memoryService.recent(12);
    if (past.length) {
      setMessages(past.map((r) => ({ id: r.id, role: r.role, content: r.text, images: r.images })));
    }
  }, [open]);

  useEffect(() => {
    if (!open) { setClosing(false); setMode('chat'); return; }
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages, phase]);

  useEffect(() => () => {
    voiceService.stopSpeaking();
    listenRef.current?.stop();
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
  }, []);

  const close = useCallback(() => {
    voiceService.stopSpeaking();
    listenRef.current?.stop();
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


  /* Asking BingGo to open something means you want to see it. Route, then get
     out of the way — otherwise the sheet covers the page it just navigated to. */
  const goTo = useCallback((target: string) => {
    onNavigate(target);
    close();
  }, [onNavigate, close]);

  /* ------------------------------------------------------------------ send */
  const send = useCallback(async (raw?: string) => {
    const text = (raw ?? input).trim();
    if ((!text && images.length === 0) || phase === 'thinking') return;

    const attached = images;
    setInput('');
    setImages([]);
    push({ id: `u${Date.now()}`, role: 'user', content: text, images: attached.length ? attached : undefined });
    memoryService.append({ role: 'user', text, images: attached.length ? attached : undefined });
    setPhase('thinking');

    const reply = (content: string, extra?: Partial<Msg>) => {
      push({ id: `a${Date.now()}`, role: 'assistant', content, ...extra });
      memoryService.append({ role: 'assistant', text: content });
      setPhase('idle');
      if (voiceOut && speechOn) {
        setPhase('speaking');
        voiceService.speak(content, { lang: locale, onEnd: () => setPhase('idle'), onError: () => setPhase('idle') });
      }
    };

    // Fast path: the offline rule parser answers instantly and needs no key.
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
      reply(lang === 'zh' ? '已经帮你打开了。' : 'Opened it for you.');
      return;
    }

    const apiKey = localStorage.getItem('app_global_api_key');
    if (!apiKey) {
      setPhase('idle');
      push({
        id: `a${Date.now()}`, role: 'assistant', isError: true,
        content: lang === 'zh'
          ? '我还没有连上模型。到「设置」里填一个 API Key，我就能真正理解你的话了。\n\n在那之前，这些精确指令我仍然可以立刻执行：\n• 记一笔午餐 25\n• 存入 500 到 Maybank\n• 新建待办：准备周报'
          : 'I am not connected to a model yet. Add an API key in Settings and I will understand free-form requests.\n\nUntil then these still run instantly:\n• 记一笔午餐 25\n• 存入 500 到 Maybank\n• 新建待办：准备周报',
      });
      return;
    }

    const provider = (localStorage.getItem('app_global_ai_provider') || 'google') as AIProvider;
    const model = localStorage.getItem('app_global_ai_model') || 'gemini-2.5-flash';

    const mw = loadMyWealthData();
    const tasks = loadTasks();
    const notes = loadNotes();
    const recalled = await memoryService.search(text, 4, { provider, model, apiKey }).catch(() => []);
    const older = recalled.filter((r) => !memoryService.recent(12).some((x) => x.id === r.id));

    const system = `You are BingGo, the resident assistant inside Apptify, a personal finance and notes app.
Reply in ${lang === 'zh' ? 'Chinese' : 'English'}. Be concise and warm. Never use emoji.

CURRENT SCREEN: ${'app'}
WALLETS: ${JSON.stringify(mw.accounts.map((a: { name: string; balance: number }) => ({ name: a.name, balance: a.balance })))}
OPEN TASKS: ${JSON.stringify(tasks.filter((x: { completed?: boolean }) => !x.completed).map((x: { id: string; title: string }) => ({ id: x.id, title: x.title })))}
RECENT NOTES: ${JSON.stringify(notes.slice(0, 5).map((n: { id: string; title: string }) => ({ id: n.id, title: n.title })))}
${older.length ? `\nRELEVANT EARLIER CONVERSATION:\n${memoryService.buildContext(older, 1200)}` : ''}

You may change the app's data by returning ONE JSON object and nothing else.
Intents:
1 WITHDRAW_MONEY {amount:number, category:"Food"|"Transport"|"Utilities"|"Entertainment"|"Shopping"|"Health"|"Other", description:string, walletName:string}
2 ADD_MONEY {amount:number, description:string, walletName:string}
3 TRANSFER_MONEY {sourceWallet:string, destinationWallet:string, amount:number, description:string}
4 CREATE_NOTE {title:string, content:string, category:"work"|"idea"|"meeting"|"life"}
5 CREATE_TASK {title:string, priority:"high"|"medium"|"low", deadline:string}
6 UPDATE_TASK {taskTitle:string, completed:boolean}
7 QUERY_WEALTH {}
8 QUERY_TASKS {}
9 NAVIGATE {target:"mywealth"|"knowledgevault"|"newshub"|"launcher"|"settings"}
10 ADD_BUDGET {name:string, amount:number, category:string}
11 ADD_LOAN {name:string, totalAmount:number, monthlyPayment:number, months:number}
12 REPAY_LOAN {loanName:string, amount:number}
13 SEARCH_NOTES {query:string}
14 QUERY_NOTES {}
15 UPDATE_NOTE {title:string, content?:string, newTitle?:string, category?:string}
16 DELETE_NOTE {title:string}
17 DELETE_TASK {taskTitle:string}
18 CHAT {}

If a request does not map to one of these, use CHAT and say plainly that you cannot do it. Never claim an action succeeded unless you returned its intent.

Shape: {"intent":"...","data":{...},"message":"<reply to show and speak>"}
Use CHAT for anything conversational, including storytelling. Output JSON only, no markdown fence.`;

    try {
      const responseText = await aiService.generate(provider, model, apiKey, text || '(image attached)', system, attached.length ? attached : undefined);
      const clean = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      let parsed: { intent?: string; data?: unknown; message?: string };
      try { parsed = JSON.parse(clean); } catch { parsed = { intent: 'CHAT', message: clean }; }

      const intent = parsed.intent || 'CHAT';
      const message = parsed.message || clean;

      if (intent === 'CHAT') { ping('happy'); reply(message); return; }
      if (intent === 'NAVIGATE') {
        goTo((parsed.data as { target: string })?.target || 'launcher');
        ping('happy'); reply(message); return;
      }
      if (intent.startsWith('QUERY_')) {
        const { message: m, result } = await executeAction(intent, parsed.data || {});
        ping('happy'); reply(m || message, { result: result as Msg['result'] }); return;
      }
      // A write. Confirm before touching the user's data.
      setPhase('idle');
      push({
        id: `a${Date.now()}`, role: 'assistant', content: message,
        pending: { intent, data: parsed.data || {}, summary: message },
      });
      memoryService.append({ role: 'assistant', text: message });
    } catch (e) {
      ping('sad');
      reply(`${t.errorState}. ${(e as Error).message}`, { isError: true });
    }
  }, [input, images, phase, push, t, lang, locale, voiceOut, speechOn, goTo, ping]);

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
  const toggleMic = useCallback(() => {
    if (phase === 'listening') { listenRef.current?.stop(); setPhase('idle'); return; }
    if (!micOn) { ping('sad'); return; }
    voiceService.stopSpeaking();
    setPhase('listening');
    listenRef.current = voiceService.listen({
      lang: locale,
      onResult: (text, isFinal) => {
        setInput(text);
        if (isFinal && text.trim()) { setPhase('idle'); void send(text); }
      },
      onError: () => { setPhase('idle'); ping('sad'); },
      onEnd: () => setPhase((p) => (p === 'listening' ? 'idle' : p)),
    });
  }, [phase, micOn, locale, send, ping]);

  useEffect(() => { setPhase((p) => (p === 'listening' ? 'idle' : p)); }, [mode]);

  const pickImage = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 3).forEach((f) => {
      const r = new FileReader();
      r.onload = () => setImages((p) => [...p, String(r.result)].slice(0, 3));
      r.readAsDataURL(f);
    });
  };

  if (!open) return null;

  const empty = messages.length === 0;

  return (
    <div className={`binggo-sheet ${closing ? 'binggo-sheet--closing' : ''}`} role="dialog" aria-modal="true" aria-label={t.name}>
      {/* ------------------------------------------------------------ head */}
      <header className="shrink-0 px-gutter pt-3 pb-3 flex items-center gap-3 border-b border-black/[0.08]">
        <button type="button" className="binggo-iconbtn" onClick={close} aria-label={t.back}>
          <X size={18} strokeWidth={2.2} />
        </button>

        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <BingGo size={30} mood={mood} autoBlink={mode === 'chat'} label={undefined} />
          <div className="min-w-0">
            <div className="text-[14px] font-semibold tracking-tight leading-tight">{t.name}</div>
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
          onClick={() => setMode((m) => (m === 'call' ? 'chat' : 'call'))}
          aria-label={t.call}
          title={t.call}
        >
          <Phone size={17} strokeWidth={2.1} />
        </button>
      </header>

      {/* ------------------------------------------------------------ call */}
      {mode === 'call' ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 px-gutter relative">
          <div className="relative flex items-center justify-center">
            <span className="binggo-call__halo" />
            <span className="binggo-call__halo" />
            <span className="binggo-call__halo" />
            <BingGo size={132} mood={mood} autoBlink={phase === 'idle'} label={t.name} />
          </div>

          <div className="text-center space-y-1">
            <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-[#0A0A0B]/45">
              {phase === 'listening' ? t.listening : phase === 'speaking' ? t.speaking : phase === 'thinking' ? t.thinking : t.ready}
            </div>
            <p className="text-[13px] text-[#0A0A0B]/55 max-w-[30ch] mx-auto leading-relaxed">
              {messages.length ? (() => {
                const full = plain(messages[messages.length - 1].content);
                if (full.length <= 140) return full;
                const cut = full.slice(0, 140);
                const gap = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('，'), cut.lastIndexOf('。'));
                return `${(gap > 80 ? cut.slice(0, gap) : cut).trimEnd()}…`;
              })() : t.emptyBody}
            </p>
          </div>

          <div className="flex items-center gap-10">
            <button type="button" className="binggo-call__btn" onClick={() => { setPaused((p) => !p); voiceService.stopSpeaking(); }}>
              <i>{paused ? <Play size={20} strokeWidth={2.2} /> : <Pause size={20} strokeWidth={2.2} />}</i>
              {paused ? t.resume : t.hold}
            </button>
            <button
              type="button"
              className={`binggo-call__btn ${phase === 'listening' ? '' : 'binggo-call__btn--end'}`}
              onClick={phase === 'listening' ? toggleMic : close}
            >
              <i>{phase === 'listening' ? <MicOff size={20} strokeWidth={2.2} /> : <PhoneOff size={20} strokeWidth={2.2} />}</i>
              {phase === 'listening' ? t.endCall : t.endCall}
            </button>
          </div>

          {!micOn && (
            <p className="binggo-live text-center">{t.unsupportedVoice}</p>
          )}
        </div>
      ) : (
        <>
          {/* -------------------------------------------------------- body */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-gutter py-4 space-y-4">
            {empty ? (
              <div className="min-h-full flex flex-col items-center justify-center text-center gap-4">
                <BingGo size={96} mood="idle" label={undefined} />
                <div className="space-y-1.5 max-w-[36ch]">
                  <h2 className="text-[17px] font-semibold tracking-tight">{t.emptyTitle}</h2>
                  <p className="text-[13.5px] leading-relaxed text-[#0A0A0B]/55">{t.emptyBody}</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  {[t.quickExpense, t.quickNote, t.quickStory].map((q) => (
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

            {phase === 'thinking' && (
              <div className="binggo-msg space-y-2.5">
                <div className="flex items-center gap-2">
                  <BingGo size={24} mood="think" still label={undefined} />
                  <span className="binggo-dots"><i /><i /><i /></span>
                  <span className="font-mono text-[10px] tracking-wider uppercase text-[#0A0A0B]/40">{t.thinkingLabel}</span>
                </div>
                <div className="space-y-1.5 max-w-[70%]">
                  <div className="binggo-skel w-[92%]" />
                  <div className="binggo-skel w-[64%]" />
                </div>
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
                placeholder={t.inputPlaceholder}
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
        </>
      )}
    </div>
  );
};

export default BingGoAssistant;
