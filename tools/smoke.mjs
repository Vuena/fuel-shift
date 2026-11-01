// Smoke test: node tools/smoke.mjs <w> <h> <mobile 0|1> <port> <tag> [query]  -> shots/smoke-<tag>-*.png, errors
import { chrome, sleep } from './lib/cdp.mjs';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { tmpdir } from 'node:os';
const ROOT = fileURLToPath(new globalThis.URL('..', import.meta.url)).replaceAll(String.fromCharCode(92), '/'), TMP = tmpdir().replaceAll(String.fromCharCode(92), '/') + '/';
const [w = '1280', h = '720', mob = '0', port = '9421', tag = 'd', q = ''] = process.argv.slice(2);
const out = ROOT + 'shots/'; mkdirSync(out, { recursive: true });
const URL = (process.env.URL || 'http://localhost:8811/public/') + (q ? '?' + q : '');
const tab = await chrome('smoke-' + tag, +port, TMP + 'go26-smoke-' + tag, { args: ['--window-size=' + w + ',' + h] });
try {
  await tab.size(+w, +h, mob === '1'); await tab.go(URL);
  for (let i = 0; i < 200 && !(await tab.ev('!!(window.__fs && __fs.ready)')); i++) await sleep(100);
  await sleep(1500); await tab.shot(out + `smoke-${tag}-1-title.png`);
  await tab.clickSel('#startBtn'); await sleep(2500); await tab.shot(out + `smoke-${tag}-2-start.png`);
  console.log('state', await tab.ev('__fs.state'), 'fps', (await tab.ev('__fs.fps')).toFixed(1));
  console.log('calls', await tab.ev('__fs.api.renderer.info.render.calls'), 'tris', await tab.ev('__fs.api.renderer.info.render.triangles'));
} catch (e) { console.log('FAIL', e.message); }
console.log('ERRORS', JSON.stringify(tab.errs.slice(0, 10)));
await tab.close(); process.exit(0);
