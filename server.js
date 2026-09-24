import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;

// Prevent uncaught exceptions from terminating the dev server
process.on('uncaughtException', (err) => {
  console.error('[DEV SERVER ERROR]', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[DEV SERVER REJECTION]', reason);
});

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico':  'image/x-icon'
};

function forwardHttps(targetUrl, clientRes, maxHops = 5) {
  if (clientRes.writableEnded || clientRes.destroyed) return;

  if (maxHops <= 0) {
    if (!clientRes.headersSent) {
      clientRes.statusCode = 502;
      clientRes.end(JSON.stringify({ error: 'Too many redirects' }));
    }
    return;
  }

  const client = targetUrl.startsWith('https') ? https : http;
  const req = client.get(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/plain,text/html,application/xhtml+xml,*/*;q=0.8'
    },
    timeout: 10000
  }, (res) => {
    if (clientRes.writableEnded || clientRes.destroyed) return;

    // Handle redirects safely
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      const redirectUrl = new URL(res.headers.location, targetUrl).toString();
      return forwardHttps(redirectUrl, clientRes, maxHops - 1);
    }

    if (!clientRes.headersSent) {
      clientRes.statusCode = res.statusCode;
      clientRes.setHeader('Access-Control-Allow-Origin', '*');
      clientRes.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      clientRes.setHeader('Content-Type', res.headers['content-type'] || 'text/plain; charset=utf-8');
    }
    res.pipe(clientRes);
  });

  req.on('timeout', () => {
    req.abort();
    if (!clientRes.headersSent) {
      clientRes.statusCode = 504;
      clientRes.setHeader('Content-Type', 'application/json');
      clientRes.end(JSON.stringify({ error: 'Upstream request timed out' }));
    } else {
      clientRes.destroy();
    }
  });

  req.on('error', (err) => {
    if (!clientRes.headersSent) {
      clientRes.statusCode = 502;
      clientRes.setHeader('Content-Type', 'application/json');
      clientRes.end(JSON.stringify({ error: err.message }));
    } else {
      clientRes.destroy();
    }
  });
}

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = reqUrl.pathname;

  console.log(`[DEV SERVER] ${req.method} ${pathname}${reqUrl.search}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // 1. /api/books (search, pagination, genres)
  if (pathname === '/api/books' || pathname === '/api/books/') {
    const target = `https://gutendex.com/books/${reqUrl.search}`;
    return forwardHttps(target, res);
  }

  // 2. /api/books/:id
  if (pathname.startsWith('/api/books/')) {
    const bookId = pathname.replace('/api/books/', '').replace(/\/$/, '');
    const target = `https://gutendex.com/books/${bookId}/`;
    return forwardHttps(target, res);
  }

  // 3. /api/read (proxies book content for reader)
  if (pathname === '/api/read') {
    const targetUrl = reqUrl.searchParams.get('url');
    if (!targetUrl) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Missing url query parameter' }));
      return;
    }
    const secureUrl = targetUrl.replace(/^http:\/\//i, 'https://');
    return forwardHttps(secureUrl, res);
  }

  // 4. Static files
  let relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const htmlPath = filePath + '.html';
      if (fs.existsSync(htmlPath)) {
        filePath = htmlPath;
      } else {
        res.statusCode = 404;
        const notFoundPath = path.join(__dirname, '404.html');
        if (fs.existsSync(notFoundPath)) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          fs.createReadStream(notFoundPath).pipe(res);
        } else {
          res.end('404 Not Found');
        }
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Bookshelf local development server running at http://localhost:${PORT}`);
});
