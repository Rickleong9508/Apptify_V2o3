
import * as cheerio from 'cheerio';

async function testYoutubeExtract(url) {
    console.log(`Testing URL: ${url}`);
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        if (!response.ok) {
            console.error(`Failed to fetch: ${response.status} ${response.statusText}`);
            return;
        }

        const html = await response.text();
        console.log(`Fetched ${html.length} bytes.`);

        const $ = cheerio.load(html);
        const title = $('meta[name="title"]').attr('content') || $('title').text();
        const description = $('meta[name="description"]').attr('content');

        console.log('--- Extracted Data ---');
        console.log('Title:', title);
        console.log('Description:', description);

    } catch (e) {
        console.error('Error:', e);
    }
}

testYoutubeExtract('https://www.youtube.com/watch?v=UVrfBw44sQ8');
