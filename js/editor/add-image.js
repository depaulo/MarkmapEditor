// @ts-nocheck
// Add Image feature extracted from main.js
// Classic browser script, no modules.

(function () {
  'use strict';

  // ================================
  // Add Image (Online / Local) — inserts Markdown link into the EDITOR
  // ================================

  const __btnAddImage = document.getElementById('btnAddImage');
  const __imageMenu = document.getElementById('imageMenu');
  const __imageFileInput = document.getElementById('imageFile');

  function __addImageLog(msg) {
    try {
      globalThis.log?.(msg);
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
      const mdEl = document.getElementById('md');
      if (!mdEl) return;
      const start = mdEl.selectionStart ?? mdEl.value.length;
      const end = mdEl.selectionEnd ?? mdEl.value.length;
      mdEl.value = mdEl.value.slice(0, start) + str + mdEl.value.slice(end);
      mdEl.focus();
      const pos = start + str.length;
      mdEl.selectionStart = mdEl.selectionEnd = pos;
      mdEl.dispatchEvent(new Event('input', { bubbles: true }));
      if (typeof window.__cmSetText === 'function') window.__cmSetText(mdEl.value);
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
      globalThis.showToast?.(msg, 'error', 3800);
      __addImageLog('AddImage: blocked non-image URL -> ' + url);
      return;
    }
    const alt = prompt('Alt text (opcional):', 'image') || 'image';
    const mdImg = __buildImgMd(alt, url);
    if (!mdImg) return;
    __insertIntoEditor(mdImg + '\n');
    globalThis.showToast?.('Image link inserted (online)', 'ok');
    __addImageLog('AddImage: inserted online');
  }

  function sanitizeAssetFileName(name) {
    const raw = String(name || 'image').trim();

    const safe = raw
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return safe || 'image';
  }

  async function ensureWorkspaceAssetsImagesFolder() {
    const workspaceState = globalThis.WORKSPACE_STATE || window.WORKSPACE_STATE || null;

    if (!workspaceState?.rootHandle) {
      return null;
    }

    const root = workspaceState.rootHandle;
    const assetsDir = await root.getDirectoryHandle('assets', { create: true });
    const imagesDir = await assetsDir.getDirectoryHandle('images', { create: true });

    return imagesDir;
  }

  function isWorkspaceImageMode() {
    const workspaceState = globalThis.WORKSPACE_STATE || window.WORKSPACE_STATE || null;
    return Boolean(workspaceState?.rootHandle);
  }

  function getWorkspaceRelativeImagePath(fileName) {
    return `../assets/images/${fileName}`;
  }

  function getStandaloneRelativeImagePath(fileName) {
    return `./images/${fileName}`;
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

  async function __copyLocalImageToWorkspaceAssets(file) {
    const originalName = String(file?.name || 'image').trim();
    const safeName = sanitizeAssetFileName(originalName);

    const imagesDir = await ensureWorkspaceAssetsImagesFolder();

    if (!imagesDir) {
      return { safeName, markdownPath: getStandaloneRelativeImagePath(safeName), copied: false };
    }

    let targetName = safeName;
    let counter = 2;

    while (true) {
      try {
        const handle = await imagesDir.getFileHandle(targetName, { create: false });
        if (handle) {
          targetName = `${safeName}-${counter++}`;
          continue;
        }
      } catch {
        break;
      }
    }

    const imageHandle = await imagesDir.getFileHandle(targetName, { create: true });
    const writable = await imageHandle.createWritable();
    await writable.write(file);
    await writable.close();

    const markdownPath = getWorkspaceRelativeImagePath(targetName);

    return { safeName: targetName, markdownPath, copied: true };
  }

  if (__imageFileInput && !__imageFileInput.__addImageBound) {
    __imageFileInput.addEventListener('change', async (e) => {
      try {
        const f = e.target.files && e.target.files[0];
        if (!f) {
          __addImageLog('AddImage: local empty');
          return;
        }

        const alt = __filenameToAlt(f.name);

        if (isWorkspaceImageMode()) {
          try {
            const result = await __copyLocalImageToWorkspaceAssets(f);
            const mdImg = __buildImgMd(alt, result.markdownPath);
            __insertIntoEditor(mdImg + '\n');
            globalThis.showToast?.(`Image copied to assets/images/${result.safeName}`, 'ok', 1800);
            __addImageLog(`AddImage: copied local image to workspace assets/images/${result.safeName}`);
            __addImageLog(`AddImage: inserted workspace image -> ${result.markdownPath}`);
          } catch (err) {
            __addImageLog('AddImage: workspace copy failed: ' + (err?.message || err));
            const fallbackPath = getStandaloneRelativeImagePath(sanitizeAssetFileName(f.name));
            const mdImg = __buildImgMd(alt, fallbackPath);
            __insertIntoEditor(mdImg + '\n');
            globalThis.showToast?.('Image inserted as ' + fallbackPath, 'ok', 3200);
            __addImageLog(`AddImage: fallback standalone local image -> ${fallbackPath}`);
          }
        } else {
          const rel = getStandaloneRelativeImagePath(sanitizeAssetFileName(f.name));
          const mdImg = __buildImgMd(alt, rel);
          __insertIntoEditor(mdImg + '\n');
          globalThis.showToast?.(
            'Image inserted as ' + rel + '. Keep the image in an images folder next to the Markdown file.',
            'ok',
            3200
          );
          __addImageLog(`AddImage: inserted standalone local image -> ${rel}`);
        }
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

    const makeHeader = globalThis.makeMenuHeader || window.makeMenuHeader;
    const makeItem = globalThis.makeMenuItem || window.makeMenuItem;
    const makeSep = globalThis.makeMenuSep || window.makeMenuSep;

    if (makeHeader) __imageMenu.appendChild(makeHeader('Add image'));
    if (makeItem) {
      __imageMenu.appendChild(
        makeItem(
          'Online (URL)…',
          () => {
            __hideImageMenu();
            __addImageOnline();
          },
          { icon: '🌐' }
        )
      );
      __imageMenu.appendChild(
        makeItem(
          'Local (relative)…',
          () => {
            __hideImageMenu();
            __addImageLocalPick();
          },
          { icon: '🖼️' }
        )
      );
    }
    if (makeSep) __imageMenu.appendChild(makeSep());
    if (makeHeader) {
      __imageMenu.appendChild(makeHeader('Online: must be a direct image file URL'));
      __imageMenu.appendChild(makeHeader('Local: assumes ./images/<filename>'));
    }
    __imageMenu.style.display = 'flex';
    __addImageLog('AddImage: menu shown');
  }

  document.addEventListener('mousedown', (e) => {
    if (!__imageMenu || __imageMenu.style.display !== 'flex') return;
    if (__imageMenu.contains(e.target)) return;
    if (__btnAddImage && (__btnAddImage === e.target || __btnAddImage.contains(e.target))) return;
    __hideImageMenu();
  });

  window.addEventListener('resize', () => {
    if (__imageMenu && __imageMenu.style.display === 'flex') __positionImageMenu();
  });

  __addImageLog(
    'AddImage: boot check btnAddImage=' + !!__btnAddImage + ' imageMenu=' + !!__imageMenu
  );

  // Button click wiring
  if (__btnAddImage) {
    __btnAddImage.addEventListener('click', () => {
      __addImageLog('AddImage: button click');
      const open = __imageMenu && __imageMenu.style.display === 'flex';
      if (open) __hideImageMenu();
      else __showImageMenu();
    });
    __addImageLog('AddImage: listener attached');
  }

  // Expose helpers for other scripts
  try {
    window.__insertIntoEditor = __insertIntoEditor;
    window.__showImageMenu = __showImageMenu;
    window.__hideImageMenu = __hideImageMenu;
    window.sanitizeAssetFileName = sanitizeAssetFileName;
    window.ensureWorkspaceAssetsImagesFolder = ensureWorkspaceAssetsImagesFolder;
    window.isWorkspaceImageMode = isWorkspaceImageMode;
    window.getWorkspaceRelativeImagePath = getWorkspaceRelativeImagePath;
    window.getStandaloneRelativeImagePath = getStandaloneRelativeImagePath;

    globalThis.__insertIntoEditor = __insertIntoEditor;
    globalThis.__showImageMenu = __showImageMenu;
    globalThis.__hideImageMenu = __hideImageMenu;
    globalThis.sanitizeAssetFileName = sanitizeAssetFileName;
    globalThis.ensureWorkspaceAssetsImagesFolder = ensureWorkspaceAssetsImagesFolder;
    globalThis.isWorkspaceImageMode = isWorkspaceImageMode;
    globalThis.getWorkspaceRelativeImagePath = getWorkspaceRelativeImagePath;
    globalThis.getStandaloneRelativeImagePath = getStandaloneRelativeImagePath;
  } catch {}
})();
