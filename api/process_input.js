import * as cheerio from 'cheerio';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfInteraction = require('pdf-parse');

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

            // YouTube specific metadata
            const isVideo = content.includes('youtube.com') || content.includes('youtu.be') || content.includes('vimeo.com');

            if (isVideo) {
                // Try multiple sources for robust metadata
                const ogTitle = $('meta[property="og:title"]').attr('content');
                const metaTitle = $('meta[name="title"]').attr('content');
                const docTitle = $('title').text();

                const ogDesc = $('meta[property="og:description"]').attr('content');
                const metaDesc = $('meta[name="description"]').attr('content');

                const finalTitle = ogTitle || metaTitle || docTitle || "Untitled Video";
                const finalDesc = ogDesc || metaDesc || "No description available.";

                metadata = {
                    title: finalTitle,
                    description: finalDesc,
                    image: $('meta[property="og:image"]').attr('content'),
                    url: content
                };
                extractedText = `[VIDEO LINK ANALYSIS]\nTitle: ${finalTitle}\nDescription: ${finalDesc}\nURL: ${content}\n\n(Note: This is metadata only. The AI cannot watch the video but can discuss the topic based on this title and description.)`;
            } else {
                extractedText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 20000); // Limit text length
                metadata = {
                    title: $('title').text() || content,
                    url: content
                };
            }

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
