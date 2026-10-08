import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
http.createServer((req, res) => {
  let pathname; try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  const candidate = [file, `${file}.html`, path.join(root, 'index.html')].find(f => fs.existsSync(f) && fs.statSync(f).isFile());
  if (!candidate) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(candidate)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(candidate).pipe(res);
}).listen(8083, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:8083'));
