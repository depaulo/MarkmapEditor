// @ts-nocheck
// ACT E — Quick Report Generator. Pure Markdown generation. No UI, no DOM, no file ops.
(function () {
  'use strict';

  function escapeCell(v) {
    return String(v == null ? '' : v)
      .replace(/\|/g, '\\|')
      .replace(/\n/g, ' ')
      .trim();
  }

  function formatValue(p) {
    if (p.value == null || !Number.isFinite(p.value)) return '—';
    const num = p.value.toLocaleString('en-US');
    const c = String(p.currency || '').trim();
    if (!c) return num + ' · no currency';
    return c + ' ' + num;
  }

  function formatQuarter(q) {
    if (!q || !q.valid || !q.display) return '—';
    return q.display;
  }

  function getNoteValue(dict, key) {
    const n = (dict.notes || []).find((x) => x.key === key);
    return n ? n.value : '';
  }

  function renderSummary(dict) {
    const lines = [];
    const summary = getNoteValue(dict, 'report.summary');
    const highlights = getNoteValue(dict, 'report.highlights');
    if (summary) lines.push('## Summary', '', summary, '');
    if (highlights) lines.push('## Highlights', '', highlights, '');
    if (!summary && !highlights)
      lines.push('## Summary', '', '_No summary or highlights provided._', '');
    return lines.join('\n');
  }

  function renderCompletedTasks(dict) {
    const lines = ['## Completed Tasks', ''];
    const tasks = dict.tasks?.completed || [];
    if (tasks.length === 0) {
      lines.push('_No completed Tasks found for this period._', '');
      return lines.join('\n');
    }
    for (const t of tasks) lines.push('- ' + (t.text || ''));
    lines.push('');
    return lines.join('\n');
  }

  function renderProjectForecast(dict) {
    const lines = ['## Project Forecast', ''];
    const projects = dict.projects?.items || [];
    if (projects.length === 0) {
      lines.push('_No Projects match the selected Project scope._', '');
      return lines.join('\n');
    }
    lines.push('| Project | Value | Order | Delivery | Billing | Status |');
    lines.push('|---|---:|---|---|---|---|');
    for (const p of projects) {
      lines.push(
        '| ' +
          escapeCell(p.name) +
          ' | ' +
          escapeCell(formatValue(p)) +
          ' | ' +
          escapeCell(formatQuarter(p.expectedOrder)) +
          ' | ' +
          escapeCell(formatQuarter(p.expectedDelivery)) +
          ' | ' +
          escapeCell(formatQuarter(p.expectedBilling)) +
          ' | ' +
          escapeCell(p.status) +
          ' |'
      );
    }
    lines.push('');
    return lines.join('\n');
  }

  function renderForecastTotals(dict) {
    const lines = ['## Forecast Totals', ''];
    const totals = dict.projects?.totalsByCurrency || [];
    if (totals.length === 0) {
      lines.push('_No named currency totals are available for the selected Projects._', '');
    } else {
      for (const t of totals) {
        lines.push('- ' + t.currency + ' ' + t.totalValue.toLocaleString('en-US'));
      }
      if (dict.projects?.valuedWithoutCurrencyCount > 0) {
        lines.push(
          '- Valued Projects without currency: ' + dict.projects.valuedWithoutCurrencyCount
        );
      }
    }
    lines.push('');
    return lines.join('\n');
  }

  function renderRisks(dict) {
    const lines = ['## Risks and Attention Points', ''];
    const risks = getNoteValue(dict, 'report.risks');
    if (risks) lines.push(risks, '');
    else lines.push('_No risks recorded._', '');
    return lines.join('\n');
  }

  function renderNextSteps(dict) {
    const lines = ['## Next Steps', ''];
    const next = getNoteValue(dict, 'report.next_steps');
    if (next) lines.push(next, '');
    else lines.push('_No next steps recorded._', '');
    return lines.join('\n');
  }

  function renderUndatedTasks(dict) {
    const lines = ['## Completed Tasks Without Date', ''];
    const tasks = dict.tasks?.completedUndated || [];
    if (tasks.length === 0) {
      lines.push('_No historical completed Tasks without a date._', '');
    } else {
      for (const t of tasks) lines.push('- ' + (t.text || ''));
      lines.push('');
      lines.push('_Completion date is unavailable for these Tasks._');
    }
    lines.push('');
    return lines.join('\n');
  }

  const SECTION_RENDERERS = {
    summary: renderSummary,
    'completed-tasks': renderCompletedTasks,
    'project-forecast': renderProjectForecast,
    'forecast-totals': renderForecastTotals,
    risks: renderRisks,
    'next-steps': renderNextSteps,
    'undated-completed-tasks': renderUndatedTasks,
  };

  function buildMarkdown(dictionary) {
    if (!dictionary || dictionary.ok === false) {
      return '# Report\n\n_Report could not be generated._\n';
    }

    const range = dictionary.reportRange || {};
    const title = getNoteValue(dictionary, 'report.title') || 'Weekly Business Report';
    const lines = [];

    lines.push('---');
    lines.push('type: report');
    lines.push('period_start: ' + (range.startDate || ''));
    lines.push('period_end: ' + (range.endDate || ''));
    lines.push('generated: ' + String(dictionary.generatedAt || '').slice(0, 10));
    lines.push('project_scope: ' + (dictionary.options?.projectMode || 'all'));
    lines.push('---');
    lines.push('');
    lines.push('# ' + title);
    lines.push('');
    lines.push('**Period:** ' + (range.startDate || '') + ' to ' + (range.endDate || ''));
    lines.push('');

    const sections = dictionary.sections || [];
    for (const s of sections) {
      if (!s.enabled) continue;
      const renderer = SECTION_RENDERERS[s.id];
      if (!renderer) continue;
      const block = renderer(dictionary);
      if (block) {
        lines.push(block);
      }
    }

    const managementNotes = getNoteValue(dictionary, 'report.management_notes');
    if (managementNotes) {
      lines.push('## Management Notes', '', managementNotes, '');
    }

    let md = lines.join('\n');
    md = md.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    if (!md.endsWith('\n')) md += '\n';
    return md;
  }

  function buildSuggestedFilename(dictionary) {
    const range = dictionary?.reportRange || {};
    const start = range.startDate || '';
    const end = range.endDate || '';
    const safe = (s) => String(s || '').replace(/[^a-zA-Z0-9-]/g, '-');
    return safe(start) + '-to-' + safe(end) + '-quick-report.md';
  }

  function validateQuickReportGenerator() {
    const results = [];
    const check = (label, actual, expected) => {
      const pass = JSON.stringify(actual) === JSON.stringify(expected);
      results.push({ label, pass, actual, expected });
    };
    const checkMd = (label, actual, expected) => {
      const pass = actual === expected;
      results.push({ label, pass, actual, expected });
    };

    const dictModule = globalThis.MME_REPORT_DICTIONARY;
    if (!dictModule || typeof dictModule.buildReportDictionary !== 'function') {
      return { ok: false, total: 0, passed: 0, failed: 1, cases: [{ label: 'dictionary module available', pass: false, actual: null, expected: 'function' }] };
    }

    const baseInput = {
      indexState: {
        ready: true,
        lastBuiltAt: 1234567890,
        tasks: [
          { done: true, text: 'Task on start', completedDate: '2026-08-03', line: 1, filePath: 'journals/a.md', fileKind: 'journals' },
          { done: true, text: 'Task on end', completedDate: '2026-08-09', line: 2, filePath: 'journals/a.md', fileKind: 'journals' },
          { done: true, text: 'Task outside', completedDate: '2026-08-10', line: 3, filePath: 'journals/a.md', fileKind: 'journals' },
          { done: true, text: 'Historical undated', completedDate: null, line: 4, filePath: 'journals/b.md', fileKind: 'journals' },
          { done: false, text: 'Open with due', dueDate: '2026-08-15', line: 5, filePath: 'journals/b.md', fileKind: 'journals' },
          { done: true, text: 'Invalid date', completedDate: '2026-02-30', line: 6, filePath: 'journals/c.md', fileKind: 'journals' },
        ],
        projects: [
          { name: 'Alpha', value: 50000, currency: 'USD', status: 'Quotation', expectedOrder: { raw: '26Q4', canonical: '2026-Q4', display: '26Q4', valid: true }, expectedBilling: { raw: '27Q1', canonical: '2027-Q1', display: '27Q1', valid: true }, expectedDelivery: { raw: '27Q1', canonical: '2027-Q1', display: '27Q1', valid: true }, sourcePath: 'journals/a.md', sourceLine: 10, sourceKind: 'journals', sourceName: 'a.md' },
          { name: 'Beta', value: 0, currency: 'BRL', status: 'Proposal', expectedOrder: { raw: '26Q3', canonical: '2026-Q3', display: '26Q3', valid: true }, expectedBilling: { raw: '', canonical: null, display: '', valid: false }, expectedDelivery: { raw: '', canonical: null, display: '', valid: false }, sourcePath: 'journals/a.md', sourceLine: 20, sourceKind: 'journals', sourceName: 'a.md' },
          { name: 'Gamma', value: null, currency: '', status: 'Lead', expectedOrder: { raw: '', canonical: null, display: '', valid: false }, expectedBilling: { raw: '', canonical: null, display: '', valid: false }, expectedDelivery: { raw: '', canonical: null, display: '', valid: false }, sourcePath: 'journals/b.md', sourceLine: 30, sourceKind: 'journals', sourceName: 'b.md' },
          { name: 'Delta', value: 30000, currency: '', status: 'Quotation', expectedOrder: { raw: '26Q2', canonical: '2026-Q2', display: '26Q2', valid: true }, expectedBilling: { raw: '', canonical: null, display: '', valid: false }, expectedDelivery: { raw: '', canonical: null, display: '', valid: false }, sourcePath: 'journals/b.md', sourceLine: 40, sourceKind: 'journals', sourceName: 'b.md' },
        ],
      },
      startDate: '2026-08-03',
      endDate: '2026-08-09',
      sections: [
        { id: 'summary', enabled: true },
        { id: 'completed-tasks', enabled: true },
        { id: 'project-forecast', enabled: true },
        { id: 'forecast-totals', enabled: true },
        { id: 'risks', enabled: true },
        { id: 'next-steps', enabled: true },
        { id: 'undated-completed-tasks', enabled: false },
      ],
      projectMode: 'all',
      generatedAt: '2026-08-09T00:00:00.000Z',
    };

    const dict = dictModule.buildReportDictionary(baseInput);
    check('dict ok', dict.ok, true);

    // 1. deterministic Markdown output
    const md1 = buildMarkdown(dict);
    const md2 = buildMarkdown(dict);
    checkMd('deterministic markdown', md1, md2);

    // 2. enabled sections appear
    checkMd('summary enabled', md1.includes('## Summary'), true);
    checkMd('completed-tasks enabled', md1.includes('## Completed Tasks'), true);
    checkMd('project-forecast enabled', md1.includes('## Project Forecast'), true);
    checkMd('forecast-totals enabled', md1.includes('## Forecast Totals'), true);
    checkMd('risks enabled', md1.includes('## Risks and Attention Points'), true);
    checkMd('next-steps enabled', md1.includes('## Next Steps'), true);

    // 3. disabled sections omitted
    checkMd('undated-completed-tasks disabled', md1.includes('## Completed Tasks Without Date'), false);

    // 4. custom normalized section order
    const customDict = dictModule.buildReportDictionary({
      ...baseInput,
      sections: [
        { id: 'next-steps', enabled: true },
        { id: 'summary', enabled: true },
        { id: 'unknown-id', enabled: true },
      ],
    });
    const customMd = buildMarkdown(customDict);
    const summaryIdx = customMd.indexOf('## Summary');
    const nextIdx = customMd.indexOf('## Next Steps');
    checkMd('custom order respected', summaryIdx > nextIdx, true);

    // 5. empty enabled section behavior
    const emptyDict = dictModule.buildReportDictionary({
      indexState: { ready: true, tasks: [], projects: [] },
      startDate: '2026-08-03',
      endDate: '2026-08-09',
      sections: baseInput.sections,
      projectMode: 'all',
      generatedAt: '2026-08-09T00:00:00.000Z',
    });
    const emptyMd = buildMarkdown(emptyDict);
    checkMd('empty tasks placeholder', emptyMd.includes('_No completed Tasks found for this period._'), true);
    checkMd('empty projects placeholder', emptyMd.includes('_No Projects match the selected Project scope._'), true);

    // 6. Markdown table-cell escaping
    const escapeDict = dictModule.buildReportDictionary({
      indexState: {
        ready: true,
        tasks: [],
        projects: [
          { name: 'A|B', value: 1000, currency: 'USD', status: 'Quotation', expectedOrder: { raw: '26Q4', canonical: '2026-Q4', display: '26Q4', valid: true }, expectedBilling: { raw: '', canonical: null, display: '', valid: false }, expectedDelivery: { raw: '', canonical: null, display: '', valid: false }, sourcePath: 'journals/a.md', sourceLine: 10, sourceKind: 'journals', sourceName: 'a.md' },
        ],
      },
      startDate: '2026-08-03',
      endDate: '2026-08-09',
      sections: baseInput.sections,
      projectMode: 'all',
      generatedAt: '2026-08-09T00:00:00.000Z',
    });
    const escapeMd = buildMarkdown(escapeDict);
    checkMd('table cell escaping', escapeMd.includes('A\\|B'), true);

    // 7. no mme-task metadata leakage
    checkMd('no mme-task leakage', md1.includes('mme-task'), false);

    // 8. Project zero value remains distinct from missing value
    checkMd('zero value included', md1.includes('Beta'), true);
    checkMd('zero value formatted', md1.includes('BRL 0'), true);

    // 9. mixed currencies remain separate
    checkMd('USD present', md1.includes('USD'), true);
    checkMd('BRL present', md1.includes('BRL'), true);

    // 10. suggested filename uses Report date range
    const filename = buildSuggestedFilename(dict);
    checkMd('suggested filename', filename, '2026-08-03-to-2026-08-09-quick-report.md');

    // 11. output has exactly one final newline
    checkMd('exactly one final newline', md1.endsWith('\n'), true);
    checkMd('no double final newline', md1.endsWith('\n\n'), false);

    // 12. same dictionary generates byte-identical output
    const md3 = buildMarkdown(dict);
    checkMd('byte identical rerun', md1, md3);

    // 13. generator does not mutate the dictionary
    const dictBefore = JSON.stringify(dict);
    buildMarkdown(dict);
    const dictAfter = JSON.stringify(dict);
    check('no dictionary mutation', dictAfter, dictBefore);

    // 14. source provenance renders according to architecture plan
    checkMd('task source path not rendered as link', md1.includes('sourcePath'), false);
    checkMd('project source path not rendered as link', md1.includes('sourceName'), false);

    // 15. markdown ends with exactly one newline after trailing section
    checkMd('exactly one final newline', md1.endsWith('\n'), true);
    checkMd('no double final newline', md1.endsWith('\n\n'), false);

    const failed = results.filter((r) => !r.pass);
    return { ok: failed.length === 0, total: results.length, passed: results.length - failed.length, failed: failed.length, cases: results };
  }

  const MME_QUICK_REPORT = Object.freeze({
    buildMarkdown,
    buildSuggestedFilename,
    validateQuickReportGenerator,
  });

  try {
    window.MME_QUICK_REPORT = MME_QUICK_REPORT;
    globalThis.MME_QUICK_REPORT = MME_QUICK_REPORT;
    if (typeof globalThis.__validateQuickReportGenerator === 'undefined') {
      globalThis.__validateQuickReportGenerator = validateQuickReportGenerator;
    }
  } catch {}
})();
