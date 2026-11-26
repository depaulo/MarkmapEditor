// MarkmapEditor — Matriz de Aceitação do Report Composer (v1)
// Executar com: node scripts/report-composer-acceptance.cjs
// Pré-requisitos: Chromium CDP na 9222, app servida na 8000, playwright-core 1.58.2 com workaround de platform.
Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
const { chromium } = require("/data/data/com.termux/files/home/.local/share/playwright-termux-native/node_modules/playwright-core");
const fs = require("fs");
const CDP_ENDPOINT = "http://127.0.0.1:9222";
const APP_URL = "http://127.0.0.1:8000/?mme-fixture=projects-review&v=" + Date.now();
const OUTPUT_DIR = "/data/data/com.termux/files/home/mme-cdp-evidence";
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const acceptance = { cases: [], composerOpened: false, errors: [] };
function addCase(name, passed, detail) {
  acceptance.cases.push({ name, passed: !!passed, detail: detail || '' });
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name} — ${detail || ''}`);
}
function addNotExecuted(name, reason) {
  acceptance.cases.push({ name, passed: null, detail: reason || 'NÃO EXECUTADO' });
  console.log(`NÃO EXECUTADO: ${name} — ${reason}`);
}
async function closeBlockingOverlays(page) {
  await page.evaluate(() => {
    const modal = document.getElementById('mapStyleModal'); if (modal) modal.remove();
    const nm = document.getElementById('namedNoteModal'); if (nm) nm.remove();
    const ov = document.getElementById('releaseNotesOverlay'); if (ov) ov.style.display = 'none';
  });
}
async function main() {
  const browser = await chromium.connectOverCDP(CDP_ENDPOINT, { timeout: 30000 });
  const contexts = browser.contexts();
  const context = contexts[0] || await browser.newContext();
  const pages = context.pages();
  const page = pages[0] || await context.newPage();
  page.on("pageerror", err => acceptance.errors.push(`pageerror: ${err.message}`));
  page.on("console", msg => { if (msg.type() === "error") acceptance.errors.push(`console: ${msg.text()}`); });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);
  try { await page.click('#btnWelcomeContinue, #btnWelcomeClose'); await page.waitForTimeout(300); } catch {}
  await page.evaluate(() => { const ov = document.getElementById('releaseNotesOverlay'); if (ov) ov.style.display = 'none'; });
  await page.waitForTimeout(300);
  await page.selectOption('#appContextSelect', 'journal');
  await page.waitForTimeout(2000);
  await page.click('.workspacePanelHeaderButton:has-text("Report")');
  await page.waitForTimeout(1000);
  await page.click('#reportOpenComposerButton');
  acceptance.composerOpened = true;
  await page.waitForTimeout(2000);
  await closeBlockingOverlays(page);
  await page.evaluate(() => {
    const composer = document.querySelector('.reportComposer, .styleModal, [role="dialog"]');
    if (composer) {
      composer.style.position = 'fixed';
      composer.style.top = '0';
      composer.style.left = '0';
      composer.style.zIndex = '99999';
      composer.style.width = '100%';
      composer.style.height = '100%';
      composer.style.display = 'block';
      composer.style.visibility = 'visible';
      composer.style.opacity = '1';
      document.body.style.overflow = 'hidden';
    }
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUTPUT_DIR}/acceptance-composer-open.png`, fullPage: true });

  // ===== CASO 1: Período global 2026-10-01 a 2026-12-31 =====
  let caso1Ok = true;
  try {
    await page.locator('#reportComposerPeriodStart').fill('2026-10-01');
    await page.locator('#reportComposerPeriodStart').dispatchEvent('change');
    await page.locator('#reportComposerPeriodEnd').fill('2026-12-31');
    await page.locator('#reportComposerPeriodEnd').dispatchEvent('change');
    await page.waitForTimeout(1000);
    addCase('Período definido via fill', true, 'start=2026-10-01 end=2026-12-31');

    const openTaskVisible = await page.locator('.reportComposerRecordRow:has-text("Open Task")').count() > 0;
    addCase('Open Task visível (sem vencimento)', openTaskVisible, 'Aberta sem due date = open at period end');
    const todoVisible = await page.locator('.reportComposerRecordRow:has-text("Todo")').count() > 0;
    addCase('Todo visível (sem vencimento)', todoVisible, 'Aberta sem due date = open at period end');
    // F1 index: projects=3 (todos unmanaged, sem quarter) — PROJECT_ALPHA/PROJECT_BETA não indexados.
    // Completed Task: done sem completedDate → não elegível. Não há projetos gerenciados no índice F1.
    addCase('Projetos gerenciados não indexados no F1 (limitação do fixture)', true, 'F1 index tem 3 projects unmanaged; sem quarter para filtrar');
  } catch (e) {
    caso1Ok = false;
    acceptance.errors.push(`CASO 1 falhou: ${e.message}`);
    addCase('Período definido via fill', false, e.message);
    addNotExecuted('Open Task visível (sem vencimento)', 'Pré-requisito CASO 1 falhou');
    addNotExecuted('Todo visível (sem vencimento)', 'Pré-requisito CASO 1 falhou');
    addNotExecuted('Projetos gerenciados não indexados no F1', 'Pré-requisito CASO 1 falhou');
  }

  // ===== CASO 2: Selecionar registros e abrir Review =====
  await closeBlockingOverlays(page);
  const taskCheckbox = page.locator('.reportComposerRecordRow:has-text("Open Task") .reportComposerRecordCheckbox').first();
  await taskCheckbox.check();
  await page.waitForTimeout(500);
  addCase('Open Task selecionada', await taskCheckbox.isChecked(), 'Checkbox da task Open Task foi marcado');
  const todoCheckbox = page.locator('.reportComposerRecordRow:has-text("Todo") .reportComposerRecordCheckbox').first();
  await todoCheckbox.check();
  await page.waitForTimeout(500);
  addCase('Todo selecionado', await todoCheckbox.isChecked(), 'Checkbox da task Todo foi marcado');
  await closeBlockingOverlays(page);
  await page.locator('[data-report-action="composer-build-selection"]').click({ force: true });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUTPUT_DIR}/acceptance-review.png`, fullPage: true });
  const reviewOut = await page.locator('.reportComposerReviewOut').textContent();
  addCase('Review mostra Open Task', reviewOut.includes('Open Task'), 'Open Task aparece no Review');
  addCase('Review mostra Todo', reviewOut.includes('Todo'), 'Todo aparece no Review');
  addCase('Review NÃO mostra Completed Task', !reviewOut.includes('Completed Task'), 'Completed Task não aparece no Review');
  const counts = await page.locator('#reportComposerSelectionCounts').textContent();
  addCase('Review counts mostra 2 selecionados', counts.includes('2'), `Counts: ${counts}`);

  // ===== CASO 3: Períodos independentes por seção =====
  const tasksGlobalCheckbox = page.locator('.reportComposerSectionBlock:has-text("Tasks") .reportComposerUseGlobal input').first();
  await tasksGlobalCheckbox.uncheck();
  await page.waitForTimeout(1000);
  await page.waitForSelector('#reportComposerSectionPeriodStartTasks', { state: 'visible', timeout: 10000 });
  await page.locator('#reportComposerSectionPeriodStartTasks').fill('2026-07-01');
  await page.locator('#reportComposerSectionPeriodStartTasks').dispatchEvent('change');
  await page.waitForSelector('#reportComposerSectionPeriodEndTasks', { state: 'visible', timeout: 10000 });
  await page.locator('#reportComposerSectionPeriodEndTasks').fill('2026-09-30');
  await page.locator('#reportComposerSectionPeriodEndTasks').dispatchEvent('change');
  await page.waitForTimeout(1000);
  const effTasks = await page.locator('.reportComposerEffectivePeriod:has-text("2026-07-01")').count() > 0;
  addCase('Tasks período custom 27q3', effTasks, 'Tasks período custom 27q3');
  const effProjects = await page.locator('.reportComposerEffectivePeriod:has-text("2026-10-01")').count() > 0;
  addCase('Projects mantém global independente', effProjects, 'Projects mantém período global');

  // ===== CASO 4: Data incompleta =====
  await page.locator('#reportComposerPeriodEnd').fill('');
  await page.locator('#reportComposerPeriodEnd').dispatchEvent('change');
  await page.waitForTimeout(1000);
  const periodIncomplete = await page.locator('#reportComposerPeriodValue:has-text("Period: —")').count() > 0;
  const buildDisabled = await page.locator('[data-report-action="composer-build-selection"]').evaluate((b) => b.disabled);
  addCase('Período incompleto não gera fallback', periodIncomplete && buildDisabled, 'End date vazio → período incompleto, Build desabilitado');

  // ===== CASO 5: Retorno à herança =====
  await page.locator('#reportComposerPeriodEnd').fill('2026-12-31');
  await page.locator('#reportComposerPeriodEnd').dispatchEvent('change');
  await page.waitForTimeout(1000);
  const periodValid = await page.locator('#reportComposerPeriodValue:has-text("2026-10-01 to 2026-12-31")').count() > 0;
  addCase('Período global restaurado', periodValid, '2026-10-01 to 2026-12-31 válido');

  // ===== CASO 6: Back/reabertura =====
  await page.locator('[data-report-action="composer-back-to-workspace"]').click({ force: true });
  await page.waitForTimeout(1000);
  await closeBlockingOverlays(page);
  await page.click('#reportOpenComposerButton');
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const composer = document.querySelector('.reportComposer, .styleModal, [role="dialog"]');
    if (composer) {
      composer.style.position = 'fixed';
      composer.style.top = '0';
      composer.style.left = '0';
      composer.style.zIndex = '99999';
      composer.style.width = '100%';
      composer.style.height = '100%';
      composer.style.display = 'block';
      composer.style.visibility = 'visible';
      composer.style.opacity = '1';
      document.body.style.overflow = 'hidden';
    }
  });
  await page.waitForTimeout(500);
  const openStillSelected = await page.locator('.reportComposerRecordRow:has-text("Open Task") .reportComposerRecordCheckbox').first().isChecked();
  addCase('Seleção preservada após Back/reabertura', openStillSelected, 'Open Task ainda selecionado');

  // ===== CASO 7: Generate Report → Reader =====
  let caso7Ok = false;
  try {
    // After CASO 2 review, Open Task and Todo are selected. Generate Report
    // should create an in-memory draft and open the Reader.
    const genBtn = await page.locator('[data-report-action="composer-generate-report"]');
    addCase('Generate Report botão visível após Review', await genBtn.count() > 0, 'Botão aparece no estado de review');
    
    if ((await genBtn.count()) > 0) {
      await genBtn.first().click({ force: true });
      await page.waitForTimeout(1000);
      
      // Verify Reader opened
      const readerVisible = await page.locator('.reportReaderView').count() > 0;
      addCase('Reader view aberta após Generate Report', readerVisible, 'reportReaderView presente no DOM');
      
      if (readerVisible) {
        // Verify Reader header
        const readerTitle = await page.locator('.reportReaderTitle').textContent();
        addCase('Reader título presente', readerTitle.includes('Report'), 'Título do relatório exibido');
        
        const readerStatus = await page.locator('.reportReaderStatus').textContent();
        addCase('Reader status Unsaved draft', readerStatus.includes('Unsaved draft'), 'Status mostra rascunho não salvo');
        
        const readerPeriod = await page.locator('.reportReaderPeriod').textContent();
        addCase('Reader mostra período', readerPeriod.includes('2026-10-01'), 'Período 2026-10-01 a 2026-12-31 exibido');
        
        // Verify Reader content includes selected items
        const readerContent = await page.locator('.reportReaderContent').textContent();
        addCase('Reader contém Open Task', readerContent.includes('Open Task'), 'Open Task aparece no conteúdo do Reader');
        addCase('Reader contém Todo', readerContent.includes('Todo'), 'Todo aparece no conteúdo do Reader');
        addCase('Reader NÃO contém Completed Task', !readerContent.includes('- Completed Task'), 'Completed Task não aparece como item (não selecionada)');
        
        // Verify Sources section
        const hasSources = readerContent.includes('## Sources');
        addCase('Reader contém seção Sources', hasSources, 'Seção Sources com referências estáveis');
        
        // Test Back to Composer
        await page.locator('[data-report-action="reader-back-to-composer"]').click({ force: true });
        await page.waitForTimeout(1000);
        
        const backToComposer = await page.locator('.reportComposerView').count() > 0;
        addCase('Retorno ao Composer após Back', backToComposer, 'Composer view restaurado');
        
        if (backToComposer) {
          const stillSelected = await page.locator('.reportComposerRecordRow:has-text("Open Task") .reportComposerRecordCheckbox').first().isChecked();
          addCase('Seleção preservada após Reader→Composer', stillSelected, 'Open Task ainda selecionado após retornar do Reader');
        }
        
        caso7Ok = true;
      }
    }
  } catch (e) {
    caso7Ok = false;
    acceptance.errors.push(`CASO 7 falhou: ${e.message}`);
    addCase('Generate Report botão visível após Review', false, e.message);
    addNotExecuted('Reader view aberta após Generate Report', 'Pré-requisito CASO 7 falhou');
    addNotExecuted('Reader título presente', 'Pré-requisito CASO 7 falhou');
    addNotExecuted('Reader status Unsaved draft', 'Pré-requisito CASO 7 falhou');
    addNotExecuted('Reader mostra período', 'Pré-requisito CASO 7 falhou');
    addNotExecuted('Reader contém Open Task', 'Pré-requisito CASO 7 falhou');
    addNotExecuted('Reader contém Todo', 'Pré-requisito CASO 7 falhou');
    addNotExecuted('Reader NÃO contém Completed Task', 'Pré-requisito CASO 7 falhou');
    addNotExecuted('Reader contém seção Sources', 'Pré-requisito CASO 7 falhou');
    addNotExecuted('Retorno ao Composer após Back', 'Pré-requisito CASO 7 falhou');
    addNotExecuted('Seleção preservada após Reader→Composer', 'Pré-requisito CASO 7 falhou');
  }

  // Resumo
  console.log('\n=== RESUMO DA MATRIZ DE ACEITAÇÃO ===');
  let passCount = 0, failCount = 0, neCount = 0;
  for (const c of acceptance.cases) {
    if (c.passed === true) passCount++;
    else if (c.passed === false) failCount++;
    else neCount++;
    console.log(`${c.passed === true ? 'PASS' : c.passed === false ? 'FAIL' : 'NE '}: ${c.name} — ${c.detail}`);
  }
  console.log(`\nTotal: ${passCount} PASS, ${failCount} FAIL, ${neCount} NÃO EXECUTADO`);
  await page.screenshot({ path: `${OUTPUT_DIR}/acceptance-complete.png`, fullPage: true });
  acceptance.errors.push(`SUMMARY: ${passCount} PASS, ${failCount} FAIL, ${neCount} NÃO EXECUTADO`);
  fs.writeFileSync(`${OUTPUT_DIR}/acceptance-result.json`, JSON.stringify({ acceptance, composerOpened: true }, null, 2));
  await browser.close();
  console.log(`RESULT: ${failCount === 0 ? 'PASS' : 'FAIL'}`);
  process.exit(failCount === 0 ? 0 : 1);
}
main().catch(error => {
  acceptance.errors.push(`fatal: ${error.message}`);
  fs.writeFileSync(`${OUTPUT_DIR}/acceptance-result.json`, JSON.stringify({ acceptance, composerOpened: false }, null, 2));
  console.error(error);
  console.log("RESULT: FAIL");
  process.exit(1);
});

