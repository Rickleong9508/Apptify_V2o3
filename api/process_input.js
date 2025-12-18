import * as cheerio from 'cheerio';
import pdfInteraction from 'pdf-parse/lib/pdf-parse.js';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { type, content, options } = req.body;

    if (!content) {
        return res.status(400).json({ error: 'Content is required' });
    }

    try {
        let extractedText = '';
        let metadata = {};

        if (type === 'url') {
            const response = await fetch(content, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch URL: ${response.statusText}`);
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            // Remove unwanted elements
            $('script, style, nav, footer, header, noscript, iframe, .ad, .ads, .sidebar').remove();

            extractedText = $('body').text().replace(/\s+/g, ' ').trim();
            metadata = {
                title: $('title').text() || content,
                url: content
            };

        } else if (type === 'pdf') {
            // Content is expected to be base64 string
            const buffer = Buffer.from(content, 'base64');
            const data = await pdfInteraction(buffer);
            
            extractedText = data.text.replace(/\s+/g, ' ').trim();
            metadata = {
                pageCount: data.numpages,
                info: data.info
            };
        } else if (type === 'doc' || type === 'txt') {
             // Basic text decoding for now, extendable for docx later
             const buffer = Buffer.from(content, 'base64');
             extractedText = buffer.toString('utf-8');
        } else {
            return res.status(400).json({ error: 'Unsupported type' });
        }

        return res.status(200).json({
            text: extractedText,
            metadata
        });

    } catch (error) {
        console.error('Processing error:', error);
        return res.status(500).json({ error: error.message });
    }
}
