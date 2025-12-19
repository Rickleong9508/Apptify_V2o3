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
                // 1. Try Transcript (Best for "Reading" content)
                try {
                    const { YoutubeTranscript } = await import('youtube-transcript');
                    const transcriptItems = await YoutubeTranscript.fetchTranscript(content);
                    const transcriptText = transcriptItems.map(item => item.text).join(' ');

                    // Get metadata for title via oEmbed (public & reliable)
                    let title = "YouTube Video";
                    try {
                        const oembedParams = new URLSearchParams({ url: content, format: 'json' });
                        const oembedRes = await fetch(`https://www.youtube.com/oembed?${oembedParams.toString()}`);
                        if (oembedRes.ok) {
                            const oembedData = await oembedRes.json();
                            title = oembedData.title;
                            metadata = {
                                title: oembedData.title,
                                author: oembedData.author_name,
                                image: oembedData.thumbnail_url,
                                url: content
                            };
                        }
                    } catch (e) { }

                    extractedText = `[VIDEO TRANSCRIPT ANALYSIS]\nVideo Title: ${title}\nURL: ${content}\n\n--- TRANSCRIPT ---\n${transcriptText.slice(0, 20000)}\n... (truncated if too long)`;

                } catch (transcriptError) {
                    console.log("Transcript failed, falling back to metadata", transcriptError.message);

                    // 2. Fallback to oEmbed Metadata (Reliable Title/Author)
                    let finalTitle = "Untitled Video";
                    let finalDesc = "No description available (Transcript unavailable).";

                    try {
                        const oembedParams = new URLSearchParams({ url: content, format: 'json' });
                        const oembedRes = await fetch(`https://www.youtube.com/oembed?${oembedParams.toString()}`);
                        if (oembedRes.ok) {
                            const oembedData = await oembedRes.json();
                            finalTitle = oembedData.title;
                            metadata = {
                                title: finalTitle,
                                image: oembedData.thumbnail_url,
                                author: oembedData.author_name,
                                url: content
                            };
                            // oEmbed doesn't give description, but better than nothing.
                            finalDesc = `By ${oembedData.author_name}`;
                        } else {
                            // 3. Last Resort: Cheerio Scraping (Flaky)
                            const ogTitle = $('meta[property="og:title"]').attr('content');
                            const metaTitle = $('meta[name="title"]').attr('content');
                            const docTitle = $('title').text();
                            const ogDesc = $('meta[property="og:description"]').attr('content');

                            finalTitle = ogTitle || metaTitle || docTitle || finalTitle;
                            finalDesc = ogDesc || finalDesc;

                            metadata = {
                                title: finalTitle,
                                description: finalDesc,
                                image: $('meta[property="og:image"]').attr('content'),
                                url: content
                            };
                        }
                    } catch (e) { console.error("oEmbed failed", e); }

                    extractedText = `[VIDEO METADATA ONLY]\nTitle: ${finalTitle}\nDescription: ${finalDesc}\nURL: ${content}\n\n(Note: The AI could not retrieve the video transcript/subtitles. It can only discuss the metadata.)`;
                }

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
