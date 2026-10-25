import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const assetList = worker.match(/const ASSETS = \[([\s\S]*?)\];/)?.[1];
assert(assetList, 'Missing runtime asset list');
const runtimeFiles = new Set(['index.html', 'service-worker.js',
    ...[...assetList.matchAll(/'([^']+)'/g)].map(match => match[1].replace(/^\//, '')).filter(Boolean)]);
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'pwa-cache-test-'));
try {
    for (const file of [...runtimeFiles, 'scripts/build_static.mjs']) {
        const destination = path.join(fixture, file);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(path.join(root, file), destination);
    }
    const buildCacheName = () => {
        execFileSync(process.execPath, [path.join(fixture, 'scripts/build_static.mjs')], { cwd: fixture });
        const builtWorker = fs.readFileSync(path.join(fixture, 'dist/service-worker.js'), 'utf8');
        const name = builtWorker.match(/^const CACHE_NAME = '([^']+)';/m)?.[1];
        assert.match(name ?? '', /^hypertrophy-[a-f0-9]{12}$/);
        return name;
    };
    const first = buildCacheName();
    assert.equal(buildCacheName(), first, 'Unchanged assets must keep the same cache key');
    fs.appendFileSync(path.join(fixture, 'index.html'), '\n<!-- updated UI -->\n');
    assert.notEqual(buildCacheName(), first, 'Changed UI must invalidate the service-worker cache');
    assert.equal(fs.readFileSync(path.join(fixture, 'dist/index.html'), 'utf8'),
        fs.readFileSync(path.join(fixture, 'index.html'), 'utf8'));
} finally {
    fs.rmSync(fixture, { recursive: true, force: true });
}
console.log('Production cache fingerprint: deterministic, asset-sensitive, non-destructive OK');
