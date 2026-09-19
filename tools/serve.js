#!/usr/bin/env node
// Tiny static server for ./app so the installable web app (PWA) can be used
// from http://localhost without any hosting. Usage: node tools/serve.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '..', 'app');
const PORT = Number(process.argv[2] || process.env.PORT || 8765);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(APP, path.normalize(rel));
  if (!file.startsWith(APP)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': file.endsWith('sw.js') ? 'no-cache' : 'public, max-age=0'
    });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Internal Medicine Training Suite: http://localhost:${PORT}/`);
});
