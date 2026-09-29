#!/usr/bin/env node
'use strict';

/**
 * ACT 3C — GENERATE the disposable Workspace for the integrated Package 3 device
 * checkpoint. This writes a GENERIC fixture Workspace into a directory the owner
 * chooses; it never writes user content into the repository.
 *
 * Usage: node scripts/package3-device-workspace.cjs <outputDir>
 *
 * The fixture deliberately covers every case the integrated checkpoint needs,
 * so the manual S22/DeX session is setup-only rather than authoring.
 */

const fs = require('fs');
const path = require('path');

const outDir = process.argv[2];
if (!outDir) {
  console.error('usage: node scripts/package3-device-workspace.cjs <outputDir>');
  process.exit(1);
}

// Each entry: exact path, and the Markdown written to it. Cases are keyed to the
// integrated checklist so a missing case is obvious while reading.
const FILES = {
  // Target Note. Its H1 deliberately DIFFERS from its filename so both the
  // filename key and the H1 key are exercised.
  'notes/Alpha.md': '# Alpha Title\n\nThe inbound target. #customer\n',

  // RESOLUTION: exact filename.
  'notes/byFilename.md': '# By Filename\n\nLinks by filename: [[Alpha]]\n',
  // RESOLUTION: filename with extension.
  'notes/byExtension.md': '# By Extension\n\nLinks with extension: [[Alpha.md]]\n',
  // RESOLUTION: saved H1.
  'notes/byH1.md': '# By Saved H1\n\nLinks by H1: [[Alpha Title]]\n',
  // REPEATED links from one source to the same target (dedup coverage).
  'notes/repeated.md': '# Repeated\n\nThree times: [[Alpha]] [[Alpha]] [[Alpha]]\n',
  // MISSING target.
  'notes/missing.md': '# Missing Target\n\nPoints nowhere: [[Nowhere At All]]\n',
  // AMBIGUOUS target (two Notes share the basename S).
  'notes/ambiguous.md': '# Ambiguous\n\nPoints at a duplicated basename: [[S]]\n',
  'notes/S.md': '# S One\n\nFirst S.\n',
  'notes/nested/S.md': '# S Two\n\nSecond S, same basename.\n',
  // DUPLICATE H1: two Notes share one saved H1.
  'notes/dupH1a.md': '# Shared Heading\n\nFirst Note with this H1.\n',
  'notes/dupH1b.md': '# Shared Heading\n\nSecond Note with this H1.\n',
  // SPACES and UNICODE targets.
  'notes/Spaced Name.md': '# Spaced Name\n\nA target whose name contains spaces.\n',
  'notes/日本語.md': '# 日本語 ノート\n\nA Unicode filename target.\n',
  'notes/usesUnicode.md': '# Uses Unicode\n\nUnicode target: [[日本語]]\n',
  'notes/usesSpaces.md': '# Uses Spaces\n\nSpaced target: [[Spaced Name]]\n',
  // CLASSIFICATION: Knowledge + Pinned overlap, and an archived Note.
  'notes/knowledge.md': '---\nknowledge: true\npinned: true\n---\n# Knowledge Pinned\n\nBoth classifications, one physical Note.\n',
  'notes/archived.md': '---\narchived: true\n---\n# Archived Note\n\nAn archived source that still links.\n\nBack to [[Alpha]]\n',
  'notes/usesClassification.md': '# Uses Classification\n\nKnowledge target: [[Knowledge Pinned]]\nArchived source: [[Archived Note]]\n',
  // The navigating SOURCE note, and a note with NO inbound links.
  'notes/Source.md': '# Source\n\nThe checkpoint source.\n\nOutgoing: [[Alpha]] [[Nowhere At All]]\n',
  'notes/noInbound.md': '# No Inbound\n\nNothing points here. Use to check the available-zero state.\n',
};

const dir = path.resolve(outDir);
fs.mkdirSync(path.join(dir, 'notes', 'nested'), { recursive: true });

let written = 0;
for (const [rel, body] of Object.entries(FILES)) {
  const abs = path.join(dir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body, 'utf8');
  written += 1;
}

console.log('Package 3 device Workspace written: ' + written + ' notes in ' + dir);
console.log('');
console.log('Covered cases:');
console.log('  RESOLUTION  exact filename, filename+extension, saved H1, spaces, Unicode');
console.log('  STATES      resolved, missing (Nowhere At All), ambiguous (S in two folders),');
console.log('              not-ready (open with no Workspace)');
console.log('  DIRECTION   byName/byExtension/byH1/repeated/archived -> Alpha');
console.log('              noInbound.md for the available-zero state');
console.log('  CLASSIFY    knowledge.md (knowledge+pinned), archived.md');
console.log('  NAVIGATION  Source.md -> Alpha; duplicate H1 fixtures for ambiguity');
console.log('');
console.log('Nothing is written inside the repository unless you point this at it.');
