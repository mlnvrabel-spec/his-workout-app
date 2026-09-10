import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const handlers = {};
const entries = new Map();
const deleted = [];
let installed;
const cache = {
    addAll: async requests => { installed = requests; for (const r of requests) entries.set(r.url, `current:${r.url}`); },
    match: async path => entries.get(path)
};
vm.runInNewContext(fs.readFileSync('service-worker.js', 'utf8'), {
    self: { addEventListener: (name, fn) => handlers[name] = fn, location: {origin:'https://test.local'}, clients:{claim: async()=>{}}, skipWaiting:()=>{} },
    caches: {open: async()=>cache, keys:async()=>['hypertrophy-v1','other-app'], delete:async name=>deleted.push(name)},
    Request: class { constructor(url, options) { this.url=url; Object.assign(this,options); } },
    URL, fetch: async()=>{throw Error('Network offline');}
});
let pending;
handlers.install({waitUntil:p=>pending=p}); await pending;
assert(installed.every(r=>r.cache==='reload'));
for (const {url} of installed) assert(fs.existsSync(url==='/'?'index.html':url.slice(1)), `Missing precache asset ${url}`);
handlers.activate({waitUntil:p=>pending=p}); await pending;
assert.deepEqual(deleted,['hypertrophy-v1']);
for (const [url, mode, expected] of [['/','navigate','/index.html'],['/src/core/WorkoutEngine.js?v=old','cors','/src/core/WorkoutEngine.js']]) {
    handlers.fetch({request:{url:`https://test.local${url}`,method:'GET',mode},respondWith:p=>pending=p});
    assert.equal(await pending,`current:${expected}`);
}
let intercepted=false;
handlers.fetch({request:{url:'https://elsewhere.test/api',method:'GET'},respondWith:()=>intercepted=true});
assert.equal(intercepted,false);
console.log('Service worker: fresh installation, scoped cache, offline navigation, safe cleanup OK');
