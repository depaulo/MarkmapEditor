// MarkmapEditor — Smoke test do Report Composer (v1)
// Executar com: node scripts/report-composer-smoke.cjs
// Pré-requisitos:
//   - Chromium com CDP em http://127.0.0.1:9222 (launcher separado, não instalado aqui)
//   - App servida em http://127.0.0.1:8000/ (servindo a raiz do checkout)
//   - playwright-core 1.58.2 em ~/.local/share/playwright-termux-native/
//     Resolução exige workaround: Object.defineProperty(process, 'platform', { value: 'linux' })
//       antes de require('playwright-core') (Android não é suportado nativamente pelo pacote).
Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
const { chromium } = require("/data/data/com.termux/files/home/.local/share/playwright-termux-native/node_modules/playwright-core");
const fs = require("fs");
const CDP_ENDPOINT = "http://127.0.0.1:9222";
const APP_URL = "http://127.0.0.1:8000/?mme-fixture=projects-review";
const OUTPUT_DIR = "/data/data/com.termux/files/home/mme-cdp-evidence";
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const results = {
  cdpConnected: false, appLoaded: false, fixtureActivated: false,
  welcomeClosed: false, journalSelected: false, sidebarVisible: false,
  reportSectionExpanded: false, composerOpened: false,
  composerControlsVisible: false, pageErrors: [], consoleErrors: [],
  errors: [],
};

async function main() {
  const browser = await chromium.connectOverCDP(CDP_ENDPOINT, { timeout: 30000 });
  results.cdpConnected = true;
  const contexts = browser.contexts();
  const context = contexts[0] || await browser.newContext();
  const pages = context.pages();
  const page = pages[0] || await context.newPage();
  page.on("pageerror", err => results.pageErrors.push(err.message));
  page.on("console", msg => { if (msg.type() === "error") results.consoleErrors.push(msg.text()); });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  results.appLoaded = true;
  await page.waitForTimeout(3000);
  try { await page.waitForSelector("#mmeFixtureBanner", { timeout: 10000 }); results.fixtureActivated = true; } catch (e) { results.errors.push(`banner: ${e.message}`); }
  try { await page.click('#btnWelcomeContinue, #btnWelcomeClose'); results.welcomeClosed = true; await page.waitForTimeout(500); } catch {}
  await page.evaluate(() => { const ov = document.getElementById('releaseNotesOverlay'); if (ov) ov.style.display = 'none'; });
  await page.waitForTimeout(300);

  await page.selectOption('#appContextSelect', 'journal');
  results.journalSelected = true;
  await page.waitForTimeout(2000);
  await page.click('.workspacePanelHeaderButton:has-text("Report")');
  results.reportSectionExpanded = true;
  await page.waitForTimeout(1000);
  await page.click('#reportOpenComposerButton');
  results.composerOpened = true;
  await page.waitForTimeout(2000);
  await page.evaluate(() => { const modal = document.getElementById('mapStyleModal'); if (modal) modal.remove(); });
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
  const controlsVisible = await page.evaluate(() => {
    const container = document.getElementById('workspaceReportComposer');
    if (!container) return false;
    const hasStart = !!document.getElementById('reportStartDate');
    const hasEnd = !!document.getElementById('reportEndDate');
    const hasProjectsSection = !!document.querySelector('[class*="reportComposerSectionBlock"]');
    const hasSelectBtn = !!document.querySelector('.reportComposerSectionTool');
    const hasBuildBtn = !!document.querySelector('.reportComposerBuildButton');
    return container.offsetParent !== null && hasStart && hasEnd && hasProjectsSection && hasSelectBtn && hasBuildBtn;
  });
  results.composerControlsVisible = controlsVisible;
  await page.screenshot({ path: `${OUTPUT_DIR}/smoke-composer-open.png`, fullPage: true });
  const summary = {
    cdpConnected: results.cdpConnected, appLoaded: results.appLoaded,
    fixtureActivated: results.fixtureActivated, welcomeClosed: results.welcomeClosed,
    journalSelected: results.journalSelected,
    reportSectionExpanded: results.reportSectionExpanded,
    composerOpened: results.composerOpened,
    composerControlsVisible: results.composerControlsVisible,
    pageErrors: results.pageErrors, consoleErrors: results.consoleErrors,
    errors: results.errors, url: APP_URL,
  };
  fs.writeFileSync(`${OUTPUT_DIR}/smoke-result.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  await browser.close();
  const allPass = results.cdpConnected && results.appLoaded && results.fixtureActivated &&
    results.journalSelected && results.reportSectionExpanded && results.composerOpened &&
    results.composerControlsVisible && results.errors.length === 0;
  console.log(`\nSMOKE: ${allPass ? 'PASS' : 'FAIL'}`);
  process.exit(allPass ? 0 : 1);
}
main().catch(error => {
  results.errors.push(`fatal: ${error.message}`);
  fs.writeFileSync(`${OUTPUT_DIR}/smoke-result.json`, JSON.stringify(results, null, 2));
  console.error(error);
  console.log("SMOKE: FAIL");
  process.exit(1);
});

