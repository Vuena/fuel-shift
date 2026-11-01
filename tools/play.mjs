// Full scripted playthrough: node tools/play.mjs <w> <h> <mobile 0|1> <cdpPort> <tag> [speed=4] [extra query]
// The in-page autopilot (?bot, public/js/qa.js) plays a whole day through the movement input; this script starts the day by
// clicking START, screenshots each shift, then prints the per-shift economy, bot purchases, FPS and every console error.
import { chrome, sleep } from './lib/cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { tmpdir } from 'node:os';
const ROOT = fileURLToPath(new globalThis.URL('..', import.meta.url)).replaceAll(String.fromCharCode(92), '/'), TMP = tmpdir().replaceAll(String.fromCharCode(92), '/') + '/';
const [w = '1280', h = '720', mob = '0', port = '9441', tag = 'p', speed = '4', extra = ''] = process.argv.slice(2);
const out = ROOT + 'shots/'; mkdirSync(out, { recursive: true });
const URL = (process.env.URL || 'http://localhost:8811/public/') + `?bot&speed=${speed}&tut` + (extra ? '&' + extra : '');
const tab = await chrome('play-' + tag, +port, TMP + 'go26-play-' + tag, { args: ['--window-size=' + w + ',' + h] });
const log = (...a) => console.log(`[${tag}]`, ...a);
try {
  await tab.size(+w, +h, mob === '1'); const t0 = Date.now(); await tab.go(URL);
  for (let i = 0; i < 300 && !(await tab.ev('!!(window.__fs && __fs.ready)')); i++) await sleep(100);
  log('ready ms', Date.now() - t0);
  if (mob === '1') { const c = await tab.center('#startBtn'); await tab.tap(c.x, c.y); } else await tab.clickSel('#startBtn');
  const fps = []; let lastShot = -1, n = 0;
  for (let i = 0; i < 2400; i++) {
    await sleep(250); const st = await tab.ev('__fs.state'); fps.push(await tab.ev('__fs.fps'));
    const s = await tab.ev('({ sh: __fs.api.G.shift, t: Math.round(__fs.api.G.shiftT), tut: __fs.api.G.tut })');
    const key = s.sh * 10 + Math.floor(s.t / 80);
    if (st === 'play' && key !== lastShot && s.t > 20) { lastShot = key; await tab.shot(out + `play-${tag}-${++n}-s${s.sh}-${s.t}.png`); }
    if (i % 40 === 0) log(st, JSON.stringify(s), 'cash', await tab.ev('__fs.api.G.cash'), 'earned', await tab.ev('__fs.api.G.earned'), 'rep', (await tab.ev('__fs.api.G.rep')).toFixed(2), 'gear', await tab.ev('__fs.api.G.gear'));
    if (st === 'end') break;
  }
  await sleep(600); await tab.shot(out + `play-${tag}-end.png`);
  const bot = await tab.ev('window.__bot'); writeFileSync(out + `play-${tag}.json`, JSON.stringify(bot, null, 1));
  log('END', await tab.ev('document.getElementById("endScore").textContent'), await tab.ev('document.getElementById("endRank").textContent'), await tab.ev('document.getElementById("endLine").textContent'));
  log('shifts', JSON.stringify(bot.shifts.map((s) => ({ e: s.earned, sv: s.served, lost: s.lost, rep: s.rep, g: s.gear, u: s.unlocked.length }))));
  log('buys', bot.buys.join(' | ')); log('stuck', bot.log.length, JSON.stringify(bot.log.slice(0, 6)));
  const f = fps.filter((x) => x > 0); log('fps avg', (f.reduce((a, b) => a + b, 0) / f.length).toFixed(1), 'min', Math.min(...f).toFixed(1));
} catch (e) { log('FAIL', e.message); }
log('ERRORS', tab.errs.length, JSON.stringify(tab.errs.slice(0, 8)));
await tab.close(); process.exit(0);
