/**
 * voiceService — Web Audio TTS + Enhanced Browser Voice I/O for the BingGo assistant.
 *
 * Supports 4 selectable cute voice personas:
 *  - 'xiaoyi':    🎀 元气萌妹 (Sandy / Xiaoyi — High-spirited cute voice)
 *  - 'hsiaochen': 🍬 甜美台腔 (Meijia / HsiaoChen — Sweet Taiwanese voice)
 *  - 'xiaoxiao':  ✨ 灵动少女 (Flo / Xiaoxiao — Natural bright voice)
 *  - 'yunxia':    🌟 活力少年 (Shelley / Yunxia — Energetic mascot voice)
 */

import { getStoredLanguage } from '../utils/i18n';

export type VoicePersonaId = 'xiaoyi' | 'hsiaochen' | 'xiaoxiao' | 'yunxia';

export interface VoicePersonaMeta {
  id: VoicePersonaId;
  badge: string;
  labelZh: string;
  labelEn: string;
  sampleZh: string;
  sampleEn: string;
  pitch: number;
  rate: number;
  /** Pitch shift in cents for Web Audio playback (100 cents = 1 semitone). */
  detuneCents: number;
  preferredLangZh: string;
  preferredVoiceKeywords: string[];
}

export const VOICE_PERSONAS: VoicePersonaMeta[] = [
  {
    id: 'hsiaochen',
    badge: '🍬',
    labelZh: '甜美台腔',
    labelEn: 'Sweet Warm',
    sampleZh: '哈啰～我是 BingGo，你的专属贴心管家，随时叫我喔！',
    sampleEn: 'Hello! I am BingGo, your sweet personal butler, always here for you!',
    pitch: 1.12,
    rate: 1.02,
    detuneCents: 45,
    preferredLangZh: 'zh-TW',
    preferredVoiceKeywords: ['hsiaochen', '晓臻', 'meijia', '美佳', 'google 國語', 'tingting'],
  },
  {
    id: 'xiaoyi',
    badge: '🎀',
    labelZh: '元气萌妹',
    labelEn: 'Lively Cute',
    sampleZh: '嗨嗨～我是你的元气小管家 BingGo！今天有什么交给我呀？',
    sampleEn: 'Hi there! I am BingGo, your lively little butler! Ready to help!',
    pitch: 1.16,
    rate: 1.05,
    detuneCents: 95,
    preferredLangZh: 'zh-TW',
    preferredVoiceKeywords: ['xiaoyi', '晓伊', 'meijia', '美佳', 'google 國語', 'google 普通话', 'tingting'],
  },
  {
    id: 'xiaoxiao',
    badge: '✨',
    labelZh: '灵动少女',
    labelEn: 'Bright Clear',
    sampleZh: '你好呀！我是灵动管家 BingGo，查账记事都包在我身上！',
    sampleEn: 'Hey! I am BingGo! Finances, tasks, or notes — leave them all to me!',
    pitch: 1.08,
    rate: 1.04,
    detuneCents: 0,
    preferredLangZh: 'zh-CN',
    preferredVoiceKeywords: ['xiaoxiao', '晓晓', 'google 普通话', 'tingting'],
  },
  {
    id: 'yunxia',
    badge: '🌟',
    labelZh: '活力少年',
    labelEn: 'Energetic Mascot',
    sampleZh: '收到！活力小管家 BingGo 随时待命，我们现在就开始吧！',
    sampleEn: 'Roger that! BingGo is on duty and supercharged! Let us go!',
    pitch: 1.18,
    rate: 1.08,
    detuneCents: 120,
    preferredLangZh: 'zh-CN',
    preferredVoiceKeywords: ['yunxia', '云夏', 'google 普通话', 'tingting'],
  },
];

const PERSONA_STORAGE_KEY = 'binggo_voice_persona';

export interface SpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  persona?: VoicePersonaId;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

