// itch.io HTML build: node tools/build.mjs  ->  dist/fuel-shift-itch-<version>.zip (index.html at the zip root). Nothing is uploaded.
import { cpSync, rmSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), pub = join(root, 'public'), out = join(root, 'dist', 'itch');
const VERSION = JSON.parse(readFileSync(join(root, 'version.json'), 'utf8')).version;
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
cpSync(pub, out, { recursive: true });
const files = walk(out), bytes = files.reduce((n, f) => n + statSync(f).size, 0);
if (!files.some((f) => f.endsWith('index.html'))) throw new Error('no index.html');
if (files.length > 900) throw new Error('itch allows max 1000 files, got ' + files.length);
const zip = join(root, 'dist', `fuel-shift-itch-${VERSION}.zip`); rmSync(zip, { force: true });
execSync(`"C:/Windows/System32/tar.exe" -a -c -f "${zip}" *`, { cwd: out, shell: 'cmd.exe' });
console.log(`${files.length} files, ${(bytes / 1048576).toFixed(2)} MB unpacked, zip ${(statSync(zip).size / 1048576).toFixed(2)} MB -> ${zip}`);
