// @ts-nocheck
// CodeMirror bootstrap extracted from index.html.
// Kept as a browser module during refactor.

// ============================================================
// CODEMIRROR BOOTSTRAP (ES module) – STABLE VERSION
// Uses defaultHighlightStyle always; dark/light differences via CSS (html.dark ...)
// ============================================================

import { EditorState } from 'codemirror/state/dist/index.js';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
} from 'codemirror/view/dist/index.js';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from 'codemirror/commands/dist/index.js';
import {
  searchKeymap,
  highlightSelectionMatches,
  openSearchPanel,
} from 'codemirror/search/dist/index.js';
import { markdown } from 'codemirror/lang-markdown/dist/index.js';
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  indentOnInput,
  foldGutter,
  foldKeymap,
  bracketMatching,
} from 'codemirror/language/dist/index.js';
import { closeBrackets, closeBracketsKeymap } from 'codemirror/autocomplete/dist/index.js';

const md = document.getElementById('md');
const host = document.getElementById('cmHost');

function fallbackToTextarea(err) {
  console.error('CodeMirror init failed:', err);
  document.body.classList.add('cmFailed');

  try {
    window.log?.(`❌ CodeMirror init failed: ${err?.message || err}`);
  } catch {}

  try {
    const md = document.getElementById('md');
    const host = document.getElementById('cmHost');

    if (md) md.style.display = 'block';
    if (host) host.style.display = 'none';
  } catch {}
}

