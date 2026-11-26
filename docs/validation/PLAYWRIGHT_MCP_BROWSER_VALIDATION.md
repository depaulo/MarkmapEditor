# Playwright MCP Browser Acceptance Guide

## Overview
This guide defines how Playwright MCP is used for browser acceptance testing in the MarkmapEditor project, distinguishing between automated validation limits and manual owner requirements.

---

## 1. HEADLESS MCP WITHOUT A WORKSPACE

### Capabilities
Playwright MCP can automatically validate when the app runs without an opened Workspace:

- **Application boot** — page loads, title, initial render
- **Welcome dialog** — content and close availability
- **Global mode selector** — Editor, Journal, Slides toggles
- **Global controls** — HTML Preview, Markmap hide/fullscreen, theme toggles, help
- **Overlays** — Welcome, error toasts, loading states
- **Themes** — light/dark mode switch persistence
- **Accessibility** — ARIA labels, focus order, semantic structure
- **Focus and aria state** — input focus, focus restoration after mode changes
- **Responsive layout** — viewport breakpoints (mobile/desktop viewports)
- **Console warnings/errors** — browser console logs, devtools messages
- **Failed network requests** — browser network request log, fetch/abort tracking
- **Screenshots** — viewport, component, overlay captures
- **Surfaces that do not require Workspace Index** — Dashboard, Help, Guide, Theme selector

### Limitations
The headless MCP cannot validate any feature that requires a Workspace Index populated with Workspace records (i.e., Projects, Tasks, Notes, Knowledge, Archive, etc.).

---

## 2. WORKSPACE-DEPENDENT FEATURES

### Inability to Validate
Without a real Workspace directory handle or deterministic, non-confidential repository-supported fixtures:

- **Projects Review with real records** — cannot open Workspace, cannot validate Project row editing, filter behavior
- **Task Review or Task Board with Workspace records** — cannot validate actual Tasks, groups, states
- **Notes, Knowledge, Archive projections** — cannot validate real note content, metadata, archive state
- **Find Files** — cannot search the real Workspace index
- **Resolved Wiki Links** — cannot fetch and validate content from real Workspace notes
- **Archive/Restore** — cannot test file-level archive/restore with actual file system
- **Project Apply** — cannot validate real mutation with actual file saves
- **Physical Save** — cannot test file write and subsequent index rebuild with a real Workspace
- **Workspace permissions** — cannot test access controls or authentication with a real Workspace

### Browser Blocking Behavior
The native `showDirectoryPicker()` dialog blocks Playwright MCP flows:

```
Browser acceptance blocked by File System Access picker.
```

The picker appears after clicking "📁 Open Workspace" and cannot be automated in the headless environment. `browser_file_upload` does not replace `showDirectoryPicker()` and does not provide a `FileSystemDirectoryHandle`.

**Do not** claim Workspace-dependent browser scenarios passed.

---

## 3. OWNER MANUAL ACCEPTANCE

### Required Manual Steps
The owner must perform the smallest remaining checklist:

- [ ] Select a real Workspace directory (the actual local folder with Markdown files)
- [ ] Run real-handle browser tests that require the Workspace Index (Projects Apply, Task Board filters, Note Archive, etc.)
- [ ] Execute physical Save/overwrite with the Workspace file system
- [ ] Run Archive/Restore with actual files
- [ ] Perform Project Apply with real files (create/edit a Project with actual mutation and index rebuild)
- [ ] Final visual and usability acceptance (inspection of real UI with real data)
- [ ] Published service-worker acceptance (offline cache test)

### Expected Outcome
Owner confirms that the visual functionality works end-to-end with real data, files, and persisted state.
---

## 4. FUTURE FIXTURE HARNESS (deferred)

### Planned Repository-Supported Browser Fixture
This remains a planned feature for a later phase. A fixture may expose deterministic, non-confidential Workspace records to the real parser, index and UI owners.

**May automate:**
- Projects UI — rendering, filter behavior, row expansion, drafts
- Task Review — Kanban board presentation, grouping, scrolling
- Validation — real mutation and index rebuild within a safe fixture scope
- Filters — multi-column filter interaction
- Presets — saved filter/sorting presets
- Tasks — task creation, reorder, status change UI
- Knowledge — note projection and metadata UI
- Archive presentation — archive list with real file metadata
- Find Files — actual Workspace Index search
- Responsive behavior — mobile/desktop layout switching

**Must not:**
- Simulate successful physical persistence (no real file writes)
- Bypass production permissions (always runs in an isolated, non-production environment)
- Enter production builds unintentionally (fixture runs only in a disposable test environment)
- Create a second parser, index or mutation architecture (uses the existing production code path)

### Planning Note
This fixture harness requires separate design, implementation and authorization cycles. It is not part of the current Playwright MCP guide.

---

## 5. CURRENT CORPORATE CONSTRAINT

### Browser Installation Limitation
The corporate browser does not allow Playwright MCP Bridge installation within the internal CI/CD environment.

