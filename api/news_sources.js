
import * as cheerio from 'cheerio';

// Helper for fetching
async function fetchHtml(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, text/html, */*'
        }
    });
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
    return await response.text();
}

const sources = {
    'rss': async (url) => {
        if (!url) throw new Error("URL is required for RSS source");
        const xml = await fetchHtml(url);
        const $ = cheerio.load(xml, { xmlMode: true });
        const news = [];

        $('item').each((i, el) => {
            if (i >= 30) return false;
            const $el = $(el);
            const title = $el.find('title').text();
            const link = $el.find('link').text();
            const pubDate = $el.find('pubDate').text();
            const description = $el.find('description').text();

            // Try to find an image if possible (media:content or encoded content)
            // For now, keep it simple

            // Image extraction logic
            let imageUrl = '';

            // 1. Try media:content / media:thumbnail
            const mediaContent = $el.find('media\\:content, content').attr('url');
            const mediaThumbnail = $el.find('media\\:thumbnail, thumbnail').attr('url');

            if (mediaContent) imageUrl = mediaContent;
            else if (mediaThumbnail) imageUrl = mediaThumbnail;

            // 2. Try enclosure
            if (!imageUrl) {
                const enclosure = $el.find('enclosure[type^="image"]');
                if (enclosure.length) imageUrl = enclosure.attr('url');
            }

            // 3. Try parsing description/content for <img> tag
            if (!imageUrl && description) {
                const match = description.match(/<img[^>]+src="([^">]+)"/);
                if (match) imageUrl = match[1];
            }

            // 4. Try content:encoded if description failed
            if (!imageUrl) {
                const contentEncoded = $el.find('content\\:encoded').text();
                if (contentEncoded) {
                    const match = contentEncoded.match(/<img[^>]+src="([^">]+)"/);
                    if (match) imageUrl = match[1];
                }
            }

            if (title && link) {
                // Simple date formatting
                let timeStr = pubDate;
                try {
                    const date = new Date(pubDate);
                    if (!isNaN(date.getTime())) {
                        timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }
                } catch (e) { }

                news.push({
                    id: link,
                    title: title,
                    url: link,
                    source: 'RSS',
                    metadata: description ? description.replace(/<[^>]*>?/gm, '').substring(0, 80) + '...' : '',
                    time: timeStr,
                    image: imageUrl
                });
            }
        });
        return news;
    }
};

export async function getNews(sourceId, url) {
    if (!sources[sourceId]) {
        throw new Error(`Source '${sourceId}' not found`);
    }
    try {
        return await sources[sourceId](url);
    } catch (error) {
        console.error(`Error fetching ${sourceId}:`, error);
        throw error;
    }
}
