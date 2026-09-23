/**
 * api/read.js — Vercel Serverless Function to fetch Project Gutenberg text reliably.
 * Solves public CORS proxy 403/rate-limit errors when reading books on Vercel.
 */
export default async function handler(req, res) {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url query parameter' });
  }

  // Security: only allow proxying to gutenberg.org or standard book sources
  try {
    const parsed = new URL(targetUrl);
    if (!parsed.hostname.endsWith('gutenberg.org') && !parsed.hostname.endsWith('archive.org')) {
      return res.status(403).json({ error: 'Target domain not permitted' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BookshelfApp/1.0',
        'Accept': 'text/html,text/plain,*/*'
      }
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `Upstream source returned HTTP ${upstream.status}`
      });
    }

    const contentType = upstream.headers.get('content-type') || 'text/plain; charset=utf-8';
    const text = await upstream.text();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400');
    return res.status(200).send(text);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal proxy error' });
  }
}
