// CDP Smoke Test for Termux Native Chromium

const { chromium } = require("playwright-core");
const fs = require("fs");

const CDP_ENDPOINT = "http://127.0.0.1:9222";
const OUTPUT_DIR = "/data/data/com.termux/files/home/mme-cdp-evidence";

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function main() {
  const browser = await chromium.connectOverCDP(CDP_ENDPOINT, {
    timeout: 30000
  });

  const contexts = browser.contexts();
  const context = contexts[0] || await browser.newContext();
  const pages = context.pages();
  const page = pages[0] || await context.newPage();

  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`
    <!doctype html>
    <meta charset="utf-8">
    <title>Termux CDP Smoke</title>
    <button id="run" type="button">Run</button>
    <div id="result">Waiting</div>
    <script>
      document.getElementById("run").addEventListener("click", () => {
        document.getElementById("result").textContent = "Passed";
      });
    </script>
  `);

  await page.getByRole("button", { name: "Run" }).click();

  const evidence = {
    title: await page.title(),
    result: await page.locator("#result").textContent(),
    viewport: page.viewportSize(),
    innerWidth: await page.evaluate(() => window.innerWidth),
    mobileQuery: await page.evaluate(() => window.matchMedia("(max-width: 767px)").matches),
    pageErrors
  };

  await page.screenshot({ path: "/data/data/com.termux/files/home/mme-cdp-evidence/cdp-smoke.png", fullPage: true });
  fs.writeFileSync("/data/data/com.termux/files/home/mme-cdp-evidence/cdp-smoke.json", JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));

  const passed =
    evidence.title === "Termux CDP Smoke" &&
    evidence.result === "Passed" &&
    evidence.innerWidth === 390 &&
    evidence.mobileQuery === true &&
    evidence.pageErrors.length === 0;

  await browser.close();
  if (!passed) { console.error("RESULT: FAIL"); process.exit(1); }
  console.log("RESULT: PASS");
}

main().catch(error => { console.error(error); process.exit(1); });