export interface ListenHandle { stop(): void; }

export interface ListenOptions {
  lang?: string;
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (err: unknown) => void;
  onEnd?: () => void;
  silenceMs?: number;
  initialWaitMs?: number;
}

interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: ((event: Event) => void) | null;
  onstart: ((event: Event) => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechWindow {
  speechSynthesis?: SpeechSynthesis;
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

const speechWindow = (): SpeechWindow | null => {
  if (typeof window === 'undefined') return null;
  return window as unknown as SpeechWindow;
};

const getSynth = (): SpeechSynthesis | null => {
  const w = speechWindow();
  if (!w) return null;
  const synth = w.speechSynthesis;
  return synth && typeof synth.speak === 'function' ? synth : null;
};

const getRecognitionCtor = (): SpeechRecognitionCtor | null => {
  const w = speechWindow();
  if (!w) return null;
  if (typeof w.SpeechRecognition === 'function') return w.SpeechRecognition;
  if (typeof w.webkitSpeechRecognition === 'function') return w.webkitSpeechRecognition;
  return null;
};

const storedLanguage = (): 'en' | 'zh' => {
  if (typeof window === 'undefined') return 'en';
  try {
    return getStoredLanguage();
  } catch {
    return 'en';
  }
};

export const getStoredPersona = (): VoicePersonaId => {
  if (typeof window === 'undefined') return 'xiaoyi';
  try {
    const saved = localStorage.getItem(PERSONA_STORAGE_KEY) as VoicePersonaId | null;
    if (saved && VOICE_PERSONAS.some((p) => p.id === saved)) return saved;
  } catch {}
  return 'xiaoyi';
};

export const setStoredPersona = (id: VoicePersonaId): VoicePersonaMeta => {
  try {
    localStorage.setItem(PERSONA_STORAGE_KEY, id);
  } catch {}
  return VOICE_PERSONAS.find((p) => p.id === id) || VOICE_PERSONAS[0];
};

export const getPersonaMeta = (id?: VoicePersonaId): VoicePersonaMeta => {
  const target = id || getStoredPersona();
  return VOICE_PERSONAS.find((p) => p.id === target) || VOICE_PERSONAS[0];
};

let sharedAudioCtx: AudioContext | null = null;
let activeBufferSource: AudioBufferSourceNode | null = null;

const getOrCreateAudioContext = (): AudioContext | null => {
  try {
    const w = speechWindow();
    const Ctx = w?.AudioContext || w?.webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
    if (sharedAudioCtx.state === 'suspended') {
      void sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
};

/**
 * Unlock both Web Audio API and SpeechSynthesis during user gesture clicks
 * so subsequent async voice replies (after STT + LLM) are never muted by autoplay policy.
 */
export const unlockAudioOutput = (): void => {
  getOrCreateAudioContext();
  const synth = getSynth();
  if (synth) {
    try {
      synth.resume();
      const silent = new SpeechSynthesisUtterance('');
      silent.volume = 0;
      synth.speak(silent);
    } catch {}
  }
};

export const playCuteChime = (kind: 'listen' | 'happy' | 'switch' = 'listen'): void => {
  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes =
      kind === 'happy'
        ? [587.33, 783.99, 1046.5]
        : kind === 'switch'
          ? [659.25, 880.0]
          : [523.25, 659.25];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const start = now + idx * 0.065;
      const dur = 0.11;
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.03, start + dur);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.01);
    });
  } catch {}
};

