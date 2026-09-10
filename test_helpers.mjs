import { IDBFactory } from 'fake-indexeddb';
import fs from 'node:fs';
import { WorkoutEngine } from './src/core/WorkoutEngine.js';

export const protocol = JSON.parse(fs.readFileSync('src/data/core_protocol.json', 'utf8'));
export function environment() {
    const light = new Map();
    globalThis.localStorage = {
        getItem: key => light.get(key) ?? null,
        setItem: (key,value) => light.set(key,value),
        removeItem: key => light.delete(key)
    };
    globalThis.window = new EventTarget();
    window.indexedDB = new IDBFactory();
    globalThis.fetch = async () => ({ ok: true, json: async () => structuredClone(protocol) });
    return light;
}
export async function engine() {
    const instance = new WorkoutEngine();
    await instance.init();
    return instance;
}
