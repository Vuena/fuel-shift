// Minimal static server for local tests: node tools/serve.mjs [port] [dir relative to the repo, default public]
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { extname, join } from 'node:path'; import { fileURLToPath } from 'node:url';
const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', process.argv[3] || 'public');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary' };
const port = +process.argv[2] || 8795;
http.createServer(async (req, res) => { let p = decodeURIComponent(req.url.split('?')[0]).split('..').join(''); if (p.endsWith('/')) p += 'index.html'; try { const b = await readFile(join(root, p)); res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(b); } catch { res.writeHead(404); res.end(); } }).listen(port, () => console.log('serving', root, port));
