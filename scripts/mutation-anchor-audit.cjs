#!/usr/bin/env node
'use strict';

/**
 * ACT 5C - mutation-control anchor audit.
 *
 * Proves that NO control anchor is missing or ambiguous in the shipped source,
 * i.e. no earlier control left a mutation behind. Exits non-zero when any
 * declared (file, find) pair is absent or occurs more than once.
 *
 * Usage: node scripts/mutation-anchor-audit.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SUITES = [
  'project-view-mutation-controls.cjs',
  'project-consumer-mutation-controls.cjs',
  'project-contract-mutation-controls.cjs',
  'workspace-index-task-filter-mutation-controls.cjs',
];

const cache = new Map();
function read(rel) {
  if (!cache.has(rel)) cache.set(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  return cache.get(rel);
}

let checked = 0;
let bad = 0;
for (const suite of SUITES) {
  const src = read('scripts/' + suite);
  const decls = src.match(/(?:const|let)\s+[A-Za-z_]+\s*=\s*'[^']+';/g) || [];
  const map = {};
  for (const d of decls) {
    const dm = d.match(/([A-Za-z_]+)\s*=\s*'([^']+)'/);
    if (dm) map[dm[1]] = dm[2];
  }
  const idRe = /\{\s*id:\s*'([^']+)'/g;
  let m;
  while ((m = idRe.exec(src)) !== null) {
    const id = m[1];
    const nextDecl = src.indexOf("\n  { id:", m.index + 10);
    const body = src.slice(m.index, nextDecl === -1 ? m.index + 4000 : nextDecl);
    const fileM = body.match(/\bfile:\s*([A-Za-z_]+)/);
    const findM = body.match(/\bfind:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/);
    if (!fileM || !findM) {
      // Not a mutation declaration (a literal id or a comment): skip it.
      continue;
    }
    const fileConst = fileM[1];
    let find;
    try { find = eval(findM[1]); } catch { console.log('UNPARSED  ' + id); bad += 1; continue; }
    const rel = map[fileConst];
    if (!rel || !fs.existsSync(path.join(ROOT, rel))) { console.log('NOFILE    ' + id + ' (' + fileConst + ')'); bad += 1; continue; }
    const counts = body.match(/\bcount:\s*(\d+)/g);
    const declared = counts ? counts[counts.length - 1] : null;
    const want = declared ? Number(declared.replace(/\D/g, '')) : 1;
    const n = read(rel).split(find).length - 1;
    checked += 1;
    if (n !== want) { console.log('ANCHOR    ' + id + ' ' + rel + ' occurrences=' + n + ' expected=' + want); bad += 1; }
  }
}
console.log('='.repeat(58));
console.log('anchors checked: ' + checked);
console.log('missing or ambiguous: ' + bad);
console.log(bad === 0 ? 'RESULT: PASS' : 'RESULT: FAIL');
process.exit(bad === 0 ? 0 : 1);
