export default async function handler(req, res) {
    const { path, ...queryParams } = req.query;

    if (!path) {
        return res.status(400).json({ error: 'Path required' });
    }

    // Reconstruct query string
    const queryString = new URLSearchParams(queryParams).toString();
    // Construct target URL. Note: vite config maps /api/nasdaq -> /api on nasdaq.com
    // But here we'll just map the captured path directly to https://api.nasdaq.com/api/...
    // If the captured path is "quote/AAPL/summary", target is "https://api.nasdaq.com/api/quote/AAPL/summary"
    const targetUrl = `https://api.nasdaq.com/api/${path}${queryString ? '?' + queryString : ''}`;

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://www.nasdaq.com',
                'Referer': 'https://www.nasdaq.com/',
                'Accept': 'application/json, text/plain, */*'
            }
        });

        const contentType = response.headers.get('content-type');
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            res.status(response.status).json(data);
        } else {
            const text = await response.text();
            res.status(response.status).send(text);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
