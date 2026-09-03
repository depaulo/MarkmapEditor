// @ts-nocheck
// Legacy browser runtime extracted from index.html.
// TypeScript checking is intentionally disabled for this file during the refactor.
// Use node --check and browser testing for validation until this file is split into typed modules.
// ================================
// Shiki HTML syntax highlighting
// Uses dynamic ESM import instead of global window.shiki
// ================================

let __shikiHighlighterPromise = null;

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeShikiLang(lang) {
  const l = String(lang || '')
    .trim()
    .split(/\s+/)[0]
    .toLowerCase();

  const aliases = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',
    yml: 'yaml',
    md: 'markdown',
  };

  return aliases[l] || l || 'text';
}

async function initShiki() {
  if (!__shikiHighlighterPromise) {
    __shikiHighlighterPromise = import('https://cdn.jsdelivr.net/npm/shiki@4.0.2/+esm').then(
      ({ createHighlighter }) => {
        return createHighlighter({
          themes: ['github-light', 'github-dark'],
          langs: [
            'text',
            'javascript',
            'jsx',
            'typescript',
            'tsx',
            'python',
            'bash',
            'json',
            'markdown',
            'html',
            'css',
            'yaml',
            'xml',
          ],
        });
      }
    );
  }

  return __shikiHighlighterPromise;
}

// ---- Render source cleaner (ACT B correction) ----
// Removes recognized mme-task metadata comments from the rendering copy only.
// Physical Markdown source is never modified.
// Preserves unrelated HTML comments and code blocks.
function stripMmeTaskMetadataForRender(mdText) {
  const text = String(mdText || '');
  const lines = text.split('\n');
  const out = [];
  let inFence = false;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }

    if (inFence) {
      out.push(line);
      continue;
    }

    out.push(line.replace(/<!--\s*mme-task:[\s\S]*?-->/gi, ''));
  }

  return out.join('\n');
}

async function renderHtmlWithShiki(mdText) {
  const highlighter = await initShiki();

  const isDark = document.documentElement.classList.contains('dark');
  const theme = isDark ? 'github-dark' : 'github-light';

  const renderer = new marked.Renderer();

  marked.setOptions({
    gfm: true,
    breaks: false,
  });

  renderer.heading = function (token) {
    const text = typeof token === 'object' ? token.text : String(token || '');
    const depth = typeof token === 'object' ? token.depth : 2;
    const id = slugifyHeading(text);

    return `<h${depth} id="${id}">
		${text}
		<a href="#${id}" style="text-decoration:none; opacity:.5;">🔗</a>
	  </h${depth}>`;
  };

  renderer.code = function (codeOrToken, infostring) {
    let code;
    let lang;

    // Supports both older and newer marked renderer signatures
    if (codeOrToken && typeof codeOrToken === 'object') {
      code = codeOrToken.text ?? codeOrToken.raw ?? '';
      lang = codeOrToken.lang ?? '';
    } else {
      code = codeOrToken ?? '';
      lang = infostring ?? '';
    }

    const normalizedLang = normalizeShikiLang(lang);

    try {
      const html = highlighter.codeToHtml(String(code), {
        lang: normalizedLang,
        theme,
      });

      return `
<div class="code-block">
  <button class="copy-btn" type="button">Copy</button>
  ${html}
</div>
`;
    } catch (e) {
      return `
<div class="code-block">
  <button class="copy-btn" type="button">Copy</button>
  <pre><code>${escapeHtml(code)}</code></pre>
</div>
`;
    }
  };

  // R-LINK1: Transform wiki links in HTML Preview
  renderer.text = function (text) {
    // Support both newer (token object) and older (string) marked API
    const str =
      typeof text === 'object' && text !== null
        ? String(text.text ?? text.raw ?? '')
        : String(text || '');
    const WIKI_RE = /\[\[([^\[\]\n]+?)\]\]/g;

    let result = '';
    let lastIndex = 0;
    let match;

    while ((match = WIKI_RE.exec(str)) !== null) {
      // Add text before this match
      if (match.index > lastIndex) {
        result += escapeHtml(str.slice(lastIndex, match.index));
      }

      const inner = match[1];
      const pipeIndex = inner.indexOf('|');
      let target = pipeIndex !== -1 ? inner.slice(0, pipeIndex) : inner;
      const label = pipeIndex !== -1 ? inner.slice(pipeIndex + 1) : target;

      target = target.trim();
      const displayLabel = label.trim();

      if (target) {
        // Escape attributes
        const escapedTarget = escapeHtml(target);
        const escapedLabel = escapeHtml(displayLabel);

        result += `<span class="wikiLink" data-wiki-target="${escapedTarget}" title="Wiki link: ${escapedTarget}">${escapedLabel}</span>`;
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < str.length) {
      result += escapeHtml(str.slice(lastIndex));
    }

    return result || str;
  };

  const renderSource = stripMmeTaskMetadataForRender(mdText);
  return marked.parse(renderSource, { renderer });
}

function slugifyHeading(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// ============================================================
// APP SCRIPT (classic <script>)
// ============================================================

// --- Dark Mode Toggle / Theme API ---
(function () {
  const html = document.documentElement;
  const STORAGE_KEY = 'markmap:darkMode';

  function applyDarkMode(enabled) {
    html.classList.toggle('dark', enabled);

    try {
      localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    } catch {}

    try {
      if (typeof updateMapOverlayThemeButton === 'function') {
        updateMapOverlayThemeButton();
      }
    } catch {}
  }

  async function refreshHtmlForTheme() {
    try {
      const htmlPaneEl = document.getElementById('htmlPane');
      const mdEl = document.getElementById('md');

      if (
        htmlPaneEl &&
        mdEl &&
        htmlPaneEl.style.display === 'block' &&
        typeof renderHtmlWithShiki === 'function'
      ) {
        htmlPaneEl.innerHTML = await renderHtmlWithShiki(mdEl.value);

        if (typeof buildHtmlHeadingIndex === 'function') {
          buildHtmlHeadingIndex();
        }

        if (typeof syncHtmlScrollToEditor === 'function') {
          syncHtmlScrollToEditor('dark mode html refresh');
        }

        if (typeof log === 'function') {
          log('Dark mode: HTML pane refreshed only');
        }
      }

      if (typeof syncToolbarHeight === 'function') {
        syncToolbarHeight();
      }
    } catch (e) {
      try {
        console.error('Dark mode HTML refresh failed:', e);
      } catch {}
    }
  }

  window.setDarkMode = async function setDarkMode(enabled) {
    applyDarkMode(!!enabled);
    await refreshHtmlForTheme();
  };

  window.toggleDarkMode = async function toggleDarkMode() {
    const enabled = !html.classList.contains('dark');
    await window.setDarkMode(enabled);
  };

  window.isDarkMode = function isDarkMode() {
    return html.classList.contains('dark');
  };

  const saved = localStorage.getItem(STORAGE_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = saved === '1' || (saved === null && prefersDark);

  applyDarkMode(initial);

  // Optional backward compatibility:
  // If btnDarkMode still exists in some older copy, wire it safely.
  const oldBtn = document.getElementById('btnDarkMode');
  if (oldBtn && !oldBtn.__bound) {
    oldBtn.textContent = initial ? '☀️' : '🌙';

    oldBtn.addEventListener('click', async () => {
      await window.toggleDarkMode();
      oldBtn.textContent = html.classList.contains('dark') ? '☀️' : '🌙';
    });

    oldBtn.__bound = true;
  }
})();

// ================================
// Release 38 — Debug + logs
// ================================
const logs = document.getElementById('logs');
const logBox = document.getElementById('log');
const saveStatus = document.getElementById('saveStatus');
const mapPane = document.getElementById('mapPane');

// PWA diagnostics flag.
// Set to false after debugging is finished.
const PWA_DEBUG_LOGS = false;

// Expose for js/pwa/diagnostics.js
globalThis.log = log;
globalThis.pwaDebugLog = pwaDebugLog;

function log(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logBox.textContent += line + '\n';
  logBox.scrollTop = logBox.scrollHeight;
  try {
    console.debug(line);
  } catch {}
}

function pwaDebugLog(msg, data = null) {
  try {
    if (typeof PWA_DEBUG_LOGS !== 'undefined' && !PWA_DEBUG_LOGS) return;

    let line = `[PWA] ${msg}`;

    if (data !== null && data !== undefined) {
      try {
        line += ' ' + JSON.stringify(data, null, 2);
      } catch {
        line += ' ' + String(data);
      }
    }

    log(line);
  } catch (e) {
    try {
      console.warn('[PWA debug log failed]', e);
    } catch {}
  }
}

const WORKSPACE_SIDEBAR_WIDTH_STORAGE_KEY = 'markmap:workspace:sidebarWidth';
const WORKSPACE_SIDEBAR_WIDTH_DEFAULT = 280;
const WORKSPACE_SIDEBAR_WIDTH_MIN = 220;
const WORKSPACE_SIDEBAR_WIDTH_MAX = 420;
const DEBUG_WORKSPACE_RESIZE = false;

function clampWorkspaceSidebarWidth(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return WORKSPACE_SIDEBAR_WIDTH_DEFAULT;
  }

  return Math.max(
    WORKSPACE_SIDEBAR_WIDTH_MIN,
    Math.min(WORKSPACE_SIDEBAR_WIDTH_MAX, Math.round(n))
  );
}

function getStoredWorkspaceSidebarWidth() {
  try {
    const raw = localStorage.getItem(WORKSPACE_SIDEBAR_WIDTH_STORAGE_KEY);
    return clampWorkspaceSidebarWidth(raw || WORKSPACE_SIDEBAR_WIDTH_DEFAULT);
  } catch {
    return WORKSPACE_SIDEBAR_WIDTH_DEFAULT;
  }
}

function storeWorkspaceSidebarWidth(width) {
  try {
    localStorage.setItem(
      WORKSPACE_SIDEBAR_WIDTH_STORAGE_KEY,
      String(clampWorkspaceSidebarWidth(width))
    );
  } catch {
    // Ignore storage errors.
  }
}

function applyWorkspaceSidebarWidth(width, options = {}) {
  const sidebar = document.getElementById('workspaceSidebar');

  if (!sidebar) {
    log?.('Workspace: sidebar width apply failed; sidebar missing');
    return;
  }

  const safeWidth = clampWorkspaceSidebarWidth(width);

  document.documentElement.style.setProperty('--workspace-sidebar-width', `${safeWidth}px`);

  sidebar.style.flexBasis = `${safeWidth}px`;
  sidebar.style.width = `${safeWidth}px`;

  /*
    Important:
    Do not set minWidth/maxWidth inline to the same value.
    Let CSS min/max remain 220/420.
    Collapsed CSS uses !important overrides.
  */

  if (options.log) {
    log?.(`Workspace: sidebar width applied ${safeWidth}px`);
  }
}

const WORKSPACE_INDEX_STATE = {
  ready: false,
  lastBuiltAt: 0,
  files: [],
  byPath: new Map(),
  byKind: {
    journals: [],
    concepts: [],
  },
  tags: new Map(),
  tasks: [],
  links: new Map(),
  projects: [],
};

try {
  window.WORKSPACE_INDEX_STATE = WORKSPACE_INDEX_STATE;
  globalThis.WORKSPACE_INDEX_STATE = WORKSPACE_INDEX_STATE;
} catch {}

function restoreWorkspaceSidebarWidth() {
  const width = getStoredWorkspaceSidebarWidth();
  applyWorkspaceSidebarWidth(width);
  log?.(`Workspace: sidebar width restored ${width}px`);
}

function normalizeParserText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function stripMarkdownHeadingPrefix(line) {
  return String(line || '')
    .replace(/^#{1,6}\s+/, '')
    .trim();
}

function countWords(text) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words.length;
}

function inferDateFromWorkspacePath(path, text = '') {
  const p = String(path || '');

  const pathDate = p.match(/(\d{4}-\d{2}-\d{2})/);
  if (pathDate) return pathDate[1];

  const textDate = String(text || '').match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (textDate) return textDate[1];

  return '';
}

function normalizeTagValue(value) {
  return String(value || '')
    .trim()
    .replace(/^#/, '')
    .replace(/[\,\.;:]+$/, '')
    .toLowerCase();
}

function parseMarkdownHeadings(text) {
  const lines = normalizeParserText(text).split('\n');
  const headings = [];

  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);

    if (!match) return;

    headings.push({
      level: match[1].length,
      text: stripMarkdownHeadingPrefix(line),
      line: index + 1,
    });
  });

  return headings;
}

function getMarkdownTitle(text, fallback = '') {
  const headings = parseMarkdownHeadings(text);
  const h1 = headings.find((h) => h.level === 1);

  if (h1?.text) return h1.text;

  return fallback;
}

// parseSimpleYamlFrontmatter moved to js/workspace/workspace-parser.js
// (exposed as window.WORKSPACE_PARSER.parseSimpleYamlFrontmatter)
// normalizeWorkspaceTagName moved to js/workspace/workspace-parser.js
// isReservedWorkspaceTag moved to js/workspace/workspace-parser.js
function stripYamlFrontmatterForTags(text) {
  return String(text || '').replace(/^---\s*[\s\S]*?\s*---\s*/, '');
}

// normalizeFrontmatterTags moved to js/workspace/workspace-parser.js
// parseMarkdownTags moved to js/workspace/workspace-parser.js
// ---- Task metadata parser (ACT B) ----

function normalizeMetadataKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
}

function parseMmeTaskMetadata(rawLine) {
  const line = String(rawLine || '');
  const commentMatch = line.match(/<!--\s*mme-task:\s*([\s\S]*?)\s*-->/i);
  if (!commentMatch) return null;

  const inner = String(commentMatch[1] || '').trim();
  if (!inner) return { metadata: {} };

  const parts = inner
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);
  const metadata = {};

  for (const part of parts) {
    const kv = part.match(/^([^=]+?)\s*=\s*(.*)$/);
    if (!kv) continue;
    const key = normalizeMetadataKey(kv[1]);
    const value = String(kv[2] || '').trim();
    if (!key) continue;
    metadata[key] = value;
  }

  if (Object.keys(metadata).length === 0) return { metadata: {} };
  return { metadata };
}

function cleanTaskText(rawMatch3) {
  const text = String(rawMatch3 || '').trim();
  const cleaned = text.replace(/<!--\s*mme-task:[\s\S]*?-->/gi, '').trim();
  return cleaned;
}

function parseMarkdownTasks(text) {
  const lines = normalizeParserText(text).split('\n');
  const tasks = [];
  const lifecycle = globalThis.MME_TASK_LIFECYCLE;
  const isValidDate =
    lifecycle && typeof lifecycle.isValidIsoDate === 'function'
      ? lifecycle.isValidIsoDate
      : null;

  lines.forEach((line, index) => {
    const match = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/);

    if (!match) return;

    const rawLine = line;
    const rawContent = match[3] || '';
    const cleanText = cleanTaskText(rawContent);
    const metaResult = parseMmeTaskMetadata(rawLine);

    const task = {
      line: index + 1,
      done: String(match[2] || '').toLowerCase() === 'x',
      text: cleanText,
      raw: rawLine,
      metadata: metaResult?.metadata || {},
      completedDate: null,
      priority: null,
      owner: null,
      dueDate: null,
    };

        const meta = task.metadata;

    if (meta.priority) {
      task.priority = String(meta.priority).trim() || null;
    }
    if (meta.owner) {
      task.owner = String(meta.owner).trim() || null;
    }
    if (meta.due && isValidDate) {
      const dueVal = String(meta.due).trim();
      if (isValidDate(dueVal)) {
        task.dueDate = dueVal;
      }
    }

    // T1B lifecycle enrichment: adopt the pure lifecycle owner. normalizeTask
    // adds status/effectiveStatus/openedDate/startedDate/closedDate (where
    // closedDate === validated completedDate) while preserving every existing
    // source field. Checkbox-authoritative normalization applies. Parsing never
    // writes metadata; invalid raw dates survive in task.metadata and normalize
    // to null on the derived date fields. Falls back to legacy validation only
    // if the lifecycle owner is unexpectedly absent.
    if (lifecycle && typeof lifecycle.normalizeTask === 'function') {
      Object.assign(task, lifecycle.normalizeTask(task));
    } else if (task.done && meta.completed && isValidDate) {
      const val = String(meta.completed || '').trim();
      if (isValidDate(val)) {
        task.completedDate = val;
      }
    }

    tasks.push(task);
  });

  return tasks;
}

// ---- Dormant Task metadata parser validator (ACT B) ----
// Does not run during normal application startup.
// To execute, open browser console and call: window.__validateTaskMetadataParser()
if (typeof window !== 'undefined') {
  try {
    window.__validateTaskMetadataParser = function validateTaskMetadataParser() {
      const cases = [
        {
          label: 'Open without metadata',
          line: '- [ ] Update quotation',
          expected: {
            done: false,
            text: 'Update quotation',
            metadata: {},
            completedDate: null,
            priority: null,
            owner: null,
            dueDate: null,
          },
        },
        {
          label: 'Completed without metadata',
          line: '- [x] Historical task',
          expected: {
            done: true,
            text: 'Historical task',
            metadata: {},
            completedDate: null,
            priority: null,
            owner: null,
            dueDate: null,
          },
        },
        {
          label: 'Valid completed date',
          line: '- [x] Update quotation <!-- mme-task: completed=2026-08-05 -->',
          expected: {
            done: true,
            text: 'Update quotation',
            metadata: { completed: '2026-08-05' },
            completedDate: '2026-08-05',
            priority: null,
            owner: null,
            dueDate: null,
          },
        },
        {
          label: 'Invalid completed date',
          line: '- [x] Bad <!-- mme-task: completed=2026-02-30 -->',
          expected: {
            done: true,
            text: 'Bad',
            metadata: { completed: '2026-02-30' },
            completedDate: null,
          },
        },
        {
          label: 'Impossible date',
          line: '- [x] Bad <!-- mme-task: completed=26-08-05 -->',
          expected: {
            done: true,
            text: 'Bad',
            metadata: { completed: '26-08-05' },
            completedDate: null,
          },
        },
        {
          label: 'Valid due date',
          line: '- [ ] Task <!-- mme-task: due=2026-08-10 -->',
          expected: {
            done: false,
            text: 'Task',
            metadata: { due: '2026-08-10' },
            completedDate: null,
            dueDate: '2026-08-10',
          },
        },
        {
          label: 'Invalid due date',
          line: '- [ ] Task <!-- mme-task: due=2026-13-01 -->',
          expected: {
            done: false,
            text: 'Task',
            metadata: { due: '2026-13-01' },
            completedDate: null,
            dueDate: null,
          },
        },
        {
          label: 'Priority',
          line: '- [ ] Task <!-- mme-task: priority=high -->',
          expected: { done: false, text: 'Task', metadata: { priority: 'high' }, priority: 'high' },
        },
        {
          label: 'Owner',
          line: '- [ ] Task <!-- mme-task: owner=Adelson -->',
          expected: { done: false, text: 'Task', metadata: { owner: 'Adelson' }, owner: 'Adelson' },
        },
        {
          label: 'Multiple fields',
          line: '- [x] Task <!-- mme-task: completed=2026-08-05; priority=high; owner=Adelson; due=2026-08-10 -->',
          expected: {
            done: true,
            text: 'Task',
            metadata: {
              completed: '2026-08-05',
              priority: 'high',
              owner: 'Adelson',
              due: '2026-08-10',
            },
            completedDate: '2026-08-05',
            priority: 'high',
            owner: 'Adelson',
            dueDate: '2026-08-10',
          },
        },
        {
          label: 'Unknown field preserved',
          line: '- [x] Task <!-- mme-task: completed=2026-08-05; unknown=value -->',
          expected: {
            metadata: { completed: '2026-08-05', unknown: 'value' },
            completedDate: '2026-08-05',
          },
        },
        {
          label: 'Duplicate key last wins',
          line: '- [x] Task <!-- mme-task: completed=2026-08-05; completed=2026-08-06 -->',
          expected: { metadata: { completed: '2026-08-06' }, completedDate: '2026-08-06' },
        },
        {
          label: 'Metadata removed from text',
          line: '- [x] Update quotation <!-- mme-task: completed=2026-08-05; owner=Adelson -->',
          expected: { text: 'Update quotation' },
        },
        {
          label: 'Raw line preserved',
          line: '- [x] Task <!-- mme-task: completed=2026-08-05 -->',
          expected: { raw: '- [x] Task <!-- mme-task: completed=2026-08-05 -->' },
        },
        {
          label: 'Unrelated HTML comment not parsed',
          line: '- [ ] Task <!-- some-other: value -->',
          expected: { metadata: {}, text: 'Task <!-- some-other: value -->' },
        },
        {
          label: 'Spacing tolerance',
          line: '- [x] Task <!-- mme-task: completed = 2026-08-05; owner = Adelson -->',
          expected: {
            metadata: { completed: '2026-08-05', owner: 'Adelson' },
            completedDate: '2026-08-05',
            owner: 'Adelson',
          },
        },
        {
          label: 'Duplicate task text lines separate',
          line: '- [ ] Task\n- [ ] Task',
          expected: { count: 2 },
        },
      ];

      const results = [];
      let passCount = 0;
      let failCount = 0;

      for (const c of cases) {
        if (c.label === 'Duplicate task text lines separate') {
          const parsed = parseMarkdownTasks(c.line);
          const ok = parsed.length === 2;
          results.push({ label: c.label, pass: ok, actual: parsed.length, expected: 2 });
          if (ok) passCount++;
          else failCount++;
          continue;
        }

        const parsed = parseMarkdownTasks(c.line);
        const task = parsed[0];
        if (!task) {
          results.push({
            label: c.label,
            pass: false,
            actual: 'no task parsed',
            expected: c.expected,
          });
          failCount++;
          continue;
        }

        let ok = true;
        for (const key of Object.keys(c.expected)) {
          if (key === 'count') continue;
          const actual = task[key];
          const expected = c.expected[key];
          if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            ok = false;
            break;
          }
        }
        results.push({ label: c.label, pass: ok, actual: task, expected: c.expected });
        if (ok) passCount++;
        else failCount++;
      }

      return {
        ok: failCount === 0,
        total: results.length,
        passed: passCount,
        failed: failCount,
        results,
      };
    };
  } catch {}
}

function normalizeConceptName(value) {
  return String(value || '')
    .trim()
    .replace(/^\.?\//, '')
    .replace(/^concepts\//i, '')
    .replace(/\.md$/i, '')
    .replace(/\|.*$/, '')
    .trim();
}

function parseConceptLinks(text) {
  const source = normalizeParserText(text);
  const links = new Set();

  const wikiRe = /\[\[([^\]]+)\]\]/g;
  let match;

  while ((match = wikiRe.exec(source))) {
    const name = normalizeConceptName(match[1]);

    if (name) links.add(name);
  }

  const pathRe = /(?:^|\s)(?:\.\/)?concepts\/([^\s)\]]+?\.md)\b/g;

  while ((match = pathRe.exec(source))) {
    const name = normalizeConceptName(match[1]);

    if (name) links.add(name);
  }

  return Array.from(links).sort();
}

function parseVisibleHeaderFields(text) {
  const fields = {};
  const lines = normalizeParserText(text).split('\n').slice(0, 30);

  for (const line of lines) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9 _-]{1,30})\s*:\s*(.*)$/);

    if (!match) continue;

    const key = String(match[1] || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');

    const value = String(match[2] || '').trim();

    fields[key] = value;
  }

  return fields;
}

// parseWorkspaceDocument moved to js/workspace/workspace-parser.js
// (exposed as window.WORKSPACE_PARSER.parseWorkspaceDocument)
async function readWorkspaceFileText(file) {
  if (!file?.handle) return '';

  const blob = await file.handle.getFile();
  return await blob.text();
}

async function buildWorkspaceIndex() {
  if (!WORKSPACE_STATE?.rootHandle) {
    WORKSPACE_INDEX_STATE.ready = false;
    WORKSPACE_INDEX_STATE.files = [];
    WORKSPACE_INDEX_STATE.byPath = new Map();
    WORKSPACE_INDEX_STATE.byKind = {
      journals: [],
      concepts: [],
    };
    WORKSPACE_INDEX_STATE.tags = new Map();
    WORKSPACE_INDEX_STATE.tasks = [];
    WORKSPACE_INDEX_STATE.links = new Map();
    WORKSPACE_INDEX_STATE.projects = [];

    log?.('Workspace Index: skipped; workspace not open');
    return WORKSPACE_INDEX_STATE;
  }

  const allFiles = [
    ...(WORKSPACE_STATE.files?.journals || []),
    ...(WORKSPACE_STATE.files?.concepts || []),
  ];

  const parsedFiles = [];

  for (const file of allFiles) {
    try {
      const kind =
        typeof normalizeWorkspaceKindForCompare === 'function'
          ? normalizeWorkspaceKindForCompare(file.kind || '')
          : String(file.kind || '').trim();

      const name = file.name || '';
      const path = file.path || `${kind}/${name}`;
      const text = await readWorkspaceFileText(file);

      const parsed = parseWorkspaceDocument({
        kind,
        name,
        path,
        text,
      });

      parsedFiles.push(parsed);
    } catch (e) {
      log?.(`Workspace Index: failed parsing ${file.path || file.name}: ${e?.message || e}`);
    }
  }

  const byPath = new Map();
  const byKind = {
    journals: [],
    concepts: [],
  };
  const tags = new Map();
  const tasks = [];
  const links = new Map();
  const projects = [];

  for (const parsed of parsedFiles) {
    byPath.set(parsed.path, parsed);

    if (!byKind[parsed.kind]) {
      byKind[parsed.kind] = [];
    }

    byKind[parsed.kind].push(parsed);

    for (const tag of parsed.tags) {
      if (!tags.has(tag)) tags.set(tag, []);
      tags.get(tag).push(parsed.path);
    }

    for (const task of parsed.tasks) {
      tasks.push({
        ...task,
        filePath: parsed.path,
        fileName: parsed.name,
        fileKind: parsed.kind,
      });
    }

    for (const concept of parsed.conceptLinks) {
      if (!links.has(concept)) links.set(concept, []);
      links.get(concept).push(parsed.path);
    }

    const parsedProjects = Array.isArray(parsed.projects) ? parsed.projects : [];
    for (const project of parsedProjects) {
      // Enrich source metadata when missing
      if (!project.sourcePath) project.sourcePath = parsed.path || '';
      if (!project.sourceKind) project.sourceKind = parsed.kind || '';
      if (!project.sourceName) project.sourceName = parsed.name || '';
      projects.push(project);
    }
  }

  // Deterministic sort for projects
  projects.sort(function (a, b) {
    const orderA = a.expectedOrder;
    const orderB = b.expectedOrder;
    const validA = orderA && orderA.valid === true;
    const validB = orderB && orderB.valid === true;

    // Scheduled before unscheduled
    if (validA && !validB) return -1;
    if (!validA && validB) return 1;

    // Valid canonical ascending
    if (validA && validB) {
      const canA = orderA.canonical || '';
      const canB = orderB.canonical || '';
      if (canA !== canB) return canA < canB ? -1 : 1;
    }

    // Name tiebreaker (case-insensitive, stable)
    const nameA = String(a.name || '').toLowerCase();
    const nameB = String(b.name || '').toLowerCase();
    if (nameA !== nameB) return nameA < nameB ? -1 : 1;

    // Source path tiebreaker
    const pathA = String(a.sourcePath || '');
    const pathB = String(b.sourcePath || '');
    if (pathA !== pathB) return pathA < pathB ? -1 : 1;

    // Source line tiebreaker (numeric)
    return (a.sourceLine || 0) - (b.sourceLine || 0);
  });

  WORKSPACE_INDEX_STATE.ready = true;
  WORKSPACE_INDEX_STATE.lastBuiltAt = Date.now();
  WORKSPACE_INDEX_STATE.files = parsedFiles;
  WORKSPACE_INDEX_STATE.byPath = byPath;
  WORKSPACE_INDEX_STATE.byKind = byKind;
  WORKSPACE_INDEX_STATE.tags = tags;
  WORKSPACE_INDEX_STATE.tasks = tasks;
  WORKSPACE_INDEX_STATE.links = links;
  WORKSPACE_INDEX_STATE.projects = projects;

  // Dispatch workspace index ready event for late modules
  try {
    window.dispatchEvent(
      new CustomEvent('mme-workspace-index-ready', {
        detail: {
          files: parsedFiles.length,
          tasks: tasks.length,
        },
      })
    );
  } catch {}

  renderWorkspaceIndexSummary();
  renderWorkspaceActivePanel?.();
  renderWorkspaceTasksPanel();
  renderWorkspaceRelatedPanel?.();
  renderWorkspaceTagsPanel?.();
  updateWorkspaceJournalSidebarTitlesFromIndex?.();
  renderWorkspaceJournalTimeline?.();

  const openTasks = tasks.filter((task) => !task.done).length;
  const doneTasks = tasks.filter((task) => task.done).length;

  log?.(
    `Workspace Index: built files=${parsedFiles.length} journals=${
      byKind.journals.length
    } concepts=${byKind.concepts.length} tags=${tags.size} tasks=${
      tasks.length
    } openTasks=${openTasks} doneTasks=${doneTasks} links=${links.size} projects=${projects.length}`
  );

  return WORKSPACE_INDEX_STATE;
}

let __workspaceIndexTimer = null;

function scheduleWorkspaceIndexRebuild(reason = 'scheduled') {
  clearTimeout(__workspaceIndexTimer);

  __workspaceIndexTimer = setTimeout(async () => {
    try {
      await buildWorkspaceIndex();
      renderWorkspaceActivePanel?.();
      renderWorkspaceTasksPanel?.();
      renderWorkspaceRelatedPanel?.();
      renderWorkspaceTagsPanel?.();
      renderWorkspaceJournalTimeline?.();
      log?.(`Workspace Index: rebuild complete (${reason})`);
    } catch (e) {
      log?.(`Workspace Index: rebuild failed (${reason}): ${e?.message || e}`);
    }
  }, 350);
}

function logWorkspaceIndexSummary() {
  const index = WORKSPACE_INDEX_STATE;

  if (!index.ready) {
    log?.('Workspace Index: not ready');
    return;
  }

  const openTasks = index.tasks.filter((task) => !task.done).length;
  const doneTasks = index.tasks.filter((task) => task.done).length;

  log?.(
    `Workspace Index Summary: files=${index.files.length} journals=${
      index.byKind.journals.length
    } concepts=${index.byKind.concepts.length} tags=${index.tags.size} tasks=${
      index.tasks.length
    } openTasks=${openTasks} doneTasks=${doneTasks} links=${index.links.size} projects=${index.projects.length}`
  );
}

try {
  window.buildWorkspaceIndex = buildWorkspaceIndex;
  window.scheduleWorkspaceIndexRebuild = scheduleWorkspaceIndexRebuild;
  window.logWorkspaceIndexSummary = logWorkspaceIndexSummary;
  globalThis.buildWorkspaceIndex = buildWorkspaceIndex;
  globalThis.scheduleWorkspaceIndexRebuild = scheduleWorkspaceIndexRebuild;
  globalThis.logWorkspaceIndexSummary = logWorkspaceIndexSummary;

  // Workspace Panels debug helper exposure
  window.wireWorkspacePanelCollapseControls = wireWorkspacePanelCollapses;
} catch {}

function ensureWorkspaceSidebarResizeHandle() {
  const sidebar = document.getElementById('workspaceSidebar');

  if (!sidebar) {
    log?.('Workspace: sidebar resize handle ensure failed; sidebar missing');
    return null;
  }

  let handle = document.getElementById('workspaceSidebarResizeHandle');

  if (!handle) {
    handle = document.createElement('div');
    handle.id = 'workspaceSidebarResizeHandle';
    handle.setAttribute('aria-hidden', 'true');
    // Resize handle belongs to the sidebar container itself, not the scrolling content.
    sidebar.appendChild(handle);

    log?.('Workspace: sidebar resize handle recreated');
  }

  return handle;
}

function getWorkspaceSidebarContentHost() {
  const sidebar = document.getElementById('workspaceSidebar');
  if (!sidebar) return null;

  // Navigation History V1: if the persistent scroller is present, panels belong there.
  const scroller = sidebar.querySelector(':scope > .workspaceNavScroller');
  return scroller || sidebar;
}

function wireWorkspaceSidebarResize() {
  const sidebar = document.getElementById('workspaceSidebar');
  const handle = ensureWorkspaceSidebarResizeHandle();

  if (!sidebar || !handle) {
    log?.(
      `Workspace: sidebar resize not wired sidebar=${Boolean(sidebar)} handle=${Boolean(handle)}`
    );
    return;
  }

  if (handle.__workspaceSidebarResizeBound) {
    log?.('Workspace: sidebar resize already wired');
    return;
  }

  let startX = 0;
  let startWidth = 0;
  let dragging = false;

  function isSidebarCollapsed() {
    return document.documentElement.classList.contains('journal-sidebar-collapsed');
  }

  function onPointerMove(event) {
    if (!dragging) return;

    event.preventDefault();

    const delta = event.clientX - startX;
    const nextWidth = clampWorkspaceSidebarWidth(startWidth + delta);

    if (DEBUG_WORKSPACE_RESIZE) {
      log?.(`Workspace: sidebar width live ${nextWidth}px`);
    }

    applyWorkspaceSidebarWidth(nextWidth);
  }

  function onPointerUp(event) {
    if (!dragging) return;

    event.preventDefault();

    dragging = false;

    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('pointerup', onPointerUp, true);
    document.body.classList.remove('workspace-sidebar-resizing');

    const rect = sidebar.getBoundingClientRect();
    const finalWidth = clampWorkspaceSidebarWidth(rect.width);

    storeWorkspaceSidebarWidth(finalWidth);
    applyWorkspaceSidebarWidth(finalWidth);

    log?.(`Workspace: sidebar resize end ${finalWidth}px`);
  }

  handle.addEventListener(
    'pointerdown',
    (event) => {
      if (isSidebarCollapsed()) {
        log?.('Workspace: sidebar resize ignored while collapsed');
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const rect = sidebar.getBoundingClientRect();

      startX = event.clientX;
      startWidth = rect.width;
      dragging = true;

      document.body.classList.add('workspace-sidebar-resizing');

      document.addEventListener('pointermove', onPointerMove, true);
      document.addEventListener('pointerup', onPointerUp, true);

      try {
        handle.setPointerCapture?.(event.pointerId);
      } catch {}

      log?.(`Workspace: sidebar resize start ${Math.round(startWidth)}px`);
    },
    true
  );

  handle.__workspaceSidebarResizeBound = true;
  log?.('Workspace: sidebar resize wired');
}

const WORKSPACE_SEARCH_MIN_CHARS = 2;
let __workspaceSearchTimer = null;
let __workspaceSearchLastQuery = '';

function normalizeWorkspaceSearchQuery(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function getWorkspaceSearchIcon(kind) {
  const normalized =
    typeof normalizeWorkspaceKindForCompare === 'function'
      ? normalizeWorkspaceKindForCompare(kind)
      : String(kind || '').trim();

  if (normalized === 'journals') return '📝';
  if (normalized === 'concepts') return '🧠';

  return '📄';
}

function getWorkspaceSearchKindLabel(kind) {
  const normalized =
    typeof normalizeWorkspaceKindForCompare === 'function'
      ? normalizeWorkspaceKindForCompare(kind)
      : String(kind || '').trim();

  if (normalized === 'journals') return 'Journal';
  if (normalized === 'concepts') return 'Concept';

  return 'File';
}

const WORKSPACE_PANEL_COLLAPSE_STORAGE_KEY = 'markmap:workspace:panelCollapsed';

const WORKSPACE_PANEL_DEFAULT_COLLAPSED = {
  active: false,
  index: true,
  related: false,
  tasks: true,
  tags: true,
  journals: false,
  concepts: false,
  projects: false,
};

function getWorkspacePanelCollapsedState() {
  try {
    const raw = localStorage.getItem(WORKSPACE_PANEL_COLLAPSE_STORAGE_KEY);
    if (!raw) return { ...WORKSPACE_PANEL_DEFAULT_COLLAPSED };

    return {
      ...WORKSPACE_PANEL_DEFAULT_COLLAPSED,
      ...JSON.parse(raw),
    };
  } catch {
    return { ...WORKSPACE_PANEL_DEFAULT_COLLAPSED };
  }
}

function setWorkspacePanelCollapsedState(panelId, collapsed) {
  const state = getWorkspacePanelCollapsedState();
  state[panelId] = Boolean(collapsed);

  try {
    localStorage.setItem(WORKSPACE_PANEL_COLLAPSE_STORAGE_KEY, JSON.stringify(state));
  } catch {}

  return state;
}

function isWorkspacePanelCollapsed(panelId) {
  return Boolean(getWorkspacePanelCollapsedState()[panelId]);
}

function hasWorkspacePanelMarkup(panelId) {
  if (panelId === 'active') {
    return !!(
      document.getElementById('workspaceActivePanel')?.querySelector?.('#workspaceActiveBadge') &&
      document.getElementById('workspaceActivePanel')?.querySelector?.('#workspaceActiveBody')
    );
  }

  if (panelId === 'index') {
    return !!(
      document.getElementById('workspaceIndexPanel')?.querySelector?.('#workspaceIndexSummary') &&
      document.getElementById('workspaceIndexPanel')?.querySelector?.('#workspaceIndexMetrics') &&
      document.getElementById('workspaceIndexPanel')?.querySelector?.('#workspaceIndexUpdated')
    );
  }

  if (panelId === 'related') {
    return !!(
      document
        .getElementById('workspaceRelatedPanel')
        ?.querySelector?.('#workspaceRelatedSummary') &&
      document.getElementById('workspaceRelatedPanel')?.querySelector?.('#workspaceRelatedList') &&
      document.getElementById('workspaceRelatedPanel')?.querySelector?.('#workspaceRelatedBadge')
    );
  }

  if (panelId === 'tasks') {
    return !!(
      document.getElementById('workspaceTasksPanel')?.querySelector?.('#workspaceTasksSummary') &&
      document.getElementById('workspaceTasksPanel')?.querySelector?.('#workspaceTasksList') &&
      document.getElementById('workspaceTasksPanel')?.querySelector?.('#workspaceTasksBadge')
    );
  }

  if (panelId === 'journals') {
    return !!(
      document
        .getElementById('workspaceJournalsPanel')
        ?.querySelector?.('#workspaceJournalsList') &&
      document.getElementById('workspaceJournalsPanel')?.querySelector?.('#workspaceJournalsBadge')
    );
  }

  if (panelId === 'concepts') {
    return !!(
      document
        .getElementById('workspaceConceptsPanel')
        ?.querySelector?.('#workspaceConceptsList') &&
      document.getElementById('workspaceConceptsPanel')?.querySelector?.('#workspaceConceptsBadge')
    );
  }

  if (panelId === 'projects') {
    return !!(
      document
        .getElementById('workspaceProjectsPanel')
        ?.querySelector?.('#workspaceProjectsBadge') &&
      document.getElementById('workspaceProjectsPanel')?.querySelector?.('#workspaceProjectsList')
    );
  }

  return false;
}

function ensureWorkspaceSearchPanel() {
  const host = getWorkspaceSidebarContentHost();

  if (!host) {
    log?.('Workspace Search: ensure failed; sidebar missing');
    return null;
  }

  let panel = document.getElementById('workspaceSearchPanel');

  if (panel) {
    return panel;
  }

  panel = document.createElement('div');
  panel.id = 'workspaceSearchPanel';

  panel.innerHTML = `
    <label id="workspaceSearchLabel" for="workspaceSearchInput">
      Search
    </label>

    <input
      id="workspaceSearchInput"
      type="search"
      placeholder="Search journals and concepts..."
      autocomplete="off"
      spellcheck="false"
    />

    <div id="workspaceSearchResults" hidden></div>
  `;

  const header = host.querySelector('.workspaceHeader');
  const filesSection = host.querySelector('.workspaceFilesSection');

  if (header && header.nextSibling && header.nextSibling.parentNode === host) {
    host.insertBefore(panel, header.nextSibling);
  } else if (filesSection && filesSection.parentNode === host) {
    host.insertBefore(panel, filesSection);
  } else {
    host.appendChild(panel);
  }

  log?.('Workspace Search: panel created');

  return panel;
}

function ensureWorkspaceActivePanel() {
  const host = getWorkspaceSidebarContentHost();

  if (!host) {
    log?.('Workspace Active: ensure failed; sidebar missing');
    return null;
  }

  let panel = document.getElementById('workspaceActivePanel');

  if (panel) {
    return panel;
  }

  panel = document.createElement('div');
  panel.id = 'workspaceActivePanel';
  panel.hidden = true;

  panel.innerHTML = `
    <button
      type="button"
      class="workspacePanelHeaderButton"
      data-workspace-panel-toggle="active"
      aria-expanded="true"
    >
      <span class="workspacePanelHeaderLeft">
        <span class="workspacePanelChevron" aria-hidden="true">▶</span>
        <span class="workspaceActiveTitle">Active</span>
      </span>

      <span id="workspaceActiveBadge" class="workspaceActiveBadge">
        No file
      </span>
    </button>

    <div class="workspacePanelBody">
      <div id="workspaceActiveBody" class="workspaceActiveBody">
        <div class="workspaceActiveEmpty">No active workspace file</div>
      </div>
    </div>
  `;

  const searchPanel = document.getElementById('workspaceSearchPanel');
  const indexPanel = document.getElementById('workspaceIndexPanel');
  const filesSection = host.querySelector('.workspaceFilesSection');

  if (searchPanel && searchPanel.nextSibling && searchPanel.nextSibling.parentNode === host) {
    host.insertBefore(panel, searchPanel.nextSibling);
  } else if (indexPanel && indexPanel.parentNode === host) {
    host.insertBefore(panel, indexPanel);
  } else if (filesSection && filesSection.parentNode === host) {
    host.insertBefore(panel, filesSection);
  } else {
    host.appendChild(panel);
  }

  log?.('Workspace Active: panel created');

  return panel;
}

function ensureWorkspaceIndexPanel() {
  const host = getWorkspaceSidebarContentHost();

  if (!host) {
    log?.('Workspace Index: ensure failed; sidebar missing');
    return null;
  }

  let panel = document.getElementById('workspaceIndexPanel');
  if (panel) return panel;

  panel = document.createElement('div');
  panel.id = 'workspaceIndexPanel';
  panel.className = 'workspaceSection workspaceIndexPanel';

  panel.innerHTML = `
    <div class="workspaceIndexHeader">
      <button
        type="button"
        class="workspacePanelHeaderButton"
        data-workspace-panel-toggle="index"
        aria-expanded="false"
      >
        <span class="workspacePanelHeaderLeft">
          <span class="workspacePanelChevron" aria-hidden="true">▶</span>
          <span class="workspaceIndexTitle">Workspace Index</span>
        </span>

        <span id="workspaceIndexBadge" class="workspacePanelBadge">
          Not ready
        </span>
      </button>

      <button
        id="btnRefreshWorkspaceIndex"
        type="button"
        title="Refresh workspace index"
        aria-label="Refresh workspace index"
      >
        ↻
      </button>

      <button
        id="btnOpenWorkspaceIndex"
        type="button"
        title="Open full Workspace Index"
        aria-label="Open full Workspace Index"
      >
        ▤
      </button>
    </div>

    <div class="workspacePanelBody">
      <div id="workspaceIndexUpdated" class="workspaceIndexUpdated"></div>

      <div id="workspaceIndexSummary" class="workspaceIndexSummary">
        Index not ready
      </div>

      <div id="workspaceIndexMetrics" class="workspaceIndexMetrics"></div>
    </div>
  `;

  // Insert after Tags and before Navigation History so the sidebar order is:
  // Header, Search, Active, Journals, Concepts, Related, Open Tasks, Tags,
  // Workspace Index, Navigation History.
  const tagsPanel = host.querySelector('#workspaceTagsPanel');
  const navControls = host.querySelector('.workspaceNavControls');

  let insertAnchor = null;
  if (
    tagsPanel &&
    tagsPanel.nextElementSibling &&
    tagsPanel.nextElementSibling.parentNode === host
  ) {
    insertAnchor = tagsPanel.nextElementSibling;
  } else if (navControls && navControls.parentNode === host) {
    insertAnchor = navControls;
  }

  if (insertAnchor) {
    host.insertBefore(panel, insertAnchor);
  } else {
    host.appendChild(panel);
  }

  log?.('Workspace Index: panel created');
  return panel;
}

function applyWorkspacePanelCollapsed(panelEl, panelId, collapsed) {
  if (!panelEl) return;

  panelEl.classList.toggle('workspacePanelCollapsed', Boolean(collapsed));
  panelEl.dataset.collapsed = collapsed ? '1' : '0';

  const btn = panelEl.querySelector('[data-workspace-panel-toggle]');
  if (btn) {
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }
}

function toggleWorkspacePanel(panelId) {
  const panelEl =
    panelId === 'active'
      ? document.getElementById('workspaceActivePanel')
      : panelId === 'index'
        ? document.getElementById('workspaceIndexPanel')
        : panelId === 'related'
          ? document.getElementById('workspaceRelatedPanel')
          : panelId === 'tasks'
            ? document.getElementById('workspaceTasksPanel')
            : panelId === 'tags'
              ? document.getElementById('workspaceTagsPanel')
              : panelId === 'journals'
                ? document.getElementById('workspaceJournalsPanel')
                : panelId === 'concepts'
                  ? document.getElementById('workspaceConceptsPanel')
                  : panelId === 'projects'
                    ? document.getElementById('workspaceProjectsPanel')
                    : panelId === 'report'
                      ? document.getElementById('workspaceReportPanel')
                      : null;

  if (!panelEl) return;

  const nextCollapsed = !panelEl.classList.contains('workspacePanelCollapsed');

  setWorkspacePanelCollapsedState(panelId, nextCollapsed);
  applyWorkspacePanelCollapsed(panelEl, panelId, nextCollapsed);

  try {
    log?.(`Workspace Panels: toggled ${panelId} collapsed=${String(nextCollapsed)}`);
  } catch {}
}

function ensureWorkspaceRelatedPanel() {
  const host = getWorkspaceSidebarContentHost();

  if (!host) {
    log?.('Workspace Related: ensure failed; sidebar missing');
    return null;
  }

  let panel = document.getElementById('workspaceRelatedPanel');
  if (panel) return panel;

  panel = document.createElement('div');
  panel.id = 'workspaceRelatedPanel';
  panel.hidden = true;

  panel.innerHTML = `
    <div class="workspaceRelatedHeader">
      <button
        type="button"
        class="workspacePanelHeaderButton"
        data-workspace-panel-toggle="related"
        aria-expanded="true"
      >
        <span class="workspacePanelHeaderLeft">
          <span class="workspacePanelChevron" aria-hidden="true">▶</span>
          <span class="workspaceRelatedTitle">Related</span>
        </span>

        <span id="workspaceRelatedBadge" class="workspacePanelBadge">
          0 related
        </span>
      </button>
    </div>

    <div class="workspacePanelBody">
      <div id="workspaceRelatedSummary" class="workspaceRelatedSummary">
        No active concept
      </div>

      <div id="workspaceRelatedList" class="workspaceRelatedList"></div>
    </div>
  `;

  const indexPanel = document.getElementById('workspaceIndexPanel');
  const filesSection = host.querySelector('.workspaceFilesSection');

  if (indexPanel && indexPanel.nextSibling && indexPanel.nextSibling.parentNode === host) {
    host.insertBefore(panel, indexPanel.nextSibling);
  } else if (filesSection && filesSection.parentNode === host) {
    host.insertBefore(panel, filesSection);
  } else {
    host.appendChild(panel);
  }

  log?.('Workspace Related: panel created');
  return panel;
}

function ensureWorkspaceTasksPanel() {
  const host = getWorkspaceSidebarContentHost();

  if (!host) {
    log?.('Workspace Tasks: ensure failed; sidebar missing');
    return null;
  }

  let panel = document.getElementById('workspaceTasksPanel');
  if (panel) return panel;

  panel = document.createElement('div');
  panel.id = 'workspaceTasksPanel';
  panel.className = 'workspaceSection workspaceTasksPanel';
  panel.hidden = true;

  panel.innerHTML = `
    <div class="workspaceTasksHeader">
      <button
        type="button"
        class="workspacePanelHeaderButton"
        data-workspace-panel-toggle="tasks"
        aria-expanded="false"
      >
        <span class="workspacePanelHeaderLeft">
          <span class="workspacePanelChevron" aria-hidden="true">▶</span>
          <span class="workspaceTasksTitle">Open Tasks</span>
        </span>

        <span id="workspaceTasksBadge" class="workspacePanelBadge">
          0 open
        </span>
      </button>
    </div>

    <div class="workspacePanelBody">
      <div id="workspaceTasksSummary" class="workspaceRelatedSummary">
        No open tasks
      </div>

      <div id="workspaceTasksList" class="workspaceTasksList">
        <div class="workspaceTasksEmpty">No open tasks</div>
      </div>
    </div>
  `;

  const relatedPanel = document.getElementById('workspaceRelatedPanel');
  const filesSection = host.querySelector('.workspaceFilesSection');

  if (relatedPanel && relatedPanel.nextSibling && relatedPanel.nextSibling.parentNode === host) {
    host.insertBefore(panel, relatedPanel.nextSibling);
  } else if (filesSection && filesSection.parentNode === host) {
    host.insertBefore(panel, filesSection);
  } else {
    host.appendChild(panel);
  }

  log?.('Workspace Tasks: panel created');
  return panel;
}

function getOpenWorkspaceTasks() {
  if (!WORKSPACE_INDEX_STATE?.ready) {
    return [];
  }

  return (WORKSPACE_INDEX_STATE.tasks || [])
    .filter((task) => !task.done)
    .map((task) => ({
      ...task,
      filePath: task.filePath || task.path || '',
      fileKind: task.fileKind || task.kind || '',
      fileName: task.fileName || task.name || task.filePath || '',
    }));
}

function getWorkspaceTaskFileDisplayName(path, fallback = '') {
  if (!WORKSPACE_INDEX_STATE?.ready || !path) {
    return fallback || path || '';
  }

  const parsed = WORKSPACE_INDEX_STATE.byPath?.get(path);

  if (!parsed) {
    return fallback || path || '';
  }

  return parsed.title || parsed.name || fallback || path;
}

function getGroupedOpenWorkspaceTasks() {
  const openTasks = typeof getOpenWorkspaceTasks === 'function' ? getOpenWorkspaceTasks() : [];

  const groupsMap = new Map();

  for (const task of openTasks) {
    const path = task.filePath || '';
    if (!path) continue;

    if (!groupsMap.has(path)) {
      const parsed = WORKSPACE_INDEX_STATE?.byPath?.get(path);
      const kind = task.fileKind || parsed?.kind || '';
      const fileName = task.fileName || parsed?.name || path;

      groupsMap.set(path, {
        path,
        kind,
        fileName,
        title: getWorkspaceTaskFileDisplayName(path, fileName),
        date: parsed?.date || '',
        tasks: [],
      });
    }

    groupsMap.get(path).tasks.push(task);
  }

  const groups = Array.from(groupsMap.values());

  groups.sort((a, b) => {
    if (a.kind !== b.kind) {
      if (a.kind === 'journals') return -1;
      if (b.kind === 'journals') return 1;
    }

    const dateA = String(a.date || '');
    const dateB = String(b.date || '');

    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }

    return String(a.title || '').localeCompare(String(b.title || ''));
  });

  for (const group of groups) {
    group.tasks.sort((a, b) => Number(a.line || 0) - Number(b.line || 0));
  }

  return groups;
}

function renderWorkspaceTasksPanel() {
  // Compatibility wrapper: delegate to Task Review if available
  if (globalThis.MME_TASK_REVIEW?.refresh) {
    globalThis.MME_TASK_REVIEW.refresh();
    log?.('Workspace Tasks: legacy renderer bypassed (Task Review active)');
    return;
  }

  // Legacy fallback
  const panel = ensureWorkspaceTasksPanel();
  const badge = document.getElementById('workspaceTasksBadge');
  const summary = document.getElementById('workspaceTasksSummary');
  const list = document.getElementById('workspaceTasksList');

  if (!panel || !badge || !summary || !list) {
    forceUpgradeWorkspacePanelMarkup('tasks');
    log?.('Workspace Tasks: render skipped; panel elements missing');
    return;
  }

  panel.hidden = false;

  if (!WORKSPACE_STATE?.rootHandle) {
    badge.textContent = '0 open';
    summary.textContent = 'Open a workspace first';
    list.innerHTML = '<div class="workspaceTasksEmpty">Open a workspace first</div>';
    applyWorkspacePanelCollapsed(panel, 'tasks', isWorkspacePanelCollapsed('tasks'));
    return;
  }

  if (!WORKSPACE_INDEX_STATE?.ready) {
    badge.textContent = '0 open';
    summary.textContent = 'Index not ready';
    list.innerHTML = '<div class="workspaceTasksEmpty">Index not ready</div>';
    applyWorkspacePanelCollapsed(panel, 'tasks', isWorkspacePanelCollapsed('tasks'));
    return;
  }

  const openTasks = getOpenWorkspaceTasks();
  const groups =
    typeof getGroupedOpenWorkspaceTasks === 'function' ? getGroupedOpenWorkspaceTasks() : [];
  const fileCount = groups.length;

  badge.textContent = `${openTasks.length} open`;
  summary.textContent = openTasks.length
    ? `${openTasks.length} open tasks across ${fileCount} files`
    : 'No open tasks';

  if (!openTasks.length) {
    list.innerHTML = '<div class="workspaceTasksEmpty">No open tasks</div>';
    applyWorkspacePanelCollapsed(panel, 'tasks', isWorkspacePanelCollapsed('tasks'));
    return;
  }

  list.innerHTML = groups
    .map((group) => {
      const icon = group.kind === 'journals' ? '📝' : group.kind === 'concepts' ? '🧠' : '📄';

      const groupTitle = escapeHtml(group.title || group.fileName || group.path);
      const groupPath = escapeHtml(group.path || '');
      const groupKind = escapeHtml(group.kind || '');

      const tasksHtml = group.tasks
        .map((task) => {
          const title = escapeHtml(task.text || '');
          const line = Number(task.line || 0);

          return `
            <button
              type="button"
              class="workspaceTasksItem"
              data-workspace-task-item="1"
              data-path="${groupPath}"
              data-kind="${groupKind}"
              data-line="${line}"
              title="${groupPath}${line ? `:${line}` : ''}"
            >
              <span class="workspaceTasksIcon" aria-hidden="true">☐</span>
              <span class="workspaceTasksBody">
                <span class="workspaceTasksText">${title}</span>
                <span class="workspaceTasksMeta">${line ? `line ${line}` : ''}</span>
              </span>
            </button>
          `;
        })
        .join('');

      return `
        <div class="workspaceTaskGroup">
          <button
            type="button"
            class="workspaceTaskGroupHeader"
            data-workspace-task-group="1"
            data-path="${groupPath}"
            data-kind="${groupKind}"
            title="${groupPath}"
          >
            <span class="workspaceTaskGroupTitle">
              <span class="workspaceTaskGroupTitleIcon" aria-hidden="true">${icon}</span>
              <span class="workspaceTaskGroupTitleText">${groupTitle}</span>
            </span>
            <span class="workspaceTaskGroupCount">${group.tasks.length}</span>
          </button>

          <div class="workspaceTasksGroupItems">
            ${tasksHtml}
          </div>
        </div>
      `;
    })
    .join('');
}

function wireWorkspaceTasksPanel() {
  // Compatibility wrapper: delegate to Task Review if available
  if (globalThis.MME_TASK_REVIEW?.wire) {
    globalThis.MME_TASK_REVIEW.wire();
    log?.('Workspace Tasks: legacy click wiring bypassed (Task Review active)');
    return;
  }

  // Legacy fallback
  ensureWorkspaceTasksPanel();

  const panel = document.getElementById('workspaceTasksPanel');
  if (!panel) {
    log?.('Workspace Tasks: panel missing');
    return;
  }

  if (panel.__workspaceTasksBound) {
    return;
  }

  panel.addEventListener('click', async (event) => {
    const groupBtn = event.target?.closest?.('[data-workspace-task-group="1"]');

    if (groupBtn) {
      event.preventDefault();
      event.stopPropagation();

      // Task Review is the sole owner of Task group-header opening when active.
      // This guards the race where this legacy handler was bound before Task
      // Review loaded. Returning here lets Task Review open the source once.
      if (globalThis.MME_TASK_REVIEW) {
        return;
      }

      const path = groupBtn.dataset.path || '';
      const kind = groupBtn.dataset.kind || '';

      const file =
        typeof findWorkspaceFileByPath === 'function' ? findWorkspaceFileByPath(path, kind) : null;

      if (!file) {
        showToast?.('Task group file not found', 'error', 2200);
        log?.(`Workspace Tasks: group file not found path=${path} kind=${kind}`);
        return;
      }

      log?.(`Workspace Tasks: opening group ${path}`);

      if (typeof openWorkspaceFile === 'function') {
        await openWorkspaceFile(file, kind || file.kind, 'workspace task group open');
        return;
      }

      showToast?.('Workspace open helper missing', 'error', 2200);
      log?.('Workspace Tasks: openWorkspaceFile missing');
      return;
    }

    const btn = event.target?.closest?.('[data-workspace-task-item="1"]');
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    const path = btn.dataset.path || '';
    const kind = btn.dataset.kind || '';
    const file = findWorkspaceFileByPath(path, kind);

    if (!file) {
      showToast?.('Task file not found', 'error', 2200);
      log?.(`Workspace Tasks: file not found path=${path} kind=${kind}`);
      return;
    }

    log?.(`Workspace Tasks: opening ${path}`);

    if (typeof openWorkspaceFile === 'function') {
      await openWorkspaceFile(file);
      return;
    }

    const opened = await openWorkspaceSearchResultFile(path, kind);
    if (!opened) {
      showToast?.('Workspace open helper missing', 'error', 2200);
      log?.('Workspace Tasks: open helper missing');
    }
  });

  panel.__workspaceTasksBound = true;
  log?.('Workspace Tasks: panel wired');
}

function getActiveConceptName() {
  const active = WORKSPACE_STATE.activeFile;

  if (!active) return '';

  const kind =
    typeof normalizeWorkspaceKindForCompare === 'function'
      ? normalizeWorkspaceKindForCompare(active.kind || '')
      : String(active.kind || '').trim();

  if (kind !== 'concepts') return '';

  return normalizeConceptName
    ? normalizeConceptName(active.name || active.path || '')
    : String(active.name || active.path || '')
        .replace(/^concepts\//i, '')
        .replace(/\.md$/i, '')
        .trim();
}

function normalizeBacklinkConceptKey(value) {
  return String(value || '')
    .trim()
    .replace(/^\.?\//, '')
    .replace(/^concepts\//i, '')
    .replace(/\.md$/i, '')
    .replace(/\|.*$/, '')
    .trim()
    .toLowerCase();
}

function findBacklinksForConcept(conceptName) {
  if (!WORKSPACE_INDEX_STATE?.ready) {
    return [];
  }

  const targetKey = normalizeBacklinkConceptKey(conceptName);
  if (!targetKey) return [];

  const results = [];

  for (const parsed of WORKSPACE_INDEX_STATE.files || []) {
    const parsedConceptName = normalizeBacklinkConceptKey(parsed.name || parsed.path || '');
    const links = parsed.conceptLinks || [];

    const hasLink = links.some((link) => normalizeBacklinkConceptKey(link) === targetKey);
    if (!hasLink) continue;

    if (parsed.kind === 'concepts' && parsedConceptName === targetKey) {
      continue;
    }

    results.push(parsed);
  }

  results.sort((a, b) => {
    if (a.kind !== b.kind) {
      if (a.kind === 'journals') return -1;
      if (b.kind === 'journals') return 1;
    }

    const dateA = String(a.date || '');
    const dateB = String(b.date || '');

    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }

    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  return results;
}

function renderWorkspaceRelatedPanel() {
  const panel = ensureWorkspaceRelatedPanel();
  const badge = document.getElementById('workspaceRelatedBadge');
  const summary = document.getElementById('workspaceRelatedSummary');
  const list = document.getElementById('workspaceRelatedList');

  if (!panel || !badge || !summary || !list) {
    forceUpgradeWorkspacePanelMarkup('related');
    log?.(
      `Workspace Related: render skipped panel=${Boolean(panel)} summary=${Boolean(summary)} list=${Boolean(list)} badge=${Boolean(badge)}`
    );
    wireWorkspaceRelatedPanel();
    return;
  }

  const activeConcept = getActiveConceptName();

  if (!activeConcept) {
    panel.hidden = true;
    badge.textContent = '0 related';
    summary.textContent = 'No active concept';
    list.innerHTML = '';
    applyWorkspacePanelCollapsed(panel, 'related', isWorkspacePanelCollapsed('related'));
    return;
  }

  panel.hidden = false;
  summary.textContent = `Current concept: ${activeConcept}`;

  if (!WORKSPACE_INDEX_STATE?.ready) {
    badge.textContent = '0 related';
    list.innerHTML = '<div class="workspaceRelatedEmpty">Index not ready</div>';
    applyWorkspacePanelCollapsed(panel, 'related', isWorkspacePanelCollapsed('related'));
    return;
  }

  const backlinks = findBacklinksForConcept(activeConcept);
  badge.textContent = `${backlinks.length} related`;

  if (!backlinks.length) {
    list.innerHTML = '<div class="workspaceRelatedEmpty">No backlinks yet</div>';
    applyWorkspacePanelCollapsed(panel, 'related', isWorkspacePanelCollapsed('related'));
    return;
  }

  list.innerHTML = backlinks
    .map((file) => {
      const kind = String(file.kind || '');
      const icon = kind === 'journals' ? '📝' : kind === 'concepts' ? '🧠' : '📄';
      const name = escapeHtml(file.name || file.title || file.path || '');
      const path = escapeHtml(file.path || '');
      const meta = escapeHtml(
        [
          kind === 'journals' ? 'Journal' : kind === 'concepts' ? 'Concept' : 'File',
          file.date || '',
        ]
          .filter(Boolean)
          .join(' · ')
      );

      return `
        <button
          type="button"
          class="workspaceRelatedItem"
          data-workspace-related-item="1"
          data-path="${path}"
          data-kind="${escapeHtml(kind)}"
          title="${path}"
        >
          <span class="workspaceRelatedIcon" aria-hidden="true">${icon}</span>
          <span class="workspaceRelatedBody">
            <span class="workspaceRelatedName">${name}</span>
            <span class="workspaceRelatedMeta">${meta}</span>
          </span>
        </button>
      `;
    })
    .join('');

  applyWorkspacePanelCollapsed(panel, 'related', isWorkspacePanelCollapsed('related'));
}

function wireWorkspaceRelatedPanel() {
  ensureWorkspaceRelatedPanel();

  const panel = document.getElementById('workspaceRelatedPanel');
  if (!panel) {
    log?.('Workspace Related: panel missing');
    return;
  }

  if (panel.__workspaceRelatedBound) {
    return;
  }

  panel.addEventListener('click', async (event) => {
    const btn = event.target?.closest?.('[data-workspace-related-item="1"]');
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    const path = btn.dataset.path || '';
    const kind = btn.dataset.kind || '';

    log?.(`Workspace Related: clicked path=${path} kind=${kind}`);

    const file =
      typeof findWorkspaceFileByPath === 'function' ? findWorkspaceFileByPath(path, kind) : null;

    if (!file) {
      const known = [
        ...(WORKSPACE_STATE.files?.journals || []),
        ...(WORKSPACE_STATE.files?.concepts || []),
      ]
        .map((f) => `${f.kind || '?'}:${f.path || f.name || '?'}`)
        .join(', ');

      showToast?.('Related file not found', 'error', 2200);
      log?.(`Workspace Related: file not found path=${path} kind=${kind} known=${known}`);
      return;
    }

    log?.(`Workspace Related: opening ${path}`);

    if (typeof openWorkspaceFile === 'function') {
      await openWorkspaceFile(file, kind || file.kind, 'workspace related open');
      return;
    }

    showToast?.('Workspace open helper missing', 'error', 2200);
    log?.('Workspace Related: openWorkspaceFile missing');
  });

  panel.__workspaceRelatedBound = true;
  log?.('Workspace Related: panel wired');
}

function forceUpgradeWorkspacePanelMarkup(panelId) {
  if (!hasWorkspacePanelMarkup(panelId)) {
    const panel =
      panelId === 'index'
        ? document.getElementById('workspaceIndexPanel')
        : panelId === 'related'
          ? document.getElementById('workspaceRelatedPanel')
          : panelId === 'tasks'
            ? document.getElementById('workspaceTasksPanel')
            : panelId === 'projects'
              ? document.getElementById('workspaceProjectsPanel')
              : null;

    if (panel) {
      log?.(`Workspace: upgrading ${panelId} panel markup`);
      panel.outerHTML = '';
    }
  }
}

function wireWorkspaceIndexRefreshButton() {
  const btn = document.getElementById('btnRefreshWorkspaceIndex');

  if (!btn) {
    log?.('Workspace Index: refresh button missing');
    return;
  }

  if (btn.__workspaceIndexRefreshBound) {
    return;
  }

  btn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      log?.('Workspace Index: manual refresh clicked');

      if (typeof buildWorkspaceIndex === 'function') {
        await buildWorkspaceIndex();

        renderWorkspaceIndexSummary?.();
        renderWorkspaceRelatedPanel?.();
        renderWorkspaceTasksPanel?.();
        renderWorkspaceTagsPanel?.();

        showToast?.('Workspace index refreshed', 'ok', 1400);
        log?.('Workspace Index: manual refresh complete');
      } else {
        showToast?.('Workspace index builder missing', 'error', 2200);
        log?.('Workspace Index: buildWorkspaceIndex missing');
      }
    } catch (e) {
      const msg = e?.message || String(e);
      showToast?.(`Index refresh failed: ${msg}`, 'error', 3000);
      log?.(`Workspace Index: manual refresh failed: ${msg}`);
    }
  });

  btn.__workspaceIndexRefreshBound = true;
  log?.('Workspace Index: refresh button wired');
}

function wireWorkspaceIndexOpenButton() {
  const btn = document.getElementById('btnOpenWorkspaceIndex');

  if (!btn) {
    log?.('Workspace Index: open button missing');
    return;
  }

  if (btn.__workspaceIndexOpenBound) {
    return;
  }

  btn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      log?.('WorkspaceIndex: open requested');

      if (typeof globalThis.MME_WORKSPACE_HOST !== 'object') {
        log?.('WorkspaceIndex: open blocked; Host missing');
        return;
      }

      const result = await globalThis.MME_WORKSPACE_HOST.switchTo('workspace-index', {
        reason: 'open full workspace index',
      });

      if (result && result.status === globalThis.MME_WORKSPACE_HOST.RESULT_STATUS.ACTIVATED) {
        if (typeof globalThis.MME_NAVIGATION === 'object') {
          globalThis.MME_NAVIGATION.recordSuccessfulNavigation({
            type: 'virtual-workspace-index',
            id: 'mme://workspace/index',
          });
        }
        log?.('WorkspaceIndex: open success');
      } else {
        log?.(`WorkspaceIndex: open unexpected result: ${result?.status || 'unknown'}`);
      }
    } catch (e) {
      log?.(`WorkspaceIndex: open failed: ${e?.message || e}`);
    }
  });

  btn.__workspaceIndexOpenBound = true;
  log?.('Workspace Index: open button wired');
}

function ensureWorkspaceTagsPanel() {
  const host = getWorkspaceSidebarContentHost();

  if (!host) {
    log?.('Workspace Tags: ensure failed; sidebar missing');
    return null;
  }

  let panel = document.getElementById('workspaceTagsPanel');

  if (panel) {
    return panel;
  }

  panel = document.createElement('div');
  panel.id = 'workspaceTagsPanel';
  panel.hidden = true;

  panel.innerHTML = `
    <div class="workspaceTagsHeader">
      <button
        type="button"
        class="workspacePanelHeaderButton"
        data-workspace-panel-toggle="tags"
        aria-expanded="false"
      >
        <span class="workspacePanelHeaderLeft">
          <span class="workspacePanelChevron" aria-hidden="true">▶</span>
          <span class="workspaceTagsTitle">Tags</span>
        </span>

        <span id="workspaceTagsBadge" class="workspacePanelBadge">
          0 tags
        </span>
      </button>
    </div>

    <div class="workspacePanelBody">
      <div id="workspaceTagsSummary" class="workspaceTagsSummary">
        No tags
      </div>

      <div id="workspaceTagsList" class="workspaceTagsList"></div>

      <div id="workspaceTagResults" class="workspaceTagResults" hidden></div>
    </div>
  `;

  const tasksPanel = document.getElementById('workspaceTasksPanel');
  const filesSection = host.querySelector('.workspaceFilesSection');

  if (tasksPanel && tasksPanel.nextSibling && tasksPanel.nextSibling.parentNode === host) {
    host.insertBefore(panel, tasksPanel.nextSibling);
  } else if (filesSection && filesSection.parentNode === host) {
    host.insertBefore(panel, filesSection);
  } else {
    host.appendChild(panel);
  }

  log?.('Workspace Tags: panel created');

  return panel;
}

function getWorkspaceTagsSummary() {
  if (!WORKSPACE_INDEX_STATE?.ready || !WORKSPACE_INDEX_STATE.tags) {
    return [];
  }

  const rows = [];

  for (const [tag, paths] of WORKSPACE_INDEX_STATE.tags.entries()) {
    const uniquePaths = Array.from(new Set(paths || []));

    rows.push({
      tag,
      count: uniquePaths.length,
      paths: uniquePaths,
    });
  }

  rows.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return String(a.tag || '').localeCompare(String(b.tag || ''));
  });

  return rows;
}

function getWorkspaceTagFiles(tag) {
  if (!WORKSPACE_INDEX_STATE?.ready) {
    return [];
  }

  const tagKey = String(tag || '').trim();

  if (!tagKey) return [];

  const paths = Array.from(new Set(WORKSPACE_INDEX_STATE.tags?.get(tagKey) || []));

  return paths
    .map((path) => WORKSPACE_INDEX_STATE.byPath?.get(path))
    .filter(Boolean)
    .sort((a, b) => {
      if (a.kind !== b.kind) {
        if (a.kind === 'journals') return -1;
        if (b.kind === 'journals') return 1;
      }

      const dateA = String(a.date || '');
      const dateB = String(b.date || '');

      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }

      return String(a.name || '').localeCompare(String(b.name || ''));
    });
}

let __workspaceActiveTag = '';

function renderWorkspaceTagsPanel() {
  const panel = ensureWorkspaceTagsPanel();
  const badge = document.getElementById('workspaceTagsBadge');
  const summary = document.getElementById('workspaceTagsSummary');
  const list = document.getElementById('workspaceTagsList');
  const results = document.getElementById('workspaceTagResults');

  if (!panel || !badge || !summary || !list || !results) {
    log?.(
      `Workspace Tags: render skipped panel=${Boolean(panel)} badge=${Boolean(
        badge
      )} summary=${Boolean(summary)} list=${Boolean(list)} results=${Boolean(results)}`
    );
    return;
  }

  if (!WORKSPACE_STATE?.rootHandle) {
    panel.hidden = true;
    badge.textContent = '0 tags';
    summary.textContent = 'Open a workspace first';
    list.innerHTML = '';
    results.hidden = true;
    results.innerHTML = '';
    return;
  }

  panel.hidden = false;

  if (!WORKSPACE_INDEX_STATE?.ready) {
    badge.textContent = '0 tags';
    summary.textContent = 'Index not ready';
    list.innerHTML = '<div class="workspaceTagsEmpty">Index not ready</div>';
    results.hidden = true;
    results.innerHTML = '';

    applyWorkspacePanelCollapsed(panel, 'tags', isWorkspacePanelCollapsed('tags'));

    return;
  }

  const tags = getWorkspaceTagsSummary();

  badge.textContent = `${tags.length} tags`;

  const totalTaggedFiles = new Set(tags.flatMap((row) => row.paths || [])).size;

  summary.textContent = tags.length
    ? `${tags.length} tags across ${totalTaggedFiles} files`
    : 'No tags';

  if (!tags.length) {
    list.innerHTML = '<div class="workspaceTagsEmpty">No tags found</div>';
    results.hidden = true;
    results.innerHTML = '';

    applyWorkspacePanelCollapsed(panel, 'tags', isWorkspacePanelCollapsed('tags'));

    return;
  }

  list.innerHTML = tags
    .map((row) => {
      const tag = escapeHtml(row.tag || '');
      const activeClass = String(row.tag || '') === __workspaceActiveTag ? ' __active' : '';

      return `
        <button
          type="button"
          class="workspaceTagItem${activeClass}"
          data-workspace-tag-item="1"
          data-tag="${tag}"
          title="#${tag}"
        >
          <span class="workspaceTagName">#${tag}</span>
          <span class="workspaceTagCount">${row.count}</span>
        </button>
      `;
    })
    .join('');

  renderWorkspaceTagResults(__workspaceActiveTag);

  applyWorkspacePanelCollapsed(panel, 'tags', isWorkspacePanelCollapsed('tags'));
}

function renderWorkspaceTagResults(tag) {
  const results = document.getElementById('workspaceTagResults');

  if (!results) return;

  const tagKey = String(tag || '').trim();

  if (!tagKey || !WORKSPACE_INDEX_STATE?.ready) {
    results.hidden = true;
    results.innerHTML = '';
    return;
  }

  const files = getWorkspaceTagFiles(tagKey);

  results.hidden = false;

  if (!files.length) {
    results.innerHTML = `
      <div class="workspaceTagResultHeader">#${escapeHtml(tagKey)}</div>
      <div class="workspaceTagsEmpty">No files for this tag</div>
    `;
    return;
  }

  results.innerHTML = `
    <div class="workspaceTagResultHeader">
      #${escapeHtml(tagKey)} · ${files.length} file${files.length !== 1 ? 's' : ''}
    </div>

    ${files
      .map((file) => {
        const kind = String(file.kind || '');
        const icon = kind === 'journals' ? '📝' : kind === 'concepts' ? '🧠' : '📄';

        const name = escapeHtml(file.name || file.title || file.path || '');
        const path = escapeHtml(file.path || '');
        const meta = escapeHtml(
          [
            kind === 'journals' ? 'Journal' : kind === 'concepts' ? 'Concept' : 'File',
            file.date || '',
            file.title || '',
          ]
            .filter(Boolean)
            .join(' · ')
        );

        return `
          <button
            type="button"
            class="workspaceTagResultItem"
            data-workspace-tag-result="1"
            data-path="${path}"
            data-kind="${escapeHtml(kind)}"
            title="${path}"
          >
            <span class="workspaceTagResultIcon" aria-hidden="true">${icon}</span>
            <span class="workspaceTagResultBody">
              <span class="workspaceTagResultName">${name}</span>
              <span class="workspaceTagResultMeta">${meta}</span>
            </span>
          </button>
        `;
      })
      .join('')}
  `;
}

function wireWorkspaceTagsPanel() {
  ensureWorkspaceTagsPanel();

  const panel = document.getElementById('workspaceTagsPanel');

  if (!panel) {
    log?.('Workspace Tags: panel missing');
    return;
  }

  if (panel.__workspaceTagsBound) {
    return;
  }

  panel.addEventListener('click', async (event) => {
    const tagBtn = event.target?.closest?.('[data-workspace-tag-item="1"]');

    if (tagBtn) {
      event.preventDefault();
      event.stopPropagation();

      const tag = tagBtn.dataset.tag || '';

      __workspaceActiveTag = __workspaceActiveTag === tag ? '' : tag;

      renderWorkspaceTagsPanel();

      log?.(
        __workspaceActiveTag
          ? `Workspace Tags: selected #${__workspaceActiveTag}`
          : 'Workspace Tags: cleared selected tag'
      );

      return;
    }

    const fileBtn = event.target?.closest?.('[data-workspace-tag-result="1"]');

    if (!fileBtn) return;

    event.preventDefault();
    event.stopPropagation();

    const path = fileBtn.dataset.path || '';
    const kind = fileBtn.dataset.kind || '';

    const file =
      typeof findWorkspaceFileByPath === 'function' ? findWorkspaceFileByPath(path, kind) : null;

    if (!file) {
      showToast?.('Tagged file not found', 'error', 2200);
      log?.(`Workspace Tags: file not found path=${path} kind=${kind}`);
      return;
    }

    log?.(`Workspace Tags: opening ${path}`);

    if (typeof openWorkspaceFile === 'function') {
      await openWorkspaceFile(file, kind || file.kind, 'workspace tag open');
    } else {
      showToast?.('Workspace open helper missing', 'error', 2200);
      log?.('Workspace Tags: openWorkspaceFile missing');
    }
  });

  panel.__workspaceTagsBound = true;

  log?.('Workspace Tags: panel wired');
}

// ================================
// Workspace Projects Panel — ACT C
// ================================

function ensureWorkspaceProjectsPanel() {
  const host = getWorkspaceSidebarContentHost();

  if (!host) {
    log?.('Workspace Projects: ensure failed; sidebar missing');
    return null;
  }

  let panel = document.getElementById('workspaceProjectsPanel');
  if (panel) return panel;

  panel = document.createElement('div');
  panel.id = 'workspaceProjectsPanel';
  panel.className = 'workspaceSection workspaceProjectsPanel';
  panel.hidden = true;

  panel.innerHTML = `
    <button
      type="button"
      class="workspacePanelHeaderButton"
      data-workspace-panel-toggle="projects"
      aria-expanded="false"
    >
      <span class="workspacePanelHeaderLeft">
        <span class="workspacePanelChevron" aria-hidden="true">▶</span>
        <span class="workspaceProjectsTitle">Projects</span>
      </span>

      <span class="workspacePanelHeaderRight">
        <span id="workspaceProjectsBadge" class="workspacePanelBadge">
          0
        </span>
        <button
          id="workspaceProjectsOpenButton"
          type="button"
          title="Open full Workspace Index"
          aria-label="Open full Workspace Index"
          data-workspace-action="open-index"
        >
          ▤
        </button>
      </span>
    </button>

    <div class="workspacePanelBody">
      <div id="workspaceProjectsSummary" class="workspaceProjectsSummary">
        No Projects found
      </div>

      <div id="workspaceProjectsList" class="workspaceProjectsList">
        <div class="workspaceProjectsEmpty">No Projects found</div>
      </div>
    </div>
  `;

  const conceptsPanel = document.getElementById('workspaceConceptsPanel');
  const relatedPanel = document.getElementById('workspaceRelatedPanel');
  const filesSection = host.querySelector('.workspaceFilesSection');

  // Insert between Concepts and Related
  if (conceptsPanel && conceptsPanel.nextSibling && conceptsPanel.nextSibling.parentNode === host) {
    host.insertBefore(panel, conceptsPanel.nextSibling);
  } else if (relatedPanel && relatedPanel.parentNode === host) {
    host.insertBefore(panel, relatedPanel);
  } else if (filesSection && filesSection.parentNode === host) {
    host.insertBefore(panel, filesSection);
  } else {
    host.appendChild(panel);
  }

  log?.('Workspace Projects: panel created');
  return panel;
}

function renderWorkspaceProjectsPanel() {
  const panel = ensureWorkspaceProjectsPanel();
  const badge = document.getElementById('workspaceProjectsBadge');
  const summary = document.getElementById('workspaceProjectsSummary');
  const list = document.getElementById('workspaceProjectsList');

  if (!panel || !badge || !summary || !list) {
    forceUpgradeWorkspacePanelMarkup('projects');
    log?.('Workspace Projects: render skipped; panel elements missing');
    return;
  }

  panel.hidden = false;

  if (!WORKSPACE_STATE?.rootHandle) {
    badge.textContent = '0';
    summary.textContent = 'Open a workspace first';
    list.innerHTML = '<div class="workspaceProjectsEmpty">Open a workspace first</div>';
    applyWorkspacePanelCollapsed(panel, 'projects', isWorkspacePanelCollapsed('projects'));
    return;
  }

  if (!WORKSPACE_INDEX_STATE?.ready) {
    badge.textContent = '0';
    summary.textContent = 'Index not ready';
    list.innerHTML = '<div class="workspaceProjectsEmpty">Index not ready</div>';
    applyWorkspacePanelCollapsed(panel, 'projects', isWorkspacePanelCollapsed('projects'));
    return;
  }

  const projects = WORKSPACE_INDEX_STATE.projects || [];
  const count = projects.length;

  badge.textContent = String(count);

  if (!count) {
    summary.textContent = 'No Projects found';
    list.innerHTML = '<div class="workspaceProjectsEmpty">No Projects found</div>';
    applyWorkspacePanelCollapsed(panel, 'projects', isWorkspacePanelCollapsed('projects'));
    return;
  }

  summary.textContent = `${count} Project${count !== 1 ? 's' : ''}`;

  // Group projects by year
  const yearGroups = new Map();
  const unscheduled = [];

  for (const project of projects) {
    const order = project.expectedOrder;
    if (order && order.valid === true && Number.isFinite(order.year)) {
      const yearKey = String(order.year);
      if (!yearGroups.has(yearKey)) {
        yearGroups.set(yearKey, { display: yearKey, projects: [] });
      }
      yearGroups.get(yearKey).projects.push(project);
    } else {
      unscheduled.push(project);
    }
  }

  // Sort year groups by year ascending, Unscheduled last
  const sortedYearKeys = Array.from(yearGroups.keys())
    .map((y) => Number(y))
    .sort((a, b) => a - b)
    .map((y) => String(y));

  let html = '';

  for (const yearKey of sortedYearKeys) {
    const group = yearGroups.get(yearKey);
    if (!group) continue;
    const groupCount = group.projects.length;

    // Sort projects within year by canonical order, then name
    const sortedProjects = group.projects.slice().sort((a, b) => {
      const orderA = a.expectedOrder;
      const orderB = b.expectedOrder;
      const canA = orderA?.canonical || '';
      const canB = orderB?.canonical || '';
      if (canA !== canB) return canA < canB ? -1 : 1;
      const nameA = String(a.name || '').toLowerCase();
      const nameB = String(b.name || '').toLowerCase();
      if (nameA !== nameB) return nameA < nameB ? -1 : 1;
      return (a.sourceLine || 0) - (b.sourceLine || 0);
    });

    const items = sortedProjects
      .map((p) => {
        const name = escapeHtml(p.name || '');
        const path = escapeHtml(p.sourcePath || '');
        const kind = escapeHtml(p.sourceKind || '');
        const line = Number(p.sourceLine) || 0;
        const lineAttr = line ? ` data-line="${escapeHtml(String(line))}"` : '';

        // Order from expectedOrder
        let orderDisplay = '\u2014';
        if (p.expectedOrder && p.expectedOrder.valid === true) {
          orderDisplay = escapeHtml(p.expectedOrder.display || p.expectedOrder.canonical || '');
        }

        // Value with currency
        let valueDisplay = '\u2014';
        if (p.value !== null && p.value !== undefined) {
          if (p.currency) {
            valueDisplay = escapeHtml(p.currency + ' ' + Number(p.value).toLocaleString());
          } else {
            valueDisplay = escapeHtml(Number(p.value).toLocaleString() + ' \u00b7 no currency');
          }
        }

        // Source provenance
        const sourceLabel = p.sourceName || p.sourcePath || '\u2014';
        const sourceDisplay =
          line > 0 ? `${escapeHtml(sourceLabel)} \u00b7 line ${line}` : escapeHtml(sourceLabel);

        return `
              <button
                type="button"
                class="workspaceProjectItem"
                data-workspace-project-item="1"
                data-path="${path}"
                data-kind="${kind}"
                ${lineAttr}
                title="${path}"
                aria-label="Open Project ${name}, value ${valueDisplay}, expected order ${orderDisplay}, source ${sourceLabel}${line ? ' line ' + line : ''}"
              >
                <span class="workspaceProjectRow">
                  <span class="workspaceProjectName">${name}</span>
                  <span class="workspaceProjectValue">${valueDisplay}</span>
                  <span class="workspaceProjectOrder">${orderDisplay}</span>
                </span>
                <span class="workspaceProjectSource">${sourceDisplay}</span>
              </button>
            `;
      })
      .join('');

    html += `
        <div class="workspaceProjectGroup">
          <div class="workspaceProjectGroupHeader">
            <span class="workspaceProjectGroupChevron" aria-hidden="true">▾</span>
            <span class="workspaceProjectGroupTitle">${escapeHtml(group.display)}</span>
            <span class="workspaceProjectGroupCount">${groupCount}</span>
          </div>
          <div class="workspaceProjectLabelRow" aria-hidden="true">
            <span class="workspaceProjectLabelName">Project name</span>
            <span class="workspaceProjectLabelValue">Value</span>
            <span class="workspaceProjectLabelOrder">Order</span>
          </div>
          <div class="workspaceProjectList">${items}</div>
        </div>
      `;
  }

  if (unscheduled.length) {
    const items = unscheduled
      .map((p) => {
        const name = escapeHtml(p.name || '');
        const path = escapeHtml(p.sourcePath || '');
        const kind = escapeHtml(p.sourceKind || '');
        const line = Number(p.sourceLine) || 0;
        const lineAttr = line ? ` data-line="${escapeHtml(String(line))}"` : '';

        // Value with currency
        let valueDisplay = '\u2014';
        if (p.value !== null && p.value !== undefined) {
          if (p.currency) {
            valueDisplay = escapeHtml(p.currency + ' ' + Number(p.value).toLocaleString());
          } else {
            valueDisplay = escapeHtml(Number(p.value).toLocaleString() + ' \u00b7 no currency');
          }
        }

        // Source provenance
        const sourceLabel = p.sourceName || p.sourcePath || '\u2014';
        const sourceDisplay =
          line > 0 ? `${escapeHtml(sourceLabel)} \u00b7 line ${line}` : escapeHtml(sourceLabel);

        return `
          <button
            type="button"
            class="workspaceProjectItem"
            data-workspace-project-item="1"
            data-path="${path}"
            data-kind="${kind}"
            ${lineAttr}
            title="${path}"
            aria-label="Open Project ${name}, value ${valueDisplay}, expected order Unscheduled, source ${sourceLabel}${line ? ' line ' + line : ''}"
          >
            <span class="workspaceProjectRow">
              <span class="workspaceProjectName">${name}</span>
              <span class="workspaceProjectValue">${valueDisplay}</span>
            </span>
            <span class="workspaceProjectSource">${sourceDisplay}</span>
          </button>
        `;
      })
      .join('');

    html += `
      <div class="workspaceProjectGroup">
        <div class="workspaceProjectGroupHeader">
          <span class="workspaceProjectGroupChevron" aria-hidden="true">▾</span>
          <span class="workspaceProjectGroupTitle">Unscheduled</span>
          <span class="workspaceProjectGroupCount">${unscheduled.length}</span>
        </div>
        <div class="workspaceProjectLabelRow" aria-hidden="true">
          <span class="workspaceProjectLabelName">Project name</span>
          <span class="workspaceProjectLabelValue">Value</span>
        </div>
        <div class="workspaceProjectList">${items}</div>
      </div>
    `;
  }

  list.innerHTML = html;
  applyWorkspacePanelCollapsed(panel, 'projects', isWorkspacePanelCollapsed('projects'));
}

function wireWorkspaceProjectsPanel() {
  ensureWorkspaceProjectsPanel();

  const panel = document.getElementById('workspaceProjectsPanel');
  if (!panel) {
    log?.('Workspace Projects: panel missing');
    return;
  }

  if (panel.__workspaceProjectsBound) {
    return;
  }

  // Open button: transition to workspace-index
  const openBtn = document.getElementById('workspaceProjectsOpenButton');
  if (openBtn && !openBtn.__workspaceProjectsOpenBound) {
    openBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      try {
        log?.('Workspace Projects: open requested');

        if (typeof globalThis.MME_WORKSPACE_HOST !== 'object') {
          log?.('Workspace Projects: open blocked; Host missing');
          return;
        }

        const result = await globalThis.MME_WORKSPACE_HOST.switchTo('workspace-index', {
          reason: 'open projects view',
        });

        if (result && result.status === globalThis.MME_WORKSPACE_HOST.RESULT_STATUS.ACTIVATED) {
          if (typeof globalThis.MME_NAVIGATION === 'object') {
            globalThis.MME_NAVIGATION.recordSuccessfulNavigation({
              type: 'virtual-workspace-index',
              id: 'mme://workspace/index',
            });
          }
          log?.('Workspace Projects: open success');
        } else {
          log?.(`Workspace Projects: open unexpected result: ${result?.status || 'unknown'}`);
        }
      } catch (e) {
        log?.(`Workspace Projects: open failed: ${e?.message || e}`);
      }
    });

    openBtn.__workspaceProjectsOpenBound = true;
  }

  // Source file opening on row click
  panel.addEventListener('click', async (event) => {
    const btn = event.target?.closest?.('[data-workspace-project-item="1"]');
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    const path = btn.dataset.path || '';
    const kind = btn.dataset.kind || '';
    const line = Number(btn.dataset.line || 0);

    const file =
      typeof findWorkspaceFileByPath === 'function' ? findWorkspaceFileByPath(path, kind) : null;

    if (!file) {
      log?.(`Workspace Projects: source file not found path=${path} kind=${kind}`);
      if (typeof showToast === 'function') {
        showToast?.('Project source file not found', 'error', 2200);
      }
      return;
    }

    log?.(`Workspace Projects: opening ${path} line=${line}`);

    if (typeof globalThis.openWorkspaceFile === 'function') {
      await globalThis.openWorkspaceFile(file, kind || file.kind, 'workspace project source open');
    } else {
      log?.('Workspace Projects: openWorkspaceFile missing');
      return;
    }

    // Wait for file activation, then scroll to line
    if (line > 0) {
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });

      const scrollToLine =
        typeof window.__cmScrollToLine === 'function' ? window.__cmScrollToLine : null;
      if (scrollToLine) {
        scrollToLine(line - 1); // Convert 1-based to 0-based
      }
    }
  });

  panel.__workspaceProjectsBound = true;
  log?.('Workspace Projects: panel wired');
}

// ACT A: Idempotent panel order normalizer.
// Moves existing nodes into canonical order using insertBefore/appendChild.
// Tolerates absent panels; preserves listeners and collapse state.
function normalizeWorkspacePanelOrder() {
  const host = getWorkspaceSidebarContentHost();
  if (!host) return;

  // Canonical order (by panel ID). Header and Navigation History are anchors.
  const order = [
    'workspaceSearchPanel',
    'workspaceActivePanel',
    'workspaceJournalsPanel',
    'workspaceConceptsPanel',
    'workspaceProjectsPanel',
    'workspaceRelatedPanel',
    'workspaceTasksPanel',
    'workspaceReportPanel',
    'workspaceTagsPanel',
    'workspaceIndexPanel',
  ];

  // Anchor: insert after header, or at top if header absent.
  const header = host.querySelector('.workspaceHeader');
  let anchor = header || null;

  for (const id of order) {
    const panel = document.getElementById(id);
    if (!panel || panel.parentNode !== host) continue;

    if (anchor) {
      if (anchor.nextSibling !== panel) {
        host.insertBefore(panel, anchor.nextSibling);
      }
    } else {
      if (host.firstChild !== panel) {
        host.insertBefore(panel, host.firstChild);
      }
    }
    anchor = panel;
  }

  // Navigation History controls remain last (workspaceNavControls).
  // It is created by workspace-sidebar.js and appended at the end already.
}

// ACT A: Idempotent post-readiness finalizer.
// Called from mme-workspace-index-ready listener.
// Does NOT call buildWorkspaceIndex() — no recursion risk.
function finalizeWorkspaceSidebar() {
  const workspaceState = globalThis.WORKSPACE_STATE || window.WORKSPACE_STATE || null;
  if (!workspaceState) {
    globalThis.log?.('Workspace: finalize skipped; WORKSPACE_STATE not ready');
    return;
  }

  // No-Workspace initial state: panels that require Workspace data (Search,
  // Active, Related, Tasks, Tags, Projects, Index) are not created until a
  // workspace is open. The header, Open Workspace, and the existing
  // no-Workspace empty state remain the only sidebar content. The Report
  // panel is unaffected: it is ensured by its own module-ready listener and
  // gates generation on index readiness itself. When a workspace opens, the
  // mme-workspace-index-ready listener below runs this finalizer once with
  // rootHandle present, creating each panel through the existing idempotent
  // ensure/wire lifecycle.
  if (!workspaceState.rootHandle) {
    if (!window.__mmeWorkspacePanelsDeferredLogged) {
      window.__mmeWorkspacePanelsDeferredLogged = true;
      globalThis.log?.(
        'Workspace: sidebar panels deferred; no active workspace (standalone controls only)'
      );
    }
    return;
  }

  try {
    // Phase 1: ensure canonical panel markup.
    forceUpgradeWorkspacePanelMarkup('index');
    forceUpgradeWorkspacePanelMarkup('related');
    forceUpgradeWorkspacePanelMarkup('tasks');

    ensureWorkspaceSearchPanel?.();
    // Wire the Search input here too (idempotent): a workspace can be opened
    // without a Journal context switch, and the context-switch path is gated
    // on rootHandle, so this is the readiness re-entry point for Search.
    wireWorkspaceSearch?.();
    ensureWorkspaceActivePanel?.();
    ensureWorkspaceRelatedPanel();
    ensureWorkspaceTasksPanel();
    ensureWorkspaceTagsPanel?.();
    ensureWorkspaceProjectsPanel();
    ensureWorkspaceIndexPanel();

    // ACT F: ensure the Quick Report configuration panel (idempotent).
    try {
      globalThis.MME_REPORT_PANEL?.ensure?.({
        getWorkspaceIndexState: () => WORKSPACE_INDEX_STATE,
        onPreparedReport: openVirtualReport,
        canGenerateReport,
        canReconcileDrawioReport,
      });
    } catch {}

    // ACT H3: ensure Draw.io reconciliation adapters are registered.
    try {
      configureDrawioReportPanel?.();
    } catch {}

    // Phase 2: normalize panel order.
    normalizeWorkspacePanelOrder();

    // Phase 3: wire actions and collapse delegation.
    wireWorkspaceIndexRefreshButton?.();
    wireWorkspaceIndexOpenButton?.();
    wireWorkspaceActivePanel?.();
    wireWorkspaceRelatedPanel();
    wireWorkspaceTasksPanel();
    wireWorkspaceTagsPanel?.();
    wireWorkspaceProjectsPanel();
    wireWorkspacePanelCollapses();

    // R-TASK2 + R-TASK3: wire task review module.
    try {
      globalThis.MME_TASK_REVIEW?.wire?.();
    } catch {}

    // Phase 4: render current panel state.
    renderWorkspaceIndexSummary();
    renderWorkspaceActivePanel?.();
    renderWorkspaceTasksPanel();
    renderWorkspaceRelatedPanel();
    renderWorkspaceTagsPanel?.();
    renderWorkspaceProjectsPanel();

    log?.('Workspace: panels setup complete');
  } catch (e) {
    log?.(`Workspace: panels finalize failed: ${e?.message || e}`);
  }
}

function setupWorkspacePanels() {
  const workspaceState = globalThis.WORKSPACE_STATE || window.WORKSPACE_STATE || null;

  if (!workspaceState) {
    globalThis.log?.('Workspace: panels setup skipped; WORKSPACE_STATE not ready');
    return;
  }

  // Delegate to the idempotent finalizer.
  finalizeWorkspaceSidebar();
}

// ACT A: Post-readiness finalization listener.
// Fires when buildWorkspaceIndex() completes and dispatches mme-workspace-index-ready.
// This is the canonical re-entry point that ensures panels are wired after reload.
// Guard against duplicate listener registration.
if (!window.__mmeWorkspaceIndexReadyFinalizerBound) {
  window.addEventListener('mme-workspace-index-ready', () => {
    try {
      finalizeWorkspaceSidebar();
    } catch (e) {
      log?.(`Workspace: index-ready finalizer failed: ${e?.message || e}`);
    }
  });
  window.__mmeWorkspaceIndexReadyFinalizerBound = true;
}

// ACT F: late-load Report module signal. Ensures the panel once after the
// module files load (they are appended after main.js in script-loader).
if (!window.__mmeReportPanelReadyFinalizerBound) {
  window.addEventListener('mme-report-panel-ready', () => {
    try {
      globalThis.MME_REPORT_PANEL?.ensure?.({
        getWorkspaceIndexState: () => WORKSPACE_INDEX_STATE,
        onPreparedReport: openVirtualReport,
        canGenerateReport,
        canReconcileDrawioReport,
      });
      log?.('Report: panel ready-signal handled');
    } catch (e) {
      log?.(`Report: ready-signal handling failed: ${e?.message || e}`);
    }
  });
  window.__mmeReportPanelReadyFinalizerBound = true;
}

function getWorkspaceParsedActiveFile() {
  const active = WORKSPACE_STATE?.activeFile;

  if (!active?.path || !WORKSPACE_INDEX_STATE?.ready) {
    return null;
  }

  const parsed = WORKSPACE_INDEX_STATE.byPath?.get(active.path);

  return parsed || null;
}

function getWorkspaceActiveStats(parsed) {
  if (!parsed) {
    return {
      openTasks: 0,
      doneTasks: 0,
      related: 0,
      linksOut: 0,
      tags: 0,
    };
  }

  const openTasks = (parsed.tasks || []).filter((task) => !task.done).length;
  const doneTasks = (parsed.tasks || []).filter((task) => task.done).length;

  let related = 0;

  if (parsed.kind === 'concepts') {
    const conceptName =
      typeof normalizeConceptName === 'function'
        ? normalizeConceptName(parsed.name || parsed.path || '')
        : String(parsed.name || '').replace(/\.md$/i, '');

    if (typeof findBacklinksForConcept === 'function') {
      related = findBacklinksForConcept(conceptName).length;
    }
  }

  return {
    openTasks,
    doneTasks,
    related,
    linksOut: (parsed.conceptLinks || []).length,
    tags: (parsed.tags || []).length,
  };
}

function getWorkspaceKindLabel(kind) {
  const normalized =
    typeof normalizeWorkspaceKindForCompare === 'function'
      ? normalizeWorkspaceKindForCompare(kind || '')
      : String(kind || '').trim();

  if (normalized === 'journals') return 'Journal';
  if (normalized === 'concepts') return 'Concept';

  return 'File';
}

function getWorkspaceKindIcon(kind) {
  const normalized =
    typeof normalizeWorkspaceKindForCompare === 'function'
      ? normalizeWorkspaceKindForCompare(kind || '')
      : String(kind || '').trim();

  if (normalized === 'journals') return '📝';
  if (normalized === 'concepts') return '🧠';

  return '📄';
}

function renderWorkspaceActivePanel() {
  const panel = ensureWorkspaceActivePanel();
  const badge = document.getElementById('workspaceActiveBadge');
  const body = document.getElementById('workspaceActiveBody');

  if (!panel || !badge || !body) {
    log?.(
      `Workspace Active: render skipped panel=${Boolean(panel)} badge=${Boolean(
        badge
      )} body=${Boolean(body)}`
    );
    return;
  }

  if (!WORKSPACE_STATE?.rootHandle) {
    panel.hidden = true;
    badge.textContent = 'No file';
    body.innerHTML = '<div class="workspaceActiveEmpty">Open a workspace first</div>';
    return;
  }

  panel.hidden = false;

  const active = WORKSPACE_STATE?.activeFile;

  if (!active?.path) {
    badge.textContent = 'No file';
    body.innerHTML = '<div class="workspaceActiveEmpty">No active workspace file</div>';

    applyWorkspacePanelCollapsed(panel, 'active', isWorkspacePanelCollapsed('active'));

    return;
  }

  const parsed = getWorkspaceParsedActiveFile();
  const kind = active.kind || parsed?.kind || '';
  const kindLabel = getWorkspaceKindLabel(kind);
  const icon = getWorkspaceKindIcon(kind);
  const displayName = parsed?.title || active.name || active.path || 'Untitled';

  badge.textContent = kindLabel;

  if (!parsed) {
    body.innerHTML = `
      <div class="workspaceActiveName">
        <span aria-hidden="true">${icon}</span>
        <span class="workspaceActiveNameText">${escapeHtml(displayName)}</span>
      </div>

      <div class="workspaceActiveMeta">
        Index not ready for this file
      </div>
    `;

    applyWorkspacePanelCollapsed(panel, 'active', isWorkspacePanelCollapsed('active'));

    return;
  }

  const stats = getWorkspaceActiveStats(parsed);

  const tagHtml = (parsed.tags || [])
    .slice(0, 8)
    .map((tag) => {
      return `<span class="workspaceActiveTag">#${escapeHtml(tag)}</span>`;
    })
    .join('');

  const statsRows =
    parsed.kind === 'concepts'
      ? [
          ['Open', stats.openTasks],
          ['Done', stats.doneTasks],
          ['Related', stats.related],
          ['Links out', stats.linksOut],
        ]
      : [
          ['Open', stats.openTasks],
          ['Done', stats.doneTasks],
          ['Tags', stats.tags],
          ['Links', stats.linksOut],
        ];

  body.innerHTML = `
    <div class="workspaceActiveName">
      <span aria-hidden="true">${icon}</span>
      <span class="workspaceActiveNameText">${escapeHtml(displayName)}</span>
    </div>

    <div class="workspaceActiveMeta">
      ${escapeHtml(kindLabel)}${parsed.date ? ` · ${escapeHtml(parsed.date)}` : ''}
    </div>

    ${
      tagHtml
        ? `<div class="workspaceActiveTags">${tagHtml}</div>`
        : '<div class="workspaceActiveMeta">No tags</div>'
    }

    <div class="workspaceActiveStats">
      ${statsRows
        .map(([label, value]) => {
          return `
            <div class="workspaceActiveStat">
              <span class="workspaceActiveStatLabel">${escapeHtml(label)}</span>
              <span class="workspaceActiveStatValue">${escapeHtml(String(value))}</span>
            </div>
          `;
        })
        .join('')}
    </div>
  `;

  log?.(`Workspace Active: rendered path=${active?.path || '(none)'}`);

  applyWorkspacePanelCollapsed(panel, 'active', isWorkspacePanelCollapsed('active'));
}

function wireWorkspaceActivePanel() {
  ensureWorkspaceActivePanel();
}

function renderWorkspaceIndexSummary() {
  const panel = ensureWorkspaceIndexPanel();
  if (!panel) return;

  const summaryEl = panel.querySelector('#workspaceIndexSummary');
  const metricsEl = panel.querySelector('#workspaceIndexMetrics');
  const index = WORKSPACE_INDEX_STATE;

  if (!summaryEl || !metricsEl) {
    forceUpgradeWorkspacePanelMarkup('index');
    log?.('Workspace Index: render failed; summary elements missing');
    return;
  }

  if (!index?.ready) {
    summaryEl.textContent = WORKSPACE_STATE?.rootHandle ? 'Index building...' : 'No workspace open';
    metricsEl.innerHTML = '';

    const badge = document.getElementById('workspaceIndexBadge');
    if (badge) badge.textContent = 'Not ready';

    applyWorkspacePanelCollapsed(panel, 'index', isWorkspacePanelCollapsed('index'));
    return;
  }

  const openTasks = index.tasks.filter((task) => !task.done).length;
  const doneTasks = index.tasks.filter((task) => task.done).length;
  const updatedAt = index.lastBuiltAt
    ? new Date(index.lastBuiltAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  /*
    Expanded Workspace Index should show ONLY one line:
    - keep #workspaceIndexUpdated
    - hide/clear #workspaceIndexSummary to avoid duplicate Updated row
  */
  summaryEl.innerHTML = '';

  const badge = document.getElementById('workspaceIndexBadge');
  if (badge) {
    badge.textContent = `${index.files.length} files · ${openTasks} open`;
  }

  const updated = document.getElementById('workspaceIndexUpdated');
  if (updated) {
    updated.textContent = updatedAt ? `Updated ${updatedAt}` : '';
  }

  const metrics = [
    { label: 'Files', value: index.files.length },
    { label: 'Journals', value: (index.byKind.journals || []).length },
    { label: 'Concepts', value: (index.byKind.concepts || []).length },
    { label: 'Tags', value: index.tags.size },
    { label: 'Tasks', value: index.tasks.length },
    { label: 'Open', value: openTasks },
    { label: 'Done', value: doneTasks },
    { label: 'Links', value: index.links.size },
  ];

  metricsEl.innerHTML = metrics
    .map(
      (metric) => `
        <div class="workspaceIndexMetricItem">
          <div class="workspaceIndexMetricValue">${escapeHtml(String(metric.value))}</div>
          <div class="workspaceIndexMetricLabel">${escapeHtml(metric.label)}</div>
        </div>
      `
    )
    .join('');

  applyWorkspacePanelCollapsed(panel, 'index', isWorkspacePanelCollapsed('index'));
}

function runWorkspaceSearch(query) {
  const normalized = normalizeWorkspaceSearchQuery(query);
  const input = document.getElementById('workspaceSearchInput');
  const resultsEl = document.getElementById('workspaceSearchResults');

  if (!input || !resultsEl) {
    log?.(`Workspace Search: run failed input=${Boolean(input)} results=${Boolean(resultsEl)}`);
    return;
  }

  if (!normalized || normalized.length < WORKSPACE_SEARCH_MIN_CHARS) {
    resultsEl.hidden = true;
    resultsEl.innerHTML = '';
    __workspaceSearchLastQuery = '';
    return;
  }

  if (normalized === __workspaceSearchLastQuery) {
    return;
  }

  __workspaceSearchLastQuery = normalized;

  const state = globalThis.WORKSPACE_STATE || {
    files: {
      journals: [],
      concepts: [],
    },
  };

  const files = [...(state.files?.journals || []), ...(state.files?.concepts || [])];

  const matches = files.filter((file) => {
    const name = String(file.name || '').toLowerCase();
    const path = String(file.path || '').toLowerCase();
    return name.includes(normalized) || path.includes(normalized);
  });

  if (!matches.length) {
    resultsEl.hidden = true;
    resultsEl.innerHTML = '';
    return;
  }

  const rows = matches
    .slice(0, 20)
    .map((file) => {
      const path = String(file.path || '');
      const kind = String(file.kind || '');
      const name = String(file.name || '');
      return `
        <button
          type="button"
          data-workspace-search-result="1"
          data-path="${escapeHtml(path)}"
          data-kind="${escapeHtml(kind)}"
          class="workspaceSearchResultItem"
        >
          <span class="workspaceSearchResultIcon">${getWorkspaceSearchIcon(kind)}</span>
          <span class="workspaceSearchResultMeta">
            <span class="workspaceSearchResultName">${escapeHtml(name)}</span>
            <span class="workspaceSearchResultKind">${escapeHtml(getWorkspaceSearchKindLabel(kind))}</span>
          </span>
          <span class="workspaceSearchResultPath">${escapeHtml(path)}</span>
        </button>
      `;
    })
    .join('');

  resultsEl.innerHTML = rows;
  resultsEl.hidden = false;
}

function normalizeWorkspaceSearchPath(value) {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\\.?\//, '');
}

function findWorkspaceFileByPath(path, preferredKind = '') {
  const target = normalizeWorkspaceSearchPath(path);
  if (!target) return null;

  const state = globalThis.WORKSPACE_STATE || {};
  const allFiles = [...(state.files?.journals || []), ...(state.files?.concepts || [])];
  const kind = normalizeWorkspaceKindForCompare(preferredKind || '');

  if (kind) {
    const byKind = allFiles.filter(
      (file) => normalizeWorkspaceKindForCompare(file.kind || '') === kind
    );

    const exactMatch = byKind.find((file) => normalizeWorkspaceSearchPath(file.path) === target);

    if (exactMatch) return exactMatch;
  }

  return allFiles.find((file) => normalizeWorkspaceSearchPath(file.path) === target) || null;
}

async function openWorkspaceSearchResultFile(path, preferredKind = '') {
  const fileRecord = findWorkspaceFileByPath(path, preferredKind);
  if (!fileRecord || !fileRecord.handle) {
    return null;
  }

  if (!globalThis.MME_APP?.confirmDiscardIfDirty?.()) {
    return null;
  }

  const file = await fileRecord.handle.getFile();
  const text = await file.text();

  globalThis.MME_APP.openTextDocument({
    text,
    fileName: file.name,
    fileHandle: fileRecord.handle,
    reason: 'workspace search result open',
  });

  WORKSPACE_STATE.activeFile = {
    kind: fileRecord.kind || 'journals',
    name: fileRecord.name,
    path: fileRecord.path,
    handle: fileRecord.handle,
  };

  globalThis.persistActiveWorkspaceFile?.();
  window.updateWorkspaceActiveFileHighlight?.();
  renderWorkspaceActivePanel?.();
  renderWorkspaceRelatedPanel?.();

  return fileRecord;
}

async function openWorkspaceFile(file, kind = '', reason = 'workspace open file', options = {}) {
  if (!file || !file.handle) {
    throw new Error('Workspace file handle missing');
  }

  const historyMode = options.historyMode === 'restore' ? 'restore' : 'normal';

  const fileKind =
    typeof normalizeWorkspaceKindForCompare === 'function'
      ? normalizeWorkspaceKindForCompare(kind || file.kind || '')
      : String(kind || file.kind || '').trim();

  const fileName =
    file.name ||
    (typeof getWorkspaceFileNameFromPath === 'function'
      ? getWorkspaceFileNameFromPath(file.path)
      : String(file.path || '')
          .split('/')
          .pop());

  const filePath = file.path || `${fileKind}/${fileName}`;

  // ACT G2: One guard at the global openWorkspaceFile() boundary only.
  // If an unsaved virtual Report is active, require Save, Discard, or Cancel
  // before the physical target may replace it.
  const guard = await guardUnsavedReportBeforePhysicalOpen();
  if (!guard || guard.ok !== true) {
    log?.(
      `Report: G2 physical open blocked reason=${guard?.reason || 'unknown'} target=${filePath}`
    );
    return {
      ok: false,
      cancelled: guard?.cancelled === true,
      reason: guard?.reason || 'report-guard',
    };
  }

  // Normal mode: block competing opens during Back/Forward restore.
  if (historyMode === 'normal' && globalThis.MME_NAVIGATION?.isNavigationInProgress?.()) {
    globalThis.MME_APP?.showToast?.('Navigation in progress. Try again shortly.', 'warn', 2000);
    return null;
  }

  // Normal mode: duplicate-current preflight before file read and dirty prompt.
  if (historyMode === 'normal' && typeof globalThis.MME_NAVIGATION === 'object') {
    const current = globalThis.MME_NAVIGATION.getCurrent?.();
    const target = {
      type: 'workspace-file',
      path: filePath,
      kind: fileKind,
      name: fileName,
      source: reason,
    };

    if (globalThis.MME_NAVIGATION.sameLocation?.(current, target)) {
      log?.(`Workspace: noop — ${filePath} is already current`);
      return file;
    }
  }

  const blob = await file.handle.getFile();
  const text = await blob.text();

  if (!globalThis.MME_APP?.confirmDiscardIfDirty?.()) {
    return null;
  }

  // ACT B: Use the shared suppression helper (lexical counter) instead of globalThis.
  runProgrammaticTextChange(() => {
    openTextDocument({
      text,
      fileName,
      fileHandle: file.handle,
      reason,
    });
  });

  WORKSPACE_STATE.activeFile = {
    kind: fileKind || 'journals',
    name: fileName,
    path: filePath,
    handle: file.handle,
  };

  // ACT G: A successfully opened physical source is authoritative.
  // Clear any stale virtual Report identity so the Report panel does not
  // remain in "report-already-active" state after opening a Journal/Concept.
  if (__virtualReportSession && __virtualReportSession.kind === 'report') {
    __virtualReportSession = null;
    log?.('Report: identity cleared on physical source open');
    // ACT H3: discard any stale reconciliation session with it.
    try {
      globalThis.MME_DRAWIO_REPORT_PANEL?.resetSession?.('navigation');
    } catch {}
    // ACT H3: refresh the Report panel so the Draw.io button disables.
    try {
      globalThis.MME_REPORT_PANEL?.refresh?.();
    } catch {}
  }

  globalThis.persistActiveWorkspaceFile?.();
  window.updateWorkspaceActiveFileHighlight?.();
  renderWorkspaceActivePanel?.();
  renderWorkspaceRelatedPanel?.();
  renderWorkspaceTasksPanel?.();
  scheduleWorkspaceIndexRebuild?.('workspace file opened');

  log?.(`Workspace: opened ${filePath}`);

  // Record successful normal navigation after physical lifecycle completes.
  if (historyMode === 'normal' && typeof globalThis.MME_NAVIGATION === 'object') {
    globalThis.MME_NAVIGATION.recordSuccessfulNavigation({
      type: 'workspace-file',
      path: filePath,
      kind: fileKind,
      name: fileName,
      source: reason,
    });
  }

  return file;
}

try {
  window.openWorkspaceFile = openWorkspaceFile;
  globalThis.openWorkspaceFile = openWorkspaceFile;
} catch {}

try {
  globalThis.findWorkspaceFileByPath = findWorkspaceFileByPath;
} catch {}

// ACT G2B: Expose the auxiliary document-switch guard and helpers so
// workspace-controller.js (loaded as a module after main.js) can reuse them.
try {
  globalThis.guardUnsavedReportBeforeDocumentSwitch =
    guardUnsavedReportBeforeDocumentSwitch;
  globalThis.isUnsavedReportActive = isUnsavedReportActive;
  globalThis.clearReportIdentityAfterTransition = clearReportIdentityAfterTransition;
} catch {}

function wireWorkspaceSearch() {
  ensureWorkspaceSearchPanel();

  const input = document.getElementById('workspaceSearchInput');
  const resultsEl = document.getElementById('workspaceSearchResults');

  if (!input || !resultsEl) {
    log?.(`Workspace Search: not wired input=${Boolean(input)} results=${Boolean(resultsEl)}`);
    return;
  }

  if (input.__workspaceSearchBound) {
    log?.('Workspace Search: already wired');
    return;
  }

  input.addEventListener('input', () => {
    const query = input.value || '';

    clearTimeout(__workspaceSearchTimer);

    __workspaceSearchTimer = setTimeout(() => {
      runWorkspaceSearch(query);
    }, 180);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.value = '';
      clearTimeout(__workspaceSearchTimer);
      resultsEl.hidden = true;
      resultsEl.innerHTML = '';
      __workspaceSearchLastQuery = '';
      log?.('Workspace Search: cleared');
    }
  });

  resultsEl.addEventListener('click', async (event) => {
    const btn = event.target?.closest?.('[data-workspace-search-result="1"]');

    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    const path = btn.dataset.path || '';
    const kind = btn.dataset.kind || '';
    const file = findWorkspaceFileByPath(path, kind);

    if (!file) {
      showToast?.('Search result file not found', 'error', 2200);
      log?.(`Workspace Search: result file not found path=${path} kind=${kind}`);
      return;
    }

    log?.(`Workspace Search: opening result ${path} kind=${kind}`);

    if (typeof globalThis.openWorkspaceFile === 'function') {
      await globalThis.openWorkspaceFile(file);
      return;
    }

    const opened = await openWorkspaceSearchResultFile(path, kind);

    if (!opened) {
      showToast?.('Workspace open helper missing', 'error', 2200);
      log?.('Workspace Search: open helper missing');
    }
  });

  input.__workspaceSearchBound = true;

  setupWorkspacePanels();

  log?.('Workspace Search: wired');
}

let __workspacePanelCollapseOwner = null;

function handleWorkspacePanelCollapseClick(event) {
  const btn = event.target?.closest?.('[data-workspace-panel-toggle]');

  if (!btn) return;

  event.preventDefault();
  event.stopPropagation();

  const panelId = btn.dataset.workspacePanelToggle || '';

  if (!panelId) return;

  toggleWorkspacePanel(panelId);
}

function wireWorkspacePanelCollapses() {
  const sidebar = document.getElementById('workspaceSidebar');

  if (!sidebar) {
    log?.('Workspace Panels: collapse wiring skipped; sidebar missing');
    return;
  }

  if (__workspacePanelCollapseOwner === sidebar) return;

  if (__workspacePanelCollapseOwner) {
    __workspacePanelCollapseOwner.removeEventListener('click', handleWorkspacePanelCollapseClick);
  }

  sidebar.addEventListener('click', handleWorkspacePanelCollapseClick);

  __workspacePanelCollapseOwner = sidebar;
  log?.('Workspace Panels: collapse delegation wired');
}

function setStatus(s) {
  saveStatus.textContent = s || '';
}

function wireLogsPanelControls() {
  const btnCopyLogs = document.getElementById('btnCopyLogs');
  const btnClearLogs = document.getElementById('btnClearLogs');
  const btnCloseLogs = document.getElementById('btnCloseLogs');

  if (btnCopyLogs && !btnCopyLogs.__bound) {
    btnCopyLogs.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      try {
        const text = logBox?.textContent || '';
        await navigator.clipboard.writeText(text);
        showToast?.('Logs copied', 'ok', 1400);
        log?.('Logs copied to clipboard');
      } catch (e) {
        showToast?.('Could not copy logs', 'error', 2200);
        log?.(`Copy logs failed: ${e?.message || e}`);
      }
    });

    btnCopyLogs.__bound = true;
  }

  if (btnClearLogs && !btnClearLogs.__bound) {
    btnClearLogs.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (logBox) {
        logBox.textContent = '';
      }

      log?.('Logs cleared');
    });

    btnClearLogs.__bound = true;
  }

  if (btnCloseLogs && !btnCloseLogs.__bound) {
    btnCloseLogs.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (logs) {
        logs.style.display = 'none';
      }
    });

    btnCloseLogs.__bound = true;
  }

  log?.('Logs panel controls wired');
}

function confirmDiscardIfDirty() {
  if (!dirty) return true;
  return confirm('Current document has unsaved changes. Discard?');
}

// ACT G1: Decision helper for Report generation when the current source is dirty.
// Uses two sequential window.confirm calls and returns one of:
//   { action: 'save' }    — Save before generating the Report
//   { action: 'discard' } — Discard current unsaved changes and generate the Report
//   { action: 'cancel' }  — Cancel Report generation (no changes)
// Does not use window.prompt, modals, or CSS.
// ACT G2: Accepts optional alternate messages so the same helper can be reused
// when leaving an unsaved Report through openWorkspaceFile().
function resolveSaveDiscardCancelDecision(options) {
  options = options || {};
  const saveMessage = options.saveMessage || 'Save before generating the Report?';
  const discardMessage =
    options.discardMessage || 'Discard the current unsaved changes and generate the Report?';

  // First confirmation: save first, or handle unsaved changes.
  if (confirm(saveMessage)) {
    return { action: 'save' };
  }

  // Second confirmation: discard current unsaved changes and continue.
  if (confirm(discardMessage)) {
    return { action: 'discard' };
  }

  // Cancel: no changes.
  return { action: 'cancel' };
}

// ACT G2: Guard for leaving an unsaved virtual Report through a physical open.
// Called at the global main.js openWorkspaceFile() boundary only.
// Qualification: Report identity must be an unsaved virtual Report.
// Returns:
//   { ok: true,  action: 'saved' | 'discarded' | 'not-report' }
//   { ok: false, cancelled: true,  reason: 'report-navigation-cancelled' }
//   { ok: false, cancelled: false, reason: 'report-save-failed' }
// This helper never opens the requested physical target.
async function guardUnsavedReportBeforePhysicalOpen() {
  const session = __virtualReportSession;

  const isUnsavedVirtualReport = Boolean(
    session &&
      session.kind === 'report' &&
      session.virtual === true &&
      session.saved === false
  );

  if (!isUnsavedVirtualReport) {
    return { ok: true, action: 'not-report' };
  }

  const decision = resolveSaveDiscardCancelDecision({
    saveMessage: 'The current Report has not been saved.\n\nSave before leaving?',
    discardMessage: 'Discard this Report and continue?',
  });

  if (decision.action === 'save') {
    // Preserve current identity values; they are only mutated after a real save.
    const saveResult = await saveSmart();

    if (!saveResult || saveResult.ok !== true) {
      log?.(`Report: G2 guard save did not succeed — physical open blocked (${saveResult?.reason || 'unknown'})`);
      return {
        ok: false,
        cancelled: false,
        reason: 'report-save-failed',
      };
    }

    // saveSmart() already updates Report identity to virtual=false, saved=true (ACT G1).
    return { ok: true, action: 'saved' };
  }

  if (decision.action === 'discard') {
    // Intentionally discard the current Report draft.
    // Clear only the current Report draft; never Journal/Concept drafts.
    try {
      clearDraft(currentFileName);
    } catch (e) {
      log?.(`Report: G2 draft clear failed: ${e?.message || e}`);
    }
    log?.('Report: G2 discard approved — draft discarded');
    return { ok: true, action: 'discarded' };
  }

  // decision.action === 'cancel'
  log?.('Report: G2 physical open cancelled by user');
  return {
    ok: false,
    cancelled: true,
    reason: 'report-navigation-cancelled',
  };
}

// ACT G2B: Thin wrapper so auxiliary document-switch paths (context selector,
// Today, New Concept) can reuse the exact same Report leave decision without
// renaming the existing physical-open guard. Delegates directly.
async function guardUnsavedReportBeforeDocumentSwitch() {
  return guardUnsavedReportBeforePhysicalOpen();
}

// ACT G2B: Qualification helper for an unsaved virtual Report.
// Returns true only when Report identity is kind=report, virtual=true, saved=false.
function isUnsavedReportActive() {
  const session = __virtualReportSession;
  return Boolean(
    session &&
      session.kind === 'report' &&
      session.virtual === true &&
      session.saved === false
  );
}

// ACT G2B: Clear Report identity at the safe target-activation boundary and
// refresh Report panel visibility so Generate re-enables. Preserves Report
// panel configuration (dates, Project mode, sections, Report Notes).
function clearReportIdentityAfterTransition() {
  if (__virtualReportSession && __virtualReportSession.kind === 'report') {
    __virtualReportSession = null;
    log?.('Report: identity cleared after auxiliary transition');
    // ACT H3: discard any stale reconciliation session with it.
    try {
      globalThis.MME_DRAWIO_REPORT_PANEL?.resetSession?.('navigation');
    } catch {}
  }
  try {
    globalThis.MME_REPORT_PANEL?.refresh?.();
  } catch (e) {
    log?.(`Report: panel refresh after transition failed: ${e?.message || e}`);
  }
}

// ACT G2C: Narrow saved-Report recognition helper.
// Returns true only when the Markdown begins with a valid leading frontmatter
// block that explicitly contains the exact field "type: report".
// Reuses the existing frontmatter parser (parseSimpleYamlFrontmatter) when
// available. Does NOT identify Reports from filename, title, headings, or
// suggested-filename patterns. Does NOT parse Report sections, tables, Tasks,
// Projects, or Template Fields.
function isSavedReportMarkdown(text) {
  const source = String(text || '');

  // Require a leading frontmatter block.
  if (!/^\uFEFF?\s*---\s*\n/.test(source)) {
    return false;
  }

  let data = null;

  try {
    if (typeof globalThis.parseSimpleYamlFrontmatter === 'function') {
      const parsed = globalThis.parseSimpleYamlFrontmatter(source);
      data = parsed && typeof parsed === 'object' ? parsed.data : null;
    }
  } catch (e) {
    log?.(`Report: G2C frontmatter parse failed: ${e?.message || e}`);
  }

  if (!data || typeof data !== 'object') {
    return false;
  }

  // Exact field match: type: report (case-insensitive value, trimmed).
  const typeValue = String(data.type ?? '').trim().toLowerCase();
  return typeValue === 'report';
}

function setWritableHandleForCurrentFile(handle) {
  currentSaveHandle = handle || null;
  setStatus(modeLabel());
}

// ACT B: Shared programmatic text suppression helper.
// Uses the same lexical counter that the input handler reads.
// Supports nested calls; try/finally prevents stuck suppression after exceptions.
function runProgrammaticTextChange(callback) {
  __programmaticTextChange += 1;
  try {
    return callback();
  } finally {
    __programmaticTextChange -= 1;
  }
}

function openTextDocument({ text, fileName, fileHandle = null, reason = 'openTextDocument' }) {
  currentFileName = fileName || 'journal.md';
  currentSaveHandle = fileHandle || null;

  // ACT B: Wrap text mutation with suppression helper to prevent false dirty.
  runProgrammaticTextChange(() => {
    md.value = text || '';

    if (typeof window.__cmSetText === 'function') {
      window.__cmSetText(md.value);
    }
  });

  dirty = false;
  externalStale = false;
  externalStaleModified = 0;

  // ACT G / T1B: capture the post-open Task baseline so the next physical Save
  // can reconcile checkbox changes. Report documents are excluded internally.
  captureTaskBaseline();

  setStatus(modeLabel());
  updateDocumentTitle();

  hasAutoFitted = false;
  render(reason);
}

// ACT G: Open a virtual unsaved Report document.
// Transaction order: validate -> dirty decision -> clear physical state -> set editor -> render.
// ACT G1: No previous source session is captured. The physical source file is
// handled directly by saveSmart() (save action) or left untouched (discard action).
// ACT G: Report document identity check. Returns false when a Report is active.
function canGenerateReport() {
  return !(__virtualReportSession && __virtualReportSession.kind === 'report');
}

// ACT H3: Draw.io reconciliation availability. True only while a Report
// document is active (virtual unsaved, saved, or reopened saved Report).
// Independent of canGenerateReport() — the two have opposite availability rules.
let __lastCanReconcileLog = null;
function canReconcileDrawioReport() {
  const session = __virtualReportSession;
  const kind = session?.kind || 'none';
  const virtual = session && typeof session.virtual !== 'undefined' ? String(session.virtual) : 'none';
  const savedVal = session && typeof session.saved !== 'undefined' ? String(session.saved) : 'none';
  const result = Boolean(session && session.kind === 'report');
  // Temporary structural diagnostic (verify-only); log only on change.
  const sig = `${kind}|${virtual}|${savedVal}|${result}`;
  if (sig !== __lastCanReconcileLog) {
    __lastCanReconcileLog = sig;
    log?.(`Report: canReconcile Draw.io kind=${kind} virtual=${virtual} saved=${savedVal} result=${result}`);
  }
  return result;
}

// ACT H3: Canonical editor update for Template Fields insertion.
// Uses runProgrammaticTextChange + __cmSetText, marks dirty once, updates
// status/title, renders once. Preserves Report identity, currentSaveHandle,
// currentFileName, Report Notes configuration, and the H3 template session.
function applyDrawioReportMarkdown(text) {
  const nextText = String(text == null ? '' : text);
  if (nextText === md.value) {
    return { changed: false };
  }
  runProgrammaticTextChange(() => {
    md.value = nextText;
    if (typeof window.__cmSetText === 'function') {
      window.__cmSetText(nextText);
    }
  });
  dirty = true;
  setStatus(modeLabel());
  updateDocumentTitle();
  render('drawio-report-template-fields');
  log?.('DrawioReport: editor updated through canonical setter');
  return { changed: true };
}

// ACT H3: Read-only Draw.io template picker. Temporary H3 input only —
// never touches currentSaveHandle, currentFileName, WORKSPACE_STATE.activeFile,
// Navigation History, Hot Reload, Report identity, or editor content.
async function pickDrawioTemplateFile() {
  // ACT H4.1 — Android/Chrome compatibility: .drawio files are commonly
  // classified by the device file manager as application/octet-stream
  // (displayed as BIN). Extension-to-MIME mapping avoids duplicate-extension
  // rejection by Chromium. All files stays available (excludeAcceptAllOption
  // is deliberately not set). Content remains validated by H2 afterwards;
  // file.type is never trusted as proof of validity.
  const acceptTypes = [
    {
      description: 'Draw.io templates',
      accept: {
        'application/xml': ['.xml'],
        'application/octet-stream': ['.drawio'],
      },
    },
  ];
  // Narrow assessment normalization only: optional UTF-8 BOM and leading
  // whitespace. Declaration-led XML is NOT altered here; H2 content
  // validation remains authoritative.
  const normalizeTemplateText = (text) =>
    String(text == null ? '' : text)
      .replace(/^\uFEFF/, '')
      .replace(/^\s+/, '');
  try {
    if (window.isSecureContext && 'showOpenFilePicker' in window) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: acceptTypes,
          multiple: false,
        });
        const file = await handle.getFile();
        const text = await file.text();
        return { ok: true, name: file.name, text: normalizeTemplateText(text) };
      } catch (e) {
        if (e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) {
          return { ok: false, reason: 'cancelled' };
        }
        // Fall through to the input fallback for other picker errors.
      }
    }
    // Fallback: hidden file input (read-only, no writable handle).
    const picked = await new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.drawio,.xml,application/xml,text/xml,application/octet-stream';
      let settled = false;
      const done = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      input.addEventListener('change', () => {
        done(input.files && input.files[0] ? input.files[0] : null);
      });
      // Cancel detection is heuristic; treat window focus without change as cancel.
      window.addEventListener(
        'focus',
        () => {
          setTimeout(() => done(null), 300);
        },
        { once: true }
      );
      input.click();
    });
    if (!picked) {
      return { ok: false, reason: 'cancelled' };
    }
    try {
      const text = await picked.text();
      return { ok: true, name: picked.name, text: normalizeTemplateText(text) };
    } catch (e) {
      log?.(`DrawioReport: template read failed: ${e?.message || e}`);
      return { ok: false, reason: 'read-failed' };
    }
  } catch (e) {
    log?.(`DrawioReport: template picker failed: ${e?.message || e}`);
    return { ok: false, reason: 'read-failed' };
  }
}

// ACT H4: Narrow output-delivery adapter. Save As via showSaveFilePicker when
// available; Blob download fallback only when the picker path is unavailable.
// Never touches currentSaveHandle, currentFileName, dirty state, drafts,
// Navigation History, WORKSPACE_STATE.activeFile, or Hot Reload ownership.
// The generated .drawio file is a separate artifact and never becomes the
// current MarkmapEditor document.
async function saveDrawioOutput({ xml, suggestedFilename, mode }) {
  const outputXml = String(xml == null ? '' : xml);
  const name = String(suggestedFilename || 'report-visual.drawio');
  if (!outputXml.trim()) {
    log?.('DrawioReport: output failed reason=empty-output');
    return { ok: false, cancelled: false, reason: 'write-failed', error: 'empty xml' };
  }

  // Primary path: Save As picker.
  if (savePickerUsable()) {
    let handle = null;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [
          {
            description: 'Draw.io diagram',
            accept: { 'text/xml': ['.drawio'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(new Blob([outputXml], { type: 'text/xml;charset=utf-8' }));
      await writable.close();
      // Deliberately NOT assigned to currentSaveHandle and not registered
      // anywhere else as document state.
      log(`DrawioReport: output saved filename=${name} method=picker${mode ? ` mode=${mode}` : ''}`);
      return { ok: true, filename: name, method: 'picker' };
    } catch (e) {
      if (e && e.name === 'AbortError') {
        // Normal user cancellation of the dialog — never an error surface.
        log('DrawioReport: output cancelled');
        return { ok: false, cancelled: true, reason: 'cancelled' };
      }
      if (e && e.name === 'NotAllowedError') {
        // Permission-denied or write failure — a structured failure,
        // NOT cancellation and NOT success. No automatic download fallback.
        log(`DrawioReport: output failed reason=write-failed error=${e?.message || e}`);
        showToast?.('Saving the Draw.io file was not permitted. Please try again.', 'error', 4500);
        return { ok: false, cancelled: false, reason: 'write-failed', error: e?.message || e };
      }
      // Any other picker/write failure stays a structured failure too.
      log(`DrawioReport: output failed reason=write-failed error=${e?.name || ''} ${e?.message || e}`);
      showToast?.('Writing the Draw.io file failed. Please try again.', 'error', 4500);
      return { ok: false, cancelled: false, reason: 'write-failed', error: e?.message || e };
    }
  }

  // Fallback path: environment has no usable Save As picker.
  try {
    const blob = new Blob([outputXml], { type: 'text/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    log(`DrawioReport: output delivered filename=${name} method=download${mode ? ` mode=${mode}` : ''}`);
    return { ok: true, filename: name, method: 'download' };
  } catch (e) {
    log(`DrawioReport: output failed reason=download-failed error=${e?.message || e}`);
    showToast?.('The Draw.io download could not be started.', 'error', 4500);
    return { ok: false, cancelled: false, reason: 'download-failed', error: e?.message || e };
  }
}

// ACT H3: Register adapters with the reconciliation panel module.
function configureDrawioReportPanel() {
  try {
    globalThis.MME_DRAWIO_REPORT_PANEL?.configure?.({
      getMarkdown: () => md.value,
      setMarkdown: applyDrawioReportMarkdown,
      isReportDocument: canReconcileDrawioReport,
      getCurrentFileName: () => currentFileName,
      pickTemplateFile: pickDrawioTemplateFile,
      saveDrawioOutput,
      showToast,
      log,
    });
  } catch (e) {
    log?.(`DrawioReport: adapter configuration failed: ${e?.message || e}`);
  }
}

// ACT H3: Late-load signal for the Draw.io Report panel module.
if (!window.__mmeDrawioReportPanelReadyBound) {
  window.addEventListener('mme-drawio-report-panel-ready', () => {
    try {
      configureDrawioReportPanel();
      log?.('DrawioReport: panel ready-signal handled');
    } catch (e) {
      log?.(`DrawioReport: ready-signal handling failed: ${e?.message || e}`);
    }
  });
  window.__mmeDrawioReportPanelReadyBound = true;
}

async function openVirtualReport(preparedResult) {
  if (!preparedResult || typeof preparedResult !== 'object') {
    showToast?.('Report preparation failed: invalid result', 'error', 3000);
    log?.('Report: openVirtualReport blocked — invalid preparedResult');
    return { ok: false, reason: 'invalid-result', error: 'Report preparation failed: invalid result' };
  }

  const markdown = String(preparedResult.markdown || '');
  const suggestedFilename = String(preparedResult.suggestedFilename || 'quick-report.md');

  if (!markdown) {
    showToast?.('Report preparation failed: empty markdown', 'error', 3000);
    log?.('Report: openVirtualReport blocked — empty markdown');
    return { ok: false, reason: 'empty-markdown', error: 'Report preparation failed: empty markdown' };
  }

  // 0. Defensive guard: a Report document is already active.
  //    Do not capture the current Report, do not replace editor content,
  //    do not clear handles or Task baseline.
  if (__virtualReportSession && __virtualReportSession.kind === 'report') {
    log?.('Report: generation blocked reason=report-already-active');
    showToast?.('Return to the workspace before generating another Report.', 'warn', 3000);
    return {
      ok: false,
      reason: 'report-already-active',
      error: 'Return to the workspace before generating another Report.',
    };
  }

  // 1. Dirty-source decision using resolveSaveDiscardCancelDecision().
  //    - clean source: no confirmation needed, proceed directly.
  //    - save:       await saveSmart(); continue only if result.ok === true.
  //    - discard:    continue without saving the current source edits.
  //    - cancel:     change nothing; do NOT open the Report.
  if (dirty) {
    const decision = resolveSaveDiscardCancelDecision();

    if (decision.action === 'cancel') {
      log?.('Report: activation canceled by user');
      showToast?.('Report generation canceled', 'warn', 2000);
      return { ok: false, reason: 'canceled', error: 'Report generation canceled by user' };
    }

    if (decision.action === 'save') {
      log?.('Report: saving current source before activation');
      const saveResult = await saveSmart();
      if (!saveResult || saveResult.ok !== true) {
        log?.('Report: activation blocked — save did not succeed');
        showToast?.('Report generation canceled — current document was not saved', 'warn', 2600);
        return { ok: false, reason: 'save-failed', error: 'Current document was not saved' };
      }
      log?.('Report: current source saved OK; proceeding with activation');
    }

    // decision.action === 'discard': continue without saving.
  }

  // 2. Verify required editor/session APIs.
  if (!md || typeof md.value === 'undefined') {
    showToast?.('Report activation failed: editor unavailable', 'error', 3000);
    log?.('Report: activation failed — md element missing');
    return { ok: false, reason: 'editor-unavailable', error: 'Editor unavailable' };
  }

  // 3. Prepare Report identity (ACT G1: saved=false for virtual Reports).
  const reportIdentity = {
    kind: 'report',
    virtual: true,
    saved: false,
    sourcePath: null,
    suggestedFilename,
    generatedAt: new Date().toISOString(),
    reportRange: {
      startDate: preparedResult.dictionary?.range?.startDate || '',
      endDate: preparedResult.dictionary?.range?.endDate || '',
    },
  };

  try {
    // 4. Clear active workspace source identity.
    if (globalThis.WORKSPACE_STATE) {
      globalThis.WORKSPACE_STATE.activeFile = null;
    }

    // 5. Clear physical handle.
    currentSaveHandle = null;

    // 6. Clear Task baseline (Report documents are excluded from ACT D).
    __taskBaseline = null;

    // 7. Set virtual Report session identity.
    __virtualReportSession = reportIdentity;

    // 8. Replace editor content using the canonical setter.
    runProgrammaticTextChange(() => {
      md.value = markdown;
      if (typeof window.__cmSetText === 'function') {
        window.__cmSetText(markdown);
      }
    });

    // 9. Set Report filename.
    currentFileName = suggestedFilename;

    // 10. Mark dirty (Report is unsaved).
    dirty = true;

    // 11. Update UI and render.
    setStatus(modeLabel());
    updateDocumentTitle();
    render('openVirtualReport');

    // 12. Refresh workspace panels to reflect no active workspace file.
    globalThis.persistActiveWorkspaceFile?.();
    window.updateWorkspaceActiveFileHighlight?.();
    renderWorkspaceActivePanel?.();
    renderWorkspaceRelatedPanel?.();
    renderWorkspaceTasksPanel?.();

    // ACT H3: refresh the Report panel so the Draw.io enablement reflects the
    // now-active Report identity (virtual unsaved Report).
    try {
      globalThis.MME_REPORT_PANEL?.refresh?.();
    } catch (e) {
      log?.(`Report: H3 refresh after activation failed: ${e?.message || e}`);
    }

    log?.(`Report: opened virtual report filename=${suggestedFilename}`);

    return {
      ok: true,
      identity: reportIdentity,
      filename: suggestedFilename,
      virtual: true,
      saved: false,
    };
  } catch (e) {
    const msg = e?.message || String(e);
    log?.(`Report: activation failed: ${msg}`);

    // Defensive rollback: release the Report identity so a retry is possible.
    __virtualReportSession = null;
    currentSaveHandle = null;

    showToast?.('Report activation failed', 'error', 3500);
    return { ok: false, reason: 'activation-error', error: msg };
  }
}


globalThis.MME_APP = {
  isDirty: () => dirty,
  confirmDiscardIfDirty,
  openTextDocument,
  setWritableHandleForCurrentFile,
  showToast,
  log,
  // ACT B: Expose the programmatic text suppression helper for mode-session.js.
  runProgrammaticTextChange,

  // Runtime bridge for mode-session capture/restore.
  // Returns clone-safe fields only. saveHandle is a FileSystemHandle
  // and must NOT be placed in Host snapshots or localStorage.
  getCurrentDocumentRuntimeState() {
    return {
      dirty,
      fileName: currentFileName || '',
      saveHandle: currentSaveHandle || null,
      fileLastSeenModified,
      externalStale,
      externalStaleModified,
      hotReloadEnabled: Boolean(hotEnabledEl?.checked),
    };
  },

  applyCurrentDocumentRuntimeState(state) {
    if (!state || typeof state !== 'object') return;

    if (typeof state.fileName === 'string') {
      currentFileName = state.fileName || 'markmap.md';
    }

    if (typeof state.saveHandle !== 'undefined') {
      currentSaveHandle = state.saveHandle || null;
    }

    if (typeof state.fileLastSeenModified === 'number') {
      fileLastSeenModified = state.fileLastSeenModified;
    }

    if (typeof state.externalStale === 'boolean') {
      externalStale = state.externalStale;
    }

    if (typeof state.externalStaleModified === 'number') {
      externalStaleModified = state.externalStaleModified;
    }

    if (typeof state.dirty === 'boolean') {
      dirty = state.dirty;
    }

    // Update status/title once.
    setStatus(modeLabel());
    updateDocumentTitle();
  },
};

async function resetServiceWorkerAndCaches() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        await reg.unregister();
      }
    }

    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        await caches.delete(key);
      }
    }

    showToast?.('Cache cleared. Reloading...', 'ok', 1600);
    log?.('PWA: service workers unregistered and caches cleared');

    setTimeout(() => {
      location.reload();
    }, 500);
  } catch (e) {
    showToast?.('Could not clear cache', 'error', 2600);
    log?.(`PWA: cache reset failed: ${e?.message || e}`);
  }
}

try {
  window.resetServiceWorkerAndCaches = resetServiceWorkerAndCaches;
  globalThis.resetServiceWorkerAndCaches = resetServiceWorkerAndCaches;
} catch {}

wireLogsPanelControls();

// ================================
// Concept helpers (Stage 7.5F)
// ================================
function normalizeConceptFileName(input) {
  let name = String(input || '').trim();

  if (!name) return '';

  name = name
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  if (!name.toLowerCase().endsWith('.md')) {
    name += '.md';
  }

  return name;
}

function createConceptStarterMarkdown(fileName) {
  const title = String(fileName || 'New Concept')
    .replace(/\.md$/i, '')
    .trim();

  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dateString = `${yyyy}-${mm}-${dd}`;

  const today = new Date().toISOString().slice(0, 10);

  return `
---
type: concept
created: ${dateString}
updated:
status: active
tags: []
---


# ${title}

Tags:

## Summary
-

## Notes
-

## Related Concepts
-

## Tasks
- [ ]

## Sources
-
`;
}
// This will be inserted after line 2917 (after the closing brace of createConceptStarterMarkdown)

// ================================
// PART B — Journal display helpers
// ================================

function getParsedJournalForFile(file) {
  if (!file?.path || !WORKSPACE_INDEX_STATE?.ready) {
    return null;
  }

  return WORKSPACE_INDEX_STATE.byPath?.get(file.path) || null;
}

function getJournalDisplayTitle(file) {
  const parsed = getParsedJournalForFile(file);

  if (parsed?.title) {
    return parsed.title;
  }

  return file?.name || file?.path || 'Untitled journal';
}

function getJournalDisplayDate(file) {
  const parsed = getParsedJournalForFile(file);

  if (parsed?.date) {
    return parsed.date;
  }

  const match = String(file?.name || file?.path || '').match(/\d{4}-\d{2}-\d{2}/);

  return match ? match[0] : '';
}

// ================================
// PART C — Journal Timeline Renderer
// ================================

function getJournalMonthGroupLabel(dateIso) {
  const value = String(dateIso || '').trim();

  const match = value.match(/^(\d{4})-(\d{2})-\d{2}$/);

  if (!match) return 'Undated';

  const year = match[1];
  const month = Number(match[2]);

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  return `${monthNames[month - 1] || 'Unknown'} ${year}`;
}

function renderWorkspaceJournalTimeline() {
  const container = document.getElementById('workspaceJournalsList');

  if (!container) {
    log?.('Workspace Journals: timeline render skipped; container missing');
    return;
  }

  const workspaceState = globalThis.WORKSPACE_STATE || window.WORKSPACE_STATE || null;

  if (!workspaceState) {
    return;
  }

  const journals = workspaceState?.files?.journals || [];

  if (!journals.length) {
    container.innerHTML = '<div class="workspaceEmpty">No journals</div>';
    return;
  }

  const sorted = [...journals].sort((a, b) => {
    const dateA = getJournalDisplayDate(a);
    const dateB = getJournalDisplayDate(b);

    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }

    return String(b.name || '').localeCompare(String(a.name || ''));
  });

  const recent = sorted.slice(0, 3);

  function renderJournalButton(file) {
    const title = escapeHtml(getJournalDisplayTitle(file));
    const date = escapeHtml(getJournalDisplayDate(file));
    const path = escapeHtml(file.path || '');
    const name = escapeHtml(file.name || '');
    const kind = 'journals';

    return `
      <button
        type="button"
        class="workspaceFileItem workspaceJournalItem"
        data-workspace-file="1"
        data-kind="${kind}"
        data-path="${path}"
        data-name="${name}"
        title="${path}"
      >
        <span class="workspaceJournalIcon" aria-hidden="true">📝</span>
        <span class="workspaceJournalBody">
          <span class="workspaceJournalTitle">${title}</span>
          <span class="workspaceJournalDate">${date || path}</span>
        </span>
      </button>
    `;
  }

  const monthGroups = new Map();

  for (const file of sorted) {
    const date = getJournalDisplayDate(file);
    const groupLabel = getJournalMonthGroupLabel(date);

    if (!monthGroups.has(groupLabel)) {
      monthGroups.set(groupLabel, []);
    }

    monthGroups.get(groupLabel).push(file);
  }

  const monthGroupsHtml = Array.from(monthGroups.entries())
    .map(([label, files]) => {
      return `
        <div class="workspaceJournalGroup">
          <div class="workspaceJournalGroupTitle">${escapeHtml(label)}</div>
          ${files.map(renderJournalButton).join('')}
        </div>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="workspaceJournalTimeline">
      <div class="workspaceJournalGroup">
        <div class="workspaceJournalGroupTitle">Recent</div>
        ${recent.map(renderJournalButton).join('')}
      </div>

      ${monthGroupsHtml}
    </div>
  `;

  window.updateWorkspaceActiveFileHighlight?.();
  log?.(
    `Workspace Journals: timeline rendered journals=${sorted.length} groups=${monthGroups.size} indexReady=${WORKSPACE_INDEX_STATE?.ready}`
  );
}

// ================================
// PART E — Export helper
// ================================

try {
  window.renderWorkspaceJournalTimeline = renderWorkspaceJournalTimeline;
  globalThis.renderWorkspaceJournalTimeline = renderWorkspaceJournalTimeline;
} catch {}

function updateWorkspaceJournalSidebarTitlesFromIndex() {
  try {
    if (!WORKSPACE_INDEX_STATE?.ready) return;

    document
      .querySelectorAll('.workspaceFileItem[data-workspace-file="1"][data-kind="journals"]')
      .forEach((btn) => {
        const path = btn.dataset.path || '';
        const nameEl = btn.querySelector('.workspaceFileName');

        if (!path || !nameEl) return;

        const parsed = WORKSPACE_INDEX_STATE.byPath?.get(path);
        if (!parsed) return;

        const title = String(parsed.title || '').trim();
        const fallback = String(btn.dataset.name || '').trim();
        const display = title || fallback;

        nameEl.textContent = display;
        btn.title = `${path}${title ? ` — ${title}` : ''}`;
        btn.dataset.displayTitle = display;
      });
  } catch (e) {
    log?.(`Workspace: journal sidebar title update failed: ${e?.message || e}`);
  }
}

try {
  window.updateWorkspaceJournalSidebarTitlesFromIndex =
    updateWorkspaceJournalSidebarTitlesFromIndex;
  globalThis.updateWorkspaceJournalSidebarTitlesFromIndex =
    updateWorkspaceJournalSidebarTitlesFromIndex;
} catch {}

function updateWorkspaceJournalSidebarTitlesFromIndexSafe() {
  try {
    updateWorkspaceJournalSidebarTitlesFromIndex();
  } catch {}
}

async function createNewConcept() {
  if (!WORKSPACE_STATE.rootHandle || !WORKSPACE_STATE.folders?.concepts) {
    showToast?.('Open a workspace first', 'error', 2600);
    log?.('Workspace: New Concept blocked because workspace is not ready');
    return;
  }

  // ACT G2B: Before New Concept replaces editor content, run the Report leave
  // decision. Cancel creates/opens nothing. Save or Discard proceeds once.
  if (typeof globalThis.guardUnsavedReportBeforeDocumentSwitch === 'function') {
    const guard = await globalThis.guardUnsavedReportBeforeDocumentSwitch();
    if (!guard || guard.ok !== true) {
      log?.('Workspace: New Concept blocked by Report guard');
      return;
    }
  } else if (typeof confirmDiscardIfDirty === 'function') {
    if (!confirmDiscardIfDirty()) {
      log?.('Workspace: New Concept cancelled by dirty document prompt');
      return;
    }
  }

  const rawName = prompt('Concept name?');

  if (rawName === null) {
    log?.('Workspace: New Concept cancelled');
    return;
  }

  const fileName = normalizeConceptFileName(rawName);

  if (!fileName) {
    showToast?.('Concept name is required', 'error', 2600);
    return;
  }

  const conceptHandle = await WORKSPACE_STATE.folders.concepts.getFileHandle(fileName, {
    create: true,
  });

  const existingFile = await conceptHandle.getFile();
  let text = await existingFile.text();

  const wasEmpty = !text.trim();

  if (wasEmpty) {
    text = createConceptStarterMarkdown(fileName);

    const writable = await conceptHandle.createWritable();
    await writable.write(text);
    await writable.close();
  }

  WORKSPACE_STATE.activeFile = {
    kind: 'concepts',
    name: fileName,
    path: `concepts/${fileName}`,
    handle: conceptHandle,
  };

  persistActiveWorkspaceFile?.();

  openTextDocument({
    text,
    fileName,
    fileHandle: conceptHandle,
    reason: 'workspace new concept',
  });

  // ACT G2B: Clear Report identity at the safe target-activation boundary.
  globalThis.clearReportIdentityAfterTransition?.();

  if (typeof globalThis.refreshWorkspaceSidebar === 'function') {
    await globalThis.refreshWorkspaceSidebar();
  }

  window.updateWorkspaceActiveFileHighlight?.();
  renderWorkspaceActivePanel?.();
  renderWorkspaceTasksPanel?.();
  renderWorkspaceRelatedPanel?.();

  showToast?.(wasEmpty ? `Created ${fileName}` : `Opened ${fileName}`, 'ok', 1800);

  log?.(
    wasEmpty
      ? `Workspace: created concept ${fileName}`
      : `Workspace: opened existing concept ${fileName}`
  );
}

window.addEventListener('error', (e) => {
  const msg = e?.message || 'Script error.';
  const src = e?.filename || '';
  const line = e?.lineno || 0;
  const col = e?.colno || 0;
  if (msg === 'Script error.' && !src && line === 0 && col === 0) {
    log('⚠️ Cross-origin script error masked by browser (Script error. @ :0:0) — ignored');
    return;
  }
  log(`❌ window.error: ${msg} @ ${src || '(unknown)'}:${line}:${col}`);
});

window.addEventListener('unhandledrejection', (e) =>
  log(`❌ unhandledrejection: ${e.reason?.message || e.reason}`)
);

log(`Release 40: main.js started ✅`);
log(`Env: href=${location.href}`);
log(`Env: protocol=${location.protocol}`);
log(`Env: isSecureContext=${window.isSecureContext}`);
log(
  `Env: topLevel=${(() => {
    try {
      return window.self === window.top;
    } catch {
      return false;
    }
  })()}`
);
log(`Env: showOpenFilePicker=${'showOpenFilePicker' in window}`);
log(`Env: showSaveFilePicker=${'showSaveFilePicker' in window}`);

// Workspace active-file highlight helpers moved to ./js/workspace/workspace-highlight.js (R5B.1)
// main.js intentionally does not define normalizeWorkspacePathForCompare / isSameWorkspaceFileButton /
// updateWorkspaceActiveFileHighlight anymore.

try {
  if (typeof WORKSPACE_STATE !== 'undefined') globalThis.WORKSPACE_STATE = WORKSPACE_STATE;
} catch {}

log?.(
  `Workspace: active highlight function ready = ${
    typeof window.updateWorkspaceActiveFileHighlight === 'function'
  }`
);

// ================================
// Toast helper (Saved / Downloaded / Error)
// ================================
let toastTimer = null;

function showToast(message, type = 'ok', ms = 2200) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.classList.remove('ok', 'download', 'error', 'show');
  el.classList.add(type);
  el.textContent = message;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
  }, ms);
}

// ================================
// Template Modal Editor (multiline)
// ================================
function tplEditModalOpen({ title = 'Edit template', initial = '', onSave }) {
  const modal = document.getElementById('tplModal');
  const titleEl = document.getElementById('tplModalTitle');
  const textEl = document.getElementById('tplModalText');
  const btnSave = document.getElementById('tplModalSave');
  const btnCancel = document.getElementById('tplModalCancel');

  if (!modal || !titleEl || !textEl || !btnSave || !btnCancel) {
    showToast('Template editor UI missing', 'error', 3000);
    return;
  }

  titleEl.textContent = title;
  textEl.value = String(initial ?? '');

  function close() {
    modal.style.display = 'none';
    btnSave.onclick = null;
    btnCancel.onclick = null;
    modal.onclick = null;
    document.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
    // Ctrl/Cmd+Enter to save
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      trySave();
    }
  }

  function trySave() {
    const val = textEl.value;
    if (typeof onSave === 'function') onSave(val);
    close();
  }

  btnCancel.onclick = close;
  btnSave.onclick = trySave;

  // Click outside panel closes
  modal.onclick = (e) => {
    if (e.target === modal) close();
  };

  document.addEventListener('keydown', onKey);
  modal.style.display = 'block';
  setTimeout(() => textEl.focus(), 0);
}

// ================================
// Recent files (menu + IndexedDB handles)
// ================================
const RECENTS_DB = 'markmap-recents-db';
const RECENTS_STORE = 'recents';
const RECENTS_KEY = 'recentFiles:v1';
const RECENTS_MAX = 10;

function idbOpenRecents() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(RECENTS_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(RECENTS_STORE)) db.createObjectStore(RECENTS_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetRecents(key) {
  try {
    const db = await idbOpenRecents();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(RECENTS_STORE, 'readonly');
      const store = tx.objectStore(RECENTS_STORE);
      const r = store.get(key);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return null;
  }
}

async function idbSetRecents(key, value) {
  try {
    const db = await idbOpenRecents();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(RECENTS_STORE, 'readwrite');
      const store = tx.objectStore(RECENTS_STORE);
      const r = store.put(value, key);
      r.onsuccess = () => resolve(true);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return false;
  }
}

async function loadRecentFiles() {
  return (await idbGetRecents(RECENTS_KEY)) || [];
}

async function saveRecentFiles(list) {
  return await idbSetRecents(RECENTS_KEY, list);
}

async function addRecentFile(handle, name) {
  if (!handle) return;
  try {
    name = sanitizeRecentName(name);
    const list = await loadRecentFiles();
    const now = Date.now();
    const filtered = list.filter((x) => x && x.name !== name);
    filtered.unshift({ name, handle, ts: now });
    await saveRecentFiles(filtered.slice(0, RECENTS_MAX));
  } catch (e) {
    log(`⚠️ Recents: failed to store handle (${e?.message || e})`);
  }
}

async function ensureReadPermission(handle) {
  try {
    if (!handle?.queryPermission || !handle?.requestPermission) return true;
    const q = await handle.queryPermission({ mode: 'read' });
    if (q === 'granted') return true;
    if (q === 'prompt') {
      const r = await handle.requestPermission({ mode: 'read' });
      return r === 'granted';
    }
    return false;
  } catch {
    return false;
  }
}

const recentMenu = document.getElementById('recentMenu');

function hideRecentMenu() {
  if (recentMenu) recentMenu.style.display = 'none';
}

function positionRecentMenu() {
  try {
    const btn = document.getElementById('btnOpen');
    if (!btn || !recentMenu) return;
    const r = btn.getBoundingClientRect();
    const top = r.bottom + 6;
    const left = Math.max(8, Math.min(window.innerWidth - 300, r.left));
    recentMenu.style.top = top + 'px';
    recentMenu.style.left = left + 'px';
  } catch {}
}

try {
  window.renderWorkspaceTagsPanel = renderWorkspaceTagsPanel;
  window.wireWorkspaceTagsPanel = wireWorkspaceTagsPanel;
  window.ensureWorkspaceTagsPanel = ensureWorkspaceTagsPanel;

  globalThis.renderWorkspaceTagsPanel = renderWorkspaceTagsPanel;
  globalThis.wireWorkspaceTagsPanel = wireWorkspaceTagsPanel;
  globalThis.ensureWorkspaceTagsPanel = ensureWorkspaceTagsPanel;
} catch {}

try {
  window.renderWorkspaceActivePanel = renderWorkspaceActivePanel;
  window.ensureWorkspaceActivePanel = ensureWorkspaceActivePanel;
  window.wireWorkspaceActivePanel = wireWorkspaceActivePanel;

  globalThis.renderWorkspaceActivePanel = renderWorkspaceActivePanel;
  globalThis.ensureWorkspaceActivePanel = ensureWorkspaceActivePanel;
  globalThis.wireWorkspaceActivePanel = wireWorkspaceActivePanel;
} catch {}

async function openFromRecent(item) {
  if (!item?.handle) throw new Error('Recent item has no handle');

  const ok = await ensureReadPermission(item.handle);
  if (!ok) throw new Error('Permission denied to read recent file');

  const f = await item.handle.getFile();
  fileLastSeenModified = f.lastModified || Date.now();

  externalStale = false;
  externalStaleModified = 0;

  const text = await f.text();

  currentSaveHandle = item.handle;
  hotStart('openRecent');

  currentFileName = f.name || item.name || 'markmap.md';

  md.value = text;
  if (window.__cmSetText) window.__cmSetText(md.value);

  dirty = false;
  setStatus(modeLabel());
  updateDocumentTitle();

  // ✅ RESTAURA DRAFT SE EXISTIR
  const restored = maybeRestoreDraftAfterOpen('openRecent');
  if (!restored) {
    hasAutoFitted = false;
    render('openRecent(writable) render()');
    showToast(`Opened ✓ ${currentFileName}`, 'ok');
  }

  // ACT G / T1B: capture the post-open Task baseline so the next physical Save
  // can reconcile checkbox changes. Report documents are excluded internally.
  captureTaskBaseline();
}

function sanitizeRecentName(name) {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeMenuItem(text, onClick, { danger = false, icon = '' } = {}) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'menuItem' + (danger ? ' danger' : '');
  const ic = document.createElement('span');
  ic.className = 'menuIcon';
  ic.textContent = icon;
  const tx = document.createElement('span');
  tx.className = 'menuText';
  tx.textContent = text;
  el.appendChild(ic);
  el.appendChild(tx);
  el.onclick = onClick;
  return el;
}

function makeMenuHeader(text) {
  const el = document.createElement('div');
  el.className = 'menuHeader';
  el.textContent = text;
  return el;
}

function makeMenuSep() {
  const el = document.createElement('div');
  el.className = 'menuSep';
  return el;
}

// ================================
// Headers Menu (H ▾)
// ================================
const btnHeaders = document.getElementById('qiHeaders');
const headersMenu = document.getElementById('headersMenu');

function showHeadersMenu() {
  if (!btnHeaders || !headersMenu) return;

  const r = btnHeaders.getBoundingClientRect();
  headersMenu.style.top = r.bottom + 6 + 'px';
  headersMenu.style.left = Math.max(8, r.left) + 'px';
  headersMenu.innerHTML = '';

  headersMenu.appendChild(makeMenuHeader('Headers'));
  headersMenu.appendChild(makeMenuItem('H1  Title', () => __qiToggleHeading(1)));
  headersMenu.appendChild(makeMenuItem('H2  Section', () => __qiToggleHeading(2)));
  headersMenu.appendChild(makeMenuItem('H3  Subsection 1', () => __qiToggleHeading(3)));
  headersMenu.appendChild(makeMenuItem('H4  Subsection 2', () => __qiToggleHeading(4)));
  headersMenu.appendChild(makeMenuItem('H5  Subsection 3', () => __qiToggleHeading(5)));
  headersMenu.appendChild(makeMenuSep());
  headersMenu.appendChild(makeMenuItem('Remove heading', () => __qiToggleHeading(0)));

  headersMenu.style.display = 'flex';
}

if (btnHeaders) {
  btnHeaders.addEventListener('click', () => {
    const open = headersMenu.style.display === 'flex';
    headersMenu.style.display = open ? 'none' : 'flex';
    if (!open) showHeadersMenu();
  });
}

document.addEventListener('mousedown', (e) => {
  if (!headersMenu || headersMenu.style.display !== 'flex') return;
  if (headersMenu.contains(e.target)) return;
  if (btnHeaders.contains(e.target)) return;
  headersMenu.style.display = 'none';
});

// ================================
// Add Image (Online / Local) — inserts Markdown link into the EDITOR
// ================================
const __btnAddImage = document.getElementById('btnAddImage');
const __imageMenu = document.getElementById('imageMenu');
const __imageFileInput = document.getElementById('imageFile');

function __addImageLog(msg) {
  try {
    log(msg);
  } catch {}
}

function __hideImageMenu() {
  if (__imageMenu) __imageMenu.style.display = 'none';
}

function __positionImageMenu() {
  try {
    if (!__btnAddImage || !__imageMenu) return;
    const r = __btnAddImage.getBoundingClientRect();
    const top = r.bottom + 6;
    const left = Math.max(8, Math.min(window.innerWidth - 320, r.left));
    __imageMenu.style.top = top + 'px';
    __imageMenu.style.left = left + 'px';
  } catch {}
}

function __filenameToAlt(name) {
  const base = String(name || 'image')
    .split(/[/\\]/)
    .pop();
  const dot = base.lastIndexOf('.');
  const noExt = dot > 0 ? base.slice(0, dot) : base;
  return noExt.replace(/[-_]+/g, ' ').trim() || 'image';
}

function __buildImgMd(alt, url) {
  const a = String(alt || '').trim() || 'image';
  const u = String(url || '').trim();
  if (!u) return '';
  return `![${a}](${u})`;
}

function __isDirectImageUrl(url) {
  try {
    const u = String(url || '').trim();
    if (!u) return false;
    if (/^data:image\//i.test(u)) return true;
    if (!/^https?:\/\//i.test(u)) return false;
    const parsed = new URL(u);
    const path = (parsed.pathname || '').toLowerCase();
    return /\.(png|jpe?g|gif|webp|svg|avif)$/.test(path);
  } catch {
    return false;
  }
}

// ================================
// Export Menu
// ================================
const btnExportMenu = document.getElementById('btnExportMenu');
const exportMenu = document.getElementById('exportMenu');

function hideExportMenu() {
  if (exportMenu) exportMenu.style.display = 'none';
}

function positionExportMenu() {
  try {
    if (!btnExportMenu || !exportMenu) return;

    const r = btnExportMenu.getBoundingClientRect();
    const top = r.bottom + 6;
    const left = Math.max(8, Math.min(window.innerWidth - 340, r.left));

    exportMenu.style.top = top + 'px';
    exportMenu.style.left = left + 'px';
  } catch {}
}

function isSlidesContext() {
  try {
    const ctxId =
      getSelectedAppContextId?.() ||
      document.documentElement.dataset.appContext ||
      localStorage.getItem('markmap:appContext') ||
      'editor';

    return ctxId === 'slides';
  } catch {
    return false;
  }
}

function showExportMenu() {
  try {
    if (!exportMenu) return;

    positionExportMenu();
    exportMenu.innerHTML = '';

    exportMenu.appendChild(makeMenuHeader('Export'));

    exportMenu.appendChild(
      makeMenuItem(
        'Mindmap SVG (.svg)',
        () => {
          hideExportMenu();
          exportMindmapSvg();
        },
        { icon: '🖼️' }
      )
    );

    exportMenu.appendChild(
      makeMenuItem(
        'HTML Preview (.html)',
        () => {
          hideExportMenu();
          exportHtmlPreview();
        },
        { icon: '🌐' }
      )
    );

    exportMenu.appendChild(makeMenuSep());

    if (isSlidesContext()) {
      exportMenu.appendChild(
        makeMenuItem(
          'Export Slides Markdown (.md)',
          () => {
            hideExportMenu();
            exportMarkdownDownload();
          },
          { icon: '📊' }
        )
      );

      exportMenu.appendChild(makeMenuSep());
    }

    exportMenu.appendChild(makeMenuHeader('SVG is static. HTML Preview is standalone.'));

    exportMenu.style.display = 'flex';
  } catch (e) {
    const msg = e?.message || String(e);
    try {
      log('❌ showExportMenu failed: ' + msg);
    } catch {}
    showToast('Export menu error: ' + msg, 'error', 3200);
  }
}

if (btnExportMenu && !btnExportMenu.__bound) {
  btnExportMenu.addEventListener('click', () => {
    const open = exportMenu && exportMenu.style.display === 'flex';

    if (open) {
      hideExportMenu();
    } else {
      showExportMenu();
    }
  });

  btnExportMenu.__bound = true;
}

document.addEventListener('mousedown', (e) => {
  if (!exportMenu || exportMenu.style.display !== 'flex') return;

  if (exportMenu.contains(e.target)) return;

  if (btnExportMenu && (e.target === btnExportMenu || btnExportMenu.contains(e.target))) {
    return;
  }

  hideExportMenu();
});

window.addEventListener('resize', () => {
  if (exportMenu && exportMenu.style.display === 'flex') {
    positionExportMenu();
  }
});

try {
  if (btnExportMenu) log('Export menu: wired');
} catch {}

// ================================
// Templates (Org + My) — TEAM MODE v1
// - Org templates: read-only (shipped in this HTML)
// - My templates: user-managed (localStorage)
// - Duplicate Org → My: recommended governance
// - My templates survive app updates automatically (stable storage key)
// ================================
async function showRecentMenu() {
  if (!recentMenu) return;
  positionRecentMenu();
  const list = await loadRecentFiles();
  recentMenu.innerHTML = '';
  recentMenu.appendChild(
    makeMenuItem(
      'New document…',
      () => {
        hideRecentMenu();
        newDocument();
      },
      { icon: '🆕' }
    )
  );
  recentMenu.appendChild(makeMenuSep());
  recentMenu.appendChild(
    makeMenuItem(
      'Browse…',
      () => {
        hideRecentMenu();
        openSmart();
      },
      { icon: '📂' }
    )
  );
  recentMenu.appendChild(
    makeMenuItem(
      'Clear draft for current file',
      () => {
        hideRecentMenu();
        clearCurrentDraftAction();
      },
      { icon: '🧹' }
    )
  );
  recentMenu.appendChild(makeMenuSep());
  recentMenu.appendChild(makeMenuHeader(list.length ? 'Recent files' : 'No recent files yet'));
  const listWrap = document.createElement('div');
  listWrap.className = 'menuList';
  for (const item of list) {
    const displayName = sanitizeRecentName(item.name);
    listWrap.appendChild(
      makeMenuItem(
        displayName,
        async () => {
          hideRecentMenu();
          try {
            await openFromRecent(item);
          } catch (err) {
            const msg = err?.message || String(err);
            setStatus(`Open error: ${msg}`);
            showToast(`Open error: ${msg}`, 'error', 3500);
            log(`❌ openFromRecent failed: ${msg}`);
          }
        },
        { icon: '📄' }
      )
    );
  }
  recentMenu.appendChild(listWrap);
  if (list.length) {
    recentMenu.appendChild(makeMenuSep());
    recentMenu.appendChild(
      makeMenuItem(
        'Clear recent files',
        async () => {
          await saveRecentFiles([]);
          hideRecentMenu();
          showToast('Recent files cleared', 'ok');
        },
        { danger: true, icon: '🧹' }
      )
    );
  }
  recentMenu.style.display = 'block';
}

document.addEventListener('mousedown', (e) => {
  if (!recentMenu || recentMenu.style.display !== 'block') return;
  const openBtn = document.getElementById('btnOpen');
  if (recentMenu.contains(e.target)) return;
  if (openBtn && (e.target === openBtn || openBtn.contains(e.target))) return;
  hideRecentMenu();
});

window.addEventListener('resize', () => {
  if (recentMenu && recentMenu.style.display === 'block') positionRecentMenu();
});

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.copy-btn');
  if (!btn) return;

  const block = btn.closest('.code-block');
  const codeEl = block?.querySelector('pre code');
  const code = codeEl?.innerText || '';

  try {
    await navigator.clipboard.writeText(code);
    btn.textContent = 'Copied!';
    setTimeout(() => (btn.textContent = 'Copy'), 1200);
  } catch {
    btn.textContent = 'Failed';
    setTimeout(() => (btn.textContent = 'Copy'), 1200);
  }
});

document.addEventListener('click', async (e) => {
  const code = e.target.closest('#htmlPane :not(pre) > code');
  if (!code) return;

  try {
    await navigator.clipboard.writeText(code.innerText || '');
    showToast('Inline code copied ✓', 'ok', 1200);
  } catch {
    showToast('Copy failed', 'error', 1200);
  }
});

// Elements + state
const md = document.getElementById('md');
const mapSvg = document.getElementById('mapSvg');
const htmlPane = document.getElementById('htmlPane');
const fileInput = document.getElementById('file');
const editorEl = document.getElementById('editor');
const splitEditorEl = document.getElementById('splitEditor');

let dirty = false;
let currentFileName = 'markmap.md';

let currentSaveHandle = null;

let fileLastSeenModified = 0;
let externalStale = false;
let externalStaleModified = 0;
let hasAutoFitted = false;
let forceFitNextRender = false;

// ================================
// AUTO‑SAVE (draft in localStorage) — Feature #2
// ================================
const AUTO_SAVE_INTERVAL_MS = 30000; // 30 seconds
let autoSaveTimer = null;

// R-MULTI4: draft key helpers — session-aware with legacy fallback.
function draftKey(filename) {
  return `markmap-draft:${filename}`;
}

function getSessionDraftKey(filename) {
  const fileId = String(filename || '').trim();
  if (!fileId) return '';
  try {
    const key = globalThis.getModeSessionStorageKey?.(undefined, undefined, 'draft:' + fileId);
    return key || draftKey(filename);
  } catch {
    return draftKey(filename);
  }
}

function saveDraft() {
  if (!globalThis.MME_WORKSPACE_CAPABILITIES?.canActive?.('draft')) return;
  if (globalThis.__creatingNewDocument) return;
  if (!dirty) return;
  try {
    const data = {
      text: md.value,
      time: Date.now(),
    };
    const newKey = getSessionDraftKey(currentFileName);
    if (newKey) {
      localStorage.setItem(newKey, JSON.stringify(data));
    }
    log('Auto‑save: draft saved');
  } catch (e) {
    /* quota exceeded, ignore */
  }
}

function clearDraft(filename) {
  try {
    const newKey = getSessionDraftKey(filename);
    if (newKey) {
      localStorage.removeItem(newKey);
    }
    log(`Auto‑save: draft cleared for ${filename}`);
  } catch {}
}

function checkAndRestoreDraft(filename) {
  try {
    // 1. Try the new session-aware key first.
    let raw = null;
    const newKey = getSessionDraftKey(filename);
    if (newKey) {
      raw = localStorage.getItem(newKey);
    }

    // 2. Fall back to the legacy key.
    if (!raw) {
      raw = localStorage.getItem(draftKey(filename));
    }

    if (globalThis.__creatingNewDocument) return false;
    if (!raw) return false;
    const draft = JSON.parse(raw);
    if (!draft || !draft.text) return false;
    const timeStr = new Date(draft.time).toLocaleString();
    const ok = confirm(
      `Unsaved draft found for "${filename}" from ${timeStr}.\n\n` + `Do you want to restore it?`
    );
    if (ok) {
      md.value = draft.text;
      if (window.__cmSetText) window.__cmSetText(draft.text);
      dirty = true;
      setStatus(modeLabel() + ' (draft restored)');
      updateDocumentTitle();
      showToast(`Draft restored ✓ ${filename}`, 'ok', 2800);
      log(`Auto‑save: draft restored for ${filename}`);
      return true;
    } else {
      clearDraft(filename); // user rejected, remove the draft
      return false;
    }
  } catch {
    return false;
  }
}

function maybeRestoreDraftAfterOpen(sourceLabel) {
  const restored = checkAndRestoreDraft(currentFileName);
  if (restored) {
    render(`${sourceLabel} (draft restored) render()`);
    return true;
  }
  return false;
}

function startAutoSave() {
  if (autoSaveTimer) clearInterval(autoSaveTimer);
  autoSaveTimer = setInterval(saveDraft, AUTO_SAVE_INTERVAL_MS);
  log('Auto‑save: timer started');
}

// Auto-save timer runs continuously; successful save/download clears drafts elsewhere.

// ================================
// HOTRELOAD_V3 — Hot Reload (external file change detection)
// ================================
const hotEnabledEl = document.getElementById('hotEnabled');
const hotStatusEl = document.getElementById('hotStatus');
let hotTimer = null;
let hotWarnedModified = 0;

function hotSetStatus(msg) {
  if (!hotStatusEl) return;
  hotStatusEl.textContent = msg || '';
}

function hotStop(reason) {
  if (hotTimer) {
    clearInterval(hotTimer);
    hotTimer = null;
  }
  hotWarnedModified = 0;
  hotSetStatus('');
  try {
    log('HotReload: stopped (' + reason + ')');
  } catch {}
}

async function hotPrime(handle) {
  try {
    const f = await handle.getFile();
    fileLastSeenModified = f.lastModified || Date.now();
    hotWarnedModified = 0;
    hotSetStatus('Hot ✓ ' + new Date(fileLastSeenModified).toLocaleString());
  } catch (e) {
    try {
      log('HotReload: prime failed: ' + (e && e.message ? e.message : e));
    } catch {}
  }
}

async function hotApplyReload(fileObj, reason) {
  try {
    const prevView = getCurrentViewState();
    const txt = await fileObj.text();
    md.value = txt;
    if (typeof window.__cmSetText === 'function') window.__cmSetText(txt);
    dirty = false;
    externalStale = false;
    externalStaleModified = 0;
    setStatus(modeLabel());
    updateDocumentTitle();
    render(reason + ' render()');
    restoreViewStateTwice(prevView, reason + ' view');
    showToast('Reloaded ✓ ' + currentFileName, 'ok');
    log('HotReload: reloaded (' + reason + ')');
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    log('❌ HotReload reload failed: ' + msg);
    showToast('Hot reload error: ' + msg, 'error', 3500);
  }
}

function hotStart(reason) {
  try {
    if (!hotEnabledEl || !hotEnabledEl.checked) {
      hotStop('disabled');
      return;
    }
    if (!currentSaveHandle) {
      hotStop('no handle');
      return;
    }

    if (hotTimer) {
      clearInterval(hotTimer);
      hotTimer = null;
    }

    hotPrime(currentSaveHandle).then(() => {
      hotTimer = setInterval(async () => {
        try {
          if (!hotEnabledEl.checked) {
            hotStop('disabled');
            return;
          }
          if (!currentSaveHandle) {
            hotStop('no handle');
            return;
          }

          const f = await currentSaveHandle.getFile();
          const lm = f.lastModified || 0;
          if (!lm) return;
          if (lm === fileLastSeenModified) return;
          if (hotWarnedModified === lm) return;

          log('HotReload: external change detected (' + fileLastSeenModified + ' -> ' + lm + ')');

          if (!dirty) {
            fileLastSeenModified = lm;
            hotWarnedModified = 0;
            await hotApplyReload(f, 'hotReload(auto)');
            hotSetStatus('Hot ✓ ' + new Date(fileLastSeenModified).toLocaleString());
            return;
          }

          hotWarnedModified = lm;
          hotSetStatus('Hot ⚠ External change detected');
          const ok = confirm(
            'O arquivo "' +
              currentFileName +
              '" foi alterado externamente.\n\nRecarregar agora e perder as alterações não salvas desta aba?'
          );
          if (ok) {
            fileLastSeenModified = lm;
            hotWarnedModified = 0;
            await hotApplyReload(f, 'hotReload(confirm)');
            hotSetStatus('Hot ✓ ' + new Date(fileLastSeenModified).toLocaleString());
          } else {
            externalStale = true;
            externalStaleModified = lm;
            hotSetStatus('Hot ⚠ OUT OF DATE');
            setStatus(modeLabel());
            updateDocumentTitle();
            showToast('External change detected — you are out of date', 'error', 3200);
            log('HotReload: user declined reload -> externalStale=true');
          }
        } catch (e) {
          const msg = e && e.message ? e.message : String(e);
          log('HotReload: stopped due to error: ' + msg);
          hotStop('error');
        }
      }, 1500);

      log('HotReload: started (' + reason + ')');
    });
  } catch (e) {
    try {
      log('HotReload: start failed: ' + (e && e.message ? e.message : e));
    } catch {}
  }
}

async function hotAfterSave() {
  try {
    if (!currentSaveHandle) return;
    const f = await currentSaveHandle.getFile();
    fileLastSeenModified = f.lastModified || Date.now();
    hotWarnedModified = 0;
    externalStale = false;
    externalStaleModified = 0;
    if (hotEnabledEl && hotEnabledEl.checked)
      hotSetStatus('Hot ✓ ' + new Date(fileLastSeenModified).toLocaleString());
    setStatus(modeLabel());
    updateDocumentTitle();
  } catch {}
}

if (hotEnabledEl && !hotEnabledEl.__bound) {
  hotEnabledEl.addEventListener('change', () => {
    if (!hotEnabledEl.checked) {
      hotStop('toggle off');
      return;
    }
    if (currentSaveHandle) hotStart('toggle on');
  });
  hotEnabledEl.__bound = true;
}

function modeLabel() {
  const base = currentSaveHandle
    ? `Writable ✓ ${currentFileName}`
    : `Read-only ✓ ${currentFileName}`;
  return externalStale ? base + ' — ⚠ external change (not reloaded)' : base;
}

function updateDocumentTitle() {
  const name = (currentFileName || 'markmap.md').trim();
  const dirtyMark = dirty ? ' *' : '';
  const staleMark = externalStale ? ' !' : '';
  document.title = `MME - ${name}${dirtyMark}${staleMark}`;
}

// ================================
// Mindmap engine (persistent instance)
// ================================
let transformer = null;
let mm = null;
const loadedCss = new Set();
const loadedJs = new Set();

function getMarkmapSafeMarkdown(text) {
  return text
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (t.startsWith('layout:')) return false;
      if (t === '---') return false;
      return true;
    })
    .join('\n');
}

// ================================
// Markmap style/layout state
// ================================
const MAP_STYLE_STORAGE_KEY = 'markmap:style:v1';

const MAP_LAYOUT_PRESETS = {
  default: {
    label: 'Default',
    sub: 'Current app layout',
    maxWidth: 600, // fallback only; nodeLength now controls active maxWidth
    spacingHorizontal: 80,
    spacingVertical: 8,
    duration: 300,
  },
  compact: {
    label: 'Compact',
    sub: 'Denser map',
    maxWidth: 420, // fallback only
    spacingHorizontal: 55,
    spacingVertical: 4,
    duration: 200,
  },
  spacious: {
    label: 'Spacious',
    sub: 'Presentation-friendly',
    maxWidth: 760, // fallback only
    spacingHorizontal: 120,
    spacingVertical: 14,
    duration: 350,
  },
};

const NODE_LENGTH_PRESETS = {
  short: {
    label: 'Short',
    sub: 'Wrap long nodes earlier',
    maxWidth: 280,
  },
  medium: {
    label: 'Medium',
    sub: 'Balanced node length',
    maxWidth: 420,
  },
  long: {
    label: 'Long',
    sub: 'Keep more text in one line',
    maxWidth: 600,
  },
  free: {
    label: 'Free',
    sub: 'Very wide nodes',
    maxWidth: 900,
  },
};

const MAP_THEME_PRESETS = {
  default: {
    label: 'Default',
    sub: 'Original Markmap palette',
    swatches: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'],
    colors: null,
    colorFreezeLevel: 0,
    light: {
      mapBg: '',
      text: '',
      active: '#1976d2',
    },
    dark: {
      mapBg: '',
      text: '',
      active: '#4fc3f7',
    },
  },

  ocean: {
    label: 'Ocean',
    sub: 'Blue / cyan, calmer range',
    swatches: ['#0077b6', '#0096c7', '#00b4d8', '#48cae4'],
    colors: [
      '#0077b6',
      '#0096c7',
      '#00b4d8',
      '#48cae4',
      '#2a9d8f',
      '#168aad',
      '#1a759f',
      '#34a0a4',
    ],
    colorFreezeLevel: 2,
    vars: {
      mapBg: '#eef8fb',
      text: '#073b4c',
      active: '#0077b6',
    },
  },

  forest: {
    label: 'Forest',
    sub: 'Green / earth, stronger contrast',
    swatches: ['#2d6a4f', '#52b788', '#bc6c25', '#5a189a'],
    colors: [
      '#2d6a4f',
      '#52b788',
      '#40916c',
      '#386641',
      '#bc6c25',
      '#99582a',
      '#007f5f',
      '#5a189a',
    ],
    colorFreezeLevel: 2,
    vars: {
      mapBg: '#f3f8f1',
      text: '#143d2a',
      active: '#1b7f4c',
    },
  },

  sunset: {
    label: 'Sunset',
    sub: 'Warm orange / purple palette',
    swatches: ['#ff7043', '#ffb300', '#ab47bc', '#7e57c2'],
    colors: [
      '#ff7043',
      '#ffb300',
      '#ffa726',
      '#f06292',
      '#ab47bc',
      '#7e57c2',
      '#ec407a',
      '#fb8c00',
    ],
    colorFreezeLevel: 2,
    vars: {
      mapBg: '#fff3e0',
      text: '#4e342e',
      active: '#ff7043',
    },
  },

  mono: {
    label: 'Mono',
    sub: 'Grayscale, wider range',
    swatches: ['#111111', '#444444', '#777777', '#aaaaaa'],
    colors: ['#111111', '#333333', '#555555', '#777777', '#999999', '#bbbbbb'],
    colorFreezeLevel: 2,
    vars: {
      mapBg: '#ffffff',
      text: '#111111',
      active: '#111111',
    },
  },
};

const MAP_LINK_PRESETS = {
  solid: {
    label: 'Solid',
    sub: 'Default line',
    dash: 'none',
    width: '2px',
  },
  dashed: {
    label: 'Dashed',
    sub: 'Dash links',
    dash: '6 4',
    width: '2px',
  },
  dotted: {
    label: 'Dotted',
    sub: 'Dot links',
    dash: '2 4',
    width: '2px',
  },
};

const MAP_STYLE_DEFAULT_STATE = {
  version: 1,
  theme: 'default',
  layout: 'default',
  nodeLength: 'medium',
  linkStyle: 'solid',
};

let mapStyleState = loadMapStyleState();

function loadMapStyleState() {
  try {
    const raw = localStorage.getItem(MAP_STYLE_STORAGE_KEY);
    if (!raw) return { ...MAP_STYLE_DEFAULT_STATE };

    const parsed = JSON.parse(raw);

    const state = {
      ...MAP_STYLE_DEFAULT_STATE,
      ...parsed,
      version: 1,
    };

    // Migration safety: if a temporary version stored "sunshine",
    // map it back to the restored "sunset" preset.
    if (state.theme === 'sunshine') {
      state.theme = 'sunset';
    }

    if (!MAP_THEME_PRESETS[state.theme]) {
      state.theme = MAP_STYLE_DEFAULT_STATE.theme;
    }

    if (!MAP_LAYOUT_PRESETS[state.layout]) {
      state.layout = MAP_STYLE_DEFAULT_STATE.layout;
    }

    if (!NODE_LENGTH_PRESETS[state.nodeLength]) {
      state.nodeLength = MAP_STYLE_DEFAULT_STATE.nodeLength;
    }

    if (!MAP_LINK_PRESETS[state.linkStyle]) {
      state.linkStyle = MAP_STYLE_DEFAULT_STATE.linkStyle;
    }

    return state;
  } catch {
    return { ...MAP_STYLE_DEFAULT_STATE };
  }
}

function saveMapStyleState() {
  try {
    localStorage.setItem(
      MAP_STYLE_STORAGE_KEY,
      JSON.stringify({
        ...mapStyleState,
        updatedAt: Date.now(),
      })
    );
  } catch {}
}

function getDefaultMarkmapColorPalette() {
  try {
    if (window.d3 && Array.isArray(window.d3.schemeCategory10)) {
      return window.d3.schemeCategory10.slice();
    }
  } catch {}

  return [
    '#1f77b4',
    '#ff7f0e',
    '#2ca02c',
    '#d62728',
    '#9467bd',
    '#8c564b',
    '#e377c2',
    '#7f7f7f',
    '#bcbd22',
    '#17becf',
  ];
}

function getCurrentMapThemeOptions() {
  const theme = MAP_THEME_PRESETS[mapStyleState.theme] || MAP_THEME_PRESETS.default;

  if (mapStyleState.theme === 'default') {
    return {
      color: getDefaultMarkmapColorPalette(),
      colorFreezeLevel: 0,
    };
  }

  return {
    color:
      Array.isArray(theme.colors) && theme.colors.length
        ? theme.colors
        : getDefaultMarkmapColorPalette(),

    colorFreezeLevel: typeof theme.colorFreezeLevel === 'number' ? theme.colorFreezeLevel : 2,
  };
}

function getCurrentMapLayoutOptions() {
  const layout = MAP_LAYOUT_PRESETS[mapStyleState.layout] || MAP_LAYOUT_PRESETS.default;

  const nodeLength = NODE_LENGTH_PRESETS[mapStyleState.nodeLength] || NODE_LENGTH_PRESETS.medium;

  const jsonOptions = {
    initialExpandLevel: 2,

    // Layout controls density/spacing.
    duration: layout.duration,
    spacingHorizontal: layout.spacingHorizontal,
    spacingVertical: layout.spacingVertical,

    // Node length controls wrapping independently.
    maxWidth: nodeLength.maxWidth,

    ...getCurrentMapThemeOptions(),
  };

  try {
    if (window.markmap && typeof window.markmap.deriveOptions === 'function') {
      return window.markmap.deriveOptions(jsonOptions);
    }
  } catch {}

  return jsonOptions;
}
// R-MULTI4: session-aware viewState key with legacy fallback.
function getViewStateKey() {
  try {
    return (
      globalThis.getModeSessionStorageKey?.(undefined, undefined, 'viewState') ||
      'markmap:viewState:v1'
    );
  } catch {
    return 'markmap:viewState:v1';
  }
}
const VIEW_STATE_KEY_LEGACY = 'markmap:viewState:v1';
const VIEW_MIN_K = 0.05;
const VIEW_MAX_K = 20;
let viewSaveTimer = null;

function isValidViewStateNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeViewState(state) {
  if (!state) return null;

  const k = Number(state.k);
  const x = Number(state.x);
  const y = Number(state.y);

  if (
    !Number.isFinite(k) ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    k < VIEW_MIN_K ||
    k > VIEW_MAX_K
  ) {
    return null;
  }

  return { k, x, y };
}

function getSvgElForZoom() {
  try {
    if (mm?.svg && typeof mm.svg.node === 'function') {
      return mm.svg.node();
    }
  } catch {}

  return mapSvg;
}

function getCurrentViewState() {
  try {
    if (!mm || !window.d3?.zoomTransform) return null;

    const svgEl = getSvgElForZoom();
    if (!svgEl) return null;

    const t = window.d3.zoomTransform(svgEl);

    const state = normalizeViewState({
      k: t.k,
      x: t.x,
      y: t.y,
    });

    if (!state) {
      console.warn('Invalid zoomTransform detected:', t);
      try {
        localStorage.removeItem(getViewStateKey());
      } catch {}
      return null;
    }

    return state;
  } catch (e) {
    log(`getCurrentViewState() error: ${e?.message || e}`);
    return null;
  }
}

function applyViewState(state, reason = 'applyViewState') {
  try {
    const safeState = normalizeViewState(state);

    if (!mm || !safeState || !window.d3?.zoomIdentity) {
      console.warn(`${reason}: invalid view state blocked`, state);
      try {
        localStorage.removeItem(getViewStateKey());
      } catch {}
      return;
    }

    const svgEl = getSvgElForZoom();
    if (!svgEl) return;

    const svgSel = mm?.svg && typeof mm.svg.call === 'function' ? mm.svg : window.d3.select(svgEl);

    if (!mm.zoom || !mm.zoom.transform) {
      console.warn(`${reason}: mm.zoom.transform unavailable`);
      return;
    }

    const tr = window.d3.zoomIdentity.translate(safeState.x, safeState.y).scale(safeState.k);

    svgSel.call(mm.zoom.transform, tr);

    log(
      `${reason}: restored zoom/pan k=${safeState.k.toFixed(3)} x=${Math.round(safeState.x)} y=${Math.round(safeState.y)}`
    );
  } catch (e) {
    log(`❌ ${reason} failed: ${e?.message || e}`);
  }
}

function restoreViewStateTwice(state, reason = 'restoreView') {
  try {
    const safeState = normalizeViewState(state);

    if (!safeState) {
      console.warn(`${reason}: invalid restore state blocked`, state);
      try {
        localStorage.removeItem(getViewStateKey());
      } catch {}
      return;
    }

    applyViewState(safeState, reason + ' (immediate)');

    requestAnimationFrame(() => {
      try {
        applyViewState(safeState, reason + ' (raf)');
      } catch {}
    });
  } catch {}
}

function loadViewState() {
  const newKey = getViewStateKey();
  try {
    // 1. Try the new session-aware key first.
    let raw = localStorage.getItem(newKey);

    // 2. Fall back to the legacy key.
    if (!raw) {
      raw = localStorage.getItem(VIEW_STATE_KEY_LEGACY);
    }

    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const safeState = normalizeViewState(parsed);

    if (!safeState) {
      console.warn('Invalid stored view state removed:', parsed);
      try {
        localStorage.removeItem(newKey);
      } catch {}
      return null;
    }

    return safeState;
  } catch {
    try {
      localStorage.removeItem(newKey);
    } catch {}
    try {
      localStorage.removeItem(VIEW_STATE_KEY_LEGACY);
    } catch {}
    return null;
  }
}

function saveViewState(state, reason = 'saveViewState') {
  try {
    if (!state || !isFinite(state.k) || !isFinite(state.x) || !isFinite(state.y)) {
      console.warn('Skipping invalid view state save:', state);
      return;
    }
    const newKey = getViewStateKey();
    localStorage.setItem(newKey, JSON.stringify(state));
    log(`${reason}: saved zoom/pan`);
  } catch (e) {
    log(`${reason} error: ${e?.message || e}`);
  }
}

function setShowHideLabel(btnId, isVisible, name) {
  const btn = document.getElementById(btnId);
  if (!btn) return;

  const verb = isVisible ? 'Hide' : 'Show';

  // ✅ Icon-only button: keep icon, update tooltip only
  if (btn.dataset && btn.dataset.icon) {
    const label = `${verb} ${name}`;
    btn.title = label;
    btn.setAttribute('aria-label', label);
    return;
  }

  // Default behavior (text buttons)
  btn.textContent = `${verb} ${name}`;
}

function syncToolbarHeight() {
  const tb = document.getElementById('toolbar');
  if (!tb) return;
  document.documentElement.style.setProperty('--toolbar-h', tb.offsetHeight + 'px');
}
window.addEventListener('resize', syncToolbarHeight);
setTimeout(syncToolbarHeight, 0);

function scheduleViewStateSave(reason = 'interaction') {
  if (viewSaveTimer) clearTimeout(viewSaveTimer);
  viewSaveTimer = setTimeout(() => {
    viewSaveTimer = null;
    const s = getCurrentViewState();
    if (s) saveViewState(s, `viewState ${reason}`);
  }, 300);
}

mapSvg.addEventListener('wheel', () => scheduleViewStateSave('wheel'), { passive: true });
mapSvg.addEventListener('pointerup', () => scheduleViewStateSave('pointerup'));
mapSvg.addEventListener('touchend', () => scheduleViewStateSave('touchend'), {
  passive: true,
});

// ================================
// Fold preservation (in‑memory)
// ================================
let foldMap = new Map();

function walkWithIndexPath(node, cb, path = '0') {
  if (!node) return;
  cb(node, path);
  const kids = node.children || [];
  for (let i = 0; i < kids.length; i++) {
    walkWithIndexPath(kids[i], cb, `${path}.${i}`);
  }
}

function captureFoldMapFromMm() {
  const map = new Map();
  try {
    const data = mm?.state?.data;
    if (!data) {
      foldDbg('capture: mm.state.data is null/undefined');
      return map;
    }
    walkWithIndexPath(data, (n, key) => {
      const f = typeof n?.payload?.fold === 'number' ? n.payload.fold : 0;
      map.set(key, f);
    });
    const s = summarizeFoldMap(map);
    const st = foldMapStats(map);
    foldDbg(
      `capture: total=${st.total} zero=${st.zero} fold1=${st.f1} fold2=${st.f2} other=${st.other} sample=[${s.sample.join(', ')}]`
    );
  } catch (e) {
    log(`captureFoldMapFromMm() error: ${e?.message || e}`);
  }
  return map;
}

function foldMapStats(map) {
  let zero = 0,
    f1 = 0,
    f2 = 0,
    other = 0;
  for (const v of map.values()) {
    if (v === 0) zero++;
    else if (v === 1) f1++;
    else if (v === 2) f2++;
    else other++;
  }
  return { total: map.size, zero, f1, f2, other };
}

function applyFoldMapToRoot(root, map) {
  try {
    if (!root || !map) {
      foldDbg('apply: root or map missing');
      return;
    }
    const pre = countFoldedInTree(root);
    foldDbg(
      `apply: BEFORE nodes=${pre.totalNodes}, folded=${pre.foldedNodes}, zero=${pre.explicitZero}, undef=${pre.undefinedFold}, incomingMap=${map.size}`
    );
    let applied = 0;
    walkWithIndexPath(root, (n, key) => {
      if (!map.has(key)) return;
      const f = map.get(key);
      n.payload = n.payload || {};
      n.payload.fold = f;
      applied++;
    });
    const post = countFoldedInTree(root);
    foldDbg(
      `apply: AFTER  nodes=${post.totalNodes}, folded=${post.foldedNodes}, zero=${post.explicitZero}, undef=${post.undefinedFold}, applied=${applied}`
    );
  } catch (e) {
    log(`applyFoldMapToRoot() error: ${e?.message || e}`);
  }
}

const DEBUG_FOLD = false; //fold debug if we notice any problem with it we can change it later
function foldDbg(msg) {
  if (!DEBUG_FOLD) return;
  log(`🧩 FOLD: ${msg}`);
}

function summarizeFoldMap(map) {
  const sample = [];
  let i = 0;
  for (const [k, v] of map.entries()) {
    if (i++ < 10) sample.push(`${k}=${v}`);
    else break;
  }
  return { foldedNodes: map.size, sample };
}

function countFoldedInTree(root) {
  let total = 0;
  let folded = 0;
  let explicitZero = 0;
  let undefinedFold = 0;
  walkWithIndexPath(root, (n) => {
    total++;
    const f = n?.payload?.fold;
    if (typeof f !== 'number') {
      undefinedFold++;
    } else if (f > 0) {
      folded++;
    } else {
      explicitZero++;
    }
  });
  return { totalNodes: total, foldedNodes: folded, explicitZero, undefinedFold };
}

function markmapReady() {
  const ok = !!(window.markmap && window.markmap.Transformer && window.markmap.Markmap);
  if (!ok) log('render(): ⚠️ markmap engine not ready yet (window.markmap missing parts)');
  return ok;
}

// Boot safety: if markmap engine isn't ready yet (slow network / blocked), retry a few times
function __ensureMarkmapBoot() {
  let tries = 0;
  const maxTries = 20; // ~5s
  const tick = () => {
    tries++;
    const ok = !!(window.markmap && window.markmap.Transformer && window.markmap.Markmap);
    if (ok) {
      try {
        globalThis.MME_RENDER?.renderNow?.('boot ensureMarkmapBoot');
      } catch {}
      return;
    }
    if (tries >= maxTries) {
      try {
        setStatus('⚠ markmap engine not loaded (check console / network)');
      } catch {}
      try {
        showToast('Markmap engine not loaded — check console/network', 'error', 5000);
      } catch {}
      return;
    }
    setTimeout(tick, 250);
  };
  setTimeout(tick, 250);
}

function ensureTransformer() {
  if (transformer) return transformer;
  transformer = new window.markmap.Transformer();
  log('Mindmap engine: Transformer created (singleton)');
  return transformer;
}

function normalizeAssetList(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function filterNewAssets(items, set) {
  const out = [];
  for (const it of items) {
    const key = typeof it === 'string' ? it : JSON.stringify(it);
    if (!set.has(key)) {
      set.add(key);
      out.push(it);
    }
  }
  return out;
}

async function ensureAssets(features) {
  const { loadCSS, loadJS } = window.markmap;
  const t = ensureTransformer();
  const assets = t.getUsedAssets(features);
  const styles = normalizeAssetList(assets.styles);
  const scripts = normalizeAssetList(assets.scripts);
  const newStyles = filterNewAssets(styles, loadedCss);
  const newScripts = filterNewAssets(scripts, loadedJs);
  if (newStyles.length) {
    log(`Mindmap engine: loading ${newStyles.length} new CSS asset(s)`);
    await loadCSS(newStyles);
  } else {
    log('Mindmap engine: CSS assets unchanged');
  }
  if (newScripts.length) {
    log(`Mindmap engine: loading ${newScripts.length} new JS asset(s)`);
    await loadJS(newScripts, {
      getMarkmap: () => window.markmap,
    });
  } else {
    log('Mindmap engine: JS assets unchanged');
  }
}

async function setAllNodesFolded(foldValue) {
  try {
    if (!mm?.state?.data) return;

    const data = mm.state.data;
    walkTree(data, (n) => {
      if (n.children && n.children.length) {
        n.payload = n.payload || {};
        n.payload.fold = foldValue;
      }
    });

    const prevView = getCurrentViewState();
    await mm.setData(data, { initialExpandLevel: 999 });
    if (prevView) applyViewState(prevView, 'set all nodes folded: restore view');

    foldMap = captureFoldMapFromMm();
  } catch (e) {
    log(`❌ setAllNodesFolded failed: ${e?.message || e}`);
  }
}

async function updateMindmap(source) {
  if (!markmapReady()) return;
  const t = ensureTransformer();
  const { Markmap } = window.markmap;
  const { root, features } = t.transform(md.value);
  log(`${source}: transform() OK`);
  await ensureAssets(features);
  if (!mm) {
    log(`${source}: creating Markmap instance (persistent)`);
    mm = Markmap.create(mapSvg, getCurrentMapLayoutOptions(), root);
    mapSvg.addEventListener('click', () => {
      if (!DEBUG_FOLD) return;
      setTimeout(() => {
        const d = mm?.state?.data;
        if (!d) return;
        const c = countFoldedInTree(d);
        foldDbg(
          `click->state: nodes=${c.totalNodes} folded=${c.foldedNodes} zero=${c.explicitZero} undef=${c.undefinedFold}`
        );
      }, 0);
    });
    log(`${source}: Markmap.create() OK`);
    const stored = loadViewState();

    if (forceFitNextRender) {
      requestAnimationFrame(() => {
        try {
          mm.fit();
          hasAutoFitted = true;
          forceFitNextRender = false;
          log(`${source}: forced auto-fit applied`);
        } catch (e) {
          log(`❌ ${source}: forced auto-fit failed: ${e?.message || e}`);
        }
      });
    } else if (stored) {
      applyViewState(stored, `${source}: restore from localStorage`);
    } else if (!hasAutoFitted) {
      requestAnimationFrame(() => {
        try {
          mm.fit();
          hasAutoFitted = true;
          log(`${source}: auto-fit applied`);
        } catch (e) {
          log(`❌ ${source}: auto-fit failed: ${e?.message || e}`);
        }
      });
    }
  } else {
    const preserveFolds =
      source.startsWith('debounced') || source.startsWith('blur') || source.startsWith('hotReload');
    foldDbg(`render source="${source}" preserveFolds=${preserveFolds}`);
    if (preserveFolds) {
      foldMap = captureFoldMapFromMm();
      applyFoldMapToRoot(root, foldMap);
    }
    const prevView = getCurrentViewState();
    log(`${source}: mm.setData() begin`);
    if (preserveFolds) {
      log(`${source}: mm.setData() using initialExpandLevel override (preserveFolds)`);
      await mm.setData(root, { initialExpandLevel: 999 });
    } else {
      await mm.setData(root);
    }
    log(`${source}: mm.setData() OK`);
    if (prevView) applyViewState(prevView, `${source}: restore after setData`);
    if (preserveFolds) {
      const afterData = mm?.state?.data;
      if (afterData) {
        const c = countFoldedInTree(afterData);
        foldDbg(
          `post-setData: nodes=${c.totalNodes} folded=${c.foldedNodes} zero=${c.explicitZero} undef=${c.undefinedFold}`
        );
      } else {
        foldDbg('post-setData: mm.state.data missing');
      }
    }
  }
}

function render(source = 'render()') {
  (async () => {
    try {
      log(`${source}: begin`);
      await updateMindmap(source);
      if (htmlPane.style.display === 'block') {
        htmlPane.innerHTML = await renderHtmlWithShiki(md.value);
        buildHtmlHeadingIndex();
        log(`${source}: HTML pane updated`);
        syncHtmlScrollToEditor('render html updated');
      }
      log(`${source}: end`);
    } catch (err) {
      log(`❌ ${source} crashed: ${err?.message || err}`);
    }
  })();
}

// Canonical HTML Preview visibility path (single source of truth).
// The top-toolbar toggle, the local Close, and the edge restore all converge on
// showHtmlPreview/hideHtmlPreview so pane width, rendered content, controls,
// class and ARIA state never diverge. Edge restore must fully show + render +
// sync controls in one click (DEFECT 3).
function showHtmlPreview() {
  if (!globalThis.MME_WORKSPACE_CAPABILITIES?.canActive?.('htmlPreview')) {
    const activeId = globalThis.MME_WORKSPACE_CAPABILITIES?.getActiveId?.() || 'current workspace';
    log?.(`HTML Preview: blocked in ${activeId}`);
    return Promise.resolve(false);
  }

  htmlPane.style.display = 'block';
  // Synchronize the HTML controls with the logical state immediately, before
  // the async content render completes. This is the same final-state owner
  // (updateHtmlPreviewButtons) used everywhere else; calling it here hides
  // #btnHtmlEdgeOpen in the same synchronous flow that makes the pane visible,
  // so the Registry refresh/audit that may run during the render no longer
  // observes a stale Open control. The post-render call below remains as the
  // idempotent final sync after content is applied.
  updateHtmlPreviewButtons();
  log('HTML view SHOW');

  return renderHtmlWithShiki(md.value)
    .then((html) => {
      // S1: guard against stale async render. If the HTML pane was closed while
      // rendering (e.g. splitter drag-open then quick Close), do not re-apply
      // content, update controls, or flip the toolbar label back as if visible.
      if (htmlPane.style.display !== 'block') {
        log?.('HTML Preview show skipped: pane closed during render');
        return false;
      }
      htmlPane.innerHTML = html;
      buildHtmlHeadingIndex();
      log('HTML pane refreshed');
      syncHtmlScrollToEditor('showHtmlPreview show');
      wireHtmlCloseButton();
      updateHtmlPreviewButtons();
      setShowHideLabel('btnHtml', true, 'HTML');
      syncToolbarHeight();
      constrainHtmlControlsToPane();
      try { globalThis.MME_VIEW_LAYOUT?.refresh?.(); } catch {}
      return true;
    })
    .catch((err) => {
      log?.(`❌ HTML Preview show failed: ${err?.message || err}`);
      return false;
    });
}

function hideHtmlPreview() {
  if (!globalThis.MME_WORKSPACE_CAPABILITIES?.canActive?.('htmlPreview')) {
    const activeId = globalThis.MME_WORKSPACE_CAPABILITIES?.getActiveId?.() || 'current workspace';
    log?.(`HTML Preview: blocked in ${activeId}`);
    return false;
  }

  // S2: enforce the last-useful-pane rule through the registry. A re-entrant
  // call from the registry adapter proceeds normally (isPaneActing guard).
  if (typeof hideViaRegistry === 'function' && !hideViaRegistry('html')) return true;

  htmlPane.style.display = 'none';
  log('HTML view HIDE');

  mapPane.style.width = '';
  mapPane.style.flex = '1 1 auto';

  wireHtmlCloseButton();
  updateHtmlPreviewButtons();
  setShowHideLabel('btnHtml', false, 'HTML');
  syncToolbarHeight();
  constrainHtmlControlsToPane();
  try { globalThis.MME_VIEW_LAYOUT?.refresh?.(); } catch {}
  return true;
}

async function toggleHtml() {
  return isHtmlPreviewOpen() ? hideHtmlPreview() : showHtmlPreview();
}

// ================================
// S2 — Pane Registry integration
// ================================

// Route a hide request through the registry so the last-useful-pane rule is
// enforced once, centrally. Returns true when the caller should proceed with
// the direct owner hide (registry absent, re-entrant call, or fallback), false
// when the registry already performed (or blocked) the hide.
function hideViaRegistry(paneId) {
  try {
    const V = globalThis.MME_VIEW_LAYOUT;
    if (!V || typeof V.hidePane !== 'function' || V.isPaneActing?.()) return true;
    const r = V.hidePane(paneId);
    if (r && r.ok) return false; // registry already delegated to the owner
    if (r && r.reason === 'last-useful-pane') {
      try { showToast('At least one content view must remain open.', 'error', 2200); } catch {}
      return false;
    }
  } catch {}
  return true;
}

// ---- S2 Markmap visibility (narrow adapter; registry owns the edge tab) ----
let _markmapHiddenView = null;

function isMapPaneVisible() {
  const pane = document.getElementById('mapPane');
  return !!pane && pane.style.display !== 'none';
}

function hideMapPane() {
  const pane = document.getElementById('mapPane');
  if (!pane || pane.style.display === 'none') return true;
  try {
    const v = getCurrentViewState();
    if (v) _markmapHiddenView = v;
  } catch {}
  pane.style.display = 'none';
  log('Markmap view HIDE');
  return true;
}

function showMapPane() {
  const pane = document.getElementById('mapPane');
  if (!pane) return false;
  const wasHidden = pane.style.display === 'none';
  pane.style.display = 'flex';
  log('Markmap view SHOW');
  if (wasHidden) {
    // Restore the user's pan/zoom after the pane regains layout; the Markmap
    // instance and SVG are never recreated. No unconditional auto-fit that
    // would destroy the current view.
    requestAnimationFrame(() => {
      try {
        const v = _markmapHiddenView || getCurrentViewState();
        if (v && typeof applyViewState === 'function') {
          applyViewState(v, 'markmap restore');
        }
      } catch (e) {
        try { log(`markmap restore view failed: ${e?.message || e}`); } catch {}
      }
      _markmapHiddenView = null;
    });
  }
  return true;
}

function ensureMapHideButton() {
  try {
    const overlay = document.getElementById('mapOverlayControls');
    if (!overlay || document.getElementById('mapBtnHide')) return;
    const btn = document.createElement('button');
    btn.id = 'mapBtnHide';
    btn.type = 'button';
    btn.textContent = '✕';
    btn.title = 'Hide Map';
    btn.setAttribute('aria-label', 'Hide Map');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideViaRegistry('markmap');
    });
    overlay.appendChild(btn);
    if (!document.getElementById('mapBtnFullscreen')) {
      const fsBtn = document.createElement('button');
      fsBtn.id = 'mapBtnFullscreen';
      fsBtn.type = 'button';
      fsBtn.textContent = '⛶';
      fsBtn.title = 'Fullscreen Map';
      fsBtn.setAttribute('aria-label', 'Fullscreen Map');
      fsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { globalThis.MME_VIEW_LAYOUT?.enterFullscreen?.('markmap'); } catch {}
      });
      overlay.appendChild(fsBtn);
    }
  } catch (e) {
    try { log(`map hide button init failed: ${e?.message || e}`); } catch {}
  }
}

function ensureEditorFullscreenButton() {
  try {
    const host = document.getElementById('editorOverlayControls');
    if (!host || document.getElementById('editorBtnFullscreen')) return;
    const btn = document.createElement('button');
    btn.id = 'editorBtnFullscreen';
    btn.type = 'button';
    btn.textContent = '⛶';
    btn.title = 'Fullscreen Editor';
    btn.setAttribute('aria-label', 'Fullscreen Editor');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try { globalThis.MME_VIEW_LAYOUT?.enterFullscreen?.('editor'); } catch {}
    });
    host.appendChild(btn);
  } catch (e) {
    try { log(`editor fullscreen button init failed: ${e?.message || e}`); } catch {}
  }
}

function ensureHtmlFullscreenButton() {
  try {
    const overlay = ensureHtmlOverlayControls();
    if (!overlay || document.getElementById('htmlBtnFullscreen')) return;
    const btn = document.createElement('button');
    btn.id = 'htmlBtnFullscreen';
    btn.type = 'button';
    btn.textContent = '⛶';
    btn.title = 'Fullscreen HTML Preview';
    btn.setAttribute('aria-label', 'Fullscreen HTML Preview');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try { globalThis.MME_VIEW_LAYOUT?.enterFullscreen?.('html'); } catch {}
    });
    overlay.appendChild(btn);
  } catch (e) {
    try { log(`html fullscreen button init failed: ${e?.message || e}`); } catch {}
  }
}

function initViewLayoutRegistry() {
  try {
    const V = globalThis.MME_VIEW_LAYOUT;
    if (!V || typeof V.registerPane !== 'function') return;
    if (V.getPane?.('editor')?.adapter) { V.configure?.(); return; } // idempotent

    V.registerPane({
      id: 'sidebar',
      label: 'Workspace',
      contexts: ['journal'],
      edge: 'left',
      usefulContent: false,
      elementId: 'workspaceSidebar',
      adapter: {
        isAvailable: () => globalThis.currentAppContextId === 'journal',
        isVisible: () =>
          !document.documentElement.classList.contains('journal-sidebar-collapsed'),
        show: () => {
          try {
            if (typeof globalThis.setJournalSidebarCollapsed !== 'function') return false;
            globalThis.setJournalSidebarCollapsed(false);
            return true;
          } catch { return false; }
        },
        hide: () => {
          try {
            if (typeof globalThis.setJournalSidebarCollapsed !== 'function') return false;
            globalThis.setJournalSidebarCollapsed(true);
            return true;
          } catch { return false; }
        },
      },
    });

    V.registerPane({
      id: 'editor',
      label: 'Editor',
      contexts: ['editor', 'journal', 'slides'],
      edge: 'left',
      usefulContent: true,
      elementId: 'editor',
      splitterId: 'splitEditor',
      adapter: {
        isVisible: () => !(globalThis.MME_EDITOR_VISIBILITY?.isEditorHidden?.() ?? false),
        show: () => {
          try { globalThis.MME_EDITOR_VISIBILITY?.showEditor?.(); return true; }
          catch { return false; }
        },
        hide: () => {
          try { globalThis.MME_EDITOR_VISIBILITY?.hideEditor?.(); return true; }
          catch { return false; }
        },
        focus: () => {
          try { globalThis.__cm?.focus?.(); return true; }
          catch { return false; }
        },
        captureLayout: () => {
          try {
            const cm = globalThis.__cm;
            return { scroll: cm ? (cm.doc?.scrollTop ?? cm.getScrollInfo?.().top ?? null) : null };
          } catch { return null; }
        },
        applyLayout: () => {
          try {
            requestAnimationFrame(() => {
              try { globalThis.__cm?.refresh?.(); } catch {}
            });
            return true;
          } catch { return false; }
        },
        restoreLayout: () => {
          try {
            requestAnimationFrame(() => {
              try { globalThis.__cm?.refresh?.(); globalThis.__cm?.focus?.(); } catch {}
            });
            return true;
          } catch { return false; }
        },
      },
    });

    V.registerPane({
      id: 'markmap',
      label: 'Map',
      contexts: ['editor', 'journal', 'slides'],
      edge: 'right',
      usefulContent: true,
      elementId: 'mapPane',
      splitterId: 'splitHtml',
      adapter: {
        isVisible: isMapPaneVisible,
        show: showMapPane,
        hide: hideMapPane,
        captureLayout: () => {
          try { return getCurrentViewState() || null; } catch { return null; }
        },
        applyLayout: ({ baselineLayout }) => {
          try {
            requestAnimationFrame(() => {
              if (baselineLayout) {
                try { applyViewState(baselineLayout, 'markmap fullscreen enter'); } catch {}
              }
            });
            return true;
          } catch { return false; }
        },
        restoreLayout: ({ fullscreenLayout, baselineLayout }) => {
          try {
            const view = fullscreenLayout || baselineLayout;
            requestAnimationFrame(() => {
              if (view) {
                try { applyViewState(view, 'markmap fullscreen exit'); } catch {}
              }
            });
            return true;
          } catch { return false; }
        },
      },
    });

    V.registerPane({
      id: 'html',
      label: 'Preview',
      contexts: ['editor', 'journal', 'slides'],
      edge: 'right',
      usefulContent: true,
      elementId: 'htmlPane',
      splitterId: 'splitHtml',
      adapter: {
        isVisible: () => htmlPane.style.display === 'block',
        show: () => {
          try { showHtmlPreview(); return true; } catch { return false; }
        },
        hide: () => {
          try { return hideHtmlPreview() !== false; } catch { return false; }
        },
        captureLayout: () => {
          try { return { top: htmlPane.scrollTop, left: htmlPane.scrollLeft }; }
          catch { return null; }
        },
        applyLayout: ({ baselineLayout }) => {
          try {
            requestAnimationFrame(() => {
              try {
                if (baselineLayout?.top != null) htmlPane.scrollTop = baselineLayout.top;
                if (baselineLayout?.left != null) htmlPane.scrollLeft = baselineLayout.left;
              } catch {}
            });
            return true;
          } catch { return false; }
        },
        restoreLayout: ({ fullscreenLayout, baselineLayout }) => {
          try {
            const lay = fullscreenLayout || baselineLayout;
            requestAnimationFrame(() => {
              try {
                if (lay?.top != null) htmlPane.scrollTop = lay.top;
                if (lay?.left != null) htmlPane.scrollLeft = lay.left;
              } catch {}
            });
            return true;
          } catch { return false; }
        },
      },
    });

    V.configure?.();
    ensureMapHideButton();
    ensureEditorFullscreenButton();
    ensureHtmlFullscreenButton();
    try {
      const presetIds = (V.getAvailablePresets?.() || []).map((p) => p.id).join(', ');
      log(`Pane registry initialized (S2) — S4A presets available: ${presetIds || 'none'}`);
    } catch {
      try { log('Pane registry initialized (S2)'); } catch {}
    }
  } catch (e) {
    try { log(`❌ pane registry init failed: ${e?.message || e}`); } catch {}
  }
}

// ================================
// Scroll sync (Editor → HTML) – FIXED (single version)
// ================================
let _scrollSyncEl = null;
let _scrollSyncBusy = false;

function _onEditorScroll() {
  if (_scrollSyncBusy) return;
  syncHtmlScrollToEditor('editor scroll');
}

function attachEditorScrollSync() {
  // Prefer CodeMirror scroller if present
  const cmScroller = document.querySelector('#cmHost .cm-scroller');

  // If CodeMirror loaded, attach to it
  if (cmScroller) {
    if (_scrollSyncEl === cmScroller) return; // already attached
    if (_scrollSyncEl) _scrollSyncEl.removeEventListener('scroll', _onEditorScroll);
    _scrollSyncEl = cmScroller;
    _scrollSyncEl.addEventListener('scroll', _onEditorScroll, { passive: true });
    log('ScrollSync: attached to CodeMirror scroller');
    return;
  }

  // If CodeMirror failed, attach to textarea fallback
  if (document.body.classList.contains('cmFailed')) {
    if (_scrollSyncEl === md) return;
    if (_scrollSyncEl) _scrollSyncEl.removeEventListener('scroll', _onEditorScroll);
    _scrollSyncEl = md;
    _scrollSyncEl.addEventListener('scroll', _onEditorScroll, { passive: true });
    log('ScrollSync: attached to textarea (cmFailed)');
    return;
  }

  // Otherwise: CodeMirror not ready yet → retry soon
  setTimeout(attachEditorScrollSync, 200);
}

// Re-try when CodeMirror signals ready, and also on boot
window.addEventListener('cm-ready', attachEditorScrollSync);
setTimeout(attachEditorScrollSync, 0);

function _getEditorScrollEl() {
  return document.querySelector('#cmHost .cm-scroller') || md;
}

function _getScrollRatio(el) {
  const max = el.scrollHeight - el.clientHeight;
  return max > 0 ? el.scrollTop / max : 0;
}
function _setScrollRatio(el, ratio) {
  const max = el.scrollHeight - el.clientHeight;
  el.scrollTop = max > 0 ? ratio * max : 0;
}

let __mdHeadings = [];
let __mdTotalLines = 0;

let __htmlByNorm = new Map();
let __htmlHeadings = [];

const __HTML_SYNC_OFFSET_PX = 48;

function buildMdHeadingIndex() {
  __mdHeadings = [];

  const lines = String(md.value || '').split(/\n/);
  __mdTotalLines = lines.length;

  const occurrenceByNorm = new Map();
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';

    // Avoid indexing headings inside fenced code blocks.
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }

    if (inFence) continue;

    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (!m) continue;

    const raw = stripHeadingPrefix((m[2] || '').trim());
    if (!raw) continue;

    const norm = _normalizeHeadingText(raw);
    if (!norm) continue;

    const occurrence = occurrenceByNorm.get(norm) || 0;
    occurrenceByNorm.set(norm, occurrence + 1);

    __mdHeadings.push({
      norm,
      raw,
      lineNo: i,
      headingIdx: __mdHeadings.length,
      occurrence,
    });
  }
}

function buildHtmlHeadingIndex() {
  __htmlByNorm = new Map();
  __htmlHeadings = [];

  if (htmlPane.style.display !== 'block') return;

  const headings = htmlPane.querySelectorAll('h1,h2,h3,h4,h5,h6');
  const occurrenceByNorm = new Map();

  headings.forEach((h, index) => {
    const norm = _normalizeHeadingText(h.textContent || '');
    if (!norm) return;

    const occurrence = occurrenceByNorm.get(norm) || 0;
    occurrenceByNorm.set(norm, occurrence + 1);

    const item = {
      norm,
      occurrence,
      headingIdx: index,
      top: h.offsetTop || 0,
      el: h,
    };

    __htmlHeadings.push(item);

    if (!__htmlByNorm.has(norm)) {
      __htmlByNorm.set(norm, []);
    }

    __htmlByNorm.get(norm).push(item);
  });
}

function getHtmlHeadingForMdHeading(mdHeading) {
  if (!mdHeading) return null;

  // Best case: same heading order.
  const byIndex = __htmlHeadings[mdHeading.headingIdx];

  if (byIndex && byIndex.norm === mdHeading.norm) {
    return byIndex;
  }

  // Fallback: same text and same occurrence.
  const sameText = __htmlByNorm.get(mdHeading.norm) || [];

  return sameText.find((x) => x.occurrence === mdHeading.occurrence) || sameText[0] || null;
}

let htmlPaneResizeObserver = null;
function ensureHtmlPaneResizeObserver() {
  try {
    if (htmlPaneResizeObserver) return;
    if (typeof ResizeObserver !== 'function') return;
    htmlPaneResizeObserver = new ResizeObserver(() => {
      if (htmlPane.style.display !== 'block') return;
      buildHtmlHeadingIndex();
      syncHtmlScrollToEditor('htmlPane resized');
    });
    htmlPaneResizeObserver.observe(htmlPane);
  } catch {}
}
setTimeout(() => ensureHtmlPaneResizeObserver(), 0);

function _findMdAnchorPair(lineNo) {
  if (!__mdHeadings.length) return { a: null, b: null };
  let lo = 0,
    hi = __mdHeadings.length - 1,
    idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (__mdHeadings[mid].lineNo <= lineNo) {
      idx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return {
    a: idx >= 0 ? __mdHeadings[idx] : null,
    b: idx >= 0 && idx + 1 < __mdHeadings.length ? __mdHeadings[idx + 1] : null,
  };
}

function _getApproxEditorLineFromScroll() {
  try {
    if (typeof window.__cmGetTopLine === 'function') return window.__cmGetTopLine();
  } catch {}
  const ed = _getEditorScrollEl();
  const max = ed.scrollHeight - ed.clientHeight;
  if (max <= 0 || __mdTotalLines <= 1) return 0;
  const r = ed.scrollTop / max;
  return Math.max(0, Math.min(__mdTotalLines - 1, Math.round(r * (__mdTotalLines - 1))));
}

function syncHtmlScrollToEditor(reason = 'sync') {
  if (htmlPane.style.display !== 'block') return;

  const ed = _getEditorScrollEl();
  if (!ed) return;

  _scrollSyncBusy = true;

  try {
    // Important for large files:
    // rebuild indexes instead of relying on possibly stale indexes.
    buildMdHeadingIndex();
    buildHtmlHeadingIndex();

    if (__mdHeadings.length && __htmlHeadings.length) {
      const curLine = _getApproxEditorLineFromScroll();
      const { a, b } = _findMdAnchorPair(curLine);

      const htmlA = getHtmlHeadingForMdHeading(a);

      if (a && htmlA) {
        let targetTop = htmlA.top;

        if (b && b.lineNo > a.lineNo) {
          const htmlB = getHtmlHeadingForMdHeading(b);

          if (htmlB && htmlB.top >= htmlA.top) {
            let ratio = (curLine - a.lineNo) / (b.lineNo - a.lineNo);

            try {
              if (typeof window.__cmGetAbsYForLine === 'function') {
                const yA = window.__cmGetAbsYForLine(a.lineNo);
                const yB = window.__cmGetAbsYForLine(b.lineNo);
                const yCur = window.__cmGetAbsYForLine(curLine);

                if (yA != null && yB != null && yCur != null && Math.abs(yB - yA) > 1) {
                  ratio = (yCur - yA) / (yB - yA);
                }
              }
            } catch {}

            ratio = Math.max(0, Math.min(1, ratio));
            targetTop = htmlA.top + ratio * (htmlB.top - htmlA.top);
          }
        }

        htmlPane.scrollTop = Math.max(0, targetTop - __HTML_SYNC_OFFSET_PX);

        return;
      }
    }

    // Fallback for documents with no headings.
    const ratio = _getScrollRatio(ed);
    _setScrollRatio(htmlPane, ratio);
  } finally {
    _scrollSyncBusy = false;
  }
}

// Markmap click → Editor jump
function _normalizeHeadingText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9\s\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _cleanNodeTextForMatch(text) {
  return String(text || '')
    .replace(/🔗/g, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/[*_~]/g, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/^\[[ xX]\]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function _getCurrentEditorLine() {
  try {
    if (typeof window.__cmGetCursorLine === 'function') return window.__cmGetCursorLine();
  } catch {}
  try {
    const pos = md.selectionStart || 0;
    return md.value.slice(0, pos).split(/\n/).length - 1;
  } catch {}
  return 0;
}

function _extractHeadingPathsFromMarkdown(markdownText) {
  const out = [];
  const lines = String(markdownText || '').split(/\n/);
  const stack = [];
  const occurrenceByPath = new Map();

  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';

    // Ignore headings inside fenced code blocks.
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }

    if (inFence) continue;

    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (!m) continue;

    const level = m[1].length;

    const raw = stripHeadingPrefix(_cleanNodeTextForMatch((m[2] || '').trim()));

    if (!raw) continue;

    const norm = _normalizeHeadingText(raw);
    if (!norm) continue;

    stack[level - 1] = norm;
    stack.length = level;

    const pathNorms = stack.slice();
    const pathKey = pathNorms.join(' > ');

    const occurrence = occurrenceByPath.get(pathKey) || 0;
    occurrenceByPath.set(pathKey, occurrence + 1);

    out.push({
      lineNo: i,
      raw,
      norm,
      level,
      pathNorms,
      pathKey,
      occurrence,
    });
  }

  return out;
}

function _scoreFuzzy(labelNorm, headingNorm) {
  if (!labelNorm || !headingNorm) return 0;
  if (labelNorm === headingNorm) return 100;
  if (headingNorm.includes(labelNorm) || labelNorm.includes(headingNorm)) return 85;
  const a = labelNorm.split(' ').filter((w) => w.length >= 2);
  const b = headingNorm.split(' ').filter((w) => w.length >= 2);
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  let hit = 0;
  for (const w of a) if (setB.has(w)) hit++;
  const ratio = hit / a.length;
  return Math.round(ratio * 70);
}

function _pickClosestByLine(candidates, currentLine) {
  let best = null,
    bestDist = Infinity;
  for (const c of candidates) {
    const d = Math.abs((c.lineNo || 0) - currentLine);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

function _scrollEditorToLine(lineNo, reason = 'jump') {
  try {
    if (typeof window.__cmScrollToLine === 'function') {
      window.__cmScrollToLine(lineNo);
    } else {
      const lines = md.value.split(/\n/);
      let pos = 0;
      for (let i = 0; i < Math.max(0, Math.min(lineNo, lines.length - 1)); i++)
        pos += lines[i].length + 1;
      md.focus();
      md.selectionStart = md.selectionEnd = pos;
      md.scrollTop = md.scrollHeight * (lineNo / Math.max(1, md.value.split('\n').length - 1));
    }
    log(`MarkmapJump: ${reason} → editor line ${lineNo}`);
    syncHtmlScrollToEditor('markmap jump');
  } catch (e) {
    log(`❌ MarkmapJump failed: ${e?.message || e}`);
  }
}

function _readMarkmapDatumText(datum) {
  try {
    const raw =
      datum?.data?.content ??
      datum?.data?.payload?.text ??
      datum?.data?.text ??
      datum?.content ??
      datum?.text ??
      '';

    if (Array.isArray(raw)) return raw.join(' ');

    return String(raw || '');
  } catch {
    return '';
  }
}

function _getClickedMarkmapNodeEl(ev) {
  let el = ev?.target;

  while (el && el !== mapSvg) {
    if (el.classList && el.classList.contains('markmap-node')) {
      return el;
    }

    el = el.parentNode;
  }

  return null;
}

function _getMarkmapNodePathNorms(nodeEl) {
  const path = [];

  try {
    if (!window.d3 || !nodeEl) return path;

    let datum = window.d3.select(nodeEl).datum();

    while (datum) {
      const raw = _cleanNodeTextForMatch(_readMarkmapDatumText(datum));

      const norm = _normalizeHeadingText(stripHeadingPrefix(raw));

      if (norm) path.push(norm);

      datum = datum.parent || null;
    }

    path.reverse();
  } catch {}

  return path;
}

function _getClickedMarkmapNodeInfo(ev) {
  const nodeEl = _getClickedMarkmapNodeEl(ev);
  if (!nodeEl) return null;

  let datum = null;

  try {
    if (window.d3?.select) datum = window.d3.select(nodeEl).datum();
  } catch {}

  const sourceLine = _findSourceLineInMarkmapDatum(datum);

  const fo = nodeEl.querySelector?.('foreignObject');
  const div = fo?.querySelector?.('div');

  const text = _cleanNodeTextForMatch(div?.textContent || nodeEl.textContent || '');

  const norm = _normalizeHeadingText(stripHeadingPrefix(text));

  const pathNorms = _getMarkmapNodePathNorms(nodeEl);

  return {
    nodeEl,
    text,
    norm,
    pathNorms,
    pathKey: pathNorms.join(' > '),
    sourceLine,
    datum,
  };
}

function _findSourceLineInMarkmapDatum(datum) {
  try {
    const candidates = [
      datum?.data?.payload?.lines,
      datum?.data?.payload?.line,
      datum?.data?.payload?.startLine,
      datum?.data?.payload?.position,
      datum?.data?.payload?.range,
      datum?.data?.lines,
      datum?.data?.line,
      datum?.payload?.lines,
      datum?.payload?.line,
      datum?.payload?.startLine,
      datum?.lines,
      datum?.line,
    ];

    for (const value of candidates) {
      const line = _normalizePossibleSourceLine(value);

      if (typeof line === 'number' && Number.isFinite(line) && line >= 0) {
        return line;
      }
    }
  } catch {}

  return null;
}

function _normalizePossibleSourceLine(value) {
  if (value == null) return null;

  // Common case: payload.lines = [start, end]
  if (Array.isArray(value)) {
    for (const item of value) {
      const line = _normalizePossibleSourceLine(item);
      if (typeof line === 'number') return line;
    }

    return null;
  }

  // Object case: { start: 10 }, { line: 10 }, etc.
  if (typeof value === 'object') {
    const keys = ['start', 'startLine', 'line', 'from', 'offset', 'index'];

    for (const key of keys) {
      const line = _normalizePossibleSourceLine(value[key]);
      if (typeof line === 'number') return line;
    }

    return null;
  }

  if (typeof value === 'number') {
    // Most Markmap/Markdown line references are zero-based.
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === 'string') {
    const n = parseInt(value, 10);
    if (Number.isFinite(n)) return Math.max(0, n);
  }

  return null;
}

function jumpEditorToHeadingFromNodeText(nodeText, nodeInfo = null) {
  const labelNorm = _normalizeHeadingText(stripHeadingPrefix(_cleanNodeTextForMatch(nodeText)));

  if (!labelNorm) return false;

  // 0) Best possible match:
  // use Markmap's own source-line metadata if available.
  if (
    nodeInfo &&
    typeof nodeInfo.sourceLine === 'number' &&
    Number.isFinite(nodeInfo.sourceLine) &&
    nodeInfo.sourceLine >= 0
  ) {
    _scrollEditorToLine(nodeInfo.sourceLine, 'markmap source line match');

    return true;
  }

  const headings = _extractHeadingPathsFromMarkdown(md.value);
  if (!headings.length) return false;

  const curLine = _getCurrentEditorLine();

  // 1) Best match: full Markmap path/context.
  if (nodeInfo?.pathKey) {
    const pathMatches = headings.filter((h) => {
      if (!h.pathKey) return false;

      return (
        h.pathKey === nodeInfo.pathKey ||
        h.pathKey.endsWith(' > ' + nodeInfo.pathKey) ||
        nodeInfo.pathKey.endsWith(' > ' + h.pathKey)
      );
    });

    if (pathMatches.length) {
      const chosen =
        pathMatches.length === 1 ? pathMatches[0] : _pickClosestByLine(pathMatches, curLine);

      _scrollEditorToLine(chosen.lineNo, 'path heading match');

      return true;
    }
  }

  // 2) Exact heading text fallback.
  const exact = headings.filter((h) => h.norm === labelNorm).map((h) => ({ ...h, score: 100 }));

  if (exact.length) {
    const chosen = exact.length === 1 ? exact[0] : _pickClosestByLine(exact, curLine);

    _scrollEditorToLine(chosen.lineNo, 'exact heading match');

    return true;
  }

  // 3) Fuzzy heading fallback.
  const scored = headings
    .map((h) => ({
      ...h,
      score: _scoreFuzzy(labelNorm, h.norm),
    }))
    .filter((h) => h.score >= 45);

  if (!scored.length) return false;

  const maxScore = Math.max(...scored.map((x) => x.score));
  const top = scored.filter((x) => x.score === maxScore);

  const chosen = top.length === 1 ? top[0] : _pickClosestByLine(top, curLine);

  _scrollEditorToLine(chosen.lineNo, `fuzzy heading match score=${chosen.score}`);

  return true;
}

function stripHeadingPrefix(text) {
  return text.replace(/^\d+\)\s*/, '').trim();
}

function _getClickedMarkmapNodeText(ev) {
  let el = ev?.target;
  while (el && el !== mapSvg) {
    if (el.classList && el.classList.contains('markmap-node')) break;
    el = el.parentNode;
  }
  if (!el || el === mapSvg) return null;
  const fo = el.querySelector?.('foreignObject');
  const div = fo?.querySelector?.('div');
  return (div?.textContent || el.textContent || '').trim();
}

let _markmapJumpAttached = false;
function attachMarkmapClickJump() {
  if (_markmapJumpAttached) return;
  if (!mapSvg) return;
  mapSvg.addEventListener('click', (ev) => {
    const nodeEl = ev.target.closest('.markmap-node');

    if (nodeEl) {
      // Remove previous active node
      mapSvg
        .querySelectorAll('.markmap-node.__active')
        .forEach((n) => n.classList.remove('__active'));

      // Mark clicked node as active
      nodeEl.classList.add('__active');
    }

    const nodeInfo = _getClickedMarkmapNodeInfo(ev);
    const t = nodeInfo?.text || _getClickedMarkmapNodeText(ev);

    if (!t) return;

    const ok = jumpEditorToHeadingFromNodeText(t, nodeInfo);

    if (!ok) {
      log(
        `MarkmapJump: no heading match for "${t}"` +
          (nodeInfo?.pathKey ? ` path="${nodeInfo.pathKey}"` : '')
      );
    }
  });
  _markmapJumpAttached = true;
  log('MarkmapJump: attached (node click → editor source line/heading)');
}
attachMarkmapClickJump();

window.__suppressBlurRenderUntil = 0;
function suppressNextBlurRender(ms) {
  window.__suppressBlurRenderUntil = Date.now() + (ms || 900);
}
mapSvg.addEventListener('pointerdown', () => suppressNextBlurRender(900), true);
mapSvg.addEventListener('mousedown', () => suppressNextBlurRender(900), true);

function toggleLogs() {
  const willShow = logs.style.display !== 'block';
  logs.style.display = willShow ? 'block' : 'none';
  log(`Logs ${willShow ? 'OPEN' : 'CLOSED'}`);
  setShowHideLabel('btnLogs', willShow, 'Logs');
  syncToolbarHeight();
}

// Editor visibility logic now lives in js/editor/editor-visibility.js (R-SPLIT3).
// Keep a lightweight compatibility wrapper so existing references in main.js keep working.
let editorWasVisible = true;
let lastEditorWidth = null;

function toggleEditor() {
  try {
    if (typeof globalThis.toggleEditor === 'function') {
      globalThis.toggleEditor();
      editorWasVisible = !document.body.classList.contains('editor-hidden');
      return;
    }
    // Fallback if module not loaded.
    editorWasVisible = !(editorEl.style.display === 'none');
    const willShow = editorWasVisible;
    if (!willShow) {
      lastEditorWidth = editorEl.style.width || editorEl.getBoundingClientRect().width + 'px';
      editorEl.style.display = 'none';
      splitEditorEl.style.display = 'none';
      document.body.classList.add('editor-hidden');
      log(`Editor HIDE (saved width=${lastEditorWidth})`);
      setShowHideLabel('btnToggleEditor', false, 'Editor');
      syncToolbarHeight();
      return;
    }
    editorEl.style.display = 'block';
    splitEditorEl.style.display = 'block';
    document.body.classList.remove('editor-hidden');
    if (lastEditorWidth) editorEl.style.width = lastEditorWidth;
    log(`Editor SHOW (restored width=${lastEditorWidth || '(default)'})`);
    setShowHideLabel('btnToggleEditor', true, 'Editor');
    syncToolbarHeight();
  } catch (e) {
    log(`❌ toggleEditor() failed: ${e?.message || e}`);
  }
}

// Global expand level +1/-1
let globalExpandLevel = null;

function walkTree(node, cb, depth = 0) {
  if (!node) return;
  cb(node, depth);
  const kids = node.children || [];
  for (const c of kids) walkTree(c, cb, depth + 1);
}

function getMaxDepth(node) {
  let max = 0;
  walkTree(node, (_n, d) => {
    if (d > max) max = d;
  });
  return max;
}

function inferCurrentExpandLevel(node) {
  const maxDepth = getMaxDepth(node);
  let minFoldDepth = Infinity;
  walkTree(node, (n, depth) => {
    const hasChildren = n.children && n.children.length > 0;
    const f = n?.payload?.fold;
    if (hasChildren && typeof f === 'number' && f > 0) {
      if (depth < minFoldDepth) minFoldDepth = depth;
    }
  });
  if (minFoldDepth === Infinity) return maxDepth + 1;
  return Math.max(1, minFoldDepth + 1);
}

function applyExpandLevelToTree(node, level) {
  walkTree(node, (n, depth) => {
    const hasChildren = n.children && n.children.length > 0;
    if (!hasChildren) return;
    n.payload = n.payload || {};
    if (depth < level - 1) n.payload.fold = 0;
    else n.payload.fold = 1;
  });
}

async function changeGlobalLevel(delta) {
  try {
    if (!mm?.state?.data) {
      log('⚠️ Level change ignored: mindmap not ready yet');
      return;
    }
    const data = mm.state.data;
    const maxDepth = getMaxDepth(data);
    const minLevel = 1;
    const maxLevel = maxDepth + 1;
    if (globalExpandLevel == null) {
      globalExpandLevel = inferCurrentExpandLevel(data);
      log(
        `Level init: inferred globalExpandLevel=${globalExpandLevel} (min=${minLevel}, max=${maxLevel})`
      );
    }
    const next = Math.min(maxLevel, Math.max(minLevel, globalExpandLevel + delta));
    if (next === globalExpandLevel) {
      log(
        `Level change blocked: already at limit (level=${globalExpandLevel}, min=${minLevel}, max=${maxLevel})`
      );
      return;
    }
    globalExpandLevel = next;
    log(`Level change: applying globalExpandLevel=${globalExpandLevel} (delta=${delta})`);
    applyExpandLevelToTree(data, globalExpandLevel);
    const prevView = getCurrentViewState();
    await mm.setData(data, { initialExpandLevel: 999 });
    if (prevView) applyViewState(prevView, 'level change: restore view');
    foldMap = captureFoldMapFromMm();
    const c = countFoldedInTree(mm.state.data);
    foldDbg(
      `level change done: level=${globalExpandLevel} nodes=${c.totalNodes} folded=${c.foldedNodes} zero=${c.explicitZero} undef=${c.undefinedFold}`
    );
  } catch (e) {
    log(`❌ changeGlobalLevel() failed: ${e?.message || e}`);
  }
}

// ================================
// Map Overlay Controls
// ================================
function updateMapOverlayThemeButton() {
  try {
    const btn = document.getElementById('mapBtnTheme');
    if (!btn) return;

    const isDark = document.documentElement.classList.contains('dark');
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  } catch {}
}

function wireMapOverlayControls() {
  try {
    const overlay = document.getElementById('mapOverlayControls');
    const btnUp = document.getElementById('mapBtnLevelUp');
    const btnDown = document.getElementById('mapBtnLevelDown');
    const btnFit = document.getElementById('mapBtnFit');
    const btnExpand = document.getElementById('mapBtnExpandAll');
    const btnCollapse = document.getElementById('mapBtnCollapseAll');
    const btnTheme = document.getElementById('mapBtnTheme');

    if (!overlay) {
      try {
        log('Map overlay controls: overlay not found');
      } catch {}
      return;
    }

    // Prevent clicks on overlay from becoming map drag/node-click events.
    ['pointerdown', 'mousedown', 'click', 'dblclick', 'wheel', 'touchstart'].forEach((evt) => {
      overlay.addEventListener(
        evt,
        (e) => {
          e.stopPropagation();
        },
        { passive: evt === 'wheel' || evt === 'touchstart' }
      );
    });

    if (btnUp && !btnUp.__bound) {
      btnUp.addEventListener('click', () => {
        changeGlobalLevel(+1);
      });
      btnUp.__bound = true;
    }

    if (btnDown && !btnDown.__bound) {
      btnDown.addEventListener('click', () => {
        changeGlobalLevel(-1);
      });
      btnDown.__bound = true;
    }

    if (btnFit && !btnFit.__bound) {
      btnFit.addEventListener('click', () => {
        try {
          if (!mm) {
            showToast('Map not ready yet', 'error', 1800);
            return;
          }

          mm.fit();
          showToast('Map fitted ✓', 'ok');
          scheduleViewStateSave('overlay fit');
        } catch (e) {
          log(`❌ overlay fit map failed: ${e?.message || e}`);
        }
      });
      btnFit.__bound = true;
    }

    if (btnExpand && !btnExpand.__bound) {
      btnExpand.addEventListener('click', () => {
        setAllNodesFolded(0);
      });
      btnExpand.__bound = true;
    }

    if (btnCollapse && !btnCollapse.__bound) {
      btnCollapse.addEventListener('click', () => {
        setAllNodesFolded(1);
      });
      btnCollapse.__bound = true;
    }

    if (btnTheme && !btnTheme.__bound) {
      btnTheme.addEventListener('click', async () => {
        try {
          if (typeof window.toggleDarkMode === 'function') {
            await window.toggleDarkMode();
          } else {
            showToast('Dark mode function not ready', 'error', 2200);
          }

          updateMapOverlayThemeButton();
        } catch (e) {
          const msg = e?.message || String(e);
          try {
            log('❌ overlay dark mode failed: ' + msg);
          } catch {}
          showToast('Dark mode error: ' + msg, 'error', 3200);
        }
      });

      btnTheme.__bound = true;
    }

    updateMapOverlayThemeButton();

    try {
      log('Map overlay controls: wired');
    } catch {}
  } catch (e) {
    try {
      log('❌ wireMapOverlayControls failed: ' + (e?.message || e));
    } catch {}
  }
}

wireMapOverlayControls();

// S2 — wire the pane registry after overlay controls exist.
ensureMapHideButton();
initViewLayoutRegistry();

// ================================
// Markmap Style Modifier MVP
// ================================
function getThemeVarsForCurrentMode(themeId) {
  const theme = MAP_THEME_PRESETS[themeId] || MAP_THEME_PRESETS.default;

  if (themeId === 'default') {
    const isDark = document.documentElement.classList.contains('dark');
    return isDark ? theme.dark : theme.light;
  }

  return theme.vars || MAP_THEME_PRESETS.default.light;
}

function applyMapStyleCss() {
  try {
    const pane = document.getElementById('mapPane');
    const svg = document.getElementById('mapSvg');
    if (!pane) return;

    const isDefaultTheme = mapStyleState.theme === 'default';
    const link = MAP_LINK_PRESETS[mapStyleState.linkStyle] || MAP_LINK_PRESETS.solid;

    pane.classList.toggle('mme-map-styled', !isDefaultTheme);

    // Link style is independent from color.
    // Markmap handles color; CSS handles dash/width.
    pane.style.setProperty('--mme-mm-link-dash', link.dash);
    pane.style.setProperty('--mme-mm-link-width', link.width);

    if (isDefaultTheme) {
      pane.style.removeProperty('--mme-map-bg');
      pane.style.removeProperty('--mme-mm-text');
      pane.style.removeProperty('--mme-mm-active');

      if (svg) {
        svg.style.removeProperty('background');
      }

      return;
    }

    const vars = getThemeVarsForCurrentMode(mapStyleState.theme);

    pane.style.setProperty('--mme-map-bg', vars.mapBg);
    pane.style.setProperty('--mme-mm-text', vars.text);
    pane.style.setProperty('--mme-mm-active', vars.active);

    if (svg) {
      svg.style.background = vars.mapBg;
    }
  } catch (e) {
    try {
      log('❌ applyMapStyleCss failed: ' + (e?.message || e));
    } catch {}
  }
}

async function applyMapLayoutOptions() {
  try {
    if (!mm) return;

    const opts = getCurrentMapLayoutOptions();
    try {
      log(
        `Map style options: theme=${mapStyleState.theme} color=${opts.color ? 'set' : 'none'} freeze=${opts.colorFreezeLevel ?? '(none)'}`
      );
    } catch {}

    const prevView = typeof getCurrentViewState === 'function' ? getCurrentViewState() : null;

    if (typeof mm.setOptions === 'function') {
      mm.setOptions(opts);
    } else {
      mm.options = {
        ...(mm.options || {}),
        ...opts,
      };
    }

    if (mm.state?.data && typeof mm.setData === 'function') {
      await mm.setData(mm.state.data, { initialExpandLevel: 999 });
    }

    if (prevView && typeof applyViewState === 'function') {
      applyViewState(prevView, 'map style layout: restore view');
    }

    if (typeof scheduleViewStateSave === 'function') {
      scheduleViewStateSave('map style layout');
    }
  } catch (e) {
    try {
      log('❌ applyMapLayoutOptions failed: ' + (e?.message || e));
    } catch {}
  }
}

async function applyMapStyleState({ save = true, layout = true } = {}) {
  applyMapStyleCss();

  if (layout) {
    await applyMapLayoutOptions();
  }

  if (save) {
    saveMapStyleState();
  }

  try {
    renderMapStyleModalChoices();
  } catch {}
}

function resetMapStyleToDefault() {
  mapStyleState = { ...MAP_STYLE_DEFAULT_STATE };
  applyMapStyleState({ save: true, layout: true });
  showToast('Map style reset ✓', 'ok', 2200);
  try {
    log('Map style: reset to default');
  } catch {}
}

function openMapStyleModal() {
  const modal = document.getElementById('mapStyleModal');
  if (!modal) return;

  renderMapStyleModalChoices();
  modal.style.display = 'flex';
}

function closeMapStyleModal() {
  const modal = document.getElementById('mapStyleModal');
  if (!modal) return;

  modal.style.display = 'none';
}

function makeStyleChoice({ group, id, label, sub, selected, swatches }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'styleChoice' + (selected ? ' __selected' : '');
  btn.dataset.group = group;
  btn.dataset.id = id;

  const title = document.createElement('div');
  title.className = 'styleChoiceTitle';
  title.textContent = label;

  const subtitle = document.createElement('div');
  subtitle.className = 'styleChoiceSub';
  subtitle.textContent = sub || '';

  btn.appendChild(title);
  btn.appendChild(subtitle);

  if (Array.isArray(swatches) && swatches.length) {
    const sw = document.createElement('div');
    sw.className = 'styleSwatches';

    swatches.forEach((color) => {
      const dot = document.createElement('span');
      dot.className = 'styleSwatch';
      dot.style.background = color;
      sw.appendChild(dot);
    });

    btn.appendChild(sw);
  }

  btn.addEventListener('click', async () => {
    if (group === 'theme') {
      mapStyleState.theme = id;

      // Theme now affects native Markmap color options,
      // so we need to reapply options and refresh data.
      await applyMapStyleState({ save: true, layout: true });

      showToast(`Map theme: ${label}`, 'ok', 1600);
    }

    if (group === 'layout') {
      mapStyleState.layout = id;
      await applyMapStyleState({ save: true, layout: true });
      showToast(`Map layout: ${label}`, 'ok', 1600);
    }

    if (group === 'nodeLength') {
      mapStyleState.nodeLength = id;
      await applyMapStyleState({ save: true, layout: true });
      showToast(`Node length: ${label}`, 'ok', 1600);
    }

    if (group === 'linkStyle') {
      mapStyleState.linkStyle = id;
      await applyMapStyleState({ save: true, layout: false });
      showToast(`Link style: ${label}`, 'ok', 1600);
    }

    try {
      log(`Map style: ${group}=${id}`);
    } catch {}
  });

  return btn;
}

function renderMapStyleModalChoices() {
  const themeHost = document.getElementById('mapStyleThemeOptions');
  const layoutHost = document.getElementById('mapStyleLayoutOptions');
  const nodeLengthHost = document.getElementById('mapStyleNodeLengthOptions');
  const linkHost = document.getElementById('mapStyleLinkOptions');

  if (!themeHost || !layoutHost || !nodeLengthHost || !linkHost) {
    try {
      log(
        '❌ Map style modal render failed: missing host(s) ' +
          JSON.stringify({
            themeHost: !!themeHost,
            layoutHost: !!layoutHost,
            nodeLengthHost: !!nodeLengthHost,
            linkHost: !!linkHost,
          })
      );
    } catch {}

    return;
  }

  themeHost.innerHTML = '';
  layoutHost.innerHTML = '';
  nodeLengthHost.innerHTML = '';
  linkHost.innerHTML = '';

  Object.entries(MAP_THEME_PRESETS).forEach(([id, preset]) => {
    themeHost.appendChild(
      makeStyleChoice({
        group: 'theme',
        id,
        label: preset.label,
        sub: preset.sub,
        selected: mapStyleState.theme === id,
        swatches: preset.swatches,
      })
    );
  });

  Object.entries(MAP_LAYOUT_PRESETS).forEach(([id, preset]) => {
    layoutHost.appendChild(
      makeStyleChoice({
        group: 'layout',
        id,
        label: preset.label,
        sub: `${preset.sub} · spacing ${preset.spacingHorizontal}/${preset.spacingVertical}`,
        selected: mapStyleState.layout === id,
      })
    );
  });

  Object.entries(NODE_LENGTH_PRESETS).forEach(([id, preset]) => {
    nodeLengthHost.appendChild(
      makeStyleChoice({
        group: 'nodeLength',
        id,
        label: preset.label,
        sub: `${preset.sub} · max ${preset.maxWidth}px`,
        selected: mapStyleState.nodeLength === id,
      })
    );
  });

  Object.entries(MAP_LINK_PRESETS).forEach(([id, preset]) => {
    linkHost.appendChild(
      makeStyleChoice({
        group: 'linkStyle',
        id,
        label: preset.label,
        sub: preset.sub,
        selected: mapStyleState.linkStyle === id,
      })
    );
  });
}

function wireMapStyleModifier() {
  try {
    const btn = document.getElementById('mapBtnStyle');
    const modal = document.getElementById('mapStyleModal');
    const btnClose = document.getElementById('mapStyleClose');
    const btnReset = document.getElementById('mapStyleReset');
    const btnApply = document.getElementById('mapStyleApply');

    if (btn && !btn.__bound) {
      btn.addEventListener('click', () => {
        openMapStyleModal();
      });
      btn.__bound = true;
    }

    if (btnClose && !btnClose.__bound) {
      btnClose.addEventListener('click', closeMapStyleModal);
      btnClose.__bound = true;
    }

    if (btnReset && !btnReset.__bound) {
      btnReset.addEventListener('click', resetMapStyleToDefault);
      btnReset.__bound = true;
    }

    if (btnApply && !btnApply.__bound) {
      btnApply.addEventListener('click', async () => {
        await applyMapStyleState({ save: true, layout: true });
        showToast('Map style applied ✓', 'ok', 1800);
        closeMapStyleModal();
      });
      btnApply.__bound = true;
    }

    if (modal && !modal.__bound) {
      modal.addEventListener('mousedown', (e) => {
        if (e.target === modal) closeMapStyleModal();
      });

      ['pointerdown', 'mousedown', 'click', 'dblclick', 'wheel', 'touchstart'].forEach((evt) => {
        modal.addEventListener(
          evt,
          (e) => {
            e.stopPropagation();
          },
          { passive: evt === 'wheel' || evt === 'touchstart' }
        );
      });

      modal.__bound = true;
    }

    if (!document.__mapStyleEscapeBound) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMapStyleModal();
      });
      document.__mapStyleEscapeBound = true;
    }

    applyMapStyleState({ save: false, layout: false });

    try {
      log('Map style modifier: wired');
    } catch {}
  } catch (e) {
    try {
      log('❌ wireMapStyleModifier failed: ' + (e?.message || e));
    } catch {}
  }
}

wireMapStyleModifier();

try {
  const __themeObserver = new MutationObserver(() => {
    updateMapOverlayThemeButton();

    if (typeof applyMapStyleCss === 'function') {
      applyMapStyleCss();
    }
  });

  __themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
} catch {}

// ================================
// Compact Mode toggle
// ================================
const btnCompact = document.getElementById('btnCompact');
if (btnCompact) {
  btnCompact.addEventListener('click', () => {
    document.documentElement.classList.toggle('compact');
    syncToolbarHeight();
  });
}

// S1: minimum resizable pane widths (px). These are small usability floors for the
// splitter drag only. They are deliberately far below the natural local-toolbar/
// overlay widths so a pane can shrink below its controls (the toolbar never defines
// the pane minimum). No snap-to-hide, no auto-hide, no persistent migration needed.
const MIN_EDITOR_PX = 96;
const MIN_MAP_PX = 140;
const MIN_HTML_PX = 140;
// Hint width (px) at which a hidden HTML pane is considered intentionally revealed
// by the user dragging the #splitHtml splitter. Kept below MIN_HTML_PX so content
// appears before the usability minimum, and large enough to ignore tiny movement.
const HTML_REVEAL_THRESHOLD = 90;
// Guards the single hidden->visible HTML show during one #splitHtml drag.
let _splitHtmlDragShown = false;

// S4B: pane splitter drag lifecycle migrated from mouse-only events to one
// unified Pointer Events path (mouse, touch, and pen). Geometry, minimums,
// clamping, callbacks, and the #splitHtml drag-to-open behavior are unchanged;
// only the input lifecycle was replaced. A shared idempotent finalizer prevents
// double finalization across pointerup / pointercancel / lostpointercapture.
// Pointer capture keeps the drag alive when the finger leaves the touch lane.
function makeResizable(splitter, left, container, getMaxWidth, getMinWidth, onDrag, onDragStart) {
  let dragging = false,
    activePointerId = null,
    startX = 0,
    startW = 0,
    finalized = false;
  // Shared cleanup: runs exactly once per drag, safe to call from
  // pointerup, pointercancel, or lostpointercapture.
  const finalize = (reason) => {
    if (finalized) return;
    finalized = true;
    if (dragging) log(reason === 'cancel' ? 'Splitter drag cancel' : 'Splitter drag end');
    dragging = false;
    activePointerId = null;
    try {
      if (typeof splitter.releasePointerCapture === 'function' &&
          typeof splitter.hasPointerCapture === 'function' &&
          activePointerId !== null &&
          splitter.hasPointerCapture(activePointerId)) {
        splitter.releasePointerCapture(activePointerId);
      }
    } catch {}
  };
  splitter.addEventListener('pointerdown', (e) => {
    if (dragging && activePointerId !== null && e.pointerId !== activePointerId) return; // one pointer at a time
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return; // primary button only
    } else if (e.isPrimary === false) {
      return; // touch/pen: primary pointer only where supported
    }
    finalized = false;
    activePointerId = e.pointerId;
    startX = e.clientX;
    startW = left.getBoundingClientRect().width;
    dragging = true;
    log(`Splitter drag start (${splitter.id || 'splitter'}, ${e.pointerType})`);
    try {
      if (typeof splitter.setPointerCapture === 'function') splitter.setPointerCapture(e.pointerId);
    } catch {}
    e.preventDefault(); // only for this splitter gesture
    if (typeof onDragStart === 'function') onDragStart();
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== activePointerId) return;
    const dx = e.clientX - startX;
    let w = startW + dx;
    const minW = getMinWidth ? getMinWidth() : 200;
    const maxW = getMaxWidth ? getMaxWidth() : container.getBoundingClientRect().width - 200;
    if (w < minW) w = minW;
    if (w > maxW) w = maxW;
    left.style.width = w + 'px';
    left.style.flex = `0 0 ${w}px`;
    constrainHtmlControlsToPane();
    if (typeof onDrag === 'function') onDrag();
    e.preventDefault(); // only during the active splitter drag
  });
  window.addEventListener('pointerup', (e) => {
    if (e.pointerId !== activePointerId) return;
    finalize('end');
  });
  window.addEventListener('pointercancel', (e) => {
    if (e.pointerId !== activePointerId) return;
    finalize('cancel');
  });
  splitter.addEventListener('lostpointercapture', (e) => {
    // Capture loss alone must not duplicate the pointerup finalization.
    if (dragging && activePointerId === e.pointerId) finalize('cancel');
  });
}

makeResizable(
  document.getElementById('splitEditor'),
  document.getElementById('editor'),
  document.getElementById('layout'),
  () => document.getElementById('layout').getBoundingClientRect().width - 300,
  () => MIN_EDITOR_PX
);

makeResizable(
  document.getElementById('splitHtml'),
  document.getElementById('mapPane'),
  document.getElementById('viewer'),
  () => {
    const viewerW = document.getElementById('viewer').getBoundingClientRect().width;
    const htmlVisible = htmlPane.style.display === 'block';
    const htmlMin = htmlVisible ? MIN_HTML_PX : 0;
    const splitterW = document.getElementById('splitHtml').getBoundingClientRect().width || 6;
    return viewerW - htmlMin - splitterW;
  },
  () => MIN_MAP_PX,
  () => {
    // S1 drag-to-open: when HTML is hidden and the user drags #splitHtml to free
    // room for it, treat the gesture as an explicit reopen via the canonical show
    // path (single source of truth). Fires at most once per drag.
    try {
      if (htmlPane.style.display !== 'block') {
        const viewerEl = document.getElementById('viewer');
        const splitEl = document.getElementById('splitHtml');
        const mapEl = document.getElementById('mapPane');
        const viewerW = viewerEl.getBoundingClientRect().width;
        const splitterW = splitEl.getBoundingClientRect().width || 6;
        const mapW = mapEl.getBoundingClientRect().width;
        const availHtml = viewerW - mapW - splitterW;
        if (availHtml > HTML_REVEAL_THRESHOLD && !_splitHtmlDragShown) {
          _splitHtmlDragShown = true;
          showHtmlPreview();
        }
      }
    } catch (e) {
      try { log(`HTML drag-to-open failed: ${e?.message || e}`); } catch {}
    }
  },
  () => {
    _splitHtmlDragShown = false;
  }
);

function isTopLevel() {
  try {
    return window.self === window.top;
  } catch {
    return false;
  }
}
function openPickerUsable() {
  return isTopLevel() && window.isSecureContext && 'showOpenFilePicker' in window;
}
function savePickerUsable() {
  return isTopLevel() && window.isSecureContext && 'showSaveFilePicker' in window;
}

function normalizeMdName(name) {
  const n = (name || 'markmap.md').trim() || 'markmap.md';
  return n.toLowerCase().endsWith('.md') ? n : n + '.md';
}
function todayStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function addDateSuffixForDownload(filename) {
  const safe = normalizeMdName(filename);
  const base = safe.replace(/\.md$/i, '');
  return `${base}_${todayStamp()}.md`;
}
function downloadFallback(text, filename) {
  const datedName = addDateSuffixForDownload(filename);
  log(`downloadFallback(): downloading "${datedName}" (${text.length} chars)`);
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = datedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  dirty = false;
  setStatus(`Downloaded ✓ ${datedName}`);
  showToast(`Downloaded ✓ ${datedName}`, 'download');
  log('downloadFallback(): done');
  updateDocumentTitle();
  clearDraft(currentFileName); // successful save clears draft
}

async function ensureWritePermission(handle) {
  try {
    if (!handle?.queryPermission || !handle?.requestPermission) {
      log('ensureWritePermission(): permission API not available -> assume OK');
      return true;
    }
    const q = await handle.queryPermission({ mode: 'readwrite' });
    log(`ensureWritePermission(): queryPermission(readwrite) => ${q}`);
    if (q === 'granted') return true;
    if (q === 'prompt') {
      const r = await handle.requestPermission({ mode: 'readwrite' });
      log(`ensureWritePermission(): requestPermission(readwrite) => ${r}`);
      return r === 'granted';
    }
    return false;
  } catch (e) {
    log(`ensureWritePermission() error: ${e?.message || e}`);
    return false;
  }
}

async function saveToHandle(handle, text) {
  log('saveToHandle(): begin');
  const ok = await ensureWritePermission(handle);
  if (!ok) throw new Error('Write permission denied');
  const writable = await handle.createWritable();
  log('saveToHandle(): writable opened');
  await writable.write(text);
  log(`saveToHandle(): wrote ${text.length} chars`);
  await writable.close();
  if (typeof hotAfterSave === 'function') await hotAfterSave();
  log('saveToHandle(): closed');
  log('saveToHandle(): success');
  dirty = false;
  setStatus(`Saved ✓ ${currentFileName}`);
  showToast(`Saved ✓ ${currentFileName}`, 'ok');
  updateDocumentTitle();
  clearDraft(currentFileName); // successful save clears draft

  if (globalThis.WORKSPACE_STATE?.activeFile) {
    globalThis.scheduleWorkspaceIndexRebuild?.('save');
  }
}

async function openSmart() {
  log('openSmart(): begin (try writable first)');
  if (openPickerUsable()) {
    try {
      log('openSmart(): using showOpenFilePicker (writable)');
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: 'Markdown',
            accept: { 'text/markdown': ['.md', '.markdown', '.txt'] },
          },
        ],
      });
      currentSaveHandle = handle;
      hotStart('openSmart');
      const f = await handle.getFile();
      currentFileName = f.name || 'markmap.md';
      updateDocumentTitle();
      await addRecentFile(handle, currentFileName);
      log(`🕘 Recents: added ${currentFileName}`);
      const openedText = await f.text();
      md.value = openedText;
      if (window.__cmSetText) window.__cmSetText(md.value);
      dirty = false;
      setStatus(modeLabel());
      log(`openSmart(): loaded WRITABLE "${currentFileName}" (${f.size} bytes)`);

      // ACT G2C: When a saved Report is reopened through the normal Open
      // workflow, classify it as a Report, clear stale workspace activeFile,
      // establish saved Report identity, and keep ACT D exclusion active.
      if (typeof isSavedReportMarkdown === 'function' && isSavedReportMarkdown(openedText)) {
        __virtualReportSession = {
          kind: 'report',
          virtual: false,
          saved: true,
          sourcePath: null,
          suggestedFilename: currentFileName,
        };
        // Clear stale workspace activeFile (previous Journal/Concept).
        if (globalThis.WORKSPACE_STATE) {
          globalThis.WORKSPACE_STATE.activeFile = null;
        }
        globalThis.persistActiveWorkspaceFile?.();
        window.updateWorkspaceActiveFileHighlight?.();
        // Clear Task baseline so ACT D stays excluded for the Report.
        __taskBaseline = null;
        // Refresh Report panel availability (Generate stays disabled).
        try {
          globalThis.MME_REPORT_PANEL?.refresh?.();
        } catch (e) {
          log?.(`Report: G2C panel refresh failed: ${e?.message || e}`);
        }
        log?.(`Report: G2C reopened saved Report identity kind=report virtual=false saved=true filename=${currentFileName}`);
      } else {
        // Normal external document: clear any stale Report identity.
        if (__virtualReportSession && __virtualReportSession.kind === 'report') {
          __virtualReportSession = null;
          log?.('Report: G2C identity cleared on normal external document open');
          // ACT H3: discard any stale reconciliation session with it.
          try {
            globalThis.MME_DRAWIO_REPORT_PANEL?.resetSession?.('navigation');
          } catch {}
          // ACT H3: refresh the Report panel so the Draw.io button disables.
          try {
            globalThis.MME_REPORT_PANEL?.refresh?.();
          } catch {}
        }
      }

      const restored = maybeRestoreDraftAfterOpen('openSmart(writable)');
      if (!restored) {
        hasAutoFitted = false;
        render('openSmart(writable) render()');
      }

      // ACT G / T1B: capture the post-open Task baseline so the next physical
      // Save can reconcile checkbox changes. Report documents are excluded
      // internally (the saved-report branch above sets report identity).
      captureTaskBaseline();
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') {
        log('openSmart(): user canceled writable picker (AbortError). No fallback.');
        setStatus('Open canceled');
        return;
      }
      log(`openSmart(): writable picker failed -> ${e?.name || ''} ${e?.message || e}`);
      log('openSmart(): falling back to read-only file input...');
    }
  } else {
    log(
      `openSmart(): writable picker not usable. secure=${window.isSecureContext}, api=${'showOpenFilePicker' in window}, top=${isTopLevel()}`
    );
  }
  currentSaveHandle = null;
  hotStop('openSmart fallback');
  fileInput.value = '';
  fileInput.click();
  log('openSmart(): triggered read-only file input');
}

// ================================
// New Document
// ================================
let __newDocCounter = 1;

// Programmatic dirty suppression counter.
// Incremented before programmatic text changes, decremented after.
// When > 0, the 'input' event listener does not set dirty=true.
let __programmaticTextChange = 0;

// ---- ACT D: Conservative pre-save Task reconciliation ----

// Canonical Task text cleaner (uses canonical parser when available).
function getCanonicalTaskText(rawLine) {
  try {
    const parsed = globalThis.parseMarkdownTasks?.(rawLine);
    if (parsed && parsed[0] && typeof parsed[0].text === 'string') {
      return parsed[0].text;
    }
  } catch {}

  const text = String(rawLine || '');
  const match = text.match(/^(\s*[-*+]\s+\[[ xX]\]\s+)(.*)$/);
  if (!match) return text;

  let content = match[2] || '';
  content = content.replace(/<!--\s*mme-task:[\s\S]*?-->/gi, '').trim();
  content = content
    .replace(/#p[123]\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return content;
}

function getLocalIsoDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Narrow public publication for the Task Board Quick View consumer.
// main.js remains the single reader of the system clock; the Board calls this
// public owner and passes `today` explicitly to the pure lifecycle module
// (which never reads the clock itself). No duplicate date calculation is
// introduced in consumer modules.
try {
  globalThis.getLocalIsoDate = getLocalIsoDate;
  window.getLocalIsoDate = getLocalIsoDate;
} catch {}

function rewriteTaskMetadataComment(text, desiredChecked) {
  const str = String(text || '');
  const commentMatch = str.match(/(<!--\s*mme-task:)([\s\S]*?)(\s*-->)/i);

  if (!commentMatch) {
    if (!desiredChecked) return str;
    const today = getLocalIsoDate();
    return `${str.trim()} <!-- mme-task: completed=${today} -->`;
  }

  let inner = String(commentMatch[2] || '').trim();

  if (desiredChecked) {
    const hasCompleted = /(?:^|;\s*)completed\s*=/i.test(inner);
    if (!hasCompleted) {
      inner = inner ? `completed=${getLocalIsoDate()}; ${inner}` : `completed=${getLocalIsoDate()}`;
    }
  } else {
    inner = inner
      .replace(/(?:^|;\s*)completed\s*=\s*[^;]+/i, '')
      .replace(/^;\s*/, '')
      .replace(/;\s*$/, '')
      .trim();
  }

  if (!inner) {
    return str.replace(commentMatch[0], '').trim();
  }

  return `${str.slice(0, commentMatch.index)}<!-- mme-task: ${inner} -->${str.slice(commentMatch.index + commentMatch[0].length)}`;
}

// Task baseline for pre-save reconciliation.
let __taskBaseline = null;

// ACT G: Virtual Report session identity.
let __virtualReportSession = null;

function captureTaskBaseline() {
  // ACT G: Skip baseline capture for Report documents.
  if (__virtualReportSession?.kind === 'report') {
    return;
  }
  try {
    const text = String(md.value || '');
    const tasks = globalThis.parseMarkdownTasks?.(text) || [];
    __taskBaseline = tasks.map((t) => ({
      line: t.line,
      done: t.done,
      text: t.text,
      raw: t.raw,
    }));
  } catch {
    __taskBaseline = null;
  }
}

function reconcileTasksBeforeSave() {
  const currentText = String(md.value || '');
  const currentTasks = globalThis.parseMarkdownTasks?.(currentText) || [];
  const lifecycle = globalThis.MME_TASK_LIFECYCLE;

  // ACT G: Report documents are excluded from Task reconciliation by identity.
  if (__virtualReportSession?.kind === 'report') {
    return {
      changed: false,
      text: currentText,
      skippedReason: 'report-document',
      completedAdded: 0,
      completedRemoved: 0,
      ambiguous: 0,
    };
  }
  if (!__taskBaseline) {
    return {
      changed: false,
      text: currentText,
      skippedReason: 'no-baseline',
      completedAdded: 0,
      completedRemoved: 0,
      ambiguous: 0,
    };
  }
  if (!lifecycle || typeof lifecycle.matchTasksForSave !== 'function') {
    return {
      changed: false,
      text: currentText,
      skippedReason: 'no-lifecycle',
      completedAdded: 0,
      completedRemoved: 0,
      ambiguous: 0,
    };
  }
  if (currentTasks.length === 0) {
    return {
      changed: false,
      text: currentText,
      skippedReason: 'no-tasks',
      completedAdded: 0,
      completedRemoved: 0,
      ambiguous: 0,
    };
  }

  const today = getLocalIsoDate();
  const lines = currentText.split('\n');
  let changed = false;
  let completedAdded = 0;
  let completedRemoved = 0;

  // T1B (ACT D): reorder-safe matching. matchTasksForSave aligns Tasks by
  // canonical text, so a checkbox change on a MOVED Task is still reconciled
  // even though its line number changed. The observed current checkbox is
  // authoritative; applySaveLifecycle only edits the task-local mme-task
  // comment (the checkbox marker is never rewritten here).
  const match = lifecycle.matchTasksForSave(__taskBaseline, currentTasks);
  const ambiguous = match.ambiguous;

  for (const pair of match.pairs) {
    const baseline = __taskBaseline[pair.baseline];
    const current = currentTasks[pair.current];
    if (!baseline || !current) continue;

    // Checkbox-authoritative: only act when the current checkbox disagrees
    // with the baseline completion state.
    if (current.done === baseline.done) continue;

    // IDEMPOTENCE: applySaveLifecycle reports changed=false when the current
    // line already reflects the desired completion state.
    const res = lifecycle.applySaveLifecycle(current.raw, {
      today,
      isNew: false,
      checked: current.done,
      explicitStatus: null,
    });

    if (res.ok && res.changed) {
      const lineIndex = current.line - 1;
      if (lineIndex >= 0 && lineIndex < lines.length) {
        lines[lineIndex] = res.line;
        changed = true;
        if (res.added.completed) completedAdded++;
        if (res.removed.completed) completedRemoved++;
      }
    }
  }

  if (!changed) {
    return { changed: false, text: currentText, completedAdded, completedRemoved, ambiguous };
  }

  return { changed: true, text: lines.join('\n'), completedAdded, completedRemoved, ambiguous };
}

function newDocument() {
  try {
    globalThis.__creatingNewDocument = true;

    logContextState('newDocument before confirm');

    if (dirty) {
      const ok = confirm('Current document has unsaved changes. Create new document anyway?');

      if (!ok) {
        globalThis.__creatingNewDocument = false;
        logContextState('newDocument canceled');
        return;
      }
    }

    const starter = getCurrentContextStarter();

    log(
      `newDocument starter: ${JSON.stringify({
        contextId: starter.contextId,
        defaultFileName: starter.defaultFileName,
        firstLine: String(starter.defaultMarkdown || '').split('\n')[0],
        length: String(starter.defaultMarkdown || '').length,
      })}`
    );

    // Fix 5: Capture previous filename before changing it, so we only clear
    // the NEW filename's draft, not the previous mode's draft.
    const previousFileName = currentFileName;

    try {
      hotStop('newDocument');
    } catch {}

    currentSaveHandle = null;
    externalStale = false;
    externalStaleModified = 0;
    fileLastSeenModified = 0;

    currentFileName = starter.defaultFileName;

    // Fix 6: Suppress programmatic dirty while setting text.
    __programmaticTextChange++;
    try {
      md.value = starter.defaultMarkdown;

      if (typeof window.__cmSetText === 'function') {
        window.__cmSetText(starter.defaultMarkdown);
      } else {
        md.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } finally {
      __programmaticTextChange--;
    }

    dirty = false;
    hasAutoFitted = false;
    forceFitNextRender = true;

    // ACT G / T1B: capture the post-open Task baseline for the new document so
    // the next physical Save can reconcile checkbox changes.
    captureTaskBaseline();

    setStatus(modeLabel());
    updateDocumentTitle();

    // Fix 5: Only clear the new document's draft, not the previous one.
    try {
      clearDraft(currentFileName);
    } catch {}

    render('newDocument');

    showToast(`New document ✓ ${currentFileName}`, 'ok');

    setTimeout(() => {
      log(
        `newDocument after setText: ${JSON.stringify({
          currentFileName,
          firstLine: String(md.value || '').split('\n')[0],
          length: String(md.value || '').length,
          contextId: getSelectedAppContextId(),
        })}`
      );
    }, 250);
  } catch (e) {
    log('❌ newDocument failed: ' + (e?.message || e));
  } finally {
    setTimeout(() => {
      globalThis.__creatingNewDocument = false;
    }, 250);
  }
}

fileInput.addEventListener('change', async (e) => {
  try {
    const f = e.target.files && e.target.files[0];
    if (!f) {
      log('read-only open: no file selected');
      return;
    }
    currentFileName = f.name || 'markmap.md';
    updateDocumentTitle();
    currentSaveHandle = null;
    const openedText = await f.text();
    md.value = openedText;
    if (window.__cmSetText) window.__cmSetText(md.value);
    dirty = false;
    setStatus(modeLabel());
    log(`read-only open: loaded "${currentFileName}" (${f.size} bytes)`);

    // ACT G2C: A normal external document opened read-only must clear any
    // stale Report identity so the Report panel does not remain in
    // "report-already-active" state.
    if (__virtualReportSession && __virtualReportSession.kind === 'report') {
      __virtualReportSession = null;
      log?.('Report: G2C identity cleared on read-only external document open');
      // ACT H3: discard any stale reconciliation session with it.
      try {
        globalThis.MME_DRAWIO_REPORT_PANEL?.resetSession?.('navigation');
      } catch {}
      // ACT H3: refresh the Report panel so the Draw.io button disables.
      try {
        globalThis.MME_REPORT_PANEL?.refresh?.();
      } catch {}
    }

    const restored = maybeRestoreDraftAfterOpen('openSmart(read-only)');
    if (!restored) {
      hasAutoFitted = false;
      render('openSmart(read-only) render()');
    }

    // ACT G / T1B: capture the post-open Task baseline so the next physical
    // Save can reconcile checkbox changes. Report documents are excluded
    // internally (stale Report identity was cleared above for read-only docs).
    captureTaskBaseline();
  } catch (err) {
    log(`❌ read-only open error: ${err?.message || err}`);
  }
});

async function saveAsSmart(text) {
  if (!globalThis.MME_WORKSPACE_CAPABILITIES?.canActive?.('saveAs')) {
    const activeId = globalThis.MME_WORKSPACE_CAPABILITIES?.getActiveId?.() || 'current workspace';
    globalThis.MME_APP?.showToast?.(`Save As is not available in ${activeId}`, 'warn', 2000);
    return { ok: false, reason: 'unavailable' };
  }
  const suggestedName = normalizeMdName(currentFileName);
  log(`saveAsSmart(): begin (suggestedName="${suggestedName}")`);
  if (savePickerUsable()) {
    try {
      log('saveAsSmart(): opening showSaveFilePicker...');
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'Markdown',
            accept: { 'text/markdown': ['.md', '.markdown', '.txt'] },
          },
        ],
      });
      await saveToHandle(handle, text);
      currentSaveHandle = handle;
      captureTaskBaseline();
      dirty = false;
      setStatus(modeLabel());
      log('saveAsSmart(): saved via picker; currentSaveHandle updated');
      return { ok: true };
    } catch (e) {
      if (e && e.name === 'AbortError') {
        log('saveAsSmart(): user canceled Save As dialog (AbortError). No fallback download.');
        setStatus('Save As canceled');
        return { ok: false, reason: 'canceled' };
      }
      log(`saveAsSmart(): picker failed -> ${e?.name || ''} ${e?.message || e}`);
      log('saveAsSmart(): falling back to download...');
    }
  } else {
    log(
      `saveAsSmart(): picker not usable. secure=${window.isSecureContext}, api=${'showSaveFilePicker' in window}, top=${isTopLevel()}`
    );
  }
  downloadFallback(text, suggestedName);
  return { ok: true, reason: 'download' };
}

async function confirmOverwriteExternal() {
  try {
    if (!currentSaveHandle) return true;
    if (!fileLastSeenModified) return true;
    const f = await currentSaveHandle.getFile();
    const lm = f.lastModified || 0;
    if (!lm) return true;
    const changed = lm !== fileLastSeenModified;
    if (!externalStale && !changed) return true;
    const msg =
      'O arquivo "' +
      currentFileName +
      '" foi alterado externamente desde a última versão carregada.\n\nSalvar agora pode sobrescrever mudanças feitas por outro app.\n\nDeseja continuar salvando mesmo assim?';
    const ok = confirm(msg);
    if (!ok) {
      setStatus('Save canceled (external change)');
      showToast('Save canceled — external change detected', 'ok', 2600);
      log('SaveSafeguard: user canceled overwrite');
      return false;
    }
    return true;
  } catch (e) {
    try {
      const ok = confirm(
        'Não foi possível verificar se o arquivo mudou externamente. Deseja continuar salvando?'
      );
      return !!ok;
    } catch {
      return true;
    }
  }
}

async function saveSmart() {
  if (!globalThis.MME_WORKSPACE_CAPABILITIES?.canActive?.('save')) {
    const activeId = globalThis.MME_WORKSPACE_CAPABILITIES?.getActiveId?.() || 'current workspace';
    globalThis.MME_APP?.showToast?.(`Save is not available in ${activeId}`, 'warn', 2000);
    return { ok: false, reason: 'unavailable' };
  }
  log('saveSmart(): begin');

  // ACT D: Conservative pre-save Task reconciliation.
  const reconciled = reconcileTasksBeforeSave();
  let text = md.value;
  if (reconciled.skippedReason) {
    log(
      `TaskReconcile: skipped (${reconciled.skippedReason}); changed=false completed=0 reopened=0 ambiguous=${reconciled.ambiguous || 0}`
    );
  } else if (reconciled.changed) {
    __programmaticTextChange++;
    try {
      md.value = reconciled.text;
      if (typeof window.__cmSetText === 'function') {
        window.__cmSetText(reconciled.text);
      }
      text = reconciled.text;
    } finally {
      __programmaticTextChange--;
    }
    log(
      `TaskReconcile: result changed=true completed=${reconciled.completedAdded} reopened=${reconciled.completedRemoved} ambiguous=${reconciled.ambiguous}`
    );
  } else {
    log(
      `TaskReconcile: no changes needed; changed=false completed=0 reopened=0 ambiguous=${reconciled.ambiguous || 0}`
    );
  }

  if (currentSaveHandle) {
    try {
      log('saveSmart(): attempting overwrite via currentSaveHandle');
      if (!(await confirmOverwriteExternal())) return { ok: false, reason: 'canceled' };
      await saveToHandle(currentSaveHandle, text);
      captureTaskBaseline();
      log('TaskReconcile: baseline refreshed after successful save');
      log('saveSmart(): overwrite OK');
      return { ok: true };
    } catch (e) {
      log(`saveSmart(): overwrite failed -> ${e?.message || e}`);
      log('saveSmart(): falling back to Save As...');
    }
  } else {
    log('saveSmart(): no writable handle -> using Save As');
  }
  const result = await saveAsSmart(text);

  // ACT G: After a successful Save As, mark the Report as saved.
  if (
    result &&
    result.ok === true &&
    __virtualReportSession &&
    __virtualReportSession.kind === 'report'
  ) {
    __virtualReportSession.virtual = false;
    __virtualReportSession.saved = true;
    log('Report: marked saved after Save As');
  }
  return result;
}

// Wiring buttons
document.getElementById('btnOpen').addEventListener('click', () => {
  const isOpen = recentMenu && recentMenu.style.display === 'block';
  if (isOpen) hideRecentMenu();
  else showRecentMenu();
});

document.getElementById('btnSave').addEventListener('click', () =>
  saveSmart().catch((e) => {
    if (e && e.name === 'AbortError') {
      log('saveSmart(): canceled (AbortError) — no toast');
      return;
    }
    const msg = e?.message || String(e);
    log(`saveSmart() error: ${msg}`);
    setStatus(`Save error: ${msg}`);
    showToast(`Save error: ${msg}`, 'error', 3500);
  })
);

const btnCopyMd = document.getElementById('btnCopyMd');
if (btnCopyMd) {
  btnCopyMd.addEventListener('click', copyMarkdownToClipboard);
}

document.getElementById('btnHtml').addEventListener('click', toggleHtml);
document.getElementById('btnLogs').addEventListener('click', toggleLogs);

// HTML preview local panel buttons
function isHtmlPreviewOpen() {
  const pane = document.getElementById('htmlPane');
  return Boolean(pane && pane.style.display === 'block');
}

function ensureHtmlCloseButton() {
  let close = document.getElementById('btnHtmlClose');
  const viewer = document.getElementById('viewer');

  if (!viewer) {
    log?.('HTML Preview close ensure failed: #viewer missing');
    return null;
  }

  if (close) {
    // If close exists inside htmlPane, move it out.
    if (close.parentElement?.id === 'htmlPane') {
      viewer.appendChild(close);
      log?.('HTML Preview close button moved out of htmlPane into viewer');
    }
    return close;
  }

  close = document.createElement('button');
  close.id = 'btnHtmlClose';
  close.type = 'button';
  close.textContent = '\u00d7';
  close.title = 'Close HTML Preview';
  close.setAttribute('aria-label', 'Close HTML Preview');

  // Put close button inside viewer, outside htmlPane.
  viewer.appendChild(close);

  log?.('HTML Preview close button recreated inside viewer');

  return close;
}

function wireHtmlCloseButton() {
  const close = ensureHtmlCloseButton();
  if (!close) return;

  if (close.__htmlCloseBound) return;

  close.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      log?.('HTML Preview close button clicked');

      if (typeof hideHtmlPreview === 'function') {
        hideHtmlPreview();
      } else {
        log?.('HTML Preview close failed: hideHtmlPreview missing');
      }
    },
    true
  );

  close.__htmlCloseBound = true;
  log?.('HTML Preview close button wired');
}

function updateHtmlPreviewButtons() {
  const edge = document.getElementById('btnHtmlEdgeOpen');
  const close = ensureHtmlCloseButton();

  const isOpen = isHtmlPreviewOpen();

  if (edge) {
    edge.textContent = '\u003c/\u003e';
    edge.setAttribute('aria-label', 'Open HTML Preview');
    edge.setAttribute('title', 'Open HTML Preview');

    edge.hidden = isOpen;
    edge.style.display = isOpen ? 'none' : 'inline-flex';
    edge.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
  }

  if (close) {
    close.textContent = '\u00d7';
    close.setAttribute('aria-label', 'Close HTML Preview');
    close.setAttribute('title', 'Close HTML Preview');

    close.hidden = !isOpen;
    close.style.display = isOpen ? 'inline-flex' : 'none';
    close.setAttribute('aria-hidden', isOpen ? 'false' : 'true');

    // Force enough inline style for diagnostics.
    if (isOpen) {
      close.style.visibility = 'visible';
      close.style.opacity = '1';
      close.style.pointerEvents = 'auto';
    }
  }

  if (typeof setHtmlPreviewOpenClass === 'function') {
    setHtmlPreviewOpenClass(isOpen);
  }

  log?.(
    `HTML Preview controls updated open=${isOpen} edge=${Boolean(edge)} close=${Boolean(close)} closeHidden=${close ? close.hidden : '(missing)'} closeDisplay=${close ? close.style.display || '(css)' : '(missing)'}`
  );
}

function ensureHtmlOverlayControls() {
  let overlay = document.getElementById('htmlOverlayControls');

  const viewer = document.getElementById('viewer');

  if (overlay) {
    if (viewer && overlay.parentElement?.id === 'htmlPane') {
      viewer.appendChild(overlay);
      log?.('HTML Preview overlay moved out of htmlPane into viewer');
    }

    return overlay;
  }

  if (!viewer) {
    log?.('HTML Preview overlay ensure failed: #viewer missing');
    return null;
  }

  overlay = document.createElement('div');
  overlay.id = 'htmlOverlayControls';
  overlay.hidden = true;

  overlay.innerHTML = `
    <button
      id="htmlBtnCopyText"
      type="button"
      title="Copy rendered text"
      aria-label="Copy rendered text"
    >
      📋<span class="htmlIconBadge" aria-hidden="true">Aa</span>
    </button>

    <button
      id="htmlBtnCopyHtml"
      type="button"
      title="Copy HTML"
      aria-label="Copy HTML"
    >
      📋<span class="htmlIconBadge" aria-hidden="true">&lt;/&gt;</span>
    </button>

    <button
      id="htmlBtnExport"
      type="button"
      title="Export HTML"
      aria-label="Export HTML"
    >
      ⬇️
    </button>

    <button
      id="htmlBtnTop"
      type="button"
      title="Scroll HTML preview to top"
      aria-label="Scroll HTML preview to top"
    >
      ⤒
    </button>
  `;

  viewer.appendChild(overlay);
  log?.('HTML Preview overlay recreated inside viewer');

  // Re-wire newly created buttons
  if (typeof wireHtmlOverlayControls === 'function') {
    wireHtmlOverlayControls();
  }

  return overlay;
}

function setHtmlPreviewOpenClass(isOpen) {
  document.documentElement.classList.toggle('html-preview-open', Boolean(isOpen));

  const overlay = ensureHtmlOverlayControls();
  ensureHtmlFullscreenButton();

  if (overlay) {
    overlay.hidden = !isOpen;
    overlay.style.display = isOpen ? 'flex' : 'none';
  }

  log?.(
    `HTML Preview open class set open=${Boolean(isOpen)} overlay=${Boolean(
      overlay
    )} hidden=${overlay ? overlay.hidden : '(missing)'} display=${
      overlay ? overlay.style.display || '(css)' : '(missing)'
    }`
  );
}

// Bounds the HTML control surface to the live HTML pane rectangle.
// The controls are reparented under #viewer at runtime, so a viewer-relative
// max-width/right would let them cross the splitter into Markmap when the HTML
// pane is narrow (DEFECT 2). We measure the real #htmlPane box and clamp the
// controls to it. Harmless no-op when HTML is hidden.
function constrainHtmlControlsToPane() {
  try {
    const pane = document.getElementById('htmlPane');
    const viewer = document.getElementById('viewer');
    if (!pane || !viewer) return;

    const isOpen = pane.style.display === 'block';
    const items = ['htmlOverlayControls', 'btnHtmlClose'];
    for (const id of items) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (!isOpen) {
        el.style.maxWidth = '';
        el.style.right = '';
        continue;
      }
      const paneRect = pane.getBoundingClientRect();
      const viewerRect = viewer.getBoundingClientRect();
      const rightInset = 14;
      const avail = Math.max(0, paneRect.width - rightInset);
      const rightOffset = Math.max(0, viewerRect.right - (paneRect.right - rightInset));
      el.style.maxWidth = avail + 'px';
      el.style.right = rightOffset + 'px';
    }
  } catch (e) {
    try { log(`constrainHtmlControlsToPane failed: ${e?.message || e}`); } catch {}
  }
}
window.addEventListener('resize', constrainHtmlControlsToPane);

updateHtmlPreviewButtons();
wireHtmlCloseButton();

document.getElementById('btnHtmlEdgeOpen')?.addEventListener('click', showHtmlPreview);

// Editor visibility (hide/show) is now owned by js/editor/editor-visibility.js (R-SPLIT3).
// The module wires btnToggleEditor / editorBtnHide / btnEditorEdgeOpen itself.
if (
  window.MME_EDITOR_VISIBILITY &&
  !document.getElementById('btnToggleEditor').__editorVisibilityBound
) {
  window.MME_EDITOR_VISIBILITY.wireEditorVisibilityControls();
}

async function copyHtmlPreviewText() {
  const pane = document.getElementById('htmlPane');

  if (!pane) {
    showToast?.('HTML preview not found', 'error', 1800);
    return;
  }

  const text = pane.innerText || pane.textContent || '';

  try {
    await navigator.clipboard.writeText(text);
    showToast?.('HTML text copied', 'ok', 1400);
    log?.('HTML Preview: rendered text copied');
  } catch (e) {
    showToast?.('Could not copy HTML text', 'error', 2200);
    log?.(`HTML Preview: copy text failed: ${e?.message || e}`);
  }
}

async function copyHtmlPreviewHtml() {
  const pane = document.getElementById('htmlPane');

  if (!pane) {
    showToast?.('HTML preview not found', 'error', 1800);
    return;
  }

  const html = pane.innerHTML || '';

  try {
    await navigator.clipboard.writeText(html);
    showToast?.('HTML copied', 'ok', 1400);
    log?.('HTML Preview: HTML copied');
  } catch (e) {
    showToast?.('Could not copy HTML', 'error', 2200);
    log?.(`HTML Preview: copy HTML failed: ${e?.message || e}`);
  }
}

function scrollHtmlPreviewToTop() {
  const pane = document.getElementById('htmlPane');

  if (!pane) return;

  pane.scrollTo({
    top: 0,
    behavior: 'smooth',
  });

  log?.('HTML Preview: scrolled to top');
}

function wireHtmlOverlayControls() {
  const btnCopyText = document.getElementById('htmlBtnCopyText');
  const btnCopyHtml = document.getElementById('htmlBtnCopyHtml');
  const btnExport = document.getElementById('htmlBtnExport');
  const btnTop = document.getElementById('htmlBtnTop');

  if (btnCopyText && !btnCopyText.__bound) {
    btnCopyText.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await copyHtmlPreviewText();
    });

    btnCopyText.__bound = true;
  }

  if (btnCopyHtml && !btnCopyHtml.__bound) {
    btnCopyHtml.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await copyHtmlPreviewHtml();
    });

    btnCopyHtml.__bound = true;
  }

  if (btnExport && !btnExport.__bound) {
    btnExport.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (typeof exportHtmlPreview === 'function') {
        await exportHtmlPreview();
      } else {
        showToast?.('HTML export is not available', 'error', 2200);
        log?.('HTML Preview: exportHtmlPreview missing');
      }
    });

    btnExport.__bound = true;
  }

  if (btnTop && !btnTop.__bound) {
    btnTop.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      scrollHtmlPreviewToTop();
    });

    btnTop.__bound = true;
  }

  log?.('HTML Preview overlay controls wired');
}

wireHtmlOverlayControls();

async function copyMarkdownToClipboard() {
  try {
    await navigator.clipboard.writeText(md.value);
    showToast('Markdown copied ✓', 'ok');
    try {
      log('Editor overlay: markdown copied');
    } catch {}
  } catch (e) {
    showToast('Copy markdown failed', 'error');
    try {
      log('❌ copyMarkdownToClipboard failed: ' + (e?.message || e));
    } catch {}
  }
}

function getCurrentMarkdownText() {
  if (typeof window.__cmGetText === 'function') {
    return window.__cmGetText();
  }

  const mdEl = document.getElementById('md');
  return mdEl?.value || '';
}

function downloadTextFile(text, fileName, mimeType = 'text/markdown;charset=utf-8') {
  const blob = new Blob([text || ''], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'document.md';
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 500);
}

function getMarkdownExportFileName(defaultName = 'document.md') {
  const name =
    typeof currentFileName !== 'undefined' && currentFileName ? currentFileName : defaultName;

  return String(name || defaultName).replace(/\.[^.]+$/, '') + '.md';
}

function exportCurrentMarkdownFile(fileName) {
  const text = getCurrentMarkdownText();
  const safeName = fileName || getMarkdownExportFileName('slides.md');
  downloadTextFile(text, safeName, 'text/markdown;charset=utf-8');
}

function exportMarkdownDownload() {
  try {
    const text = getCurrentMarkdownText();
    const fileName = getMarkdownExportFileName('slides.md');
    downloadTextFile(text, fileName, 'text/markdown;charset=utf-8');
    showToast(`Exported ✓ ${fileName}`, 'download', 2600);
    log(`Export Slides Markdown: downloaded ${fileName}`);
  } catch (e) {
    showToast(' ❌ Export failed: ' + e.message, 'error');
  }
}

// Expose template/menu helpers for templates-menu.js (loaded after main.js)
try {
  window.makeMenuItem = makeMenuItem;
  window.makeMenuHeader = makeMenuHeader;
  window.makeMenuSep = makeMenuSep;
  window.tplEditModalOpen = tplEditModalOpen;
  window.showToast = showToast;
  window.exportMarkdownDownload = exportMarkdownDownload;
  window.__insertIntoEditor = __insertIntoEditor;

  globalThis.makeMenuItem = makeMenuItem;
  globalThis.makeMenuHeader = makeMenuHeader;
  globalThis.makeMenuSep = makeMenuSep;
  globalThis.tplEditModalOpen = tplEditModalOpen;
  globalThis.showToast = showToast;
  globalThis.exportMarkdownDownload = exportMarkdownDownload;
  globalThis.__insertIntoEditor = __insertIntoEditor;
} catch {}

// Expose log for add-image.js and other extracted modules
try {
  window.log = log;
  globalThis.log = log;
} catch {}

// ================================
// Editor Overlay Controls
// ================================
function wireEditorOverlayControls() {
  try {
    const overlay = document.getElementById('editorOverlayControls');
    const btnSearch = document.getElementById('editorBtnSearch');
    const btnCopy = document.getElementById('editorBtnCopyMd');

    if (!overlay) {
      try {
        log('Editor overlay controls: overlay not found');
      } catch {}
      return;
    }

    // Prevent overlay clicks from stealing editor interactions more than necessary.
    ['pointerdown', 'mousedown', 'click', 'dblclick', 'touchstart'].forEach((evt) => {
      overlay.addEventListener(
        evt,
        (e) => {
          e.stopPropagation();
        },
        { passive: evt === 'touchstart' }
      );
    });

    if (btnSearch && !btnSearch.__bound) {
      btnSearch.addEventListener('click', () => {
        try {
          if (typeof window.__cmOpenSearchPanel === 'function') {
            window.__cmOpenSearchPanel();
          } else {
            showToast('Search: Ctrl+F | Replace: Ctrl+H', 'ok', 2600);

            if (typeof window.__cmFocus === 'function') {
              window.__cmFocus();
            } else {
              md.focus();
            }
          }
        } catch (e) {
          showToast('Search: Ctrl+F | Replace: Ctrl+H', 'ok', 2600);
        }
      });

      btnSearch.__bound = true;
    }

    if (btnCopy && !btnCopy.__bound) {
      btnCopy.addEventListener('click', copyMarkdownToClipboard);
      btnCopy.__bound = true;
    }

    try {
      log('Editor overlay controls: wired');
    } catch {}
  } catch (e) {
    try {
      log('❌ wireEditorOverlayControls failed: ' + (e?.message || e));
    } catch {}
  }
}

wireEditorOverlayControls();

function insertCheckboxFromOverlay(checked) {
  try {
    if (typeof window.__cmApplyCheckboxAtCursor === 'function') {
      window.__cmApplyCheckboxAtCursor(!!checked);
      return;
    }
  } catch (e) {
    try {
      log(`❌ CodeMirror checkbox helper failed: ${e?.message || e}`);
    } catch {}
  }

  // Do not use the hidden textarea while CodeMirror is active.
  // The hidden textarea cursor is not reliable and can point to the end/last line.
  if (!document.body.classList.contains('cmFailed')) {
    try {
      log('Checkbox insert skipped: CodeMirror checkbox helper missing');
    } catch {}
    try {
      showToast('Checkbox helper not ready', 'error', 2400);
    } catch {}
    return;
  }

  // Textarea fallback only when CodeMirror failed.
  try {
    const marker = checked ? '[x]' : '[ ]';
    const el = document.getElementById('md');
    if (!el) return;

    const value = String(el.value || '');
    const start = el.selectionStart ?? value.length;

    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = value.indexOf('\n', start);
    if (lineEnd < 0) lineEnd = value.length;

    const beforeLine = value.slice(0, lineStart);
    const line = value.slice(lineStart, lineEnd);
    const afterLine = value.slice(lineEnd);

    let newLine;

    if (/^\s*$/.test(line)) {
      const indent = line.match(/^\s*/)?.[0] || '';
      newLine = `${indent}- ${marker} `;
    } else if (/^(\s*)[-*+]\s+\[[ xX]\]\s*/.test(line)) {
      newLine = line.replace(/^(\s*)[-*+]\s+\[[ xX]\]\s*/, `$1- ${marker} `);
    } else if (/^(\s*)[-*+]\s+/.test(line)) {
      newLine = line.replace(/^(\s*)[-*+]\s+/, `$1- ${marker} `);
    } else if (/^(\s*)[-*+]\s*$/.test(line)) {
      const indent = line.match(/^(\s*)/)?.[1] || '';
      newLine = `${indent}- ${marker} `;
    } else if (/^(\s*)\d+[.)]\s+/.test(line)) {
      newLine = line.replace(/^(\s*)\d+[.)]\s+/, `$1- ${marker} `);
    } else {
      const indent = line.match(/^\s*/)?.[0] || '';
      const content = line.slice(indent.length);
      newLine = `${indent}- ${marker} ${content}`;
    }

    const nextValue = beforeLine + newLine + afterLine;
    el.value = nextValue;

    const newCursor = lineStart + newLine.length;
    el.selectionStart = el.selectionEnd = newCursor;

    el.dispatchEvent(new Event('input', { bubbles: true }));
  } catch (e) {
    try {
      log(`❌ Checkbox textarea fallback failed: ${e?.message || e}`);
    } catch {}
  }
}

// ================================
// Editor Overlay — separate expandable tools panel
// ================================
(function wireEditorOverlayToolsPanel() {
  function initEditorOverlayToolsPanel() {
    const overlay = document.getElementById('editorOverlayControls');
    const btnToggle = document.getElementById('editorBtnEditToggle');
    const panel = document.getElementById('editorOverlayToolsPanel');

    if (!overlay || !btnToggle || !panel) {
      try {
        log('Editor overlay tools panel: missing elements');
      } catch {}
      return;
    }

    if (panel.__bound) return;

    function setOpen(open) {
      open = !!open;

      panel.hidden = !open;
      overlay.classList.toggle('__expanded', open);

      btnToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      btnToggle.title = open ? 'Hide edit tools' : 'Show edit tools';
    }

    function isOpen() {
      return !panel.hidden;
    }

    function runEditorCommand(commandName) {
      try {
        const commands = {
          link: () => __qiInsertLink(),
          inlineCode: () => __qiWrap('`', '`', 'code'),

          bold: () => __qiWrap('**', '**', 'bold'),
          italic: () => __qiWrap('*', '*', 'italic'),
          boldItalic: () => __qiWrap('***', '***', 'bold italic'),
          strike: () => __qiWrap('~~', '~~', 'strike'),

          bullet: () => __qiToggleList('- '),
          ordered: () => __qiToggleList('1. '),

          checkboxUnchecked: () => insertCheckboxFromOverlay(false),
          checkboxChecked: () => insertCheckboxFromOverlay(true),

          indent: () => __qiIndent(2),
          outdent: () => __qiIndent(-2),
        };

        const fn = commands[commandName];

        if (!fn) {
          try {
            log(`Editor overlay: unknown command ${commandName}`);
          } catch {}
          try {
            showToast(`Unknown editor command: ${commandName}`, 'error', 2400);
          } catch {}
          return;
        }

        if (typeof window.__cmFocus === 'function') {
          window.__cmFocus();
        }

        fn();
      } catch (e) {
        try {
          log(`❌ Editor overlay command failed (${commandName}): ${e?.message || e}`);
        } catch {}
        try {
          showToast('Editor command failed', 'error', 2400);
        } catch {}
      }
    }

    function runHeading(level) {
      try {
        const fn =
          window.__qiToggleHeading ||
          (typeof __qiToggleHeading === 'function' ? __qiToggleHeading : null);

        if (!fn) {
          try {
            log('Editor overlay: __qiToggleHeading missing');
          } catch {}
          try {
            showToast('Heading command missing', 'error', 2400);
          } catch {}
          return;
        }

        fn(level);
      } catch (e) {
        try {
          log(`❌ Editor overlay heading failed: ${e?.message || e}`);
        } catch {}
        try {
          showToast('Heading command failed', 'error', 2400);
        } catch {}
      }
    }

    btnToggle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    btnToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setOpen(!isOpen());
    });

    panel.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || !panel.contains(btn)) return;

      e.preventDefault();
      e.stopPropagation();

      const commandName = btn.dataset.editorCommand;
      const headingLevel = btn.dataset.headingLevel;

      if (commandName) {
        runEditorCommand(commandName);
        return;
      }

      if (headingLevel != null) {
        runHeading(parseInt(headingLevel, 10));
      }
    });

    function insertIntoEditorFromOverlay(text) {
      try {
        if (typeof window.__cmInsertAtCursor === 'function') {
          window.__cmInsertAtCursor(text);
          return;
        }
      } catch {}

      try {
        if (typeof __insertIntoEditor === 'function') {
          __insertIntoEditor(text);
          return;
        }
      } catch {}

      try {
        const el = document.getElementById('md');
        if (!el) return;

        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;

        el.value = el.value.slice(0, start) + text + el.value.slice(end);

        const pos = start + text.length;
        el.selectionStart = el.selectionEnd = pos;

        el.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (e) {
        try {
          log(`❌ Editor overlay insert failed: ${e?.message || e}`);
        } catch {}
      }
    }

    // Keep editor tools open until the user clicks the edit button again.
    // Do not close when clicking the editor, top toolbar, map, or map overlay.

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) {
        setOpen(false);
      }
    });

    panel.__bound = true;
    setOpen(false);

    try {
      log('Editor overlay tools panel: wired');
    } catch {}
  }

  setTimeout(initEditorOverlayToolsPanel, 0);
  window.addEventListener('cm-ready', initEditorOverlayToolsPanel);
})();

// ================================
// Export: Mindmap SVG + HTML Preview
// ================================

function __exportSafeBaseName(name) {
  try {
    return (
      String(name || 'markmap')
        .replace(/\.(md|markdown|txt)$/i, '')
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, ' ')
        .trim() || 'markmap'
    );
  } catch {
    return 'markmap';
  }
}

function __downloadBlob(textOrBlob, filename, type = 'text/plain;charset=utf-8') {
  try {
    const blob = textOrBlob instanceof Blob ? textOrBlob : new Blob([textOrBlob], { type });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    try {
      log('❌ downloadBlob failed: ' + (e?.message || e));
    } catch {}
    return false;
  }
}

function __copyComputedStylesToSvgClone(sourceRoot, cloneRoot) {
  try {
    const importantProps = [
      'fill',
      'stroke',
      'stroke-width',
      'stroke-opacity',
      'fill-opacity',
      'opacity',
      'color',
      'font',
      'font-family',
      'font-size',
      'font-weight',
      'font-style',
      'text-decoration',
      'dominant-baseline',
      'text-anchor',
    ];

    function walk(src, dst) {
      if (!src || !dst || src.nodeType !== 1 || dst.nodeType !== 1) return;

      const cs = window.getComputedStyle(src);
      let styleText = dst.getAttribute('style') || '';

      for (const prop of importantProps) {
        const val = cs.getPropertyValue(prop);
        if (val) styleText += `${prop}:${val};`;
      }

      if (styleText) dst.setAttribute('style', styleText);

      const srcChildren = Array.from(src.children || []);
      const dstChildren = Array.from(dst.children || []);

      for (let i = 0; i < Math.min(srcChildren.length, dstChildren.length); i++) {
        walk(srcChildren[i], dstChildren[i]);
      }
    }

    walk(sourceRoot, cloneRoot);
  } catch (e) {
    try {
      log('⚠️ SVG export: computed style copy failed: ' + (e?.message || e));
    } catch {}
  }
}

function __injectSvgExportStyle(svgEl, isDark) {
  try {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');

    const bg = isDark ? '#1e1e1e' : '#ffffff';
    const text = isDark ? '#d4d4d4' : '#1a1a1a';
    const active = isDark ? '#4fc3f7' : '#1976d2';
    const circleFill = isDark ? '#444444' : '#ffffff';
    const circleStroke = isDark ? '#666666' : '#999999';

    style.textContent = `
      svg {
        background: ${bg};
      }

      .markmap-node text {
        fill: ${text} !important;
        opacity: 1 !important;
      }

      .markmap-node foreignObject,
      .markmap-node foreignObject div {
        color: ${text} !important;
        opacity: 1 !important;
      }

      .markmap-node.__active text {
        fill: ${active} !important;
        font-weight: 700 !important;
      }

      .markmap-node.__active foreignObject div {
        color: ${active} !important;
        font-weight: 700 !important;
      }

      .markmap-node circle {
        fill: ${circleFill};
        stroke: ${circleStroke};
      }

      .markmap-link {
        stroke-opacity: ${isDark ? '0.85' : '0.65'};
        stroke-width: 2px;
      }
    `;

    svgEl.insertBefore(style, svgEl.firstChild);
  } catch (e) {
    try {
      log('⚠️ SVG export: style injection failed: ' + (e?.message || e));
    } catch {}
  }
}

function exportMindmapSvg() {
  try {
    if (!mapSvg) {
      showToast('SVG export error: map SVG not found', 'error', 3200);
      return;
    }

    const rect = mapSvg.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || mapSvg.clientWidth || 1200));
    const height = Math.max(1, Math.round(rect.height || mapSvg.clientHeight || 800));

    const clone = mapSvg.cloneNode(true);

    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    // Fixed viewBox preserves the exported map coordinate system.
    clone.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Make it fill the browser viewport when opened directly.
    // This reduces the white side area in Chrome/Edge SVG viewer.
    clone.setAttribute('width', '100%');
    clone.setAttribute('height', '100%');
    clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const isDark = document.documentElement.classList.contains('dark');
    const bg = isDark ? '#1e1e1e' : '#ffffff';

    clone.style.background = bg;
    clone.setAttribute('style', `background:${bg};display:block;width:100vw;height:100vh;`);

    // Copy computed styles BEFORE adding extra nodes,
    // otherwise child indexes can shift.
    __copyComputedStylesToSvgClone(mapSvg, clone);

    // Inject explicit SVG-local theme styles.
    // This avoids depending on app CSS like html.dark.
    __injectSvgExportStyle(clone, isDark);

    // Add background rectangle after style copying.
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', '0');
    bgRect.setAttribute('y', '0');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', bg);

    // Put bg after <style>, but before visual content.
    const firstNonStyle = Array.from(clone.childNodes).find((n) => n.nodeName !== 'style');
    clone.insertBefore(bgRect, firstNonStyle || clone.firstChild);

    const serializer = new XMLSerializer();
    let svgText = serializer.serializeToString(clone);

    if (!svgText.startsWith('<?xml')) {
      svgText = `<?xml version="1.0" encoding="UTF-8"?>\n${svgText}`;
    }

    const base = __exportSafeBaseName(currentFileName);
    const stamp =
      typeof todayStamp === 'function' ? todayStamp() : new Date().toISOString().slice(0, 10);

    const filename = `${base}_mindmap_${stamp}.svg`;

    const ok = __downloadBlob(svgText, filename, 'image/svg+xml;charset=utf-8');

    if (ok) {
      showToast(`Exported SVG ✓ ${filename}`, 'download', 2600);
      log(`Export SVG: downloaded ${filename}`);
    } else {
      showToast('SVG export failed', 'error', 3200);
    }
  } catch (e) {
    const msg = e?.message || String(e);
    showToast('SVG export error: ' + msg, 'error', 3800);
    try {
      log('❌ exportMindmapSvg failed: ' + msg);
    } catch {}
  }
}

function __escapeHtmlText(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function __standaloneHtmlCss(isDark) {
  return `
:root {
  --bg: ${isDark ? '#1e1e1e' : '#ffffff'};
  --text: ${isDark ? '#d4d4d4' : '#1a1a1a'};
  --html-bg: ${isDark ? '#252526' : '#fafafa'};
  --html-border: ${isDark ? '#3e3e42' : '#cccccc'};
  --table-border: ${isDark ? '#555555' : '#cfcfcf'};
  --table-head-bg: ${isDark ? '#3a3a3a' : '#f3f3f3'};
  --code-bg: ${isDark ? '#2a2a2a' : '#f4f4f4'};
}

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.5;
}

body {
  padding: 24px;
}

main {
  max-width: 1100px;
  margin: 0 auto;
  background: var(--html-bg);
  border: 1px solid var(--html-border);
  border-radius: 12px;
  padding: 24px;
}

h1, h2, h3, h4, h5, h6 {
  line-height: 1.25;
}

a {
  color: ${isDark ? '#4fc3f7' : '#1976d2'};
}

table {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
}

th, td {
  border: 1px solid var(--table-border);
  padding: 6px 8px;
  vertical-align: top;
}

thead th {
  background: var(--table-head-bg);
  font-weight: 700;
}

tbody tr:nth-child(even) {
  background: rgba(127, 127, 127, 0.06);
}

img {
  max-width: 100%;
  height: auto;
}

pre {
  overflow: auto;
}

pre.shiki {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--html-border);
}

pre.shiki code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
}

:not(pre) > code {
  background: var(--code-bg);
  color: var(--text);
  padding: 2px 5px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 0.9em;
}

blockquote {
  border-left: 4px solid ${isDark ? '#555' : '#ddd'};
  margin-left: 0;
  padding-left: 12px;
  opacity: 0.9;
}

.code-block {
  position: relative;
}

.copy-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 12px;
  padding: 2px 6px;
  cursor: pointer;
  opacity: 0.75;
}

.copy-btn:hover {
  opacity: 1;
}
`;
}

async function exportHtmlPreview() {
  try {
    const mdEl = document.getElementById('md');
    if (!mdEl) {
      showToast('HTML export error: markdown source not found', 'error', 3200);
      return;
    }

    if (typeof renderHtmlWithShiki !== 'function') {
      showToast('HTML export error: HTML renderer not available', 'error', 3200);
      return;
    }

    const isDark = document.documentElement.classList.contains('dark');
    const title = currentFileName || 'markmap.md';
    const bodyHtml = await renderHtmlWithShiki(mdEl.value);

    const css = __standaloneHtmlCss(isDark);

    const standalone = `<!DOCTYPE html>
<html lang="pt-BR"${isDark ? ' class="dark"' : ''}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${__escapeHtmlText(title)} - HTML Preview</title>
  <style>
${css}
  </style>
</head>
<body>
  <main>
${bodyHtml}
  </main>

  <script>
  document.addEventListener('click', async function(e) {
    var btn = e.target.closest('.copy-btn');
    if (!btn) return;

    var block = btn.closest('.code-block');
    var codeEl = block && block.querySelector('pre code');
    var code = codeEl ? codeEl.innerText : '';

    try {
      await navigator.clipboard.writeText(code);
      btn.textContent = 'Copied!';
      setTimeout(function(){ btn.textContent = 'Copy'; }, 1200);
    } catch {
      btn.textContent = 'Failed';
      setTimeout(function(){ btn.textContent = 'Copy'; }, 1200);
    }
  });
  <\/script>
</body>
</html>`;

    const base = __exportSafeBaseName(currentFileName);
    const stamp =
      typeof todayStamp === 'function' ? todayStamp() : new Date().toISOString().slice(0, 10);
    const filename = `${base}_preview_${stamp}.html`;

    const ok = __downloadBlob(standalone, filename, 'text/html;charset=utf-8');

    if (ok) {
      showToast(`Exported HTML ✓ ${filename}`, 'download', 2600);
      log(`Export HTML: downloaded ${filename}`);
    } else {
      showToast('HTML export failed', 'error', 3200);
    }
  } catch (e) {
    const msg = e?.message || String(e);
    showToast('HTML export error: ' + msg, 'error', 3800);
    try {
      log('❌ exportHtmlPreview failed: ' + msg);
    } catch {}
  }
}

// =======================================
// LAYOUT ENGINE V1 (Pandoc)
// =======================================

// =======================================
// LAYOUT ENGINE V1 (Pandoc)
// =======================================

function transformLayouts(mdText) {
  const blocks = splitSlidesForPandoc(mdText);
  const output = [];

  let titleMeta = null;

  for (const rawBlock of blocks) {
    const block = rawBlock.trim();
    if (!block) continue;

    const lines = block.split('\n');

    let layout = 'content';
    let startIndex = 0;

    if (lines[0] && lines[0].trim().toLowerCase().startsWith('layout:')) {
      layout = lines[0]
        .replace(/^layout:/i, '')
        .trim()
        .toLowerCase();
      startIndex = 1;
    }

    const content = lines.slice(startIndex).join('\n').trim();

    switch (layout) {
      case 'title':
        if (!titleMeta) {
          titleMeta = transformTitleMetadata(content);
        } else {
          output.push(transformSection(content));
        }
        break;

      case 'twocols':
        output.push(transformTwoCols(content));
        break;

      case 'image-text':
        output.push(transformImageText(content, true));
        break;

      case 'text-image':
        output.push(transformImageText(content, false));
        break;

      case 'image-caption':
        output.push(transformImageCaption(content));
        break;

      case 'agenda':
        output.push(cleanPandocContent(content));
        break;

      case 'kpi':
        output.push(transformKpi(content));
        break;

      case 'bullets-2':
        output.push(transformBulletsTwoCols(content));
        break;

      case 'threecols':
        output.push(transformThreeCols(content));
        break;

      case 'grid2':
        output.push(transformGrid2(content));
        break;

      case 'section':
        output.push(transformSection(content));
        break;

      case 'highlight':
        output.push(transformHighlight(content));
        break;

      case 'big':
        output.push(transformBigNumber(content));
        break;

      case 'table':
      case 'content':
      default:
        output.push(cleanPandocContent(content));
        break;
    }
  }

  const body = output
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n\n---\n\n');

  if (titleMeta) {
    return titleMeta + '\n\n' + body;
  }

  return body;
}

function splitSlidesForPandoc(mdText) {
  return String(mdText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n---\n/g);
}

function cleanPandocContent(content) {
  return String(content || '')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

function transformTitleMetadata(content) {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  let title = '';
  let subtitle = '';
  let author = '';
  let date = '';

  if (lines.length > 0 && lines[0].startsWith('# ')) {
    title = lines[0].replace(/^#\s+/, '').trim();
    subtitle = lines[1] || '';
    author = lines[2] || '';
    date = lines[3] || '';
  } else {
    title = lines[0] || '';
    subtitle = lines[1] || '';
    author = lines[2] || '';
    date = lines[3] || '';
  }

  const meta = ['---', `title: "${escapeYamlString(title)}"`];

  if (subtitle) {
    meta.push(`subtitle: "${escapeYamlString(subtitle)}"`);
  }

  if (author) {
    meta.push(`author: "${escapeYamlString(author)}"`);
  }

  if (date) {
    meta.push(`date: "${escapeYamlString(date)}"`);
  }

  meta.push('---');

  return meta.join('\n');
}

function escapeYamlString(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .trim();
}

function transformTwoCols(content) {
  const lines = content.split('\n');

  let title = '';
  const left = [];
  const right = [];
  let current = 'left';

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) continue;

    if (line.startsWith('# ')) {
      title = line;
      continue;
    }

    if (line.startsWith('## ')) {
      const section = line.toLowerCase();

      if (
        section.includes('right') ||
        section.includes('column 2') ||
        section.includes('col 2') ||
        section.includes('[2]')
      ) {
        current = 'right';
      } else {
        current = 'left';
      }

      continue;
    }

    if (current === 'left') {
      left.push(line);
    } else {
      right.push(line);
    }
  }

  return [
    title,
    '',
    '::: columns',
    '::: column',
    left.join('\n'),
    ':::',
    '',
    '::: column',
    right.join('\n'),
    ':::',
    ':::',
  ]
    .join('\n')
    .trim();
}

function isImageLine(line) {
  const value = String(line || '').trim();

  if (!value) return false;
  if (/^!\[.*\]\(.+\)$/.test(value)) return true;

  return /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(value);
}

function formatPandocImage(line) {
  const value = String(line || '').trim();

  if (!value) return '';
  if (/^!\[.*\]\(.+\)$/.test(value)) return value;

  const alt =
    value
      .split('/')
      .pop()
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .trim() || 'image';

  return `![${alt}](${value})`;
}

function transformImageText(content, imageFirst = true) {
  const lines = content.split('\n');

  let title = '';
  const imageLines = [];
  const textLines = [];
  let current = 'text';

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) continue;

    if (line.startsWith('# ')) {
      title = line;
      continue;
    }

    if (line.startsWith('## ')) {
      const section = line.toLowerCase();

      if (
        section.includes('image') ||
        section.includes('visual') ||
        section.includes('figure') ||
        section.includes('chart')
      ) {
        current = 'image';
      } else {
        current = 'text';
      }

      continue;
    }

    if (current === 'image' || isImageLine(line)) {
      imageLines.push(formatPandocImage(line));
    } else {
      textLines.push(line);
    }
  }

  const imageBlock = imageLines.filter(Boolean).join('\n');
  const textBlock = textLines.join('\n');

  const firstBlock = imageFirst ? imageBlock : textBlock;
  const secondBlock = imageFirst ? textBlock : imageBlock;

  return [
    title,
    '',
    '::: columns',
    '::: column',
    firstBlock,
    ':::',
    '',
    '::: column',
    secondBlock,
    ':::',
    ':::',
  ]
    .join('\n')
    .trim();
}

function transformImageCaption(content) {
  const lines = content.split('\n');

  let title = '';
  const captionLines = [];
  let imageLine = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) continue;

    if (line.startsWith('# ')) {
      title = line;
      continue;
    }

    if (isImageLine(line)) {
      imageLine = formatPandocImage(line);
      continue;
    }

    if (!line.startsWith('## ')) {
      captionLines.push(line);
    }
  }

  return [title, '', imageLine, '', captionLines.join('\n')].join('\n').trim();
}

function transformKpi(content) {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  let title = '';
  let metric = '';
  const body = [];

  for (const line of lines) {
    if (line.startsWith('# ')) {
      title = line;
      continue;
    }

    if (line.startsWith('## ') && !metric) {
      metric = line.replace(/^##\s+/, '').trim();
      continue;
    }

    if (!line.startsWith('## ')) {
      body.push(line);
    }
  }

  return [title, '', metric ? `# ${metric}` : '', '', body.join('\n')].join('\n').trim();
}

function transformBulletsTwoCols(content) {
  const lines = content.split('\n');

  let title = '';
  const bullets = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) continue;

    if (line.startsWith('# ')) {
      title = line;
      continue;
    }

    if (line.startsWith('- ')) {
      bullets.push(line);
    }
  }

  const mid = Math.ceil(bullets.length / 2);
  const left = bullets.slice(0, mid);
  const right = bullets.slice(mid);

  return [
    title,
    '',
    '::: columns',
    '::: column',
    left.join('\n'),
    ':::',
    '',
    '::: column',
    right.join('\n'),
    ':::',
    ':::',
  ]
    .join('\n')
    .trim();
}

function transformThreeCols(content) {
  const lines = content.split('\n');

  let title = '';
  const cols = [
    { heading: '', body: [] },
    { heading: '', body: [] },
    { heading: '', body: [] },
  ];

  let current = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) continue;

    if (line.startsWith('# ')) {
      title = line;
      continue;
    }

    if (line.startsWith('## ')) {
      const sectionTitle = line.replace(/^##\s+/, '').trim();
      const section = sectionTitle.toLowerCase();

      if (
        section.includes('column 3') ||
        section.includes('col 3') ||
        section.includes('[3]') ||
        section.includes('right') ||
        section.includes('option c')
      ) {
        current = 2;
      } else if (
        section.includes('column 2') ||
        section.includes('col 2') ||
        section.includes('[2]') ||
        section.includes('middle') ||
        section.includes('center') ||
        section.includes('option b')
      ) {
        current = 1;
      } else {
        current = 0;
      }

      cols[current].heading = sectionTitle;
      continue;
    }

    cols[current].body.push(line.replace(/^- /, '').trim());
  }

  const cellHeading = (col) => {
    return col.heading ? `**${escapePandocTableCell(col.heading)}**` : ' ';
  };

  const cellBody = (col) => {
    const body = col.body.map(escapePandocTableCell).join(' — ');

    return body || ' ';
  };

  return [
    title,
    '',
    `| ${cellHeading(cols[0])} | ${cellHeading(cols[1])} | ${cellHeading(cols[2])} |`,
    '|---|---|---|',
    `| ${cellBody(cols[0])} | ${cellBody(cols[1])} | ${cellBody(cols[2])} |`,
  ]
    .join('\n')
    .trim();
}

function transformGrid2(content) {
  const lines = content.split('\n');

  let title = '';
  const blocks = [];
  let currentBlock = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) continue;

    if (line.startsWith('# ')) {
      title = line;
      continue;
    }

    if (line.startsWith('## ')) {
      currentBlock = {
        heading: line.replace(/^##\s+/, '').trim(),
        body: [],
      };
      blocks.push(currentBlock);
      continue;
    }

    if (currentBlock) {
      currentBlock.body.push(line);
    }
  }

  while (blocks.length < 4) {
    blocks.push({ heading: '', body: [] });
  }

  const cell = (block) => {
    const heading = escapePandocTableCell(block.heading || '');
    const body = block.body.map(escapePandocTableCell).join(' ');

    if (heading && body) return `**${heading}** — ${body}`;
    if (heading) return `**${heading}**`;
    if (body) return body;

    return ' ';
  };

  return [
    title,
    '',
    `| ${cell(blocks[0])} | ${cell(blocks[1])} |`,
    '|---|---|',
    `| ${cell(blocks[2])} | ${cell(blocks[3])} |`,
  ]
    .join('\n')
    .trim();
}

function escapePandocTableCell(text) {
  return String(text || '')
    .replace(/\|/g, '\\|')
    .trim();
}

function transformSection(content) {
  return cleanPandocContent(content);
}

function transformHighlight(content) {
  return cleanPandocContent(content);
}

function transformBigNumber(content) {
  return cleanPandocContent(content);
}

try {
  if (__btnAddImage) {
    __btnAddImage.addEventListener('click', () => {
      __addImageLog('AddImage: button click');
      const open = __imageMenu && __imageMenu.style.display === 'flex';
      if (open) __hideImageMenu();
      else __showImageMenu();
    });
    __addImageLog('AddImage: listener attached');
  }
} catch (e) {
  __addImageLog('AddImage wiring error: ' + (e && e.message ? e.message : e));
}

log('✅ UI wiring: buttons listeners attached (Open/Save/HTML/Logs)');

// ================================
// Quick Insert Toolbar (Enhanced)
// - Prefix toggles apply to ALL selected lines
// - Indent/Outdent apply to ALL selected lines
// - Uses CodeMirror helpers when available (cursor-correct)
// ================================
function __qiSyncCm() {
  try {
    if (typeof window.__cmSetText === 'function') window.__cmSetText(md.value);
  } catch {}
}
function __qiGetSel() {
  const start = md.selectionStart ?? 0;
  const end = md.selectionEnd ?? start;
  return { start, end, text: md.value.slice(start, end) };
}
function __qiSetSel(start, end) {
  try {
    md.focus();
    md.selectionStart = start;
    md.selectionEnd = end;
  } catch {}
}
function __qiLineBlockRange() {
  const { start, end } = __qiGetSel();
  const v = md.value;
  // If selection ends exactly at a line start, back up one char so we don't include the next line.
  const end2 = end > start && end > 0 && v[end - 1] === '\n' ? end - 1 : end;
  const from = v.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const ix = v.indexOf('\n', end2);
  const to = ix === -1 ? v.length : ix;
  return { from, to };
}
function __qiWrapTextarea(before, after, placeholder = '') {
  const { start, end, text } = __qiGetSel();
  const has = end > start;
  const inner = has ? text : placeholder || '';
  const insert = String(before) + inner + String(after);
  md.value = md.value.slice(0, start) + insert + md.value.slice(end);
  __qiSyncCm();
  md.dispatchEvent(new Event('input', { bubbles: true }));
  const selStart = start + String(before).length;
  const selEnd = selStart + inner.length;
  __qiSetSel(selStart, selEnd);
}
function __qiTogglePrefixTextarea(prefix) {
  prefix = String(prefix || '');
  const v = md.value;
  const { from, to } = __qiLineBlockRange();
  const block = v.slice(from, to);
  const lines = block.split('\n');
  const allHave = lines.length && lines.every((ln) => ln.startsWith(prefix));
  const nextLines = lines.map((ln) =>
    allHave ? (ln.startsWith(prefix) ? ln.slice(prefix.length) : ln) : prefix + ln
  );
  md.value = v.slice(0, from) + nextLines.join('\n') + v.slice(to);
  __qiSyncCm();
  md.dispatchEvent(new Event('input', { bubbles: true }));
}
function __qiIndentTextarea(delta) {
  const v = md.value;
  const { from, to } = __qiLineBlockRange();
  const block = v.slice(from, to);
  const lines = block.split('\n');
  const n = Math.min(8, Math.max(1, Math.abs(delta)));
  const indent = ' '.repeat(n);
  const nextLines = lines.map((ln) => {
    if (delta > 0) return indent + ln;
    if (ln.startsWith('	')) return ln.slice(1);
    let cut = 0;
    while (cut < n && cut < ln.length && ln[cut] === ' ') cut++;
    return ln.slice(cut);
  });
  md.value = v.slice(0, from) + nextLines.join('\n') + v.slice(to);
  __qiSyncCm();
  md.dispatchEvent(new Event('input', { bubbles: true }));
}
function __qiWrap(before, after, placeholder) {
  if (typeof window.__cmWrapSelection === 'function') {
    window.__cmWrapSelection(before, after, placeholder);
    return;
  }
  __qiWrapTextarea(before, after, placeholder);
}
function __qiToggleHeading(level) {
  if (typeof window.__cmToggleHeading === 'function') {
    window.__cmToggleHeading(level);
    return;
  }
  __qiTogglePrefixTextarea('#'.repeat(level) + ' ');
}
function __qiToggleList(prefix) {
  if (typeof window.__cmToggleLinePrefix === 'function') {
    window.__cmToggleLinePrefix(prefix);
    return;
  }
  __qiTogglePrefixTextarea(prefix);
}
function __qiIndent(delta) {
  if (typeof window.__cmIndentLines === 'function') {
    window.__cmIndentLines(delta);
    return;
  }
  __qiIndentTextarea(delta);
}
function __qiInsertLink() {
  if (typeof window.__cmInsertLink === 'function') {
    window.__cmInsertLink();
    return;
  }
  const { start, end, text } = __qiGetSel();
  const label = end > start ? text : 'link text';
  const url = 'https://';
  const insert = `[${label}](${url})`;
  md.value = md.value.slice(0, start) + insert + md.value.slice(end);
  __qiSyncCm();
  md.dispatchEvent(new Event('input', { bubbles: true }));
  const urlStart = start + 1 + label.length + 2;
  __qiSetSel(urlStart, urlStart + url.length);
}
function __qiBind(id, fn) {
  const el = document.getElementById(id);
  if (!el) return;
  // Prevent the toolbar button from stealing focus/selection from CodeMirror
  el.addEventListener(
    'pointerdown',
    (ev) => {
      try {
        ev.preventDefault();
      } catch {}
    },
    { passive: false }
  );
  el.addEventListener(
    'mousedown',
    (ev) => {
      try {
        ev.preventDefault();
      } catch {}
    },
    { passive: false }
  );
  el.addEventListener('click', () => {
    try {
      if (typeof window.__cmFocus === 'function') window.__cmFocus();
      fn();
    } catch (e) {
      try {
        log('QuickInsert error: ' + (e?.message || e));
      } catch {}
    }
  });
}

__qiBind('qiLink', () => __qiInsertLink());
__qiBind('qiCode', () => __qiWrap('`', '`', 'code'));
__qiBind('qiBold', () => __qiWrap('**', '**', 'bold'));
__qiBind('qiItalic', () => __qiWrap('*', '*', 'italic'));
__qiBind('qiBoldItalic', () => __qiWrap('***', '***', 'bold italic'));
__qiBind('qiStrike', () => __qiWrap('~~', '~~', 'strike'));
__qiBind('qiH1', () => __qiToggleHeading(1));
__qiBind('qiH2', () => __qiToggleHeading(2));
__qiBind('qiH3', () => __qiToggleHeading(3));
__qiBind('qiH4', () => __qiToggleHeading(4));
__qiBind('qiH5', () => __qiToggleHeading(5));
__qiBind('qiCheck', () => __qiToggleList('- [ ] '));
__qiBind('qiBullet', () => __qiToggleList('- '));
__qiBind('qiOrdered', () => __qiToggleList('1. '));
__qiBind('qiIndent', () => __qiIndent(2));
__qiBind('qiOutdent', () => __qiIndent(-2));
log('QuickInsert: wired');
log('✅ UI wiring: editor toggle attached');

// ================================
// App Context Selector
// ================================
function getContextApi() {
  return globalThis.APP_CONTEXT_API || null;
}

function getSelectedAppContextId() {
  const select = document.getElementById('appContextSelect');

  const selectValue =
    select && typeof select.value === 'string' && select.value ? select.value : '';

  const globalValue =
    typeof globalThis.currentAppContextId === 'string' && globalThis.currentAppContextId
      ? globalThis.currentAppContextId
      : '';

  const datasetValue = document.documentElement.dataset.appContext || '';

  let storedValue = '';
  try {
    storedValue = localStorage.getItem('markmap:appContext') || '';
  } catch {}

  return selectValue || globalValue || datasetValue || storedValue || 'editor';
}

function getCurrentContextStarter() {
  const api = getContextApi();
  const selectedId = getSelectedAppContextId();
  const ctx = api ? api.getAppContext(selectedId) : null;

  return {
    contextId: ctx?.id || 'editor',
    defaultFileName: ctx?.defaultFileName || 'mindmap.md',
    defaultMarkdown:
      ctx?.defaultMarkdown ||
      `# New Mindmap

## Ideas
- `,
  };
}

function logContextState(reason = 'context') {
  try {
    const select = document.getElementById('appContextSelect');

    const payload = {
      reason,
      selectValue: select?.value || null,
      globalCurrentAppContextId: globalThis.currentAppContextId || null,
      datasetAppContext: document.documentElement.dataset.appContext || null,
      storedAppContext: localStorage.getItem('markmap:appContext') || null,
      resolved: getSelectedAppContextId(),
      hasApi: !!globalThis.APP_CONTEXT_API,
    };

    log(`CTX ${reason}: ${JSON.stringify(payload)}`);
  } catch (e) {
    try {
      log(`CTX ${reason}: failed ${e?.message || e}`);
    } catch {}
  }
}

function applyAppContextUi(contextId, reason = 'applyAppContextUi') {
  // Correction 8: Do not reveal Journal while workspace-index is active
  const host = globalThis.MME_WORKSPACE_HOST;
  if (host && host.getActiveId?.() === 'workspace-index') {
    // Store context but do not remove journal-suspended or reveal Journal
    try {
      const api = getContextApi();
      if (api) {
        api.storeAppContextId(contextId);
        globalThis.currentAppContextId = contextId;
        const select = document.getElementById('appContextSelect');
        if (select) select.value = contextId;
      }
    } catch {}
    return;
  }
  const api = getContextApi();

  if (!api) {
    try {
      log(`CTX ${reason}: APP_CONTEXT_API missing`);
    } catch {}
    return;
  }

  const ctx = api.storeAppContextId(contextId);
  api.applyAppContextDataset(ctx.id);

  globalThis.currentAppContextId = ctx.id;

  const select = document.getElementById('appContextSelect');
  if (select) {
    select.value = ctx.id;
  }

  const markmapBtn = document.getElementById('btnTemplatesMarkmap');
  const pandocBtn = document.getElementById('btnTemplatesPandoc');

  if (ctx.id === 'editor') {
    if (markmapBtn) {
      markmapBtn.style.display = '';
      markmapBtn.textContent = '🧠 Templates ▾';
      markmapBtn.title = 'Markmap templates';
    }
    if (pandocBtn) {
      pandocBtn.style.display = '';
      pandocBtn.textContent = '📊 Pandoc ▾';
      pandocBtn.title = 'Pandoc templates';
    }
  }

  if (ctx.id === 'journal') {
    if (markmapBtn) {
      markmapBtn.style.display = '';
      markmapBtn.textContent = '📓 MMJ Templates ▾';
      markmapBtn.title = 'MarkMap Journal templates';
    }
    if (pandocBtn) {
      pandocBtn.style.display = 'none';
    }
  }

  if (ctx.id === 'slides') {
    if (markmapBtn) {
      markmapBtn.style.display = 'none';
    }
    if (pandocBtn) {
      pandocBtn.style.display = '';
      pandocBtn.textContent = '📊 Pandoc Templates ▾';
      pandocBtn.title = 'Pandoc slide templates';
    }
  }

  logContextState(reason);

  try {
    restoreWorkspaceSidebarWidth?.();
    wireWorkspaceSidebarResize?.();
    // Workspace-dependent sidebar setup: deferred until a workspace is open.
    // Width/resize restore above is standalone-safe and stays unconditional.
    // When a workspace opens later, finalizeWorkspaceSidebar (index-ready)
    // creates the panels and wires Search exactly once.
    if (globalThis.WORKSPACE_STATE?.rootHandle) {
      ensureWorkspaceSearchPanel?.();
      wireWorkspaceSearch?.();
      setupWorkspacePanels?.();
    }
  } catch (e) {
    log?.(`Workspace: sidebar resize restore/wire failed: ${e?.message || e}`);
  }
}

// Mode session helpers moved to js/core/mode-session.js (R-SPLIT1 + R-MULTI3).
// wireAppContextSelector below still uses captureCurrentModeSession /
// restoreModeSession, which are now provided as globals by that module.

function wireAppContextSelector() {
  const select = document.getElementById('appContextSelect');
  const api = getContextApi();

  if (!select) {
    try {
      log('CTX wireAppContextSelector: select missing');
    } catch {}
    return;
  }

  if (!api) {
    try {
      log('CTX wireAppContextSelector: APP_CONTEXT_API missing; retrying');
    } catch {}
    setTimeout(wireAppContextSelector, 100);
    return;
  }

  if (select.__bound) {
    try {
      log('CTX wireAppContextSelector: already bound');
    } catch {}
    logContextState('selector already bound');
    return;
  }

  const initialId =
    globalThis.currentAppContextId || api.getStoredAppContextId() || select.value || 'editor';

  applyAppContextUi(initialId, 'context boot');

  select.addEventListener('change', async () => {
    const nextId = select.value || 'editor';

    try {
      log(`CTX selector change: nextId=${nextId}`);
    } catch {}

    // ACT G2B: Before a context switch that replaces editor content, run the
    // Report leave decision. Cancel keeps the Report active and resets the
    // selector to the actual current context.
    if (typeof globalThis.guardUnsavedReportBeforeDocumentSwitch === 'function') {
      const guard = await globalThis.guardUnsavedReportBeforeDocumentSwitch();
      if (!guard || guard.ok !== true) {
        try {
          log(`CTX selector change: blocked reason=${guard?.reason || 'unknown'}`);
        } catch {}
        const actual = globalThis.currentAppContextId || 'editor';
        if (select.value !== actual) {
          select.value = actual;
        }
        return;
      }
      // Approved transition: clear Report identity at the safe activation boundary.
      globalThis.clearReportIdentityAfterTransition?.();
    }

    // R-MULTI1: switching modes must NOT prompt to save/discard.
    // Each mode keeps its own unsaved session state.
    captureCurrentModeSession('before context switch');
    applyAppContextUi(nextId, 'context switch');
    restoreModeSession(nextId, 'after context switch');
  });

  select.__bound = true;
  logContextState('selector wired');
}

wireAppContextSelector();

syncToolbarHeight();
setShowHideLabel('btnHtml', htmlPane.style.display === 'block', 'HTML');
setShowHideLabel('btnLogs', logs.style.display === 'block', 'Logs');
setShowHideLabel('btnToggleEditor', editorEl.style.display !== 'none', 'Editor');
syncToolbarHeight();

// ================================
// CLEAN DRAFT: clean the draft so it doesnt request more to be recovered
// ================================

function clearCurrentDraftAction() {
  try {
    clearDraft(currentFileName);

    showToast(`Draft cleared ✓ ${currentFileName}`, 'ok', 2200);

    try {
      log(`Auto-save: draft manually cleared for ${currentFileName}`);
    } catch {}
  } catch (e) {
    const msg = e?.message || String(e);
    showToast('Clear draft error: ' + msg, 'error', 3200);

    try {
      log('❌ clearCurrentDraftAction failed: ' + msg);
    } catch {}
  }
}

// ================================
// AUTO‑SAVE: check for draft on load & start timer
// ================================
const restored = checkAndRestoreDraft(currentFileName);
if (restored) {
  // If restored, render immediately to reflect the draft content
  globalThis.MME_RENDER?.renderNow?.('draft restore render()');
} else {
  // Normal initial render
  setStatus(modeLabel());
  updateDocumentTitle();
  __ensureMarkmapBoot();
  globalThis.MME_RENDER?.renderNow?.('boot render()');
  setTimeout(() => globalThis.MME_RENDER?.renderNow?.('boot delayed render()'), 1000);
}

wireHelpOverlay?.();

startAutoSave();

maybeShowWelcomeOverlay();

// Debounced rendering via MME_RENDER (R-SPLIT4 + R-RENDER1)
const RENDER_DEBOUNCE_MS = 1000;
md.addEventListener('input', () => {
  // Fix 6: Suppress programmatic dirty when __programmaticTextChange > 0
  if (typeof __programmaticTextChange === 'number' && __programmaticTextChange > 0) {
    return;
  }
  dirty = true;
  setStatus(modeLabel() + ' (modified)');
  updateDocumentTitle();
  globalThis.MME_RENDER?.scheduleRender?.('editor input');
});

md.addEventListener('blur', () => {
  if (window.__suppressBlurRenderUntil && Date.now() < window.__suppressBlurRenderUntil) {
    log('Editor blur suppressed (map interaction)');
    window.__suppressBlurRenderUntil = 0;
    return;
  }
  log('Editor blur -> rendering immediately');
  globalThis.MME_RENDER?.renderNow?.('editor blur');
});

window.addEventListener('beforeunload', (ev) => {
  const s = getCurrentViewState();
  if (s) saveViewState(s, 'beforeunload');
  // Auto‑save will have saved recently, but we also save now for safety
  saveDraft();
  if (!dirty) return;
  ev.preventDefault();
  ev.returnValue = '';
  log('beforeunload: blocked due to dirty=true');
});

// ================================
// End of APP SCRIPT
// ================================
