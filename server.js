
import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import processInputHandler from './api/process_input.js';
import { getNews } from './api/news_sources.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createServer() {
    const app = express();

    // Create Vite server in middleware mode
    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
    });

    // API Route Handler (Parse JSON ONLY for this route to avoid breaking proxies)
    app.post('/api/process_input', express.json({ limit: '10mb' }), async (req, res) => {
        console.log('API Request received: /api/process_input');
        try {
            await processInputHandler(req, res);
        } catch (e) {
            console.error("API Handler Error", e);
            res.status(500).json({ error: e.message });
        }
    });

    // NewsHub API Route
    app.post('/api/news', express.json(), async (req, res) => {
        try {
            const { source, url } = req.body;
            console.log(`Fetching news for source: ${source} ${url ? '(' + url + ')' : ''}`);
            const news = await getNews(source, url);
            res.json(news);
        } catch (e) {
            console.error("News API Error", e);
            res.status(500).json({ error: e.message });
        }
    });

    // Use vite's connect instance as middleware
    app.use(vite.middlewares);

    const port = 3001;
    app.listen(port, () => {
        console.log(`\n\n=== SERVER RESTARTED (FIXED PROXY) ===`);
        console.log(`Server running at http://localhost:${port}`);
        console.log(`> API endpoint ready at http://localhost:${port}/api/process_input\n`);
    });
}

createServer();
