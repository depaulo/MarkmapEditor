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

        return marked.parse(mdText, { renderer });
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
      const PWA_DEBUG_LOGS = true;

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

      function setStatus(s) {
        saveStatus.textContent = s || '';
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

      function __insertIntoEditor(str) {
        try {
          if (typeof window.__cmInsertAtCursor === 'function') {
            window.__cmInsertAtCursor(str);
            return;
          }
        } catch {}
        try {
          const start = md.selectionStart ?? md.value.length;
          const end = md.selectionEnd ?? md.value.length;
          md.value = md.value.slice(0, start) + str + md.value.slice(end);
          md.focus();
          const pos = start + str.length;
          md.selectionStart = md.selectionEnd = pos;
          md.dispatchEvent(new Event('input', { bubbles: true }));
          if (typeof window.__cmSetText === 'function') window.__cmSetText(md.value);
        } catch {}
      }

      function __addImageOnline() {
        const url = prompt(
          'Cole o endereço (URL) direto da imagem (terminando em .png/.jpg/.jpeg/.gif/.webp/.svg/.avif):'
        );
        if (!url) {
          __addImageLog('AddImage: online canceled');
          return;
        }
        if (!__isDirectImageUrl(url)) {
          const msg = 'URL inválida: use o link direto do arquivo de imagem (ex.: .png/.jpg)';
          showToast(msg, 'error', 3800);
          __addImageLog('AddImage: blocked non-image URL -> ' + url);
          return;
        }
        const alt = prompt('Alt text (opcional):', 'image') || 'image';
        const mdImg = __buildImgMd(alt, url);
        if (!mdImg) return;
        __insertIntoEditor(mdImg + '\n');
        showToast('Image link inserted (online)', 'ok');
        __addImageLog('AddImage: inserted online');
      }

      function __addImageLocalPick() {
        if (!__imageFileInput) {
          __addImageLog('AddImage: imageFile input missing');
          return;
        }
        __imageFileInput.value = '';
        __imageFileInput.click();
        __addImageLog('AddImage: opened local picker');
      }

      if (__imageFileInput && !__imageFileInput.__addImageBound) {
        __imageFileInput.addEventListener('change', (e) => {
          try {
            const f = e.target.files && e.target.files[0];
            if (!f) {
              __addImageLog('AddImage: local empty');
              return;
            }
            const rel = `./images/${f.name}`;
            const alt = __filenameToAlt(f.name);
            const mdImg = __buildImgMd(alt, rel);
            __insertIntoEditor(mdImg + '\n');
            showToast('Local link inserted — place file in ./images next to the .md', 'ok', 3200);
            __addImageLog(`AddImage: inserted local -> ${rel}`);
          } catch (err) {
            __addImageLog('AddImage: local insert failed: ' + (err?.message || err));
          }
        });
        __imageFileInput.__addImageBound = true;
      }

      function __showImageMenu() {
        if (!__imageMenu) {
          __addImageLog('AddImage: imageMenu missing');
          return;
        }
        __positionImageMenu();
        __imageMenu.innerHTML = '';
        __imageMenu.appendChild(makeMenuHeader('Add image'));
        __imageMenu.appendChild(
          makeMenuItem(
            'Online (URL)…',
            () => {
              __hideImageMenu();
              __addImageOnline();
            },
            { icon: '🌐' }
          )
        );
        __imageMenu.appendChild(
          makeMenuItem(
            'Local (relative)…',
            () => {
              __hideImageMenu();
              __addImageLocalPick();
            },
            { icon: '🖼️' }
          )
        );
        __imageMenu.appendChild(makeMenuSep());
        __imageMenu.appendChild(makeMenuHeader('Online: must be a direct image file URL'));
        __imageMenu.appendChild(makeMenuHeader('Local: assumes ./images/<filename>'));
        __imageMenu.style.display = 'flex';
        __addImageLog('AddImage: menu shown');
      }

      document.addEventListener('mousedown', (e) => {
        if (!__imageMenu || __imageMenu.style.display !== 'flex') return;
        if (__imageMenu.contains(e.target)) return;
        if (__btnAddImage && (__btnAddImage === e.target || __btnAddImage.contains(e.target)))
          return;
        __hideImageMenu();
      });

      window.addEventListener('resize', () => {
        if (__imageMenu && __imageMenu.style.display === 'flex') __positionImageMenu();
      });

      __addImageLog(
        'AddImage: boot check btnAddImage=' + !!__btnAddImage + ' imageMenu=' + !!__imageMenu
      );

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

      function showExportMenu() {
        try {
          if (!exportMenu) return;

          positionExportMenu();
          exportMenu.innerHTML = '';

          exportMenu.appendChild(makeMenuHeader('Export'));

          exportMenu.appendChild(
            makeMenuItem(
              'Markdown (Pandoc .md)',
              () => {
                hideExportMenu();
                exportMarkdownDownload();
              },
              { icon: '📝' }
            )
          );

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
      const TEMPLATES_V1_TEAM = true;
      const __TPL_MY_KEY = 'markmap:templates:my:v1';

      const __TPL_ORG = [
        {
          id: 'meeting_notes',
          name: '🗓️ Meeting Notes',
          body: `# 🗓️ Meeting Notes
## 🎯 Purpose
- ⟨Why are we meeting?⟩
## 👥 Attendees
- ⟨Name⟩
## 🧩 Agenda
- ⟨Topic 1⟩
- ⟨Topic 2⟩
## 📝 Notes
- ⟨Key points⟩
## ✅ Decisions
- ⟨Decision⟩ — ⟨Owner⟩ — ⟨Rationale⟩
## 🛠️ Action Items
- [ ] ⟨Action⟩ — ⟨Owner⟩ — ⟨Due date⟩
## ⚠️ Risks / Blockers
- ⟨Risk⟩ — ⟨Mitigation⟩
## 📌 Parking Lot
- ⟨Out of scope topic⟩
`,
        },

        {
          id: 'one_on_one',
          name: '🤝 1:1 Notes',
          body: `# 🤝 1:1 Notes
## 🧭 Context
- ⟨Role / current priorities⟩
## 🗂️ Topics
- ⟨Topic 1⟩
- ⟨Topic 2⟩
## 🌟 Wins
- ⟨What went well⟩
## 🧱 Challenges
- ⟨What’s hard / blocked⟩
## 💬 Feedback
- ✅ Keep doing
  - ⟨Item⟩
- 🔁 Start doing
  - ⟨Item⟩
- 🛑 Stop doing
  - ⟨Item⟩
## 🎯 Growth & Career
- ⟨Skills to build⟩
- ⟨Opportunities⟩
## 🧾 Commitments
- ⟨Commitment⟩ — ⟨Owner⟩ — ⟨Due date⟩
## ✅ Next Steps
- [ ] ⟨Action⟩ — ⟨Owner⟩ — ⟨Due date⟩
`,
        },

        {
          id: 'project_plan',
          name: '🚀 Project Plan',
          body: `# 🚀 Project Plan
## 🎯 Goal
- ⟨What success looks like⟩
## 📌 Scope
- ✅ In scope
  - ⟨Item⟩
- 🚫 Out of scope
  - ⟨Item⟩
## 🧱 Deliverables
- ⟨Deliverable 1⟩
- ⟨Deliverable 2⟩
## 🗺️ Milestones
- 🏁 M1: ⟨Milestone⟩ — ⟨Date⟩
- 🏁 M2: ⟨Milestone⟩ — ⟨Date⟩
## 👤 Owners
- ⟨Workstream⟩ — ⟨Owner⟩
## 📊 Metrics
- ⟨Metric⟩ — ⟨Target⟩
## 🧩 Dependencies
- ⟨Dependency⟩ — ⟨Owner⟩
## ⚠️ Risks
- ⟨Risk⟩ — ⟨Mitigation⟩ — ⟨Owner⟩
## 📅 Timeline
- ⟨Phase⟩ — ⟨Start⟩ → ⟨End⟩
## ✅ Next Actions
- [ ] ⟨Action⟩ — ⟨Owner⟩ — ⟨Due date⟩
`,
        },

        {
          id: 'decision_record',
          name: '🧾 Decision Record',
          body: `# 🧾 Decision Record
## 🧠 Context
- ⟨Why a decision is needed⟩
## 🎯 Objective
- ⟨What we optimize for⟩
## 🧪 Options
- Option A
  - ✅ Pros
    - ⟨Pro⟩
  - ⚠️ Cons
    - ⟨Con⟩
- Option B
  - ✅ Pros
    - ⟨Pro⟩
  - ⚠️ Cons
    - ⟨Con⟩
## ✅ Decision
- ⟨Chosen option⟩
## 🧩 Rationale
- ⟨Why this was chosen⟩
## 🔄 Tradeoffs
- ⟨Tradeoff⟩
## 📌 Impact
- 👥 People
  - ⟨Impact⟩
- 🧱 Process
  - ⟨Impact⟩
- 🛠️ Tech
  - ⟨Impact⟩
## 🗓️ Follow-up
- [ ] ⟨Action⟩ — ⟨Owner⟩ — ⟨Due date⟩
`,
        },

        {
          id: 'weekly_update',
          name: '📣 Weekly Update',
          body: `# 📣 Weekly Update
## 🧭 Summary
- ⟨One sentence summary⟩
## 🌟 Wins
- ⟨Win 1⟩
- ⟨Win 2⟩
## 📊 Metrics
- ⟨Metric⟩ — ⟨This week⟩ → ⟨Trend⟩
## 🧱 Blockers
- ⟨Blocker⟩ — ⟨Help needed⟩
## 🔜 Next Week Priorities
- ⟨Priority 1⟩
- ⟨Priority 2⟩
## 🤝 Asks
- ⟨Ask⟩ — ⟨Owner⟩ — ⟨Due date⟩
## 🗓️ Upcoming
- ⟨Event / deadline⟩
`,
        },

        {
          id: 'brainstorm',
          name: '💡 Brainstorm',
          body: `# 💡 Brainstorm
## 🧩 Problem Statement
- ⟨What problem are we solving?⟩
## 👥 Users / Stakeholders
- ⟨Who is affected⟩
## 🎯 Desired Outcome
- ⟨What changes⟩
## 🌩️ Ideas (Diverge)
- Idea 1
  - ⟨Notes⟩
- Idea 2
  - ⟨Notes⟩
## 🔎 Assumptions
- ⟨Assumption⟩ — ⟨Risk if wrong⟩
## 🧪 Experiments (Converge)
- [ ] ⟨Experiment⟩ — ⟨Owner⟩ — ⟨Success criteria⟩
## ✅ Next Steps
- [ ] ⟨Action⟩ — ⟨Owner⟩ — ⟨Due date⟩
`,
        },

        {
          id: 'sop_checklist',
          name: '📋 SOP / Checklist',
          body: `# 📋 SOP / Checklist
## 🎯 Purpose
- ⟨What this procedure achieves⟩
## 🧰 Prerequisites
- ⟨Access / tools / info needed⟩
## 🧭 Steps
- 1) ⟨Step⟩
  - ✅ Expected result
    - ⟨Result⟩
  - ⚠️ Notes
    - ⟨Note⟩
- 2) ⟨Step⟩
## 🔍 Verification
- ⟨How to confirm success⟩
## 🧯 Troubleshooting
- Symptom
  - ⟨What you see⟩
  - Fix
    - ⟨What to do⟩
## 👤 Owners / Escalation
- Primary: ⟨Name⟩
- Backup: ⟨Name⟩
## 🗓️ Review Cadence
- ⟨When to revisit/update⟩
`,
        },

        {
          id: 'rfc_proposal',
          name: '🧠 RFC / Proposal',
          body: `# 🧠 RFC / Proposal
## 🧾 Summary
- ⟨One paragraph⟩
## 🎯 Problem
- ⟨What is broken / missing⟩
## ✅ Goals
- ⟨Goal 1⟩
- ⟨Goal 2⟩
## 🚫 Non‑Goals
- ⟨Non‑goal⟩
## 🧩 Proposed Solution
- ⟨High-level approach⟩
## 🏗️ Design
- Architecture
  - ⟨Components⟩
- Data / Interfaces
  - ⟨Inputs/outputs⟩
## 🔁 Alternatives Considered
- ⟨Alternative⟩ — ⟨Why not⟩
## ⚠️ Risks
- ⟨Risk⟩ — ⟨Mitigation⟩
## 📊 Success Metrics
- ⟨Metric⟩ — ⟨Target⟩
## 🧪 Rollout Plan
- Phase 1
  - ⟨What⟩
- Phase 2
  - ⟨What⟩
## ✅ Next Actions
- [ ] ⟨Action⟩ — ⟨Owner⟩ — ⟨Due date⟩
`,
        },
      ];

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

      function __tplInsert(body) {
        const txt = String(body || '').trimEnd();
        if (!txt) return;
        try {
          // Reuse editor insert helper (CodeMirror first, textarea fallback)
          if (typeof __insertIntoEditor === 'function') {
            __insertIntoEditor(txt + '\n\n');
          } else if (typeof window.__cmInsertAtCursor === 'function') {
            window.__cmInsertAtCursor(txt + '\n\n');
          } else {
            // textarea fallback
            const start = md.selectionStart ?? md.value.length;
            const end = md.selectionEnd ?? md.value.length;
            md.value = md.value.slice(0, start) + txt + '\n\n' + md.value.slice(end);
            md.dispatchEvent(new Event('input', { bubbles: true }));
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
          showToast('No items available', 'error', 2400);
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

        tplEditModalOpen({
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
            showToast('Saved ✓ My template', 'ok');
          },
        });
      }

      function __tplDupOrgPicker() {
        const org = __tplPickFromList(
          'Duplicate which Org template to My?',
          __tplOrg(),
          (x) => x.name
        );
        if (!org) return;
        __tplDupOrgToMy(org);
      }

      function __tplOrg() {
        return __TPL_ORG;
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
        showToast('Saved ✓ Duplicated to My templates', 'ok');
      }

      function __tplEditMy() {
        const items = __tplLoadMy();
        const t = __tplPickFromList('Edit which My template?', items, (x) => x.name);
        if (!t) return;

        tplEditModalOpen({
          title: `Edit My template: ${t.name}`,
          initial: t.body || '',
          onSave: (body) => {
            if (body == null) return;
            t.body = body;
            t.updatedAt = Date.now();
            __tplSaveMy(items);
            showToast('Saved ✓ Template updated', 'ok');
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
        showToast('Saved ✓ Template renamed', 'ok');
      }

      function __tplDeleteMy() {
        const items = __tplLoadMy();
        const t = __tplPickFromList('Delete which My template?', items, (x) => x.name);
        if (!t) return;
        const ok = confirm(`Delete My template "${t.name}"?`);
        if (!ok) return;
        __tplSaveMy(items.filter((x) => x.id !== t.id));
        showToast('Deleted ✓ My template', 'ok');
      }

      function __tplExportMy() {
        const items = __tplLoadMy();
        const payload = { version: 1, exportedAt: new Date().toISOString(), items };
        const text = JSON.stringify(payload, null, 2);
        const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `my-templates_${todayStamp()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast('Exported ✓ My templates JSON', 'download', 2600);
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
            showToast('Import: no templates found', 'error', 2600);
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
          showToast(`Imported ✓ ${added} added, ${updated} updated`, 'ok', 3200);
        } catch (e) {
          showToast('Import error: ' + (e?.message || String(e)), 'error', 3500);
        }
      }

      function __tplShow() {
        if (!__tplMenu) return;
        __tplPos();
        __tplMenu.innerHTML = '';

        __tplMenu.appendChild(makeMenuHeader('Templates'));
        __tplMenu.appendChild(makeMenuHeader('Org templates (read-only)'));

        const orgWrap = document.createElement('div');
        orgWrap.className = 'menuList';
        for (const t of __tplOrg()) {
          orgWrap.appendChild(
            makeMenuItem(
              t.name,
              () => {
                __tplHide();
                __tplInsert(t.body);
              },
              { icon: '🏛️' }
            )
          );
        }
        __tplMenu.appendChild(orgWrap);

        __tplMenu.appendChild(makeMenuSep());
        __tplMenu.appendChild(makeMenuHeader('My templates'));

        const mine = __tplLoadMy();
        const myWrap = document.createElement('div');
        myWrap.className = 'menuList';
        if (mine.length) {
          for (const t of mine) {
            myWrap.appendChild(
              makeMenuItem(
                '🧩 ' + t.name,
                () => {
                  __tplHide();
                  __tplInsert(t.body);
                },
                { icon: '👤' }
              )
            );
          }
        } else {
          myWrap.appendChild(makeMenuHeader('No My templates yet'));
        }
        __tplMenu.appendChild(myWrap);

        __tplMenu.appendChild(makeMenuSep());
        __tplMenu.appendChild(makeMenuHeader('Actions'));

        __tplMenu.appendChild(
          makeMenuItem(
            '➕ New My template…',
            () => {
              __tplHide();
              __tplNewMy();
            },
            { icon: '➕' }
          )
        );
        __tplMenu.appendChild(
          makeMenuItem(
            '📋 Duplicate Org → My…',
            () => {
              __tplHide();
              __tplDupOrgPicker();
            },
            { icon: '📋' }
          )
        );
        __tplMenu.appendChild(
          makeMenuItem(
            '✏️ Edit My template…',
            () => {
              __tplHide();
              __tplEditMy();
            },
            { icon: '✏️' }
          )
        );
        __tplMenu.appendChild(
          makeMenuItem(
            '📝 Rename My template…',
            () => {
              __tplHide();
              __tplRenameMy();
            },
            { icon: '📝' }
          )
        );
        __tplMenu.appendChild(
          makeMenuItem(
            '🗑️ Delete My template…',
            () => {
              __tplHide();
              __tplDeleteMy();
            },
            { icon: '🗑️' }
          )
        );
        __tplMenu.appendChild(makeMenuSep());
        __tplMenu.appendChild(
          makeMenuItem(
            '⬇️ Export My templates (JSON)…',
            () => {
              __tplHide();
              __tplExportMy();
            },
            { icon: '⬇️' }
          )
        );
        __tplMenu.appendChild(
          makeMenuItem(
            '⬆️ Import My templates (JSON)…',
            () => {
              __tplHide();
              __tplImportMy();
            },
            { icon: '⬆️' }
          )
        );

        __tplMenu.style.display = 'flex';
      }

      const __TPL_PANDOC_ORG = [
        {
          id: 'pandoc_templates_v3',
          name: '📊 Pandoc Slides Templates V3 — Full Test Deck',
          body: `layout: title

# Strategy Proposal

Market expansion, product acceleration, and execution roadmap

Business Development Team

2026-05-26

---

layout: agenda

# Agenda

- Executive summary and recommendation
- Market opportunity and customer demand signals
- Strategic options and trade-offs
- Product and go-to-market priorities
- Execution roadmap and next steps

---

layout: content

# 1. Executive Summary

- Clear growth opportunity exists in priority customer segments with strong demand signals.
- Product innovation is needed to sustain differentiation and improve time-to-value.
- Go-to-market execution should focus on faster validation, partner leverage, and clearer prioritization.
- Recommended path combines focused market expansion with AI-enabled product acceleration.

---

layout: twocols

# 2. Growth Strategy

## Left
- Expand priority customer segments with measurable pipeline potential.
- Strengthen partner-led motion to reduce acquisition friction.
- Focus regional execution on markets with clear demand signals.
- Improve account prioritization using data-driven opportunity scoring.

## Right
- Accelerate AI-enabled product capabilities for high-value workflows.
- Simplify user experience across onboarding, reporting, and daily execution.
- Consolidate platform capabilities to reduce complexity.
- Shorten release cycles to improve learning speed and customer feedback loops.

---

layout: image-text

# 3. Market Opportunity

## Image
./images/market-opportunity.png

## Text
- Local demand for scalable digital infrastructure continues to increase.
- AI workloads create additional pressure for performance, reliability, and governance.
- Customers want solutions that reduce complexity while improving decision speed.
- Partner ecosystem can accelerate adoption if the value proposition is specific and easy to explain.
- Initial validation should focus on high-intent segments before broader expansion.

---

layout: text-image

# 4. Product Roadmap

## Text
- Simplify core workflows to reduce time-to-value for new users.
- Add AI-assisted decision support where users already experience repeated manual work.
- Improve executive visibility through better reporting and clearer business metrics.
- Prioritize fewer, higher-impact releases instead of a broad list of disconnected features.
- Use customer feedback loops to validate adoption before scaling investment.

## Image
./images/product-roadmap.png

---

layout: bullets-2

# 5. Key Execution Priorities

- Market growth
- Segment expansion
- AI-enabled features
- UX improvement
- Pricing optimization
- Partner ecosystem
- Operational efficiency
- Better reporting
- Pipeline governance
- Customer success enablement

---

layout: threecols

# 6. Strategic Options

## Column 1
- Option A: focused market validation
- Fast to implement
- Lower investment requirement
- Best for reducing uncertainty early

## Column 2
- Option B: balanced growth and product acceleration
- Medium implementation complexity
- Stronger cross-functional impact
- Best balance of speed, risk, and upside

## Column 3
- Option C: aggressive expansion
- Highest upside potential
- Higher execution risk
- Requires stronger funding, governance, and operational capacity

---

layout: grid2

# 7. Operating Model Overview

## Market
Focus on priority segments with clear demand signals, measurable pipeline, and partner leverage.

## Product
Accelerate AI and UX roadmap delivery while reducing platform complexity.

## Operations
Simplify decision cadence, clarify ownership, and improve execution visibility.

## Financials
Improve margin discipline, investment prioritization, and ROI tracking.

---

layout: kpi

# 8. Revenue Growth Potential

## 42%

Expected growth potential over the planning horizon based on focused market expansion, product adoption, and partner-led go-to-market execution.

## Drivers
- Segment expansion
- AI-enabled product adoption
- Partner-led go-to-market
- Improved customer retention

---

layout: table

# 9. Option Comparison

| Criteria | Option A | Option B | Option C |
|---|---|---|---|
| Cost | Low | Medium | High |
| Speed | Fast | Medium | Slow |
| Impact | Medium | High | Very High |
| Risk | Low | Medium | High |
| Governance need | Low | Medium | High |
| Recommended use | Validation | Balanced scale | Aggressive expansion |

---

layout: image-caption

# 10. Architecture View

./images/architecture-view.png

The target architecture should support scale, observability, integration readiness, and faster product experimentation.

---

layout: section

# 11. Recommendation

Focused expansion with accelerated AI product delivery

---

layout: highlight

# 12. Key Message

The best path is to combine focused market expansion with product simplification and AI-enabled differentiation.

---

layout: content

# 13. Next Steps

- Validate the recommended option with priority stakeholders.
- Confirm target segments, success metrics, and investment guardrails.
- Build a 90-day execution plan with clear owners and decision checkpoints.
- Prepare a follow-up review to assess early results and adjust priorities.
`,
        },
      ];

      function __tplPandocShow() {
        if (!__tplPandocMenu) return;

        __tplPandocPos();
        __tplPandocMenu.innerHTML = '';

        __tplPandocMenu.appendChild(makeMenuHeader('Pandoc templates'));
        __tplPandocMenu.appendChild(makeMenuHeader('Slides / PPTX export templates'));

        const pandocWrap = document.createElement('div');
        pandocWrap.className = 'menuList';

        for (const t of __TPL_PANDOC_ORG) {
          pandocWrap.appendChild(
            makeMenuItem(
              t.name,
              () => {
                __tplPandocHide();
                __tplInsert(t.body);
              },
              { icon: '📊' }
            )
          );
        }

        __tplPandocMenu.appendChild(pandocWrap);

        __tplPandocMenu.appendChild(makeMenuSep());

        __tplPandocMenu.appendChild(
          makeMenuItem(
            'Export Pandoc Markdown (.md)',
            () => {
              __tplPandocHide();
              exportMarkdownDownload();
            },
            { icon: '⬇️' }
          )
        );

        __tplPandocMenu.appendChild(makeMenuSep());
        __tplPandocMenu.appendChild(makeMenuHeader('Convert with Pandoc after export.'));
        __tplPandocMenu.appendChild(
          makeMenuHeader('pandoc file.md -o output.pptx --reference-doc=PandocTemplateV4.pptx')
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
        if (__tplPandocBtn && (e.target === __tplPandocBtn || __tplPandocBtn.contains(e.target)))
          return;

        __tplHide();
        __tplPandocHide();
      });

      window.addEventListener('resize', () => {
        if (__tplMenu && __tplMenu.style.display === 'flex') __tplPos();
        if (__tplPandocMenu && __tplPandocMenu.style.display === 'flex') __tplPandocPos();
      });

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
        recentMenu.appendChild(
          makeMenuHeader(list.length ? 'Recent files' : 'No recent files yet')
        );
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

      function draftKey(filename) {
        return `markmap-draft:${filename}`;
      }

      function saveDraft() {
        if (!dirty) return;
        try {
          const data = {
            text: md.value,
            time: Date.now(),
          };
          localStorage.setItem(draftKey(currentFileName), JSON.stringify(data));
          log('Auto‑save: draft saved');
        } catch (e) {
          /* quota exceeded, ignore */
        }
      }

      function clearDraft(filename) {
        try {
          localStorage.removeItem(draftKey(filename));
          log(`Auto‑save: draft cleared for ${filename}`);
        } catch {}
      }

      function checkAndRestoreDraft(filename) {
        try {
          const raw = localStorage.getItem(draftKey(filename));
          if (!raw) return false;
          const draft = JSON.parse(raw);
          if (!draft || !draft.text) return false;
          const timeStr = new Date(draft.time).toLocaleString();
          const ok = confirm(
            `Unsaved draft found for "${filename}" from ${timeStr}.\n\n` +
              `Do you want to restore it?`
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

                log(
                  'HotReload: external change detected (' + fileLastSeenModified + ' -> ' + lm + ')'
                );

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

        const nodeLength =
          NODE_LENGTH_PRESETS[mapStyleState.nodeLength] || NODE_LENGTH_PRESETS.medium;

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
      const VIEW_STATE_KEY = 'markmap:viewState:v1';
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
              localStorage.removeItem(VIEW_STATE_KEY);
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
              localStorage.removeItem(VIEW_STATE_KEY);
            } catch {}
            return;
          }

          const svgEl = getSvgElForZoom();
          if (!svgEl) return;

          const svgSel =
            mm?.svg && typeof mm.svg.call === 'function' ? mm.svg : window.d3.select(svgEl);

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
              localStorage.removeItem(VIEW_STATE_KEY);
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
        try {
          const raw = localStorage.getItem(VIEW_STATE_KEY);
          if (!raw) return null;

          const parsed = JSON.parse(raw);
          const safeState = normalizeViewState(parsed);

          if (!safeState) {
            console.warn('Invalid stored view state removed:', parsed);
            localStorage.removeItem(VIEW_STATE_KEY);
            return null;
          }

          return safeState;
        } catch {
          try {
            localStorage.removeItem(VIEW_STATE_KEY);
          } catch {}
          return null;
        }
      }

      function saveViewState(state, reason = 'saveViewState') {
        try {
          const safeState = normalizeViewState(state);

          if (!safeState) {
            console.warn(`${reason}: skipped invalid view state save`, state);
            return;
          }

          localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(safeState));
          log(`${reason}: saved zoom/pan`);
        } catch (e) {
          log(`${reason} error: ${e?.message || e}`);
        }
      }
      function saveViewState(state, reason = 'saveViewState') {
        try {
          if (!state || !isFinite(state.k) || !isFinite(state.x) || !isFinite(state.y)) {
            console.warn('Skipping invalid view state save:', state);
            return;
          }
          localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(state));
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
              render('boot ensureMarkmapBoot');
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
            source.startsWith('debounced') ||
            source.startsWith('blur') ||
            source.startsWith('hotReload');
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

      async function toggleHtml() {
        const willShow = htmlPane.style.display !== 'block';
        htmlPane.style.display = willShow ? 'block' : 'none';
        log(`HTML view ${willShow ? 'SHOW' : 'HIDE'}`);
        if (willShow) {
          htmlPane.innerHTML = await renderHtmlWithShiki(md.value);
          buildHtmlHeadingIndex();
          log('HTML pane refreshed');
          syncHtmlScrollToEditor('toggleHtml show');
        } else {
          mapPane.style.width = '';
          mapPane.style.flex = '1 1 auto';
        }
        setShowHideLabel('btnHtml', willShow, 'HTML');
        syncToolbarHeight();
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

      function _getScrollRatio(el) {
        const max = el.scrollHeight - el.clientHeight;
        return max > 0 ? el.scrollTop / max : 0;
      }
      function _setScrollRatio(el, ratio) {
        const max = el.scrollHeight - el.clientHeight;
        el.scrollTop = max > 0 ? ratio * max : 0;
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
            md.scrollTop =
              md.scrollHeight * (lineNo / Math.max(1, md.value.split('\n').length - 1));
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
        const labelNorm = _normalizeHeadingText(
          stripHeadingPrefix(_cleanNodeTextForMatch(nodeText))
        );

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
        const exact = headings
          .filter((h) => h.norm === labelNorm)
          .map((h) => ({ ...h, score: 100 }));

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

      let editorWasVisible = true;
      let lastEditorWidth = null;

      function toggleEditor() {
        try {
          editorWasVisible = !(editorEl.style.display === 'none');
          const willShow = !editorWasVisible;
          if (!willShow) {
            lastEditorWidth = editorEl.style.width || editorEl.getBoundingClientRect().width + 'px';
            editorEl.style.display = 'none';
            splitEditorEl.style.display = 'none';
            log(`Editor HIDE (saved width=${lastEditorWidth})`);
            setShowHideLabel('btnToggleEditor', false, 'Editor');
            syncToolbarHeight();
            return;
          }
          editorEl.style.display = 'block';
          splitEditorEl.style.display = 'block';
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
          ['pointerdown', 'mousedown', 'click', 'dblclick', 'wheel', 'touchstart'].forEach(
            (evt) => {
              overlay.addEventListener(
                evt,
                (e) => {
                  e.stopPropagation();
                },
                { passive: evt === 'wheel' || evt === 'touchstart' }
              );
            }
          );

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

            ['pointerdown', 'mousedown', 'click', 'dblclick', 'wheel', 'touchstart'].forEach(
              (evt) => {
                modal.addEventListener(
                  evt,
                  (e) => {
                    e.stopPropagation();
                  },
                  { passive: evt === 'wheel' || evt === 'touchstart' }
                );
              }
            );

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

      // Splitters
      function makeResizable(splitter, left, container, getMaxWidth, getMinWidth) {
        let dragging = false,
          startX = 0,
          startW = 0;
        splitter.addEventListener('mousedown', (e) => {
          dragging = true;
          startX = e.clientX;
          startW = left.getBoundingClientRect().width;
          log('Splitter drag start');
          e.preventDefault();
        });
        window.addEventListener('mouseup', () => {
          if (dragging) log('Splitter drag end');
          dragging = false;
        });
        window.addEventListener('mousemove', (e) => {
          if (!dragging) return;
          const dx = e.clientX - startX;
          let w = startW + dx;
          const minW = getMinWidth ? getMinWidth() : 200;
          const maxW = getMaxWidth ? getMaxWidth() : container.getBoundingClientRect().width - 200;
          if (w < minW) w = minW;
          if (w > maxW) w = maxW;
          left.style.width = w + 'px';
          left.style.flex = `0 0 ${w}px`;
        });
      }

      makeResizable(
        document.getElementById('splitEditor'),
        document.getElementById('editor'),
        document.getElementById('layout'),
        () => document.getElementById('layout').getBoundingClientRect().width - 300,
        () => 200
      );

      makeResizable(
        document.getElementById('splitHtml'),
        document.getElementById('mapPane'),
        document.getElementById('viewer'),
        () => {
          const viewerW = document.getElementById('viewer').getBoundingClientRect().width;
          const htmlVisible = htmlPane.style.display === 'block';
          const htmlMin = htmlVisible ? 200 : 0;
          const splitterW = document.getElementById('splitHtml').getBoundingClientRect().width || 6;
          return viewerW - htmlMin - splitterW;
        },
        () => 200
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
            md.value = await f.text();
            if (window.__cmSetText) window.__cmSetText(md.value);
            dirty = false;
            setStatus(modeLabel());
            log(`openSmart(): loaded WRITABLE "${currentFileName}" (${f.size} bytes)`);
            const restored = maybeRestoreDraftAfterOpen('openSmart(writable)');
            if (!restored) {
              hasAutoFitted = false;
              render('openSmart(writable) render()');
            }
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

      function newDocument() {
        try {
          // Se houver alterações não salvas, confirmar antes de limpar
          if (dirty) {
            const ok = confirm(
              'Você tem alterações não salvas.\n\nCriar um novo documento e descartar as alterações atuais?'
            );
            if (!ok) return;
          }

          // Estado: novo doc não tem handle
          currentSaveHandle = null;
          hotStop('newDocument'); // desliga hot reload se estava ativo
          externalStale = false;
          externalStaleModified = 0;
          fileLastSeenModified = 0;

          // Nome sugerido (não salva em disco até você clicar Save)
          currentFileName = `untitled_${__newDocCounter++}.md`;

          // Conteúdo inicial minimalista
          const starter = `# New document\n\n- [ ] First idea\n`;
          md.value = starter;
          if (typeof window.__cmSetText === 'function') window.__cmSetText(starter);

          dirty = false;
          setStatus(modeLabel());
          updateDocumentTitle();
          hasAutoFitted = false;
          render('newDocument render()');
          showToast(`New document ✓ ${currentFileName}`, 'ok');
        } catch (e) {
          const msg = e?.message || String(e);
          try {
            log('❌ newDocument failed: ' + msg);
          } catch {}
          showToast('New document error: ' + msg, 'error', 3500);
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
          md.value = await f.text();
          if (window.__cmSetText) window.__cmSetText(md.value);
          dirty = false;
          setStatus(modeLabel());
          log(`read-only open: loaded "${currentFileName}" (${f.size} bytes)`);
          const restored = maybeRestoreDraftAfterOpen('openSmart(read-only)');
          if (!restored) {
            hasAutoFitted = false;
            render('openSmart(read-only) render()');
          }
        } catch (err) {
          log(`❌ read-only open error: ${err?.message || err}`);
        }
      });

      async function saveAsSmart(text) {
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
            dirty = false;
            setStatus(modeLabel());
            log('saveAsSmart(): saved via picker; currentSaveHandle updated');
            return;
          } catch (e) {
            if (e && e.name === 'AbortError') {
              log(
                'saveAsSmart(): user canceled Save As dialog (AbortError). No fallback download.'
              );
              setStatus('Save As canceled');
              return;
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
        log('saveSmart(): begin');
        const text = md.value;
        if (currentSaveHandle) {
          try {
            log('saveSmart(): attempting overwrite via currentSaveHandle');
            if (!(await confirmOverwriteExternal())) return;
            await saveToHandle(currentSaveHandle, text);
            log('saveSmart(): overwrite OK');
            return;
          } catch (e) {
            log(`saveSmart(): overwrite failed -> ${e?.message || e}`);
            log('saveSmart(): falling back to Save As...');
          }
        } else {
          log('saveSmart(): no writable handle -> using Save As');
        }
        await saveAsSmart(text);
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
      document.getElementById('btnToggleEditor').addEventListener('click', toggleEditor);

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

      function exportMarkdownDownload() {
        try {
          if (typeof globalThis.transformLayouts !== 'function') {
            showToast('Pandoc export error: transformLayouts is not loaded', 'error', 3500);
            log('Pandoc export error: globalThis.transformLayouts is not defined');
            return;
          }

          const text = globalThis.transformLayouts(md.value);

          const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
          const url = URL.createObjectURL(blob);

          const a = document.createElement('a');
          a.href = url;
          a.download = currentFileName.replace('.md', '') + '_pandoc.md';

          document.body.appendChild(a);
          a.click();
          a.remove();

          URL.revokeObjectURL(url);

          showToast('Run: pandoc file.md -o output.pptx --reference-doc=template.pptx', 'download');
        } catch (e) {
          showToast(' ❌ Export failed: ' + e.message, 'error');
        }
      }

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
        render('draft restore render()');
      } else {
        // Normal initial render
        setStatus(modeLabel());
        updateDocumentTitle();
        __ensureMarkmapBoot();
        render('boot render()');
        setTimeout(() => render('boot delayed render()'), 1000);
      }

      startAutoSave();

      // Debounced rendering (unchanged)
      let renderTimer = null;
      const RENDER_DEBOUNCE_MS = 1000;
      md.addEventListener('input', () => {
        dirty = true;
        setStatus(modeLabel() + ' (modified)');
        log(`Editor input: dirty=true; scheduling render in ${RENDER_DEBOUNCE_MS}ms`);
        updateDocumentTitle();
        if (renderTimer) {
          clearTimeout(renderTimer);
          renderTimer = null;
          log('Debounce: cleared previous render timer');
        }
        renderTimer = setTimeout(() => {
          renderTimer = null;
          log('Debounce: timeout reached -> rendering');
          render('debounced render()');
        }, RENDER_DEBOUNCE_MS);
      });

      md.addEventListener('blur', () => {
        if (window.__suppressBlurRenderUntil && Date.now() < window.__suppressBlurRenderUntil) {
          log('Editor blur suppressed (map interaction)');
          window.__suppressBlurRenderUntil = 0;
          return;
        }
        if (renderTimer) {
          clearTimeout(renderTimer);
          renderTimer = null;
        }
        log('Editor blur -> rendering immediately');
        render('blur render()');
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