try {
  if (!md || !host) throw new Error('Missing #md textarea or #cmHost');

  const foldUI = foldGutter({
    markerDOM: (open) => {
      const el = document.createElement('span');
      el.className = 'cm-foldBtn';
      el.textContent = open ? '−' : '+';
      return el;
    },
  });

  const state = EditorState.create({
    doc: md.value,
    extensions: [
      lineNumbers(),
      EditorView.lineWrapping,
      highlightActiveLineGutter(),
      highlightActiveLine(),
      drawSelection(),
      history(),
      indentOnInput(),
      // Bracket matching + auto-close
      bracketMatching(),
      closeBrackets(),
      highlightSelectionMatches(),
      // ✅ Stable highlighter
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      foldUI,
      keymap.of([
        indentWithTab,
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...searchKeymap,
      ]),
      markdown(),

      // keep textarea synced with your app logic
      EditorView.updateListener.of((update) => {
        try {
          if (update.selectionSet) __cmLastSelection = update.state.selection.main;
        } catch {}
        if (!update.docChanged) return;
        const text = update.state.doc.toString();
        if (md.value !== text) md.value = text;
        md.dispatchEvent(new Event('input', { bubbles: true }));
      }),
      EditorView.domEventHandlers({
        blur: () => md.dispatchEvent(new Event('blur', { bubbles: true })),
      }),
    ],
  });

  const view = new EditorView({ state, parent: host });

  window.__cmOpenSearchPanel = function __cmOpenSearchPanel() {
    try {
      openSearchPanel(view);
      view.focus();
    } catch (e) {
      try {
        console.warn('openSearchPanel failed:', e);
      } catch {}
    }
  };

  window.__cmFocus = function __cmFocus() {
    try {
      view.focus();
    } catch {}
  };

  // Preserve last selection even if toolbar steals focus
  let __cmLastSelection = null;
  try {
    __cmLastSelection = view.state.selection.main;
  } catch {}
  // Track selection changes
  view.dispatch({}); // no-op to ensure view exists

  // Expose focus helper
  window.__cmFocus = () => {
    try {
      view.focus();
    } catch {}
  };

  // Indent/Outdent (CodeMirror) — applies to all selected lines, using last known selection
  window.__cmIndentLines = (delta) => {
    try {
      const d = Number(delta) || 0;
      if (!d) return;
      const n = Math.min(8, Math.max(1, Math.abs(d)));
      const pad = ' '.repeat(n);

      const sel =
        __cmLastSelection && typeof __cmLastSelection.from === 'number'
          ? __cmLastSelection
          : view.state.selection.main;
      let a = view.state.doc.lineAt(sel.from).number;
      let b = view.state.doc.lineAt(sel.to).number;

      // If selection ends exactly at the start of a line, exclude that line.
      // This avoids affecting the next heading when the user selected whole lines above it.
      const endLine = view.state.doc.lineAt(sel.to);
      if (sel.to === endLine.from && sel.to > sel.from) {
        b = Math.max(a, b - 1);
      }

      const changes = [];
      for (let ln = b; ln >= a; ln--) {
        const line = view.state.doc.line(ln);
        const t = line.text;
        let insert = t;
        if (d > 0) {
          insert = pad + t;
        } else {
          if (t.startsWith('\t')) insert = t.slice(1);
          else {
            let cut = 0;
            while (cut < n && cut < t.length && t[cut] === ' ') cut++;
            insert = t.slice(cut);
          }
        }
        changes.push({ from: line.from, to: line.to, insert });
      }

      if (!changes.length) return;
      view.dispatch({ changes });
      view.focus();

      // Update last selection to the current one after dispatch
      try {
        __cmLastSelection = view.state.selection.main;
      } catch {}
    } catch {}
  };

  // Keep last selection updated on selection changes
  try {
    view.dom.addEventListener(
      'keyup',
      () => {
        try {
          __cmLastSelection = view.state.selection.main;
        } catch {}
      },
      true
    );
    view.dom.addEventListener(
      'mouseup',
      () => {
        try {
          __cmLastSelection = view.state.selection.main;
        } catch {}
      },
      true
    );
    view.dom.addEventListener(
      'selectionchange',
      () => {
        try {
          __cmLastSelection = view.state.selection.main;
        } catch {}
      },
      true
    );
  } catch {}

  // expose helpers used by your main script
  window.__cmGetText = () => view.state.doc.toString();
  window.__cmSetText = (text) => {
    const cur = view.state.doc.toString();
    if (text === cur) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  };
  window.__cmInsertAtCursor = (insertText) => {
    try {
      const t = String(insertText ?? '');
      const sel = view.state.selection.main;
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: t },
        selection: { anchor: sel.from + t.length },
      });
      view.focus();
    } catch {}
  };

  window.__cmApplyCheckboxAtCursor = (checked) => {
    try {
      const marker = checked ? '[x]' : '[ ]';

      const sel = view.state.selection.main;
      const head = sel.head;

      const lineObj = view.state.doc.lineAt(head);
      const lineText = lineObj.text || '';

      function transformCheckboxLine(line) {
        // Empty or whitespace-only line.
        if (/^\s*$/.test(line)) {
          const indent = line.match(/^\s*/)?.[0] || '';
          return `${indent}- ${marker} `;
        }

        // Already unchecked/checked task.
        if (/^(\s*)[-*+]\s+\[[ xX]\]\s*/.test(line)) {
          return line.replace(/^(\s*)[-*+]\s+\[[ xX]\]\s*/, `$1- ${marker} `);
        }

        // Already a bullet, but not checkbox.
        if (/^(\s*)[-*+]\s+/.test(line)) {
          return line.replace(/^(\s*)[-*+]\s+/, `$1- ${marker} `);
        }

        // Bare dash/bullet, e.g. "-", "-   ", "*", "+"
        if (/^(\s*)[-*+]\s*$/.test(line)) {
          const indent = line.match(/^(\s*)/)?.[1] || '';
          return `${indent}- ${marker} `;
        }

        // Numbered list item.
        if (/^(\s*)\d+[.)]\s+/.test(line)) {
          return line.replace(/^(\s*)\d+[.)]\s+/, `$1- ${marker} `);
        }

        // Normal text line.
        const indent = line.match(/^\s*/)?.[0] || '';
        const content = line.slice(indent.length);
        return `${indent}- ${marker} ${content}`;
      }

      const newLine = transformCheckboxLine(lineText);

      view.dispatch({
        changes: {
          from: lineObj.from,
          to: lineObj.to,
          insert: newLine,
        },
        selection: {
          anchor: lineObj.from + newLine.length,
        },
      });

      view.focus();
    } catch (e) {
      try {
        console.warn('__cmApplyCheckboxAtCursor failed:', e);
      } catch {}
    }
  };

  window.__cmGetCursorLine = () => {
    try {
      return view.state.doc.lineAt(view.state.selection.main.head).number - 1;
    } catch {
      return 0;
    }
  };

  window.__cmGetTopLine = () => {
    try {
      const r = view.scrollDOM.getBoundingClientRect();
      const pos = view.posAtCoords({ x: r.left + 10, y: r.top + 10 });
      if (pos == null) return window.__cmGetCursorLine ? window.__cmGetCursorLine() : 0;
      return view.state.doc.lineAt(pos).number - 1;
    } catch {
      return 0;
    }
  };

  window.__cmGetAbsYForLine = (lineNo) => {
    try {
      const maxLine = view.state.doc.lines;
      const ln = Math.max(0, Math.min(maxLine - 1, Number(lineNo) || 0));
      const pos = view.state.doc.line(ln + 1).from;
      const coords = view.coordsAtPos(pos);
      if (!coords) return null;
      const rect = view.scrollDOM.getBoundingClientRect();
      return coords.top - rect.top + view.scrollDOM.scrollTop;
    } catch {
      return null;
    }
  };

  window.__cmScrollToLine = (lineNo) => {
    try {
      const maxLine = view.state.doc.lines;
      const ln = Math.max(0, Math.min(maxLine - 1, Number(lineNo) || 0));
      const line = view.state.doc.line(ln + 1);
      const pos = line.from;

      view.dispatch({
        selection: { anchor: pos },
        effects: EditorView.scrollIntoView(pos, { y: 'center' }),
      });

      view.focus();
    } catch {}
  };

  // Ensure cm height and fold markers look right
  const style = document.createElement('style');
  style.textContent = `
    .cm-editor { height: 100%; }
    .cm-scroller { overflow: auto; }
    .cm-foldBtn{
      display:inline-block;
      width: 1.2em;
      text-align:center;
      font-weight:700;
      cursor:pointer;
      user-select:none;
    }
  `;
  document.head.appendChild(style);

  // ================================
  // Quick Insert helpers (CodeMirror) — required so toolbar edits at the cursor
  // ================================
  window.__cmWrapSelection = (before, after, placeholder = '') => {
    try {
      const sel = view.state.selection.main;
      const has = sel.to > sel.from;
      const selected = view.state.sliceDoc(sel.from, sel.to);
      const inner = has ? selected : String(placeholder || '');
      const insert = String(before) + inner + String(after);
      const from = sel.from,
        to = sel.to;
      view.dispatch({
        changes: { from, to, insert },
        selection: {
          anchor: from + String(before).length,
          head: from + String(before).length + inner.length,
        },
      });
      view.focus();
    } catch {}
  };

  window.__cmToggleLinePrefix = (prefix) => {
    try {
      prefix = String(prefix || '');
      const sel = view.state.selection.main;
      const pos = sel.from;
      const line = view.state.doc.lineAt(pos);
      const text = line.text;
      const hasPrefix = text.startsWith(prefix);
      const insert = hasPrefix ? text.slice(prefix.length) : prefix + text;
      const delta = hasPrefix ? -prefix.length : prefix.length;
      const nextPos = Math.max(line.from, Math.min(line.from + insert.length, pos + delta));
      view.dispatch({
        changes: { from: line.from, to: line.to, insert },
        selection: { anchor: nextPos },
      });
      view.focus();
    } catch {}
  };

  window.__cmToggleHeading = (level) => {
    try {
      const n = Math.max(1, Math.min(6, Number(level) || 2));
      const prefix = '#'.repeat(n) + ' ';
      window.__cmToggleLinePrefix(prefix);
    } catch {}
  };

  window.__cmInsertLink = () => {
    try {
      const sel = view.state.selection.main;
      const has = sel.to > sel.from;
      const label = has ? view.state.sliceDoc(sel.from, sel.to) : 'link text';
      const url = 'https://';
      const insert = `[${label}](${url})`;
      const from = sel.from,
        to = sel.to;
      const urlStart = from + 1 + label.length + 2;
      const urlEnd = urlStart + url.length;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: urlStart, head: urlEnd },
      });
      view.focus();
    } catch {}
  };
  window.dispatchEvent(new Event('cm-ready'));
} catch (e) {
  fallbackToTextarea(e);
}
