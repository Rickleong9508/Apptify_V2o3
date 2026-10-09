/**
 * voiceService — browser-native voice I/O for the BingGo assistant.
 *
 * Scope: `window.speechSynthesis` (TTS) + `SpeechRecognition`/`webkitSpeechRecognition`
 * (STT). No dependencies, no API keys, no network calls.
 *
 * Every entry point degrades gracefully: on an unsupported browser (or during SSR)
 * the `isXSupported()` probes return `false` and `speak()`/`listen()` no-op while
 * reporting through the `onError` callback. Nothing in here ever throws.
 *
 * Browser quirks this file works around (each noted again at the call site):
 *  - Chrome/Safari drop or clip utterances longer than roughly 200 characters, so
 *    text is split into sentence-sized chunks and queued.
 *  - `speechSynthesis.getVoices()` is empty until the async `voiceschanged` event
 *    fires, so voice selection always has a `null` fallback.
 *  - `cancel()` immediately followed by `speak()` can silently drop the new
 *    utterance, so speaking is deferred by one tick with a generation guard.
 *  - Recognition fires `onend` after short pauses even with `continuous = true`,
 *    so the session is restarted unless the caller explicitly stopped it.
 *  - The DOM lib still lacks SpeechRecognition types, hence the local declarations.
 */

import { getStoredLanguage } from '../utils/i18n';

