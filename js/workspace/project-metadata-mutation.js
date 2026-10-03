// @ts-nocheck
// ACT 5B-3 — PURE Project metadata mutation owner (single owner).
//
// PURE BY CONTRACT. This module receives Markdown and returns proposed Markdown.
// It has NO DOM, NO file handles, NO editor buffer, NO dirty state, NO Save, NO
// Workspace Index mutation and NO Report mutation. It never claims filesystem
// ownership: filesystem and Save reasons belong to the future ACT 5C visual
// adapter.
//
// Targeting is by `projectId` ONLY. Never by title, source line alone, ordinal
// or DOM row index. Ambiguity (duplicate id) and malformed/duplicate metadata
// BLOCK the mutation instead of guessing.
//
// Mirrors the proven MME_TASK_LIFECYCLE pattern: one owner global, injected
// dependencies, no second writer.

(function () {
  'use strict';

  const STAGE_CANONICAL = ['funnel', 'pipeline', 'quoted', 'on-delivery', 'delivered'];
  const STATE_CANONICAL = ['open', 'on-hold', 'completed', 'lost', 'canceled'];

  const REASONS = Object.freeze({
    PROJECT_NOT_FOUND: 'project-not-found',
    PROJECT_ID_MISSING: 'project-id-missing',
    DUPLICATE_PROJECT_ID: 'duplicate-project-id',
    MALFORMED_PROJECT_COMMENT: 'malformed-project-comment',
    INVALID_VALUE: 'invalid-value',
    INVALID_CURRENCY: 'invalid-currency',
    INVALID_QUARTER: 'invalid-quarter',
    UNSUPPORTED_STAGE: 'unsupported-stage',
    UNSUPPORTED_STATE: 'unsupported-state',
    UNSUPPORTED_OPERATION: 'unsupported-operation',
    NO_CHANGE: 'no-change',
  });

  const VISIBLE_OPS = new Set(['setValueCurrency', 'clearValueCurrency', 'setExpectedOrder', 'clearExpectedOrder']);
  const MANAGED_OPS = new Set([
    'setStage', 'clearStage',
    'setState', 'clearState',
    'setExpectedDelivery', 'clearExpectedDelivery',
    'setExpectedBilling', 'clearExpectedBilling',
  ]);

  const CURRENCY_RE = /^[A-Za-z]{3}$/;
  const VALUE_RE = /^\d+(?:\.\d+)?$/; // canonical: no thousands separators, no sign

  function result(over) {
    return Object.assign(
      {
        ok: false,
        changed: false,
        reason: '',
        projectId: '',
        proposedMarkdown: '',
        diagnostics: [],
        fieldsChanged: [],
        resolvedSourceLine: null,
        resolvedSourcePath: '',
      },
      over || {}
    );
  }

  // ---- locating ------------------------------------------------------------

  function findManagedCommentLine(lines, fromIndex) {
    // Mirrors the ACT 5A reader: immediate next line, or the line after exactly
    // one blank line, stopping at a blank/heading/Project declaration/fence.
    let cursor = fromIndex;
    let blanks = 0;
    const parser = globalThis.parseManagedProjectComment;

    while (cursor < lines.length) {
      const raw = lines[cursor];
      const trimmed = String(raw == null ? '' : raw).trim();
      if (!trimmed) {
        blanks += 1;
        if (blanks > 1) return null;
        cursor += 1;
        continue;
      }
      if (/^#{1,6}\s/.test(trimmed)) return null;
      if (typeof parser === 'function') {
        const parsed = parser(raw);
        if (parsed && parsed.present) return { index: cursor, parsed };
      }
      if (/^Project\s*:/i.test(trimmed)) return null;
      cursor += 1;
    }
    return null;
  }

  // Returns { ok, reason, declIndex, comment, id, sourceLine } for the single
  // Project whose managed id equals projectId.
  function locateProject(markdown, projectId) {
    const wantId = String(projectId == null ? '' : projectId).trim();
    if (!wantId) {
      return { ok: false, reason: REASONS.PROJECT_ID_MISSING };
    }

    const lines = String(markdown).split(/\r?\n/);
    const hits = [];

    for (let i = 0; i < lines.length; i += 1) {
      const trimmed = String(lines[i] || '').trim();
      if (!/^Project\s*:/i.test(trimmed)) continue;
      const found = findManagedCommentLine(lines, i + 1);
      if (!found || !found.parsed || !found.parsed.fields) continue;
      if (String(found.parsed.fields.id || '') === wantId) {
        hits.push({ declIndex: i, comment: found, id: wantId });
      }
    }

    if (!hits.length) return { ok: false, reason: REASONS.PROJECT_NOT_FOUND };
    if (hits.length > 1) return { ok: false, reason: REASONS.DUPLICATE_PROJECT_ID };
    return Object.assign({ ok: true }, hits[0]);
  }

  // ---- visible-line token rewriting ---------------------------------------

  // Rebuilds the declaration line, consuming only exact trailing tokens.
  // Title (including arbitrary bracketed text and Wiki Links) is preserved
  // byte-for-byte.
  function splitDeclaration(line) {
    const m = String(line).match(/^(\s*(?:[-*+]\s+)?Project\s*:\s*)(.*)$/i);
    if (!m) return null;
    return { prefix: m[1], body: m[2] };
  }

  function trailingTokens(body) {
    let rest = body;
    const values = [];
    const orders = [];
    for (let i = 0; i < 16; i += 1) {
      const trimmed = rest.replace(/\s+$/, '');
      if (trimmed.charAt(trimmed.length - 1) !== ']') {
        rest = trimmed;
        break;
      }
      const open = trimmed.lastIndexOf('[');
      if (open <= 0) {
        rest = trimmed;
        break;
      }
      const inner = trimmed.slice(open + 1, trimmed.length - 1);
      if (inner.indexOf('[') !== -1 || inner.indexOf(']') !== -1) {
        rest = trimmed;
        break;
      }
      if (/^\d+(?:\.\d+)?[ \t]+[A-Za-z]{3}$/.test(inner)) {
        // Keep the canonical bracket group, delimiters included.
        values.push('[' + inner + ']');
      } else if (/^(\d{2}|\d{4})[/-]?[qQ][1-4]$/.test(inner)) {
        orders.push('[' + inner + ']');
      } else {
        rest = trimmed;
        break;
      }
      rest = trimmed.slice(0, open);
    }
    return { title: rest.trim(), values, orders };
  }

  function compactQuarter(canonical) {
    const m = String(canonical || '').match(/^(\d{4})-Q([1-4])$/);
    if (!m) return '';
    return String(m[1]).slice(-2) + 'Q' + m[2];
  }

  // ---- managed-comment rewriting ------------------------------------------

  function serializeComment(fields, extras) {
    const parser = globalThis.serializeManagedProjectComment;
    return parser(fields, extras || {});
  }

  const MME_PROJECT_METADATA_MUTATION = {
    REASONS,
    STAGE_CANONICAL,
    STATE_CANONICAL,

    /**
     * Mutate one Project's metadata by projectId.
     *
     * @param {string} markdown
     * @param {{projectId: string, today?: string}} target
     * @param {{op: string, value?: any, currency?: string, quarter?: string}} request
     */
    mutateProject(markdown, target, request) {
      const source = String(markdown == null ? '' : markdown);
      const req = request || {};
      const op = String(req.op || '');

      const located = locateProject(source, target && target.projectId);
      if (!located.ok) {
        // A refused mutation ALWAYS reports the untouched original Markdown, so
        // a caller can never mistake a refusal for a proposal.
        return result({
          ok: false,
          reason: located.reason,
          projectId: String((target && target.projectId) || ''),
          proposedMarkdown: source,
        });
      }

      const projectId = located.id;
      const diagnostics = [];
      const comment = located.comment.parsed;

      if (!comment.valid) {
        diagnostics.push({ code: 'malformed-project-comment', detail: '' });
        return result({
          ok: false,
          reason: REASONS.MALFORMED_PROJECT_COMMENT,
          projectId,
          proposedMarkdown: source,
          diagnostics,
        });
      }

      const lines = source.split(/\r?\n/);
      const fieldsChanged = [];

      // ---------------- visible-line operations ----------------
      if (VISIBLE_OPS.has(op)) {
        const parsed = splitDeclaration(lines[located.declIndex]);
        if (!parsed) {
          return result({ ok: false, reason: REASONS.PROJECT_NOT_FOUND, projectId, proposedMarkdown: source, diagnostics });
        }
        const tokens = trailingTokens(parsed.body);

        if (op === 'clearValueCurrency') {
          tokens.values.length = 0;
          fieldsChanged.push('value', 'currency');
        } else if (op === 'setValueCurrency') {
          const rawValue = req.value;
          const rawCurrency = String(req.currency == null ? '' : req.currency).trim();
          if (!VALUE_RE.test(String(rawValue == null ? '' : rawValue).trim())) {
            return result({ ok: false, reason: REASONS.INVALID_VALUE, projectId, proposedMarkdown: source, diagnostics });
          }
          if (!CURRENCY_RE.test(rawCurrency)) {
            return result({ ok: false, reason: REASONS.INVALID_CURRENCY, projectId, proposedMarkdown: source, diagnostics });
          }
          // Value and currency are ONE atomic pair: never one without the other.
          tokens.values.length = 0;
          tokens.values.push('[' + String(rawValue).trim() + ' ' + rawCurrency.toUpperCase() + ']');
          fieldsChanged.push('value', 'currency');
        } else if (op === 'clearExpectedOrder') {
          tokens.orders.length = 0;
          fieldsChanged.push('expectedOrder');
        } else if (op === 'setExpectedOrder') {
          const q = globalThis.normalizeProjectQuarter
            ? globalThis.normalizeProjectQuarter(String(req.quarter == null ? '' : req.quarter))
            : { valid: false };
          if (!q || !q.valid) {
            return result({ ok: false, reason: REASONS.INVALID_QUARTER, projectId, proposedMarkdown: source, diagnostics });
          }
          tokens.orders.length = 0;
          tokens.orders.push('[' + compactQuarter(q.canonical) + ']');
          fieldsChanged.push('expectedOrder');
        }

        // Canonical order is always value/currency BEFORE Expected Order.
        const suffix = tokens.values.concat(tokens.orders);
        const rebuilt = suffix.length ? tokens.title + ' ' + suffix.join(' ') : tokens.title;
        const next = lines.slice();
        next[located.declIndex] = parsed.prefix + rebuilt;
        const proposed = next.join('\n');

        if (proposed === source) {
          return result({ ok: true, changed: false, reason: REASONS.NO_CHANGE, projectId, proposedMarkdown: source, diagnostics, fieldsChanged: [], resolvedSourceLine: located.declIndex + 1, resolvedSourcePath: '' });
        }
        return result({ ok: true, changed: true, reason: '', projectId, proposedMarkdown: proposed, diagnostics, fieldsChanged, resolvedSourceLine: located.declIndex + 1, resolvedSourcePath: '' });
      }

      // ---------------- managed-comment operations ----------------
      if (MANAGED_OPS.has(op)) {
        const owned = Object.assign({}, comment.fields);
        // Unknown accepted fields survive untouched.
        const extras = Object.assign({}, comment.extraFields);
        // id and created are NOT owned by a mutation: they are removed here and
        // re-emitted verbatim from the parsed comment, so no operation can ever
        // regenerate or rewrite them.
        delete owned.id;
        delete owned.created;

        const setOrClear = (key, value, reason) => {
          if (value === null) {
            delete owned[key];
          } else {
            owned[key] = value;
          }
        };

        if (op === 'setStage' || op === 'clearStage') {
          const v = op === 'clearStage' ? null : String(req.value == null ? '' : req.value).trim().toLowerCase();
          if (v !== null && STAGE_CANONICAL.indexOf(v) === -1) {
            return result({ ok: false, reason: REASONS.UNSUPPORTED_STAGE, projectId, proposedMarkdown: source, diagnostics });
          }
          setOrClear('stage', v);
          fieldsChanged.push('stage');
        } else if (op === 'setState' || op === 'clearState') {
          const v = op === 'clearState' ? null : String(req.value == null ? '' : req.value).trim().toLowerCase();
          if (v !== null && STATE_CANONICAL.indexOf(v) === -1) {
            return result({ ok: false, reason: REASONS.UNSUPPORTED_STATE, projectId, proposedMarkdown: source, diagnostics });
          }
          setOrClear('state', v);
          fieldsChanged.push('state');
        } else if (op === 'setExpectedDelivery' || op === 'clearExpectedDelivery') {
          let v = null;
          if (op !== 'clearExpectedDelivery') {
            const q = globalThis.normalizeProjectQuarter
              ? globalThis.normalizeProjectQuarter(String(req.quarter == null ? '' : req.quarter))
              : { valid: false };
            if (!q || !q.valid) {
              return result({ ok: false, reason: REASONS.INVALID_QUARTER, projectId, proposedMarkdown: source, diagnostics });
            }
            v = compactQuarter(q.canonical);
          }
          setOrClear('delivery', v);
          fieldsChanged.push('expectedDelivery');
        } else if (op === 'setExpectedBilling' || op === 'clearExpectedBilling') {
          let v = null;
          if (op !== 'clearExpectedBilling') {
            const q = globalThis.normalizeProjectQuarter
              ? globalThis.normalizeProjectQuarter(String(req.quarter == null ? '' : req.quarter))
              : { valid: false };
            if (!q || !q.valid) {
              return result({ ok: false, reason: REASONS.INVALID_QUARTER, projectId, proposedMarkdown: source, diagnostics });
            }
            v = compactQuarter(q.canonical);
          }
          setOrClear('billing', v);
          fieldsChanged.push('expectedBilling');
        }

        // projectId and created are NEVER touched by a mutation.
        const next = lines.slice();
        next[located.comment.index] = serializeComment(
          Object.assign({ id: projectId, created: comment.fields.created }, owned),
          extras
        );
        const proposed = next.join('\n');

        if (proposed === source) {
          return result({ ok: true, changed: false, reason: REASONS.NO_CHANGE, projectId, proposedMarkdown: source, diagnostics, fieldsChanged: [], resolvedSourceLine: located.declIndex + 1, resolvedSourcePath: '' });
        }
        return result({ ok: true, changed: true, reason: '', projectId, proposedMarkdown: proposed, diagnostics, fieldsChanged, resolvedSourceLine: located.declIndex + 1, resolvedSourcePath: '' });
      }

      return result({ ok: false, reason: REASONS.UNSUPPORTED_OPERATION, projectId, proposedMarkdown: source, diagnostics });
    },
  };

  try {
    globalThis.MME_PROJECT_METADATA_MUTATION = MME_PROJECT_METADATA_MUTATION;
    window.MME_PROJECT_METADATA_MUTATION = MME_PROJECT_METADATA_MUTATION;
  } catch {}
})();
