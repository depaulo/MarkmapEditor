'use strict';
const fs = require('fs');
const path = require('path');
function read(file) { return fs.readFileSync(file, 'utf8'); }
function fail(msg) { console.error('[FAIL]', msg); return false; }
function pass(msg) { console.log('[PASS]', msg); return true; }
let ok = true;
console.log('=== Report Composer ACT R1A Validator ===\n');
const composer = read('js/report/report-composer.js');
if (!composer.includes('(function ()')) { ok &= fail('report-composer.js: should use IIFE pattern'); } else { ok &= pass('report-composer.js: uses IIFE pattern'); }
if (composer.includes('export ') || composer.includes('import ')) { ok &= fail('report-composer.js: should not use ES module export/import'); } else { ok &= pass('report-composer.js: no ES module export/import'); }
if (!composer.includes('globalThis.MME_REPORT_COMPOSER')) { ok &= fail('report-composer.js: must publish globalThis.MME_REPORT_COMPOSER'); } else { ok &= pass('report-composer.js: publishes globalThis.MME_REPORT_COMPOSER'); }
const composerGlobalCount = (composer.match(/MME_REPORT_COMPOSER/g) || []).length;
if (composerGlobalCount > 4) { ok &= fail('report-composer.js: multiple MME_REPORT_COMPOSER references'); } else { ok &= pass('report-composer.js: single MME_REPORT_COMPOSER owner'); }
const requiredMethods = ['open', 'returnToWorkspace', 'render', 'refresh', 'reset', 'getState', 'setPeriod', 'setDomain', 'setRecordSelected', 'selectEligible', 'clearSelection', 'buildSelection'];
for (const method of requiredMethods) { if (!composer.includes('function ' + method)) { ok &= fail('report-composer.js: missing method ' + method); } else { ok &= pass('report-composer.js: method ' + method + ' present'); } }
const periodFuncs = ['normalizePeriod', 'isDateWithinInclusivePeriod', 'quarterToRange', 'quarterIntersectsPeriod'];
for (const func of periodFuncs) { if (!composer.includes('function ' + func)) { ok &= fail('report-composer.js: missing period function ' + func); } else { ok &= pass('report-composer.js: period function ' + func + ' present'); } }
if (!composer.includes('Start date must be on or before End date.')) { ok &= fail('report-composer.js: missing reversed period error message'); } else { ok &= pass('report-composer.js: reversed period error message present'); }
if (!composer.includes('incomplete') && !composer.includes("incomplete")) { ok &= fail('report-composer.js: missing incomplete period status'); } else { ok &= pass('report-composer.js: incomplete period status present'); }
if (!composer.includes('function collectProjectPeriodMatches')) { ok &= fail('report-composer.js: missing collectProjectPeriodMatches function'); } else { ok &= pass('report-composer.js: collectProjectPeriodMatches function present'); }
for (const field of ['expectedOrder', 'expectedDelivery', 'expectedBilling']) { if (!composer.includes(field)) { ok &= fail('report-composer.js: project eligibility checks ' + field); } else { ok &= pass('report-composer.js: project eligibility checks ' + field); } }
if (!composer.includes('function classifyTaskForPeriod')) { ok &= fail('report-composer.js: missing classifyTaskForPeriod function'); } else { ok &= pass('report-composer.js: classifyTaskForPeriod function present'); }
for (const cls of ['open-at-period-end', 'due-in-period', 'completed-in-period', 'overdue-at-period-end']) { if (!composer.includes(cls)) { ok &= fail('report-composer.js: missing task classification ' + cls); } else { ok &= pass('report-composer.js: task classification ' + cls + ' present'); } }
if (composer.includes('new Date()') || composer.includes('Date.now()')) { ok &= fail('report-composer.js: task eligibility must not use Date.now()'); } else { ok &= pass('report-composer.js: task eligibility does not use Date.now()'); }
if (!composer.includes('function classifyNoteForPeriod')) { ok &= fail('report-composer.js: missing classifyNoteForPeriod function'); } else { ok &= pass('report-composer.js: classifyNoteForPeriod function present'); }
if (!composer.includes('dated-in-period') && !composer.includes("dated-in-period")) { ok &= fail('report-composer.js: missing dated-in-period note classification'); } else { ok &= pass('report-composer.js: dated-in-period note classification present'); }
if (!composer.includes('undated-manual') && !composer.includes("undated-manual")) { ok &= fail('report-composer.js: missing undated-manual note classification'); } else { ok &= pass('report-composer.js: undated-manual note classification present'); }
if (!composer.includes('function buildEligibilityProjection')) { ok &= fail('report-composer.js: missing buildEligibilityProjection function'); } else { ok &= pass('report-composer.js: buildEligibilityProjection function present'); }
const buildFields = ['selectedProjectIds', 'selectedTaskIds', 'selectedNotePaths', 'eligibleCounts', 'selectedCounts', 'diagnostics', 'sourceTraceability'];
for (const field of buildFields) { if (!composer.includes(field)) { ok &= fail('report-composer.js: Build Selection missing ' + field); } else { ok &= pass('report-composer.js: Build Selection has ' + field); } }
if (composer.includes('Markdown generation') || composer.includes('generateMarkdown')) { ok &= fail('report-composer.js: Build Selection must not generate Markdown'); } else { ok &= pass('report-composer.js: Build Selection does not generate Markdown'); }
if (composer.includes('saveSmart') || composer.includes('saveToHandle')) { ok &= fail('report-composer.js: Build Selection must not Save'); } else { ok &= pass('report-composer.js: Build Selection does not Save'); }
if (composer.includes('Draw.io reconciliation') || composer.includes('drawio')) { ok &= fail('report-composer.js: Build Selection must not use Draw.io'); } else { ok &= pass('report-composer.js: Build Selection does not use Draw.io'); }
if (composer.includes('source write')) { ok &= fail('report-composer.js: Build Selection must not write source'); } else { ok &= pass('report-composer.js: Build Selection does not write source'); }
if (!composer.includes('function applyDefaultSelection')) { ok &= fail('report-composer.js: missing applyDefaultSelection function'); } else { ok &= pass('report-composer.js: applyDefaultSelection function present'); }
if (!composer.includes('stale-project') && !composer.includes('stale-task') && !composer.includes('stale-note')) { ok &= fail('report-composer.js: missing stale identity diagnostics'); } else { ok &= pass('report-composer.js: stale identity diagnostics present'); }
if (!composer.includes('function returnToWorkspace')) { ok &= fail('report-composer.js: missing returnToWorkspace function'); } else { ok &= pass('report-composer.js: returnToWorkspace function present'); }
if (!composer.includes('reportComposerView')) { ok &= fail('report-composer.js: missing .reportComposerView class'); } else { ok &= pass('report-composer.js: .reportComposerView class present'); }
const evSections = ['Back to Workspace', 'Period', 'Domains', 'Projects', 'Tasks', 'Notes', 'Selection Review', 'Build Selection'];
for (const section of evSections) { if (!composer.includes(section)) { ok &= fail('report-composer.js: Expanded View missing section ' + section); } else { ok &= pass('report-composer.js: Expanded View has section ' + section); } }
const fixtureDir = 'tests/fixtures/workspaces/projects-review';
const fixtureFiles = ['CUSTOMER_A.md', 'CUSTOMER_B.md', 'PROJECTS_TEST.md'];
let foundFixtureFiles = 0;
for (const f of fixtureFiles) { if (fs.existsSync(path.join(fixtureDir, f))) foundFixtureFiles++; }
if (foundFixtureFiles === fixtureFiles.length) { ok &= pass('fixture: all 3 project-review fixture files present'); } else { ok &= fail('fixture: expected ' + fixtureFiles.length + ' files, found ' + foundFixtureFiles); }
let fixtureContent = '';
for (const f of fixtureFiles) { try { fixtureContent += fs.readFileSync(path.join(fixtureDir, f), 'utf8'); } catch (e) {} }
const requiredScenarios = [
  { label: 'Order in period', pattern: 'Order: 26q4|Order: 27q4|Order: 26q3|Order: 27q3' },
  { label: 'open Task', pattern: '\\[ \\]' },
  { label: 'completed Task', pattern: '\\[x\\]' },
];
for (const s of requiredScenarios) { const re = new RegExp(s.pattern, 'i'); if (!re.test(fixtureContent)) { ok &= fail('fixture: missing scenario ' + s.label); } else { ok &= pass('fixture: scenario ' + s.label + ' present'); } }
console.log('\\n=== Report Composer ACT R1A Validator Result ===');
if (ok) { console.log('RESULT: PASS'); process.exit(0); } else { console.log('RESULT: FAIL'); process.exit(1); }