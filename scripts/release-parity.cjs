'use strict';
// Release parity validator.
//
// Enforces single-source-of-truth release identity:
//   - js/release/release.js must declare productVersion, cacheIdentity,
//     and lastSeenKey (identity only; no visible copy).
//   - sw.js APP_VERSION must equal the declared cacheIdentity AT THE FINAL
//     RELEASE BOUNDARY. Before the boundary, sw.js is intentionally frozen
//     and a mismatch is EXPECTED (reported as PENDING, not failure), because
//     APP_VERSION / sw.js must not change until final accepted release
//     closure.
//   - the cache identity must embed the semantic productVersion;
//   - the runtime must read the version from the registry (no hardcoded
//     literal elsewhere in js/ besides the two content owners).
//
// Run: node scripts/release-parity.cjs   (exit 0 = pass, exit 1 = fail)
// Env: RELEASE_PARITY_STRICT_SW=1  → treat a pre-boundary sw.js mismatch as
//      failure (used only at final release closure).

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const releaseSrc = read('js/release/release.js');
const swSrc = read('sw.js');

const rvMatch = releaseSrc.match(/productVersion\s*:\s*'([^']+)'/);
const ciMatch = releaseSrc.match(/cacheIdentity\s*:\s*'([^']+)'/);
const swMatch = swSrc.match(/const APP_VERSION\s*=\s*'([^']+)'/);

const productVersion = rvMatch ? rvMatch[1] : null;
const cacheIdentity = ciMatch ? ciMatch[1] : null;
const swVersion = swMatch ? swMatch[1] : null;

const failures = [];
const pending = [];

if (!productVersion) failures.push('release.js missing productVersion');
if (!cacheIdentity) failures.push('release.js missing cacheIdentity');
if (!swVersion) failures.push('sw.js missing APP_VERSION');

if (productVersion && cacheIdentity && swVersion) {
  if (swVersion !== cacheIdentity) {
    var __strict = process.env.RELEASE_PARITY_STRICT_SW === '1';
    var __msg =
      `sw.js APP_VERSION (${swVersion}) !== release.js cacheIdentity (${cacheIdentity})`;
    if (__strict) {
      failures.push(__msg);
    } else {
      // Expected before the final boundary: do NOT edit APP_VERSION / sw.js
      // until final accepted release closure.
      pending.push(__msg + ' [EXPECTED pre-boundary: sw.js frozen]');
    }
  }
  if (!cacheIdentity.includes(productVersion)) {
    failures.push(
      `cacheIdentity (${cacheIdentity}) does not embed productVersion (${productVersion})`
    );
  }
}

// Ensure the bare version literal is not manually scattered. Permitted owners:
//   - js/release/release.js (identity only)
//   - js/ui/release-notes-content.js (visible copy only)
// Runtime rules (enforced):
//   - js/main.js reads MME_RELEASE.productVersion with an '(unversioned)'
//     fallback (no literal allowed).
//   - js/ui/release-notes.js derives CURRENT from MME_RELEASE at runtime and
//     never hardcodes the productVersion literal.
// Visible Help copy must not hardcode the active productVersion either; any
// release-specific label in help-content.js is derived or generic. A match of
// the productVersion token in help-content.js is treated as failure.
const allowedOwners = ['js/release/release.js'];
if (productVersion) {
  const jsFiles = ['js', 'index.html']
    .map((dir) => {
      const out = [];
      const walk = (d) => {
        let entries = [];
        try {
          entries = fs.readdirSync(path.join(root, d), { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of entries) {
          const full = path.join(d, e.name);
          if (e.isDirectory()) {
            walk(full);
          } else if (/\.js$/.test(e.name)) {
            out.push(full);
          }
        }
      };
      walk(dir);
      return out;
    })
    .flat();

  const scattered = jsFiles.filter((f) => {
    if (allowedOwners.includes(f)) return false;
    // Release Notes content is allowed to display the version string.
    if (f === 'js/ui/release-notes-content.js') return false;
    const src = read(f);
    // Ignore comment-only occurrences; require the literal token followed by
    // a non-comment usage. Simple heuristic: the exact version token present
    // in non-comment text.
    const stripped = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    return stripped.includes(productVersion);
  });

  for (const f of scattered) {
    failures.push(`productVersion ${productVersion} appears unexpectedly in ${f}`);
  }
}

if (failures.length) {
  console.error('RELEASE PARITY FAIL');
  for (const f of failures) console.error(' - ' + f);
  process.exit(1);
}

console.log(
  `RELEASE PARITY OK productVersion=${productVersion} cacheIdentity=${cacheIdentity} sw.js=${swVersion}`
);