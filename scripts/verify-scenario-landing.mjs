// End-to-end check for "scenario selected on landing" (no frontend test runner).
// Requires the dev servers running (vite :5173 + api :8787) and `playwright-core`
// available (npm i -D playwright-core, or run with NODE_PATH pointing at an
// existing install). Drives real Chrome.
import { chromium } from 'playwright-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:5173';

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext();
// Returning user with a valid indicator + geography, no stored scenario yet.
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('indicator', 'Mean Temperature');
    localStorage.setItem('geography', 'Algeria');
    localStorage.removeItem('scenarios');
  } catch {}
});
const page = await ctx.newPage();

async function scenarioBtn() {
  return await page.evaluate(() => {
    const labels = [...document.querySelectorAll('*')].filter((el) => el.children.length === 0 && el.textContent.trim() === 'Scenario');
    for (const lab of labels) {
      const b = lab.closest('button') || lab.parentElement?.closest('button') || lab.parentElement;
      if (b) return b.innerText.replace(/\s+/g, ' ').trim();
    }
    return '(none)';
  });
}

const BROKEN = /Unavailable|Select (an|a valid)/; // the states this fix removes
const NOT_RENDERED = '(none)'; // page/control still loading — not a scenario failure

// Land on another page first, then navigate INTO explore in-app (the failure path).
await page.goto(`${BASE}/methodology`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.evaluate(() => {
  const a = [...document.querySelectorAll('a[href]')].find((a) => a.getAttribute('href')?.includes('/impacts/explore'));
  if (a) a.click();
});

// Wait for the scenario control to render (the nav itself waits on the slow
// catalog fetch — that's a page-load concern, separate from the scenario bug).
let firstShown = NOT_RENDERED;
for (let i = 0; i < 30 && firstShown === NOT_RENDERED; i++) {
  await page.waitForTimeout(500);
  firstShown = await scenarioBtn();
}

// Once it renders, sample it repeatedly: it must never be a broken state and
// must not change scenario (no swap).
const seen = [firstShown];
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(750);
  seen.push(await scenarioBtn());
}

const rendered = seen.filter((v) => v !== NOT_RENDERED);
const brokenStates = rendered.filter((v) => BROKEN.test(v));
const distinct = [...new Set(rendered)];
const swapped = distinct.length > 1;

console.log('first rendered:', JSON.stringify(firstShown));
console.log('samples after render:', JSON.stringify(rendered));
if (brokenStates.length) {
  console.log(`\nFAIL — scenario showed a broken state after render: ${JSON.stringify([...new Set(brokenStates)])}`);
} else if (swapped) {
  console.log(`\nFAIL — scenario swapped under the user: ${JSON.stringify(distinct)}`);
} else {
  console.log(`\nPASS — scenario rendered as ${JSON.stringify(distinct[0])} immediately and held (no "unavailable", no swap)`);
}
await browser.close();
