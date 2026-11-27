import type { Language } from '../utils/i18n';

export interface DetectedLanguage {
  /** ISO-ish code used to drive replies */
  code: 'zh' | 'en' | 'ms' | 'ja' | 'ko';
  /** UI language subset for internal badges/fallbacks */
  uiLang: Language;
  /** Locale passed to Web Speech / Neural TTS */
  speechLocale: string;
  /** Explicit instruction name for the LLM */
  promptName: string;
}

export interface WebSearchSource {
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

export interface LiveQuote {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  change: number;
  changePct: number;
  marketTime: string;
  url: string;
}

export interface WebSearchResponse {
  success: boolean;
  query: string;
  results: WebSearchSource[];
  liveQuote?: LiveQuote | null;
  fetchedAt?: string;
}

/**
 * Automatically detect the user's message language so BingGo ALWAYS mirrors
 * the language the user actually spoke or typed — even if the UI toggle is set differently.
 */
export const detectMessageLanguage = (text: string, fallback: Language = 'en'): DetectedLanguage => {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    return fallback === 'zh'
      ? { code: 'zh', uiLang: 'zh', speechLocale: 'zh-CN', promptName: 'Chinese (中文)' }
      : { code: 'en', uiLang: 'en', speechLocale: 'en-US', promptName: 'English' };
  }

  // Japanese (Hiragana / Katakana)
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(trimmed)) {
    return { code: 'ja', uiLang: 'en', speechLocale: 'ja-JP', promptName: 'Japanese (日本語)' };
  }

  // Korean (Hangul)
  if (/[\uac00-\ud7af\u1100-\u11ff]/.test(trimmed)) {
    return { code: 'ko', uiLang: 'en', speechLocale: 'ko-KR', promptName: 'Korean (한국어)' };
  }

  // Chinese (CJK Unified Ideographs) — handles mixed Chinese + English terms like "查一下 Maybank 余额"
  const cjkMatches = trimmed.match(/[\u4e00-\u9fff]/g);
  if (cjkMatches && cjkMatches.length >= 1) {
    return { code: 'zh', uiLang: 'zh', speechLocale: 'zh-CN', promptName: 'Chinese (中文, matching Simplified/Traditional script of the user)' };
  }

  // Bahasa Melayu detection (common Malay function words)
  const malayHits = trimmed.toLowerCase().match(/\b(saya|awak|kamu|tolong|berapa|baki|duit|belanja|perbelanjaan|simpanan|hutang|gaji|bulan|ini|bagaimana|kenapa|apa|khabar|terima|kasih|boleh|tidak|macam|mana)\b/g);
  if (malayHits && malayHits.length >= 2) {
    return { code: 'ms', uiLang: 'en', speechLocale: 'ms-MY', promptName: 'Bahasa Melayu (Malay)' };
  }

  // Latin letters -> English
  if (/[a-zA-Z]/.test(trimmed)) {
    return { code: 'en', uiLang: 'en', speechLocale: 'en-US', promptName: 'English' };
  }

  return fallback === 'zh'
    ? { code: 'zh', uiLang: 'zh', speechLocale: 'zh-CN', promptName: 'Chinese (中文)' }
    : { code: 'en', uiLang: 'en', speechLocale: 'en-US', promptName: 'English' };
};

/**
 * Determine whether a user message likely needs live web search in "Auto" mode.
 * Avoids unnecessary web calls for personal App data queries or casual chat.
 */
export const shouldAutoWebSearch = (text: string): boolean => {
  const q = (text || '').trim();
  if (!q) return false;

  // Explicit request to search the internet
  if (/(联网|上网查|搜一下|帮我搜|查一下网|百度|谷歌|search the web|search online|look up online|google it|find online|web search)/i.test(q)) {
    return true;
  }

  // Personal app data / action commands should NOT auto-search the web unless explicitly asked above
  const isPersonalAppQuery =
    /(我的钱包|我的预算|我的资产|我的净值|我的贷款|我的待办|我的笔记|记一笔|存入|转账|新增|删除|my wallet|my budget|my net worth|my loan|my task|my note|spent rm|add task|create note)/i.test(q);
  if (isPersonalAppQuery) return false;

  // Real-time / fresh world facts, prices, FX, news, weather, current policies
  return /(今天|今日|最新|现在|实时|目前|刚刚|2025|2026|2027|汇率|股价|股票价格|天气|新闻|热搜|财报|利率|降息|加息|金价|比特币|黄金价格|油价|税率|减免|today|latest|current|live|real[- ]?time|news|weather|stock price|exchange rate|usd\/myr|sgd\/myr|bitcoin|btc|gold price|earnings|interest rate|inflation|release date|who won)/i.test(q);
};

export const searchWeb = async (query: string, lang: string = 'en', limit = 6): Promise<WebSearchResponse> => {
  try {
    const res = await fetch('/api/web_search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, lang, limit }),
    });
    if (!res.ok) {
      return { success: false, query, results: [] };
    }
    const data = await res.json();
    return {
      success: Boolean(data?.success),
      query: data?.query || query,
      results: Array.isArray(data?.results) ? data.results : [],
      liveQuote: data?.liveQuote || null,
      fetchedAt: data?.fetchedAt,
    };
  } catch (err) {
    console.warn('Live web search failed:', err);
    return { success: false, query, results: [] };
  }
};

export const formatWebSearchContext = (searchRes: WebSearchResponse): string => {
  const parts: string[] = [];

  if (searchRes.liveQuote) {
    const q = searchRes.liveQuote;
    const sign = q.change >= 0 ? '+' : '';
    parts.push(
      `[LIVE MARKET QUOTE]\n- ${q.name} (${q.symbol}): ${q.price} ${q.currency} (${sign}${q.change} / ${sign}${q.changePct}%) as of ${q.marketTime}\n- Source: ${q.url}`
    );
  }

  if (searchRes.results.length > 0) {
    const lines = searchRes.results.map(
      (r, i) => `${i + 1}. ${r.title} (${r.domain})\n   URL: ${r.url}\n   Snippet: ${r.snippet}`
    );
    parts.push(`[LIVE WEB SEARCH RESULTS for "${searchRes.query}"]\n${lines.join('\n')}`);
  }

  return parts.join('\n\n');
};
