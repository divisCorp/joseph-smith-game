// Renders the icon masters with headless Chrome: 1024 regular, 1024 maskable, 256 simple (favicons)
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('/workspace/joseph-smith-game/tools/icon/icon.js', 'utf8').replace(/export function/g, 'function');
const out = process.argv[2] || '/workspace/qa/release75/icon/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await b.newPage();
await p.setContent('<html><body></body></html>');
for (const [name, S, opts] of [['master-1024', 1024, {}], ['maskable-1024', 1024, { maskable: true }], ['simple-256', 256, { simple: true }]]) {
  const data = await p.evaluate(([src, S, opts]) => {
    eval(src);
    const c = document.createElement('canvas'); c.width = c.height = S;
    drawIcon(c.getContext('2d', { willReadFrequently: true }), S, opts);
    return c.toDataURL('image/png');
  }, [src, S, opts]);
  writeFileSync(`${out}${name}.png`, Buffer.from(data.split(',')[1], 'base64'));
}
await b.close();
console.log('ok');
