import * as cheerio from 'cheerio';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const extractDomain = (rawUrl) => {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const cleanDuckDuckGoUrl = (href) => {
  if (!href) return '';
  try {
    if (href.includes('uddg=')) {
      const parsed = new URL(href.startsWith('http') ? href : `https://duckduckgo.com${href}`);
      const target = parsed.searchParams.get('uddg');
      if (target) return decodeURIComponent(target);
    }
    if (href.startsWith('//')) return `https:${href}`;
    return href;
  } catch {
    return href;
  }
};

async function searchDuckDuckGoHtml(query, limit = 6) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(6500),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const $ = cheerio.load(html);
  const items = [];

  $('.result').each((_, el) => {
    if (items.length >= limit) return;
    const anchor = $(el).find('a.result__a').first();
    const title = anchor.text().trim();
    const rawHref = anchor.attr('href') || '';
    const link = cleanDuckDuckGoUrl(rawHref);
    const snippet = $(el).find('.result__snippet').first().text().trim();

    if (title && link && /^https?:\/\//i.test(link)) {
      items.push({
        title,
        url: link,
        snippet: snippet || title,
        domain: extractDomain(link),
      });
    }
  });

  return items;
}

async function searchBingRss(query, limit = 6) {
  const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(6500),
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];

  $('item').each((_, el) => {
    if (items.length >= limit) return;
    const title = $(el).find('title').first().text().trim();
    const link = $(el).find('link').first().text().trim();
    const snippet = $(el).find('description').first().text().trim();
    if (title && link && /^https?:\/\//i.test(link)) {
      items.push({
        title,
        url: link,
        snippet: snippet || title,
        domain: extractDomain(link),
      });
    }
  });

  return items;
}

async function searchGoogleNewsRss(query, lang = 'en', limit = 5) {
  const isZh = lang === 'zh' || /[\u4e00-\u9fff]/.test(query);
  const hl = isZh ? 'zh-CN' : 'en-US';
  const gl = isZh ? 'CN' : 'US';
  const ceid = isZh ? 'CN:zh-Hans' : 'US:en';
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(6500),
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];

  $('item').each((_, el) => {
    if (items.length >= limit) return;
    const title = $(el).find('title').first().text().trim();
    const link = $(el).find('link').first().text().trim();
    const pubDate = $(el).find('pubDate').first().text().trim();
    const source = $(el).find('source').first().text().trim();
    if (title && link) {
      items.push({
        title,
        url: link,
        snippet: [source, pubDate].filter(Boolean).join(' · ') || title,
        domain: source || extractDomain(link),
      });
    }
  });

  return items;
}

/**
 * Optional live Yahoo Finance quote lookup when the query mentions FX pairs or stock symbols.
 */
async function tryLiveFinanceQuote(query) {
  const upper = query.toUpperCase();
  let symbol = null;

  // Common FX pairs
  if (/(USD\s*[/\-to ]*\s*MYR|美元.*马币|马币.*美元|美元汇率)/.test(query) || /USD\/?MYR/.test(upper)) {
    symbol = 'MYR=X';
  } else if (/(SGD\s*[/\-to ]*\s*MYR|新币.*马币|新加坡元.*马币)/.test(query) || /SGD\/?MYR/.test(upper)) {
    symbol = 'SGDMYR=X';
  } else if (/(CNY|RMB)\s*[/\-to ]*\s*MYR|人民币.*马币/.test(query)) {
    symbol = 'CNYMYR=X';
  } else if (/(HKD\s*[/\-to ]*\s*MYR|港币.*马币)/.test(query)) {
    symbol = 'HKDMYR=X';
  } else if (/(USD\s*[/\-to ]*\s*(CNY|RMB)|美元.*人民币)/.test(query)) {
    symbol = 'CNY=X';
  } else if (/(BTC|BITCOIN|比特币)/.test(upper)) {
    symbol = 'BTC-USD';
  } else if (/(GOLD|黄金价格|金价)/.test(upper)) {
    symbol = 'GC=F';
  } else {
    // Explicit ticker match when query asks about stock/price
    const asksMarket = /(stock|price|share|ticker|quote|股价|股票|市值|行情|财报)/i.test(query);
    if (asksMarket) {
      const m = upper.match(/\b(NVDA|AAPL|MSFT|GOOGL|GOOG|AMZN|META|TSLA|AMD|TSM|NFLX|AVGO|PLTR|BABA|TCEHY|SPY|QQQ|VOO|\d{4}\.KL)\b/);
      if (m) symbol = m[1];
    }
  }

  if (!symbol) return null;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta || meta.regularMarketPrice === undefined) return null;

    const price = Number(meta.regularMarketPrice);
    const prevClose = Number(meta.chartPreviousClose || meta.previousClose || price);
    const change = price - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

    return {
      symbol: meta.symbol || symbol,
      name: meta.shortName || meta.longName || symbol,
      price,
      currency: meta.currency || '',
      change: Number(change.toFixed(4)),
      changePct: Number(changePct.toFixed(2)),
      marketTime: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
      url: `https://finance.yahoo.com/quote/${encodeURIComponent(meta.symbol || symbol)}`,
    };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const query = String(req.body?.query || req.query?.q || '').trim();
    const lang = String(req.body?.lang || req.query?.lang || 'en');
    const limit = Math.min(8, Math.max(3, Number(req.body?.limit || 6)));

    if (!query) {
      return res.status(400).json({ success: false, error: 'query is required', results: [] });
    }

    const [ddgRes, bingRes, liveQuote] = await Promise.allSettled([
      searchDuckDuckGoHtml(query, limit),
      searchBingRss(query, limit),
      tryLiveFinanceQuote(query),
    ]);

    const combined = [];
    const seen = new Set();

    const pushUnique = (list) => {
      for (const item of list || []) {
        const key = item.url.replace(/\/$/, '').toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(item);
        }
      }
    };

    if (ddgRes.status === 'fulfilled') pushUnique(ddgRes.value);
    if (bingRes.status === 'fulfilled') pushUnique(bingRes.value);

    // Fallback to Google News RSS if web search returned sparse results or query looks newsy
    const wantsNews = /(新闻|最新|今日|今天|刚刚|news|latest|today|update|headline)/i.test(query);
    if (combined.length < 3 || wantsNews) {
      try {
        const newsItems = await searchGoogleNewsRss(query, lang, 4);
        pushUnique(newsItems);
      } catch {
        // ignore fallback failure
      }
    }

    const quote = liveQuote.status === 'fulfilled' ? liveQuote.value : null;

    return res.status(200).json({
      success: true,
      query,
      results: combined.slice(0, limit),
      liveQuote: quote,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Web Search API Error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Web search failed',
      results: [],
    });
  }
}
