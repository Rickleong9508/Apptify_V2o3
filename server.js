
import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import processInputHandler from './api/process_input.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createServer() {
    const app = express();

    // Middleware to parse JSON bodies (limit 10mb as per config)
    app.use(express.json({ limit: '10mb' }));

    // Create Vite server in middleware mode
    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
    });

    // API Route Handler
    app.post('/api/process_input', async (req, res) => {
        console.log('API Request received: /api/process_input');
        try {
            await processInputHandler(req, res);
        } catch (e) {
            console.error("API Handler Error", e);
            res.status(500).json({ error: e.message });
        }
    });

    // Use vite's connect instance as middleware
    app.use(vite.middlewares);

    const port = 3001;
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
        console.log(`> API endpoint ready at http://localhost:${port}/api/process_input`);
    });
}

createServer();
