#!/usr/bin/env node
// Cache-bust every asset reference with one version number.
// Usage: node scripts/bump-version.mjs 68
// - index.html: every ?v=NN (CSS, portrait, main.js)
// - js/*.js: every relative ES module import gets ?v=NN. All modules must use
//   the SAME specifier for a file, or the browser would load two copies.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const v = process.argv[2];
if (!/^\d+$/.test(v || '')) {
  console.error('usage: node scripts/bump-version.mjs <number>');
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let count = 0;

const html = join(root, 'index.html');
const h0 = readFileSync(html, 'utf8');
const h1 = h0.replace(/\?v=\d+/g, () => (count++, `?v=${v}`));
writeFileSync(html, h1);

const jsDir = join(root, 'js');
const spec = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"?]+\.js)(?:\?v=\d+)?\2/g;
for (const f of readdirSync(jsDir).filter((n) => n.endsWith('.js'))) {
  const p = join(jsDir, f);
  const s0 = readFileSync(p, 'utf8');
  const s1 = s0.replace(spec, (_, pre, q, path) => (count++, `${pre}${q}${path}?v=${v}${q}`));
  if (s1 !== s0) writeFileSync(p, s1);
}
console.log(`version ${v}: ${count} references`);