### Accepted Codespaces Workflow
1. **Static checks** (`node --check`, `git diff --check`)
2. **Repository validators** (`npm run validate:quick`, `npm run validate:projects`)
3. **Headless Playwright MCP** — for non-Workspace browser checks (boot, Welcome, mode, UI controls, overlays, themes, accessibility, responsive layout)
4. **Owner manual acceptance** — for Workspace-dependent behavior (Projects Apply, Task Board, Notes, Knowledge, Archive)
5. **Git review** — CODEOWNERS or human approval
6. **Checkpoint** — record outcomes in `docs/validation/CURRENT_VALIDATION.md`

---

## 6. CANONICAL MCP CONFIGURATION

### User Environment Configuration
This configuration belongs in the personal Cline settings (IDE-specific, not repository-level) and must not be committed to Git.

```json
{
  "mcpServers": {
    "playwright": {
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": [
          "-y",
          "@playwright/mcp@latest",
          "--browser",
          "chromium",
          "--headless",
          "--no-sandbox",
          "--isolated",
          "--output-dir",
          "/tmp/playwright-mcp"
        ]
      },
      "timeout": 60
    }
  }
}
```

**File location:** `~/.cursor/rules` or the IDE's equivalent settings path.

---

## 7. SERVER AND EVIDENCE

### Server Endpoint
Use the MarkmapEditor local server at:

```
http://127.0.0.1:8000/
```

### Temporary Evidence Location
All browser snapshots, screenshots, console logs and network request artifacts are stored under:

```
/tmp/playwright-mcp
```

An agent may stop only the server process started by that task.

**Prohibited:** broad commands that kill unrelated processes (e.g., `pkill python`, `pkill node`, `killall python3`).

---

## 8. FLUXO S22/TERMUX NATIVO + CDP + F1 (separado do headless MCP)

Este fluxo roda no Termux nativo do S22 (Android), não no Codespaces/remoto, e não depende do
`@playwright/mcp` nem do Composio. Usa Playwright direto (`playwright-core`) com
`connectOverCDP` no loopback do Chromium já rodando no S22, mais o fixture local F1
(`js/workspace/fixture-loader.js`) para popular o Workspace Index sem o seletor de pasta.

### 8.1 Pré-requisitos confirmados no S22

- Chromium com CDP na porta **9222** (`http://127.0.0.1:9222/json/version` retorna JSON com `webSocketDebuggerUrl`)
- App servida na porta **8000** (`http://127.0.0.1:8000/` retorna HTML do MarkmapEditor)
- `playwright-core` instalado em `~/.local/share/playwright-termux-native/node_modules/playwright-core` (v1.58.2)
- `playwright-core` **não carrega nativamente no Android** (`Unsupported platform: android`). Workaround: forçar
  `Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })` antes de `require('playwright-core')`.
  Após isso, `chromium.connectOverCDP` funciona normalmente.
- Não instalar pacote nem escrever cliente CDP novo. Reutilizar `cdp-smoke.cjs` na raiz como base.

### 8.2 Servidor da app

```
python3 -m http.server 8000 --bind 127.0.0.1
```
(rodar a partir da raiz do checkout `development`)

### 8.3 URL do fixture F1

```
http://127.0.0.1:8000/?mme-fixture=projects-review
```

O fixture é read-only, não modifica o workspace real. Ativa o `WORKSPACE_STATE` com dados sintéticos
(Projects: PROJECT_ALPHA, PROJECT_BETA, OWNER_A, FIXTURE_DRAFT, FIXTURE_INVALID_Q, FIXTURE_LEGACY;
Tasks: Completed Task, Open Task) e dispara `buildWorkspaceIndex()` + evento `mme-workspace-index-ready`.

Confirmação de ativação: banner `#mmeFixtureBanner` visível + logs `[fixture] activated` e
`Workspace Index: built files=.. notes=.. tags=.. tasks=.. projects=..`.

### 8.4 Comando do smoke (cópia descartável)

Baseado em `cdp-smoke.cjs` na raiz, mas **sem** `page.setContent()` na aba de trabalho e **sem** fechar
o Chromium do owner. Criar cópia temporária em `~/mme-composer-test.cjs`, conectar via CDP, navegar para
a URL do fixture, verificar ativação, então tentar expor o Report Composer pela UI.

### 8.5 Causa raiz da Sidebar oculta (S22 Termux nativo + CDP)

O botão `#reportOpenComposerButton` existe no DOM mas não tem layout físico (`offsetParent=null`,
`getBoundingClientRect()` zeros) porque o ancestral `ASIDE#workspaceSidebar` está com
`display: none`.

**Declaração CSS que aplica `display: none`:**
- Seletor: `#workspaceSidebar` (regra base, arquivo `css/workspace.css`)
- Valor: `display: none`
- Isso ocorre porque o `<html>` tem `data-app-context="editor"`, não `"journal"`.

