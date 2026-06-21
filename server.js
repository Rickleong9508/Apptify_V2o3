
import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
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

    // InvestSkill API Route: List available prompts
    app.get('/api/invest_skills/list', async (req, res) => {
        try {
            const promptsPath = path.join(__dirname, 'invest-skills');
            const files = await fs.promises.readdir(promptsPath);
            const markdownFiles = files
                .filter(file => file.endsWith('.md'))
                .map(file => {
                    const id = file.replace('.md', '');
                    // Generate a human-readable title
                    const title = id.split('-')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    return { id, title, fileName: file };
                });
            res.json({ success: true, prompts: markdownFiles });
        } catch (e) {
            console.error("InvestSkill List Error", e);
            res.status(500).json({ error: e.message });
        }
    });

    // InvestSkill API Route: Read a prompt template
    app.post('/api/invest_skills/read', express.json(), async (req, res) => {
        try {
            const { id } = req.body;
            if (!id) {
                return res.status(400).json({ error: 'id is required' });
            }
            const cleanId = path.basename(id);
            const promptPath = path.join(__dirname, 'invest-skills', `${cleanId}.md`);
            const content = await fs.promises.readFile(promptPath, 'utf-8');
            res.json({ success: true, content });
        } catch (e) {
            console.error("InvestSkill Read Error", e);
            res.status(500).json({ error: e.message });
        }
    });

    // InvestSkill API Route: Save generated HTML report
    app.post('/api/invest_skills/save_report', express.json({ limit: '10mb' }), async (req, res) => {
        try {
            const { fileName, htmlContent } = req.body;
            if (!fileName || !htmlContent) {
                return res.status(400).json({ error: 'fileName and htmlContent are required' });
            }

            // Safe filename check to avoid directory traversal
            const cleanFileName = path.basename(fileName);
            const reportPath = path.join(__dirname, cleanFileName);

            await fs.promises.writeFile(reportPath, htmlContent, 'utf-8');
            console.log(`Saved stock report: ${reportPath}`);
            res.json({ success: true, filePath: reportPath });
        } catch (e) {
            console.error("Save Report Error", e);
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
