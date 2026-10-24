import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
// The service worker is the runtime asset manifest. Never publish the repository root.
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const list = worker.match(/const ASSETS = \[([\s\S]*?)\];/)?.[1];
if (!list) throw new Error('Missing runtime asset manifest');
const files = new Set(['index.html', 'service-worker.js', ...[...list.matchAll(/'([^']+)'/g)]
    .map(match => match[1].replace(/^\//, '')).filter(Boolean)]);
for (const file of files) {
    if (file.includes('..') || path.isAbsolute(file) || !/\.(html|js|css|json|png)$/.test(file)) {
        throw new Error(`Invalid runtime asset: ${file}`);
    }
    if (!fs.statSync(path.join(root, file)).isFile()) throw new Error(`Missing asset: ${file}`);
}
// Only the fixed generated directory may be cleared; refuse redirected output.
if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) throw new Error('dist must not be a symlink');
fs.rmSync(output, { recursive: true, force: true });
for (const file of files) {
    const target = path.join(output, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, file), target);
}
console.log(`Built ${files.size} runtime files into dist; development files excluded.`);