**Regra CSS que tornaria o sidebar visível:**
- Seletor: `html[data-app-context="journal"] #workspaceSidebar`
- Valor: `display: flex`
- Condição: `data-app-context` deve ser `"journal"` no `<html>`.

**Estado atual confirmado (inspeção somente leitura):**
- `data-app-context: "editor"` (confirmado via `document.documentElement.attributes`)
- `bodyClasses: []` (sem classes adicionais no body)
- `sidebar.classList: []` (sem classes no sidebar)
- Nenhum seletor de modo visível na UI (`modeSelectors: []`)
- Nenhum botão "Journal"/"Editor"/"Slides" como controle de modo visível
- Journal workspace ativado internamente (logs: "journal workspace activated", "journalInitialized=true")
- MAS `data-app-context` ainda é "editor" — não foi alterado para "journal"

**Não é falha de conexão nem de CDP.** O CDP funciona normalmente. É o estado da UI:
o app está no modo `editor` e não há controle visível para mudar para `journal`.

**Fluxo manual conhecido:** Editor → Journal → Sidebar → Report

Requer ação manual do owner na aba F1 já controlada pelo CDP:
1. Carregar `http://127.0.0.1:8000/?mme-fixture=projects-review` (já carregada)
2. Selecionar "Journal" no seletor de modo da aplicação (muda `data-app-context` de "editor" para "journal")
3. Deixar a aba aberta — o coder retoma a automação nessa mesma aba para abrir o sidebar,
   expandir Report, clicar em "Configure Report" e executar a matriz de aceite.

Se o seletor de modo não for visível imediatamente, fechar primeiro o welcome dialog
(botão "Start" ou ×) e então selecionar Journal.

### 8.6 Evidências

Salvas em `~/mme-cdp-evidence/` (screenshots PNG, JSON de resultados).

---

## 9. TOOL POLICY

### Preferred Tools
In the headless MCP, prefer the following stable tools for validation:

- `browser_navigate`
- `browser_wait_for`
- `browser_snapshot`
- `browser_find`
- `browser_click`
- `browser_type`
- `browser_select_option`
- `browser_press_key`
- `browser_resize`
- `browser_console_messages`
- `browser_network_requests`
- `browser_take_screenshot`
- `browser_close`

Use `browser_evaluate` only for exposing properties unavailable in the snapshot.

**Do not:** use `browser_run_code_unsafe` unless explicitly authorized.

---

## 9. REPORTING

### Required Distinctions
Every report must clearly categorize outcomes:

- **automated and passed:** Validation completed fully in headless MCP (e.g., Welcome dialog close, theme toggle, accessibility check)
- **automated and failed:** Validation failed in headless MCP (e.g., assertion mismatch, element not found, console error)
- **blocked:** Validation stopped because of an automation blocker (e.g., File System Access picker)
- **manual owner check required:** Owner action needed (e.g., select a real Workspace directory)
- **not tested:** Feature not covered by Playwright MCP (e.g., Archive/Restore with real files)

### Reporting Rule
Never convert static validation (e.g., `git diff --check`, `node --check`) into browser acceptance.

---



## 11. VALIDATION RATIONALIZATION WORKFLOW RULES (added after ACT 3B closure)

### Owner evidence rule:
If the owner supplies equivalent or stronger real-Workspace browser evidence before the agent finishes a broad Playwright run:
- stop the redundant broad run;
- use the owner evidence for fulfilled scenarios;
- run only missing bounded regression checks;
- clearly distinguish owner evidence from automated evidence.

### Visual-only correction rule:
Do not rerun complete browser acceptance after a visual-only correction.
Run only the scenario that covers the corrected behavior plus one functional smoke check.

### Validator timing rule:
Do not update validators while the product implementation is still changing unless the validator protects a critical architecture or mutation boundary.
Preferred sequence:
implement to functional completion
→ syntax/diff check
→ one browser smoke
→ align targeted validators once
→ targeted browser acceptance once

### Release check separation:
Do not let release checks (T01, T04, T07, N08, N09) block normal Projects/Reports feature implementation.
These belong to PACKAGE5 profile only, run at package/version boundaries.

Do not remove them from the repository, but ensure normal feature work does not run them by default.

## 10. REFERENCES

### Related Documents
- `docs/AI_DEVELOPMENT_WORKFLOW.md` — full workflow and manual acceptance stages
- `docs/validation/CURRENT_VALIDATION.md` — latest validation evidence
- `docs/validation/OWNER_TEST_MATRIX.md` — owner-selected validation tiers (entry point for owners)
- `docs/validation/TEST_CATALOG.md` — test catalog (entry point for test runners)

---

## 11. VALIDATION

### Run this checklist on every manual edit of this guide

1. **Check git status:** `git status --short`
2. **Check git diff:** `git diff --check`
3. **Check git diff stat:** `git diff --stat`
4. **Validate scope:** ensure no source, test, validator or ACT-plan files changed.
5. **Do not:** stage, commit, or push the guide or references (they will be staged by a separate agent).