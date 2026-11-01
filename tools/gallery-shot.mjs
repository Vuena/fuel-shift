// Dev tool: node tools/gallery-shot.mjs  (needs `node tools/serve.mjs 8811 .`) -> media/_gallery.png + model sizes
import { chrome, sleep } from './lib/cdp.mjs';
import { fileURLToPath } from 'node:url'; import { tmpdir } from 'node:os';
const ROOT = fileURLToPath(new globalThis.URL('..', import.meta.url)).replaceAll(String.fromCharCode(92), '/'), TMP = tmpdir().replaceAll(String.fromCharCode(92), '/') + '/';
const tab = await chrome('gal', 9411, TMP + 'go26-gal', { args: ['--window-size=1600,1000'] });
try {
  await tab.size(1600, 1000, false); await tab.go('http://localhost:8811/tools/gallery.html');
  for (let i = 0; i < 200 && !(await tab.ev('!!window.__done')); i++) await sleep(100);
  await sleep(300); await tab.shot(ROOT + 'media/_gallery.png');
  console.log(JSON.stringify(await tab.ev('__info')));
  console.log('ERR', JSON.stringify(tab.errs));
} catch (e) { console.log('FAIL', e.message, tab.errs); }
await tab.close(); process.exit(0);