const stripMarkdown = (input: string): string => {
  if (!input) return '';
  let out = input.replace(/\r\n?/g, '\n');
  out = out.replace(/```[\s\S]*?```/g, ' ');
  out = out.replace(/~~~[\s\S]*?~~~/g, ' ');
  out = out.replace(/`([^`\n]*)`/g, '$1');
  out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  out = out.replace(/<https?:\/\/[^>\s]+>/g, ' ');
  out = out.replace(/https?:\/\/\S+/g, ' ');
  out = out.replace(/^[ \t]{0,3}#{1,6}[ \t]*/gm, '');
  out = out.replace(/^[ \t]{0,3}(?:[-*_][ \t]*){3,}$/gm, ' ');
  out = out.replace(/^[ \t]{0,3}>[ \t]?/gm, '');
  out = out.replace(/^[ \t]{0,3}(?:[-*+\u2022\u2023\u25E6]|\d{1,3}[.)])[ \t]+/gm, '');
  out = out.replace(/\|/g, ' ');
  out = out.replace(/[*_~]{1,3}/g, '');
  out = out.replace(/<\/?[a-zA-Z][^>]*>/g, ' ');
  if (storedLanguage() === 'zh') {
    out = out.replace(/\bRM\s*(\d+(?:\.\d+)?)/gi, '$1 令吉');
  }
  out = out.replace(/[ \t]{2,}/g, ' ');
  out = out.replace(/\n{2,}/g, '。 ');
  out = out.replace(/\n/g, '，');
  return out.replace(/\s{2,}/g, ' ').trim();
};

const MAX_CHUNK_CHARS = 180;

const chunkText = (text: string, limit: number = MAX_CHUNK_CHARS): string[] => {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= limit) return [trimmed];

  const sentences = trimmed.match(/[^.!?\u3002\uFF01\uFF1F\uFF1B;\uFF1A:]+[.!?\u3002\uFF01\uFF1F\uFF1B;\uFF1A:]*\s*/g) ?? [trimmed];
  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    const value = current.trim();
    if (value) chunks.push(value);
    current = '';
  };

  for (const sentence of sentences) {
    if (sentence.length > limit) {
      flush();
      let rest = sentence.trim();
      while (rest.length > limit) {
        let cut = rest.lastIndexOf(' ', limit);
        if (cut < limit * 0.5) cut = limit;
        chunks.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
      }
      if (rest) current = `${rest} `;
      continue;
    }
    if ((current + sentence).length > limit) flush();
    current += `${sentence.trim()} `;
  }
  flush();
  return chunks.length ? chunks : [trimmed];
};

let speakGeneration = 0;
let listening = false;
let activeRecognition: SpeechRecognitionLike | null = null;
let micPermissionGranted = false;

const localeForImpl = (lang: 'en' | 'zh'): string => (lang === 'zh' ? 'zh-CN' : 'en-US');

const pickVoiceImpl = (locale: string, personaId?: VoicePersonaId): SpeechSynthesisVoice | null => {
  const synth = getSynth();
  if (!synth || !locale) return null;
  let voices: SpeechSynthesisVoice[] = [];
  try {
    voices = synth.getVoices() || [];
  } catch {
    return null;
  }
  if (!voices.length) return null;

  const persona = getPersonaMeta(personaId);
  const normalize = (value: string) => (value || '').toLowerCase().replace(/_/g, '-');
  const isZh = normalize(locale).startsWith('zh');
  const targetLocale = isZh ? normalize(persona.preferredLangZh) : normalize(locale);
  const primary = targetLocale.split('-')[0];

  const candidates = voices.filter((v) => normalize(v.lang).startsWith(primary));
  if (!candidates.length) return null;

  const scoreVoice = (v: SpeechSynthesisVoice): number => {
    const name = (v.name || '').toLowerCase();
    const vLang = normalize(v.lang);
    let score = 0;

    if (vLang === targetLocale) score += 25;
    if (isZh) {
      for (let i = 0; i < persona.preferredVoiceKeywords.length; i++) {
        if (name.includes(persona.preferredVoiceKeywords[i])) {
          score += 100 - i * 10;
          break;
        }
      }
    } else {
      if (name.includes('ana') || name.includes('ava') || name.includes('aria') || name.includes('samantha') || name.includes('flo')) {
        score += 60;
      }
    }

    if (name.includes('natural') || name.includes('neural')) score += 45;
    if (name.includes('premium') || name.includes('enhanced')) score += 35;
    return score;
  };

  return [...candidates].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || candidates[0];
};

export type MicFailure = 'unsupported' | 'denied' | 'no-device' | 'insecure' | 'unknown';

export const requestMicPermission = async (): Promise<MicFailure | null> => {
  if (typeof window === 'undefined') return 'unsupported';
  if (!window.isSecureContext) return 'insecure';
  unlockAudioOutput();
  if (micPermissionGranted) return null;
  if (!navigator.mediaDevices?.getUserMedia) return null;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    micPermissionGranted = true;
    return null;
  } catch (err) {
    const name = (err as { name?: string })?.name || '';
    if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied';
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'no-device';
    return 'unknown';
  }
};

export const voiceService = {
  isSpeechSupported(): boolean {
    return getSynth() !== null || typeof AudioContext !== 'undefined';
  },

  isRecognitionSupported(): boolean {
    return getRecognitionCtor() !== null;
  },

  localeFor(lang: 'en' | 'zh'): string {
    return localeForImpl(lang);
  },

  pickVoice(locale: string, personaId?: VoicePersonaId): SpeechSynthesisVoice | null {
    return pickVoiceImpl(locale, personaId);
  },

  getPersonas(): VoicePersonaMeta[] {
    return VOICE_PERSONAS;
  },

  getCurrentPersona(): VoicePersonaMeta {
    return getPersonaMeta();
  },

  cyclePersona(): VoicePersonaMeta {
    const current = getStoredPersona();
    const idx = VOICE_PERSONAS.findIndex((p) => p.id === current);
    const next = VOICE_PERSONAS[(idx + 1) % VOICE_PERSONAS.length];
    setStoredPersona(next.id);
    playCuteChime('switch');
    return next;
  },

  speak(text: string, opts: SpeakOptions = {}): void {
    const clean = stripMarkdown(text ?? '');
    if (!clean) {
      opts.onEnd?.();
      return;
    }

    // Ensure any active recognition is immediately aborted before speaking so
    // macOS / Edge does not block audio output while holding the mic stream.
    if (activeRecognition) {
      try {
        activeRecognition.onend = null;
        activeRecognition.onresult = null;
        activeRecognition.onerror = null;
        activeRecognition.abort();
      } catch {}
      activeRecognition = null;
      listening = false;
    }

    speakGeneration += 1;
    const generation = speakGeneration;
    const persona = getPersonaMeta(opts.persona);
    const appLang = storedLanguage();
    const lang = opts.lang || (appLang === 'zh' ? persona.preferredLangZh : 'en-US');

    if (activeBufferSource) {
      try {
        activeBufferSource.onended = null;
        activeBufferSource.stop();
        activeBufferSource.disconnect();
      } catch {}
      activeBufferSource = null;
    }
    const synth = getSynth();
    if (synth) {
      try { synth.cancel(); } catch {}
    }

    let completed = false;
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;

    const completeOnce = () => {
      if (completed || generation !== speakGeneration) return;
      completed = true;
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
      }
      opts.onEnd?.();
    };

    const estimatedMs = Math.min(45_000, Math.max(6_000, clean.length * 250 + 4_000));

    // Fallback: Browser SpeechSynthesis with Edge Online voice compatibility
    const speakWithBrowserFallback = () => {
      if (generation !== speakGeneration) return;
      if (!synth) {
        completeOnce();
        return;
      }
      const chunks = chunkText(clean);
      if (!chunks.length) {
        completeOnce();
        return;
      }

      try { synth.resume(); } catch {}

      const selectedVoice = pickVoiceImpl(lang, persona.id);
      const isOnlineNatural = Boolean(selectedVoice && /online|natural/i.test(selectedVoice.name));
      // Edge Online Natural voices reject custom pitch != 1, whereas local voices support cute pitch
      const rate = isOnlineNatural ? 1.06 : (typeof opts.rate === 'number' && opts.rate > 0 ? opts.rate : persona.rate);
      const pitch = isOnlineNatural ? 1.0 : (typeof opts.pitch === 'number' && opts.pitch > 0 ? opts.pitch : persona.pitch);

      watchdogTimer = setTimeout(completeOnce, estimatedMs);

      setTimeout(() => {
        if (generation !== speakGeneration) return;
        chunks.forEach((chunk, index) => {
          const utterance = new SpeechSynthesisUtterance(chunk);
          utterance.lang = selectedVoice?.lang || lang;
          utterance.rate = rate;
          utterance.pitch = pitch;
          if (selectedVoice) utterance.voice = selectedVoice;

          if (index === 0) {
            utterance.onstart = () => {
              if (generation === speakGeneration) opts.onStart?.();
            };
          }
          utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
            if (generation !== speakGeneration) return;
            if (event.error === 'interrupted' || event.error === 'canceled') {
              return;
            }
            if (index === chunks.length - 1) completeOnce();
          };
          if (index === chunks.length - 1) {
            utterance.onend = () => completeOnce();
          }
          synth.speak(utterance);
        });
      }, 120);
    };

    // Primary: Play synthesized cute voice through unlocked Web Audio API (AudioContext)
    // This completely bypasses browser HTMLAudioElement autoplay blocks and Edge SpeechSynthesis bugs!
    void (async () => {
      try {
        const ctx = getOrCreateAudioContext();
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 4500);
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: clean.slice(0, 500),
            persona: persona.id,
            lang: lang.startsWith('en') ? 'en' : 'zh',
          }),
          signal: controller.signal,
        });
        clearTimeout(fetchTimeout);

        if (generation !== speakGeneration) return;

        if (res.status === 200 && ctx) {
          const arrayBuf = await res.arrayBuffer();
          if (generation !== speakGeneration) return;
          if (arrayBuf.byteLength > 200) {
            if (ctx.state === 'suspended') {
              await ctx.resume();
            }
            const audioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
            if (generation !== speakGeneration) return;

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            // Apply cute pitch shift (detune in cents) without warbling!
            if (source.detune) {
              source.detune.value = persona.detuneCents;
            }
            source.connect(ctx.destination);
            activeBufferSource = source;

            const durationMs = Math.ceil((audioBuffer.duration / Math.pow(2, persona.detuneCents / 1200)) * 1000) + 1200;
            watchdogTimer = setTimeout(completeOnce, Math.max(3000, durationMs));

            source.onended = () => {
              if (activeBufferSource === source) activeBufferSource = null;
              completeOnce();
            };

            opts.onStart?.();
            source.start(0);
            return;
          }
        }
        speakWithBrowserFallback();
      } catch {
        if (generation === speakGeneration) {
          speakWithBrowserFallback();
        }
      }
    })();
  },

  stopSpeaking(): void {
    speakGeneration += 1;
    if (activeBufferSource) {
      try {
        activeBufferSource.onended = null;
        activeBufferSource.stop();
        activeBufferSource.disconnect();
      } catch {}
      activeBufferSource = null;
    }
    const synth = getSynth();
    if (!synth) return;
    try {
      synth.cancel();
    } catch {}
  },

  isSpeaking(): boolean {
    if (activeBufferSource !== null) return true;
    const synth = getSynth();
    if (!synth) return false;
    try {
      return !!synth.speaking;
    } catch {
      return false;
    }
  },

  listen(opts: ListenOptions): ListenHandle {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      opts.onError?.(new Error('Speech recognition is not supported in this browser.'));
      return { stop() {} };
    }

    unlockAudioOutput();

    if (activeRecognition) {
      try {
        activeRecognition.onend = null;
        activeRecognition.onresult = null;
        activeRecognition.onerror = null;
        activeRecognition.abort();
      } catch {}
      activeRecognition = null;
    }

    const silenceMs = typeof opts.silenceMs === 'number' && opts.silenceMs > 0 ? opts.silenceMs : 1500;
    const initialWaitMs = typeof opts.initialWaitMs === 'number' && opts.initialWaitMs > 0 ? opts.initialWaitMs : 45_000;

    let stopped = false;
    let ended = false;
    let deliveredFinal = false;
    let hasSpoken = false;
    let committedFinal = '';
    let latestInterim = '';

    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    let initialWaitTimer: ReturnType<typeof setTimeout> | null = null;

    const recognition = new Ctor();
    activeRecognition = recognition;
    recognition.lang = opts.lang || localeForImpl(storedLanguage());
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    const clearTimers = () => {
      if (silenceTimer !== null) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
      if (initialWaitTimer !== null) {
        clearTimeout(initialWaitTimer);
        initialWaitTimer = null;
      }
    };

    const getFullTranscript = (): string => {
      return `${committedFinal} ${latestInterim}`.replace(/\s+/g, ' ').trim();
    };

    const flushFinalIfAny = () => {
      if (deliveredFinal) return;
      const full = getFullTranscript();
      if (full) {
        deliveredFinal = true;
        opts.onResult(full, true);
      }
    };

    const finish = () => {
      if (ended) return;
      ended = true;
      listening = false;
      if (activeRecognition === recognition) activeRecognition = null;
      clearTimers();
      flushFinalIfAny();
      opts.onEnd?.();
    };

    const stopSession = () => {
      if (stopped) return;
      stopped = true;
      clearTimers();
      flushFinalIfAny();
      try {
        recognition.abort();
      } catch {}
      finish();
    };

    const armSpeechSilenceTimer = () => {
      if (silenceTimer !== null) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        stopSession();
      }, silenceMs);
    };

    const armInitialWaitTimer = () => {
      if (initialWaitTimer !== null) clearTimeout(initialWaitTimer);
      initialWaitTimer = setTimeout(() => {
        if (!hasSpoken) {
          stopSession();
        }
      }, initialWaitMs);
    };

    recognition.onstart = () => {
      listening = true;
      micPermissionGranted = true;
    };

    recognition.onresult = (event) => {
      let sessionFinal = '';
      let sessionInterim = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript ?? '';
        if (result.isFinal) sessionFinal += transcript;
        else sessionInterim += transcript;
      }

      if (sessionFinal.trim()) {
        committedFinal = sessionFinal.trim();
      }
      latestInterim = sessionInterim.trim();

      const full = getFullTranscript();
      if (full) {
        hasSpoken = true;
        if (initialWaitTimer !== null) {
          clearTimeout(initialWaitTimer);
          initialWaitTimer = null;
        }
        opts.onResult(full, false);
        armSpeechSilenceTimer();
      }
    };

    recognition.onerror = (event) => {
      const code = event?.error || 'recognition-error';
      if (code === 'aborted' || code === 'no-speech') return;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        stopped = true;
        clearTimers();
        opts.onError?.(code);
        finish();
        return;
      }
      opts.onError?.(code);
    };

    recognition.onend = () => {
      if (stopped) {
        finish();
        return;
      }
      if (hasSpoken && getFullTranscript()) {
        stopped = true;
        finish();
        return;
      }
      setTimeout(() => {
        if (stopped) return;
        try {
          recognition.start();
        } catch {
          finish();
        }
      }, 120);
    };

    try {
      recognition.start();
      listening = true;
      playCuteChime('listen');
      armInitialWaitTimer();
    } catch (err) {
      listening = false;
      opts.onError?.(err);
      finish();
      return { stop() {} };
    }

    return { stop: stopSession };
  },

  requestMicPermission,

  isListening(): boolean {
    return listening;
  },
};

export default voiceService;
