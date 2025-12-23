import { getNews } from './news_sources.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { source, url } = req.body;
        console.log(`Fetching news for source: ${source} ${url ? '(' + url + ')' : ''}`);
        const news = await getNews(source, url);
        res.status(200).json(news);
    } catch (e) {
        console.error("News API Error", e);
        res.status(500).json({ error: e.message });
    }
}
