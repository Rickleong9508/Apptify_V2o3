
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
            const { source, url, forceRefresh } = req.body;
            console.log(`Fetching news for source: ${source} ${url ? '(' + url + ')' : ''} (forceRefresh: ${!!forceRefresh})`);
            const news = await getNews(source, url, forceRefresh);
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

    // --- OBSIDIAN INTEGRATION HELPERS ---
    async function getMarkdownFiles(dir, rootDir, filesList = []) {
        const files = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const file of files) {
            const resPath = path.resolve(dir, file.name);
            if (file.name.startsWith('.')) continue;

            if (file.isDirectory()) {
                await getMarkdownFiles(resPath, rootDir, filesList);
            } else if (file.isFile() && file.name.endsWith('.md')) {
                const relativePath = path.relative(rootDir, resPath);
                filesList.push({ absolutePath: resPath, relativePath });
            }
        }
        return filesList;
    }

    function getSafePath(vaultPath, relativePath) {
        const resolvedVault = path.resolve(vaultPath);
        const resolvedFile = path.resolve(vaultPath, relativePath);
        if (!resolvedFile.startsWith(resolvedVault)) {
            throw new Error("Directory traversal detected.");
        }
        return resolvedFile;
    }

    function parseMarkdownFile(filePath, relativePath, fileContent, stats) {
        let title = path.basename(filePath, '.md');
        let content = fileContent;
        let metadata = {
            id: relativePath,
            title: title,
            content: content,
            date: stats.mtime.toISOString(),
            ai_processed: false,
            ai_summary: '',
            ai_keywords: [],
            ai_category: 'General'
        };

        const fmMatch = fileContent.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$/);
        if (fmMatch) {
            const yamlStr = fmMatch[1];
            content = fmMatch[2];
            metadata.content = content.trim();
            
            const lines = yamlStr.split('\n');
            lines.forEach(line => {
                const colonIdx = line.indexOf(':');
                if (colonIdx !== -1) {
                    const key = line.slice(0, colonIdx).trim().toLowerCase();
                    let val = line.slice(colonIdx + 1).trim();
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.slice(1, -1);
                    }
                    if (key === 'title') metadata.title = val;
                    else if (key === 'date' || key === 'created') metadata.date = val;
                    else if (key === 'category') metadata.ai_category = val;
                    else if (key === 'summary') metadata.ai_summary = val;
                    else if (key === 'keywords' || key === 'tags') {
                        if (val.startsWith('[') && val.endsWith(']')) {
                            try {
                                metadata.ai_keywords = JSON.parse(val.replace(/'/g, '"'));
                            } catch (e) {
                                metadata.ai_keywords = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
                            }
                        } else {
                            metadata.ai_keywords = val.split(',').map(s => s.trim()).filter(Boolean);
                        }
                    }
                }
            });
            metadata.ai_processed = true;
        }
        return metadata;
    }

    function generateMarkdownWithFrontmatter(title, content, date, category, keywords, summary) {
        const tags = Array.isArray(keywords) ? keywords : [];
        const dateStr = date || new Date().toISOString();
        return `---
title: "${title.replace(/"/g, '\\"')}"
date: "${dateStr}"
category: "${category || 'General'}"
summary: "${(summary || '').replace(/"/g, '\\"')}"
keywords: ${JSON.stringify(tags)}
---
${content}`;
    }

    // --- OBSIDIAN INTEGRATION API ROUTES ---
    app.post('/api/obsidian/status', express.json(), async (req, res) => {
        try {
            const { vaultPath } = req.body;
            if (!vaultPath) {
                return res.status(400).json({ error: 'vaultPath is required' });
            }
            const resolvedPath = path.resolve(vaultPath);
            const stats = await fs.promises.stat(resolvedPath);
            if (!stats.isDirectory()) {
                return res.status(400).json({ error: 'Provided path is not a directory.' });
            }
            res.json({ success: true, message: 'Vault folder found.' });
        } catch (e) {
            res.status(400).json({ error: `Invalid vault directory: ${e.message}` });
        }
    });

    app.post('/api/obsidian/notes', express.json(), async (req, res) => {
        try {
            const { vaultPath } = req.body;
            if (!vaultPath) {
                return res.status(400).json({ error: 'vaultPath is required' });
            }
            const resolvedVault = path.resolve(vaultPath);
            const files = await getMarkdownFiles(resolvedVault, resolvedVault);
            const notes = [];

            for (const file of files) {
                try {
                    const content = await fs.promises.readFile(file.absolutePath, 'utf-8');
                    const stats = await fs.promises.stat(file.absolutePath);
                    const noteMeta = parseMarkdownFile(file.absolutePath, file.relativePath, content, stats);
                    notes.push(noteMeta);
                } catch (err) {
                    console.error(`Error reading note ${file.relativePath}:`, err);
                }
            }
            res.json({ success: true, notes });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/obsidian/create', express.json({ limit: '10mb' }), async (req, res) => {
        try {
            const { vaultPath, title, content, category, keywords, summary, date } = req.body;
            if (!vaultPath || !title) {
                return res.status(400).json({ error: 'vaultPath and title are required' });
            }

            const cleanTitle = title.replace(/[/\\?%*:|"<>]/g, '-').trim();
            const folderName = category && category !== 'General' ? category.replace(/[/\\?%*:|"<>]/g, '-').trim() : '';
            const relativeDir = folderName;
            
            const vaultResolved = path.resolve(vaultPath);
            const finalDir = path.join(vaultResolved, relativeDir);
            await fs.promises.mkdir(finalDir, { recursive: true });

            const relativeFilePath = path.join(relativeDir, `${cleanTitle}.md`);
            const finalFilePath = getSafePath(vaultResolved, relativeFilePath);

            let targetPath = finalFilePath;
            let finalRelative = relativeFilePath;
            if (fs.existsSync(targetPath)) {
                const uniqueTitle = `${cleanTitle}_${Date.now()}`;
                finalRelative = path.join(relativeDir, `${uniqueTitle}.md`);
                targetPath = getSafePath(vaultResolved, finalRelative);
            }

            const markdown = generateMarkdownWithFrontmatter(title, content, date, category, keywords, summary);
            await fs.promises.writeFile(targetPath, markdown, 'utf-8');

            const stats = await fs.promises.stat(targetPath);
            res.json({
                success: true,
                note: {
                    id: finalRelative,
                    title,
                    content,
                    date: stats.mtime.toISOString(),
                    ai_processed: true,
                    ai_summary: summary || '',
                    ai_keywords: keywords || [],
                    ai_category: category || 'General'
                }
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/obsidian/update', express.json({ limit: '10mb' }), async (req, res) => {
        try {
            const { vaultPath, id, title, content, category, keywords, summary, date } = req.body;
            if (!vaultPath || !id) {
                return res.status(400).json({ error: 'vaultPath and id are required' });
            }

            const vaultResolved = path.resolve(vaultPath);
            const currentFilePath = getSafePath(vaultResolved, id);

            if (!fs.existsSync(currentFilePath)) {
                return res.status(404).json({ error: `Note not found: ${id}` });
            }

            let finalFilePath = currentFilePath;
            let finalId = id;
            const currentDir = path.dirname(currentFilePath);
            const cleanTitle = title.replace(/[/\\?%*:|"<>]/g, '-').trim();
            const expectedFileName = `${cleanTitle}.md`;

            if (path.basename(currentFilePath) !== expectedFileName) {
                finalFilePath = path.join(currentDir, expectedFileName);
                finalFilePath = getSafePath(vaultResolved, path.relative(vaultResolved, finalFilePath));
                await fs.promises.rename(currentFilePath, finalFilePath);
                finalId = path.relative(vaultResolved, finalFilePath);
            }

            const markdown = generateMarkdownWithFrontmatter(title, content, date, category, keywords, summary);
            await fs.promises.writeFile(finalFilePath, markdown, 'utf-8');

            const stats = await fs.promises.stat(finalFilePath);
            res.json({
                success: true,
                note: {
                    id: finalId,
                    title,
                    content,
                    date: stats.mtime.toISOString(),
                    ai_processed: true,
                    ai_summary: summary || '',
                    ai_keywords: keywords || [],
                    ai_category: category || 'General'
                }
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/obsidian/delete', express.json(), async (req, res) => {
        try {
            const { vaultPath, id } = req.body;
            if (!vaultPath || !id) {
                return res.status(400).json({ error: 'vaultPath and id are required' });
            }

            const vaultResolved = path.resolve(vaultPath);
            const filePath = getSafePath(vaultResolved, id);

            if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
            }
            res.json({ success: true });
        } catch (e) {
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