export interface SpeakOptions {
  lang?: string;            // 'en-US' | 'zh-CN' | ...
  rate?: number;            // default 1
  pitch?: number;           // default 1
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

export interface ListenHandle { stop(): void; }

export interface ListenOptions {
  lang?: string;
  /** Called on every interim result and once more with isFinal true. */
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (err: unknown) => void;
  onEnd?: () => void;
  /** Stop automatically after this much silence. Default 1400ms. */
  silenceMs?: number;
}

/* ------------------------------------------------------------------ *
 * Minimal local Web Speech API declarations (recognition side).
 * Only the members this service actually touches are declared.
 * ------------------------------------------------------------------ */

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

/** Shape of the vendor-prefixed globals we probe, without resorting to `any`. */
interface SpeechWindow {
  speechSynthesis?: SpeechSynthesis;
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

/* ------------------------------------------------------------------ *
 * Environment helpers
 * ------------------------------------------------------------------ */

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

/** i18n reads localStorage directly, so never call it outside the browser. */
const storedLanguage = (): 'en' | 'zh' => {
  if (typeof window === 'undefined') return 'en';
  try {
    return getStoredLanguage();
  } catch {
    return 'en';
  }
};

/* ------------------------------------------------------------------ *
 * Text preparation
 * ------------------------------------------------------------------ */

/**
 * Assistant replies are markdown; a raw read-out says "asterisk asterisk".
 * Fenced code blocks are removed entirely (reading code aloud is noise);
 * everything else keeps its human-readable text.
 */
const stripMarkdown = (input: string): string => {
  if (!input) return '';
  let out = input.replace(/\r\n?/g, '\n');
  out = out.replace(/```[\s\S]*?```/g, ' ');                                  // fenced code
  out = out.replace(/~~~[\s\S]*?~~~/g, ' ');
  out = out.replace(/`([^`\n]*)`/g, '$1');                                    // inline code
  out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');                         // images -> alt
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');                          // links -> label
  out = out.replace(/<https?:\/\/[^>\s]+>/g, ' ');                            // autolinks
  out = out.replace(/https?:\/\/\S+/g, ' ');                                  // bare urls
  out = out.replace(/^[ \t]{0,3}#{1,6}[ \t]*/gm, '');                         // headings
  out = out.replace(/^[ \t]{0,3}(?:[-*_][ \t]*){3,}$/gm, ' ');                // rules
  out = out.replace(/^[ \t]{0,3}>[ \t]?/gm, '');                              // blockquote
  out = out.replace(/^[ \t]{0,3}(?:[-*+\u2022\u2023\u25E6]|\d{1,3}[.)])[ \t]+/gm, ''); // lists
  out = out.replace(/\|/g, ' ');                                              // tables
  out = out.replace(/[*_~]{1,3}/g, '');                                       // emphasis
  out = out.replace(/<\/?[a-zA-Z][^>]*>/g, ' ');                              // html tags
  out = out.replace(/[ \t]{2,}/g, ' ');
  out = out.replace(/\n{2,}/g, '. ');                                         // paragraph pause
  out = out.replace(/\n/g, ' ');
  return out.replace(/\s{2,}/g, ' ').trim();
};

/** Utterances above roughly this length get clipped by some engines. */
const MAX_CHUNK_CHARS = 190;

/**
 * Split on sentence boundaries first, then hard-split any single sentence that
 * is still longer than the limit (CJK has no spaces, so prefer a space break
 * only when one is reasonably close to the limit).
 */
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
        if (cut < limit * 0.5) cut = limit; // no usable space (e.g. CJK) -> hard cut
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

/* ------------------------------------------------------------------ *
 * Service
 * ------------------------------------------------------------------ */

/** Bumped on every speak/stop so a deferred utterance can detect cancellation. */
let speakGeneration = 0;
/** Tracks whether any recognition session (including restarts) is live. */
let listening = false;

/** BCP-47 tag for the app's two languages. */
const localeForImpl = (lang: 'en' | 'zh'): string => (lang === 'zh' ? 'zh-CN' : 'en-US');

/**
 * Prefer an exact locale match (`zh-CN`), then any voice sharing the primary
 * subtag (`zh-TW`), preferring on-device voices over network ones.
 * Returns null while `getVoices()` is still empty (voices load async and the
 * browser signals readiness with the `voiceschanged` event) — callers should
 * simply speak without an explicit voice then.
 */
const pickVoiceImpl = (locale: string): SpeechSynthesisVoice | null => {
  const synth = getSynth();
  if (!synth || !locale) return null;
  let voices: SpeechSynthesisVoice[] = [];
  try {
    voices = synth.getVoices() || [];
  } catch {
    return null;
  }
  if (!voices.length) return null;

  const normalize = (value: string) => (value || '').toLowerCase().replace(/_/g, '-');
  const target = normalize(locale);
  const primary = target.split('-')[0];

  const exact = voices.find((voice) => normalize(voice.lang) === target);
  if (exact) return exact;

  const sameLanguage = voices.filter((voice) => normalize(voice.lang).startsWith(primary));
  if (!sameLanguage.length) return null;
  return sameLanguage.find((voice) => voice.localService) ?? sameLanguage[0];
};

export const voiceService = {
  /**
   * `speechSynthesis` exists in every modern browser, but not in SSR, old
   * WebViews, or when the API is disabled by policy — hence the probe.
   */
  isSpeechSupported(): boolean {
    return getSynth() !== null;
  },

  /** Chrome/Safari expose the constructor only with a `webkit` prefix. */
  isRecognitionSupported(): boolean {
    return getRecognitionCtor() !== null;
  },

  /** Resolve a BCP-47 tag from the app language. */
  localeFor(lang: 'en' | 'zh'): string {
    return localeForImpl(lang);
  },

  /** See `pickVoiceImpl` above for the matching strategy. */
  pickVoice(locale: string): SpeechSynthesisVoice | null {
    return pickVoiceImpl(locale);
  },

  /**
   * Cancel anything in flight, strip markdown, chunk, then queue the utterances.
   * `onStart`/`onEnd` bracket the whole queue, not each chunk.
   */
  speak(text: string, opts: SpeakOptions = {}): void {
    const synth = getSynth();
    if (!synth) {
      opts.onError?.(new Error('Speech synthesis is not supported in this browser.'));
      return;
    }

    const clean = stripMarkdown(text ?? '');
    const chunks = chunkText(clean);
    if (!chunks.length) {
      opts.onEnd?.();
      return;
    }

    speakGeneration += 1;
    const generation = speakGeneration;
    const lang = opts.lang || localeForImpl(storedLanguage());
    const rate = typeof opts.rate === 'number' && opts.rate > 0 ? opts.rate : 1;
    const pitch = typeof opts.pitch === 'number' && opts.pitch > 0 ? opts.pitch : 1;

    // Chrome can drop an utterance queued in the same task as cancel().
    try {
      synth.cancel();
    } catch {
      /* some engines throw when cancelling with an empty queue */
    }

    const voice = pickVoiceImpl(lang);

    const startQueue = () => {
      if (generation !== speakGeneration) return; // superseded by a newer speak/stop
      chunks.forEach((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.lang = lang;
        utterance.rate = rate;
        utterance.pitch = pitch;
        if (voice) utterance.voice = voice;
        if (index === 0) {
          utterance.onstart = () => {
            if (generation === speakGeneration) opts.onStart?.();
          };
        }
        utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
          if (generation !== speakGeneration) return;
          opts.onError?.(event.error || 'speech-error');
        };
        if (index === chunks.length - 1) {
          utterance.onend = () => {
            if (generation === speakGeneration) opts.onEnd?.();
          };
        }
        synth.speak(utterance);
      });
    };

    setTimeout(startQueue, 0);
  },

  stopSpeaking(): void {
    speakGeneration += 1; // invalidate any deferred queue
    const synth = getSynth();
    if (!synth) return;
    try {
      synth.cancel();
    } catch {
      /* ignore */
    }
  },

  /**
   * Note: some engines keep reporting `speaking === true` while paused; this
   * intentionally reports "audio is active" rather than "not paused".
   */
  isSpeaking(): boolean {
    const synth = getSynth();
    if (!synth) return false;
    try {
      return !!synth.speaking;
    } catch {
      return false;
    }
  },

  /**
   * Start one recognition session. `continuous` + `interimResults` are enabled,
   * the session restarts itself after the browser's premature `onend`, and a
   * sliding silence timer stops it once the user has been quiet for `silenceMs`.
   */
  listen(opts: ListenOptions): ListenHandle {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      opts.onError?.(new Error('Speech recognition is not supported in this browser.'));
      return { stop() { /* nothing to stop */ } };
    }

    const silenceMs = typeof opts.silenceMs === 'number' && opts.silenceMs > 0 ? opts.silenceMs : 1400;
    let stopped = false;          // caller asked to stop (or a fatal error)
    let ended = false;            // onEnd already delivered
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;

    const recognition = new Ctor();
    recognition.lang = opts.lang || localeForImpl(storedLanguage());
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    const clearSilenceTimer = () => {
      if (silenceTimer !== null) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
    };

    const finish = () => {
      if (ended) return;
      ended = true;
      listening = false;
      clearSilenceTimer();
      opts.onEnd?.();
    };

    const stopSession = () => {
      if (stopped) return;
      stopped = true;
      clearSilenceTimer();
      try {
        recognition.stop();
      } catch {
        try {
          recognition.abort();
        } catch {
          /* ignore */
        }
        finish(); // no onend will arrive if stop() itself failed
      }
      // Safety net: if onend never fires after stop(), still report the end.
      setTimeout(() => {
        if (stopped) finish();
      }, 800);
    };

    const handle: ListenHandle = { stop: stopSession };

    const armSilenceTimer = () => {
      clearSilenceTimer();
      silenceTimer = setTimeout(() => {
        stopSession(); // quiet for silenceMs -> end the turn
      }, silenceMs);
    };

    recognition.onstart = () => {
      listening = true;
      armSilenceTimer();
    };

    recognition.onresult = (event) => {
      armSilenceTimer(); // every result (interim or final) resets the quiet timer
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript ?? '';
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (interimText) {
        opts.onResult((finalText || interimText).trim(), false);
      }
      if (finalText) {
        opts.onResult(finalText.trim(), true);
      }
    };

    recognition.onerror = (event) => {
      const code = event?.error || 'recognition-error';
      // 'aborted' is the expected echo of our own stop()/abort() call.
      if (code === 'aborted' && stopped) return;
      // Permission failures are terminal: restarting would loop on the prompt.
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        stopped = true;
        clearSilenceTimer();
        opts.onError?.(code);
        finish();
        return;
      }
      opts.onError?.(code);
    };

    recognition.onend = () => {
      clearSilenceTimer();
      if (stopped) {
        finish();
        return;
      }
      // Browsers end the session after a short pause despite continuous=true.
      setTimeout(() => {
        if (stopped) return;
        try {
          recognition.start();
        } catch {
          /* InvalidStateError: already restarted */
        }
      }, 150);
    };

    try {
      recognition.start();
      listening = true;
    } catch (err) {
      listening = false;
      opts.onError?.(err);
      finish();
      return { stop() { /* never started */ } };
    }

    // Idle guard: if nothing (not even onstart) arrives, end the session.
    armSilenceTimer();

    return handle;
  },

  isListening(): boolean {
    return listening;
  },
};

export default voiceService;
