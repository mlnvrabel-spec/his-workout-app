import fs from 'node:fs';
import { createHash } from 'node:crypto';
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
// Hash deployable assets (and worker source) so a changed app forces an updated
// service worker even when nobody remembers to manually bump a cache counter.
const fingerprint = createHash('sha256');
for (const file of [...files].sort()) {
    if (file === 'service-worker.js') continue;
    fingerprint.update(file);
    fingerprint.update('::');
    fingerprint.update(fs.readFileSync(path.join(root, file)));
    fingerprint.update('::');
}
fingerprint.update(worker);
const cacheName = `hypertrophy-${fingerprint.digest('hex').slice(0, 12)}`;
const cacheDeclaration = worker.match(/^const CACHE_NAME = 'hypertrophy-[^']+';/m)?.[0];
if (!cacheDeclaration) throw new Error('Missing expected service worker cache declaration');
fs.writeFileSync(path.join(output, 'service-worker.js'),
    worker.replace(cacheDeclaration, `const CACHE_NAME = '${cacheName}';`));

console.log(`Built ${files.size} runtime files into dist; development files excluded.`);
