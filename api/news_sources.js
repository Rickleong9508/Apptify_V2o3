import * as cheerio from 'cheerio';

// In-memory cache for news feeds with 60s TTL for real-time freshness
const cache = {};
const CACHE_TTL_MS = 60 * 1000; // 60 seconds cache

// Clean HTML strings and unescape common entities
function cleanText(raw) {
    if (!raw) return '';
    return raw
        .replace(/<[^>]*>?/gm, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

// Format date into human-readable relative or short local format
function formatPubDate(pubDateStr) {
    if (!pubDateStr) return '刚刚';
    try {
        const date = new Date(pubDateStr);
        if (isNaN(date.getTime())) return pubDateStr;
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);

        if (diffMin < 1) return '刚刚更新 (Just now)';
        if (diffMin < 60) return `${diffMin} 分钟前 (${diffMin}m ago)`;
        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) return `${diffHours} 小时前 (${diffHours}h ago)`;

        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' ' + 
               date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return pubDateStr;
    }
}

// Robust fetch with 8-second timeout & real browser User-Agent
async function fetchHtml(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*'
            }
        });
        clearTimeout(timeout);
        if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
        return await response.text();
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

const sources = {
    'rss': async (url) => {
        if (!url) throw new Error("URL is required for RSS source");
        const xml = await fetchHtml(url);
        const $ = cheerio.load(xml, { xmlMode: true });
        const news = [];

        // Support both RSS <item> and Atom <entry>
        const nodes = $('item').length > 0 ? $('item') : $('entry');

        nodes.each((i, el) => {
            if (i >= 40) return false;
            const $el = $(el);

            // Title & Link
            let title = cleanText($el.find('title').first().text());
            let link = $el.find('link').text() || $el.find('link').attr('href') || '';
            const pubDate = $el.find('pubDate, published, updated').first().text();
            const rawDescription = $el.find('description, summary, content').first().text();

            // Extract source name (e.g. from <source> tag in Google News or BBC)
            let sourceName = $el.find('source').first().text() || '';
            if (!sourceName) {
                try {
                    const parsedUrl = new URL(link || url);
                    sourceName = parsedUrl.hostname.replace(/^www\./, '').split('.')[0].toUpperCase();
                } catch {
                    sourceName = 'NEWS';
                }
            }

            // Remove trailing source from Google News title if redundant (e.g. "Title - The Verge")
            if (title.includes(' - ') && sourceName && title.endsWith(sourceName)) {
                title = title.substring(0, title.lastIndexOf(' - ')).trim();
            }

            // Image extraction logic
            let imageUrl = '';

            // 1. media:content / media:thumbnail
            const mediaContent = $el.find('media\\:content, content[url]').attr('url');
            const mediaThumbnail = $el.find('media\\:thumbnail, thumbnail[url]').attr('url');
            if (mediaContent) imageUrl = mediaContent;
            else if (mediaThumbnail) imageUrl = mediaThumbnail;

            // 2. enclosure
            if (!imageUrl) {
                const enclosure = $el.find('enclosure[type^="image"], enclosure[url]');
                if (enclosure.length) imageUrl = enclosure.attr('url') || '';
            }

            // 3. Extract <img> from description or content:encoded
            if (!imageUrl && rawDescription) {
                const match = rawDescription.match(/<img[^>]+src=["']([^"']+)["']/i);
                if (match && match[1]) imageUrl = match[1];
            }

            if (!imageUrl) {
                const contentEncoded = $el.find('content\\:encoded').text();
                if (contentEncoded) {
                    const match = contentEncoded.match(/<img[^>]+src=["']([^"']+)["']/i);
                    if (match && match[1]) imageUrl = match[1];
                }
            }

            // Clean clean metadata text
            const metaClean = cleanText(rawDescription);
            const metadata = metaClean ? (metaClean.length > 120 ? metaClean.substring(0, 120) + '...' : metaClean) : '';

            if (title && link) {
                news.push({
                    id: link || `news_${i}_${Date.now()}`,
                    title: title,
                    url: link,
                    source: sourceName,
                    metadata: metadata,
                    time: formatPubDate(pubDate),
                    timestamp: pubDate ? new Date(pubDate).getTime() || 0 : 0,
                    image: imageUrl
                });
            }
        });

        // Sort by timestamp if available to guarantee freshest on top
        news.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        return news;
    }
};

export async function getNews(sourceId, url, forceRefresh = false) {
    if (!sources[sourceId]) {
        throw new Error(`Source '${sourceId}' not found`);
    }

    const cacheKey = url ? `${sourceId}:${url}` : sourceId;
    const cached = cache[cacheKey];

    // If cache is fresh and not forced, return cached data
    if (!forceRefresh && cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        return cached.data;
    }

    try {
        const data = await sources[sourceId](url);
        cache[cacheKey] = {
            timestamp: Date.now(),
            data: data
        };
        return data;
    } catch (error) {
        console.error(`Error fetching ${sourceId} (${url}):`, error.message);
        // Fallback to cached data even if expired if fetch fails
        if (cached && cached.data && cached.data.length > 0) {
            console.warn(`Returning stale cache for ${cacheKey}`);
            return cached.data;
        }
        throw error;
    }
}
