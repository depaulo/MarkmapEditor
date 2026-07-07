// @ts-nocheck
// Extracted template menu behavior.
(function () {
  const __TPL_MY_KEY = 'markmap:templates:my:v1';

  function __tplLoadMy() {
    try {
      const raw = localStorage.getItem(__TPL_MY_KEY);
      if (!raw) return [];
      const obj = JSON.parse(raw);
      return Array.isArray(obj?.items) ? obj.items : [];
    } catch {
      return [];
    }
  }

  function __tplSaveMy(items) {
    try {
      localStorage.setItem(
        __TPL_MY_KEY,
        JSON.stringify({ version: 1, updatedAt: Date.now(), items })
      );
      return true;
    } catch {
      return false;
    }
  }

  function __tplId(prefix = 'my') {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function getTemplateDateString() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function applyTemplatePlaceholders(text) {
    const dateString = getTemplateDateString();

    return String(text || '')
      .replaceAll('{{date}}', dateString)
      .replaceAll('{{today}}', dateString)
      .replaceAll('{{created}}', dateString)
      .replaceAll('{{journalDate}}', dateString);
  }

  function __tplInsert(body) {
    const replaced = applyTemplatePlaceholders(body);
    const txt = String(replaced || '').trimEnd();
    if (!txt) return;
    try {
      if (typeof __insertIntoEditor === 'function') {
        __insertIntoEditor(txt + '\n\n');
      } else if (typeof window.__cmInsertAtCursor === 'function') {
        window.__cmInsertAtCursor(txt + '\n\n');
      } else {
        const mdEl = document.getElementById('md');
        if (!mdEl) return;
        const start = mdEl.selectionStart ?? mdEl.value.length;
        const end = mdEl.selectionEnd ?? mdEl.value.length;
        mdEl.value = mdEl.value.slice(0, start) + txt + '\n\n' + mdEl.value.slice(end);
        mdEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } catch {}
  }

  const __tplBtn = document.getElementById('btnTemplatesMarkmap');
  const __tplMenu = document.getElementById('tplMenu');
  const __tplPandocBtn = document.getElementById('btnTemplatesPandoc');
  const __tplPandocMenu = document.getElementById('tplPandocMenu');

  function __tplHide() {
    if (__tplMenu) __tplMenu.style.display = 'none';
  }

  function __tplPandocHide() {
    if (__tplPandocMenu) __tplPandocMenu.style.display = 'none';
  }

  function __tplPos() {
    try {
      if (!__tplBtn || !__tplMenu) return;
      const r = __tplBtn.getBoundingClientRect();
      const top = r.bottom + 6;
      const left = Math.max(8, Math.min(window.innerWidth - 340, r.left));
      __tplMenu.style.top = top + 'px';
      __tplMenu.style.left = left + 'px';
    } catch {}
  }

  function __tplPandocPos() {
    try {
      if (!__tplPandocBtn || !__tplPandocMenu) return;
      const r = __tplPandocBtn.getBoundingClientRect();
      const top = r.bottom + 6;
      const left = Math.max(8, Math.min(window.innerWidth - 340, r.left));
      __tplPandocMenu.style.top = top + 'px';
      __tplPandocMenu.style.left = left + 'px';
    } catch {}
  }

  function __tplPickFromList(title, items, labelFn) {
    if (!items.length) {
      globalThis.showToast?.('No items available', 'error', 2400);
      return null;
    }
    const list = items.map((x, i) => `${i + 1}) ${labelFn(x)}`).join('\n');
    const v = prompt(`${title}\n\n${list}\n\nEnter a number:`);
    if (!v) return null;
    const n = parseInt(v, 10);
    if (!n || n < 1 || n > items.length) return null;
    return items[n - 1];
  }

  function __tplNewMy() {
    const name = prompt('My template name:');
    if (!name) return;

    globalThis.tplEditModalOpen?.({
      title: `New My template: ${name}`,
      initial: `# ${name}\n`,
      onSave: (body) => {
        if (!body) return;
        const items = __tplLoadMy();
        items.unshift({
          id: __tplId('my'),
          name: name.trim(),
          body: body,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        __tplSaveMy(items);
        globalThis.showToast?.('Saved ✓ My template', 'ok');
      },
    });
  }

  function __tplDupOrgPicker() {
    const org = __tplPickFromList(
      'Duplicate which Org template to My?',
      globalThis.__TPL_ORG || window.__TPL_ORG || [],
      (x) => x.name
    );
    if (!org) return;
    __tplDupOrgToMy(org);
  }

  function __tplOrg() {
    return globalThis.__TPL_ORG || window.__TPL_ORG || [];
  }

  function __tplDupOrgToMy(org) {
    const defaultName = org.name.replace(/^\S+\s+/, '') + ' (copy)';
    const name = prompt('Name for My template:', defaultName);
    if (!name) return;
    const items = __tplLoadMy();
    items.unshift({
      id: __tplId(`my_${org.id}`),
      name: name.trim(),
      body: org.body,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fromOrgId: org.id,
    });
    __tplSaveMy(items);
    globalThis.showToast?.('Saved ✓ Duplicated to My templates', 'ok');
  }

  function __tplEditMy() {
    const items = __tplLoadMy();
    const t = __tplPickFromList('Edit which My template?', items, (x) => x.name);
    if (!t) return;

    globalThis.tplEditModalOpen?.({
      title: `Edit My template: ${t.name}`,
      initial: t.body || '',
      onSave: (body) => {
        if (body == null) return;
        t.body = body;
        t.updatedAt = Date.now();
        __tplSaveMy(items);
        globalThis.showToast?.('Saved ✓ Template updated', 'ok');
      },
    });
  }

  function __tplRenameMy() {
    const items = __tplLoadMy();
    const t = __tplPickFromList('Rename which My template?', items, (x) => x.name);
    if (!t) return;
    const name = prompt('New name:', t.name || '');
    if (!name) return;
    t.name = name.trim();
    t.updatedAt = Date.now();
    __tplSaveMy(items);
    globalThis.showToast?.('Saved ✓ Template renamed', 'ok');
  }

  function __tplDeleteMy() {
    const items = __tplLoadMy();
    const t = __tplPickFromList('Delete which My template?', items, (x) => x.name);
    if (!t) return;
    const ok = confirm(`Delete My template "${t.name}"?`);
    if (!ok) return;
    __tplSaveMy(items.filter((x) => x.id !== t.id));
    globalThis.showToast?.('Deleted ✓ My template', 'ok');
  }

  function __tplExportMy() {
    const items = __tplLoadMy();
    const payload = { version: 1, exportedAt: new Date().toISOString(), items };
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-templates_${globalThis.todayStamp?.() || new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    globalThis.showToast?.('Exported ✓ My templates JSON', 'download', 2600);
  }

  async function __tplImportMy() {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.style.display = 'none';
      document.body.appendChild(input);
      const file = await new Promise((resolve) => {
        input.onchange = () => resolve(input.files && input.files[0]);
        input.click();
      });
      input.remove();
      if (!file) return;
      const text = await file.text();
      const obj = JSON.parse(text);
      const imported = Array.isArray(obj?.items) ? obj.items : [];
      if (!imported.length) {
        globalThis.showToast?.('Import: no templates found', 'error', 2600);
        return;
      }

      const existing = __tplLoadMy();
      const byId = new Map(existing.map((x) => [x.id, x]));
      let added = 0,
        updated = 0;

      for (const it of imported) {
        if (!it || !it.name || !it.body) continue;
        const id = typeof it.id === 'string' && it.id ? it.id : __tplId('my');
        if (byId.has(id)) {
          const target = byId.get(id);
          target.name = String(it.name);
          target.body = String(it.body);
          target.updatedAt = Date.now();
          updated++;
        } else {
          const obj2 = {
            id,
            name: String(it.name),
            body: String(it.body),
            createdAt: it.createdAt || Date.now(),
            updatedAt: Date.now(),
            fromOrgId: it.fromOrgId || null,
          };
          existing.unshift(obj2);
          byId.set(id, obj2);
          added++;
        }
      }

      __tplSaveMy(existing);
      globalThis.showToast?.(`Imported ✓ ${added} added, ${updated} updated`, 'ok', 3200);
    } catch (e) {
      globalThis.showToast?.('Import error: ' + (e?.message || String(e)), 'error', 3500);
    }
  }

  function getCurrentTemplateGroup() {
    const contextId =
      globalThis.currentAppContextId ||
      document.documentElement.dataset.appContext ||
      localStorage.getItem('markmap:appContext') ||
      'editor';

    if (contextId === 'slides') {
      return 'slides';
    }

    if (contextId === 'journal') {
      const workspaceState =
        globalThis.WORKSPACE_STATE ||
        window.WORKSPACE_STATE ||
        null;

      const activeKind =
        typeof globalThis.normalizeWorkspaceKindForCompare === 'function'
          ? globalThis.normalizeWorkspaceKindForCompare(workspaceState?.activeFile?.kind || '')
          : String(workspaceState?.activeFile?.kind || '').trim();

      if (activeKind === 'concepts') {
        return 'concept';
      }

      return 'journal';
    }

    return 'editor';
  }

  function getTemplateGroupLabel(group) {
    if (group === 'editor') return 'Editor Templates';
    if (group === 'journal') return 'Journal Templates';
    if (group === 'concept') return 'Concept Templates';
    if (group === 'slides') return 'Pandoc / Slides Templates';
    return 'Templates';
  }

  function __tplShow() {
    if (!__tplMenu) return;
    __tplPos();
    __tplMenu.innerHTML = '';

    const group = getCurrentTemplateGroup();
    const groupLabel = getTemplateGroupLabel(group);

    __tplMenu.appendChild(globalThis.makeMenuHeader?.(groupLabel) || makeMenuHeader(groupLabel));

    const visibleOrgTemplates = __tplOrg().filter((tpl) => {
      return !tpl.context || tpl.context === group;
    });

    if (visibleOrgTemplates.length) {
      __tplMenu.appendChild(globalThis.makeMenuHeader?.('Org templates (read-only)') || makeMenuHeader('Org templates (read-only)'));

      const orgWrap = document.createElement('div');
      orgWrap.className = 'menuList';
      for (const t of visibleOrgTemplates) {
        orgWrap.appendChild(
          globalThis.makeMenuItem?.(
            t.name,
            () => {
              __tplHide();
              __tplInsert(t.body);
            },
            { icon: '🏛️' }
          ) || makeMenuItem(t.name, () => {
            __tplHide();
            __tplInsert(t.body);
          }, { icon: '🏛️' })
        );
      }
      __tplMenu.appendChild(orgWrap);
      __tplMenu.appendChild(globalThis.makeMenuSep?.() || makeMenuSep());
    }

    __tplMenu.appendChild(globalThis.makeMenuHeader?.('My templates') || makeMenuHeader('My templates'));

    const mine = __tplLoadMy();
    const myWrap = document.createElement('div');
    myWrap.className = 'menuList';
    if (mine.length) {
      for (const t of mine) {
        myWrap.appendChild(
          globalThis.makeMenuItem?.(
            '🧩 ' + t.name,
            () => {
              __tplHide();
              __tplInsert(t.body);
            },
            { icon: '👤' }
          ) || makeMenuItem('🧩 ' + t.name, () => {
            __tplHide();
            __tplInsert(t.body);
          }, { icon: '👤' })
        );
      }
    } else {
      myWrap.appendChild(globalThis.makeMenuHeader?.('No My templates yet') || makeMenuHeader('No My templates yet'));
    }
    __tplMenu.appendChild(myWrap);

    __tplMenu.appendChild(globalThis.makeMenuSep?.() || makeMenuSep());
    __tplMenu.appendChild(globalThis.makeMenuHeader?.('Actions') || makeMenuHeader('Actions'));

    __tplMenu.appendChild(
      globalThis.makeMenuItem?.(
        'New My template…',
        () => {
          __tplHide();
          __tplNewMy();
        },
        { icon: '➕' }
      ) || makeMenuItem('New My template…', () => {
        __tplHide();
        __tplNewMy();
      }, { icon: '➕' })
    );
    __tplMenu.appendChild(
      globalThis.makeMenuItem?.(
        'Duplicate Org → My…',
        () => {
          __tplHide();
          __tplDupOrgPicker();
        },
        { icon: '📋' }
      ) || makeMenuItem('Duplicate Org → My…', () => {
        __tplHide();
        __tplDupOrgPicker();
      }, { icon: '📋' })
    );
    __tplMenu.appendChild(
      globalThis.makeMenuItem?.(
        'Edit My template…',
        () => {
          __tplHide();
          __tplEditMy();
        },
        { icon: '✏️' }
      ) || makeMenuItem('Edit My template…', () => {
        __tplHide();
        __tplEditMy();
      }, { icon: '✏️' })
    );
    __tplMenu.appendChild(
      globalThis.makeMenuItem?.(
        'Rename My template…',
        () => {
          __tplHide();
          __tplRenameMy();
        },
        { icon: '📝' }
      ) || makeMenuItem('Rename My template…', () => {
        __tplHide();
        __tplRenameMy();
      }, { icon: '📝' })
    );
    __tplMenu.appendChild(
      globalThis.makeMenuItem?.(
        'Delete My template…',
        () => {
          __tplHide();
          __tplDeleteMy();
        },
        { icon: '🗑️' }
      ) || makeMenuItem('Delete My template…', () => {
        __tplHide();
        __tplDeleteMy();
      }, { icon: '🗑️' })
    );
    __tplMenu.appendChild(globalThis.makeMenuSep?.() || makeMenuSep());
    __tplMenu.appendChild(
      globalThis.makeMenuItem?.(
        'Export My templates (JSON)…',
        () => {
          __tplHide();
          __tplExportMy();
        },
        { icon: '⬇️' }
      ) || makeMenuItem('Export My templates (JSON)…', () => {
        __tplHide();
        __tplExportMy();
      }, { icon: '⬇️' })
    );
    __tplMenu.appendChild(
      globalThis.makeMenuItem?.(
        'Import My templates (JSON)…',
        () => {
          __tplHide();
          __tplImportMy();
        },
        { icon: '⬆️' }
      ) || makeMenuItem('Import My templates (JSON)…', () => {
        __tplHide();
        __tplImportMy();
      }, { icon: '⬆️' })
    );

    __tplMenu.style.display = 'flex';
  }

  function __tplPandocShow() {
    if (!__tplPandocMenu) return;

    __tplPandocPos();
    __tplPandocMenu.innerHTML = '';

    __tplPandocMenu.appendChild(globalThis.makeMenuHeader?.('Pandoc templates') || makeMenuHeader('Pandoc templates'));
    __tplPandocMenu.appendChild(globalThis.makeMenuHeader?.('Slides / PPTX export templates') || makeMenuHeader('Slides / PPTX export templates'));

    const pandocWrap = document.createElement('div');
    pandocWrap.className = 'menuList';

    const pandocTemplates = globalThis.__TPL_PANDOC_ORG || window.__TPL_PANDOC_ORG || [];
    for (const t of pandocTemplates) {
      pandocWrap.appendChild(
        globalThis.makeMenuItem?.(
          t.name,
          () => {
            __tplPandocHide();
            __tplInsert(t.body);
          },
          { icon: '📊' }
        ) || makeMenuItem(t.name, () => {
          __tplPandocHide();
          __tplInsert(t.body);
        }, { icon: '📊' })
      );
    }

    __tplPandocMenu.appendChild(pandocWrap);

    __tplPandocMenu.appendChild(globalThis.makeMenuSep?.() || makeMenuSep());

    __tplPandocMenu.appendChild(
      globalThis.makeMenuItem?.(
        'Export Slides Markdown (.md)',
        () => {
          __tplPandocHide();
          globalThis.exportMarkdownDownload?.();
        },
        { icon: '⬇️' }
      ) || makeMenuItem('Export Slides Markdown (.md)', () => {
        __tplPandocHide();
        globalThis.exportMarkdownDownload?.();
      }, { icon: '⬇️' })
    );

    __tplPandocMenu.appendChild(globalThis.makeMenuSep?.() || makeMenuSep());
    __tplPandocMenu.appendChild(globalThis.makeMenuHeader?.('Convert with Pandoc after export.') || makeMenuHeader('Convert with Pandoc after export.'));
    __tplPandocMenu.appendChild(
      globalThis.makeMenuHeader?.('pandoc file.md -o output.pptx --reference-doc=PandocTemplateV4.pptx') || makeMenuHeader('pandoc file.md -o output.pptx --reference-doc=PandocTemplateV4.pptx')
    );

    __tplPandocMenu.style.display = 'flex';
  }

  if (__tplBtn && !__tplBtn.__bound) {
    __tplBtn.addEventListener('click', () => {
      const open = __tplMenu && __tplMenu.style.display === 'flex';

      __tplPandocHide();

      if (open) __tplHide();
      else __tplShow();
    });

    __tplBtn.__bound = true;
  }

  if (__tplPandocBtn && !__tplPandocBtn.__bound) {
    __tplPandocBtn.addEventListener('click', () => {
      const open = __tplPandocMenu && __tplPandocMenu.style.display === 'flex';

      __tplHide();

      if (open) __tplPandocHide();
      else __tplPandocShow();
    });

    __tplPandocBtn.__bound = true;
  }

  document.addEventListener('mousedown', (e) => {
    const markmapOpen = __tplMenu && __tplMenu.style.display === 'flex';
    const pandocOpen = __tplPandocMenu && __tplPandocMenu.style.display === 'flex';

    if (!markmapOpen && !pandocOpen) return;

    if (__tplMenu && __tplMenu.contains(e.target)) return;
    if (__tplPandocMenu && __tplPandocMenu.contains(e.target)) return;

    if (__tplBtn && (e.target === __tplBtn || __tplBtn.contains(e.target))) return;
    if (__tplPandocBtn && (e.target === __tplPandocBtn || __tplPandocBtn.contains(e.target))) return;

    __tplHide();
    __tplPandocHide();
  });

  window.addEventListener('resize', () => {
    if (__tplMenu && __tplMenu.style.display === 'flex') __tplPos();
    if (__tplPandocMenu && __tplPandocMenu.style.display === 'flex') __tplPandocPos();
  });

  try {
    window.__tplShow = __tplShow;
    window.__tplPandocShow = __tplPandocShow;
    window.__tplLoadMy = __tplLoadMy;
    window.__tplSaveMy = __tplSaveMy;

    globalThis.__tplShow = __tplShow;
    globalThis.__tplPandocShow = __tplPandocShow;
    globalThis.__tplLoadMy = __tplLoadMy;
    globalThis.__tplSaveMy = __tplSaveMy;
  } catch {}
})();
