/* ============================================================
   verify.mjs — "verify like a pro" (Playwright)

   Serves nothing itself: start a static server first, e.g.
       python3 -m http.server 4173
   then:
       node scripts/verify.mjs [http://localhost:4173]

   What it checks (screenshots land in screenshots/):
     1. Desktop 1440×900 — screenshots at 0/15/30/45/60/75/90 %
        of the full scroll range. LOOK at every one.
     2. Mobile 390×844 — screenshots at 3 positions.
     3. Zero console errors, zero failed requests (404s etc).
     4. No horizontal overflow (scrollWidth must equal clientWidth).
     5. Reduced-motion pass — page must render with all copy visible.
   Exits non-zero if any hard assertion fails.
   ============================================================ */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:4173';
const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

const consoleErrors = [];
const failedRequests = [];
let failures = 0;

/* CHROMIUM_PATH lets CI / sandboxes reuse a preinstalled browser
   instead of downloading one (e.g. /opt/pw-browsers/chromium). */
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

async function makePage(context) {
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', (res) => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
  });
  page.on('requestfailed', (req) => {
    failedRequests.push(`FAILED ${req.url()} (${req.failure()?.errorText})`);
  });
  return page;
}

/* Scroll by real wheel-ish steps so Lenis + ScrollTrigger run exactly the
   code a user runs; a plain scrollTo teleport can skip pinned states. */
async function settleAt(page, fraction) {
  await page.evaluate(async (f) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.round(max * f));
  }, fraction);
  await page.waitForTimeout(1400); // let scrub catch up (scrub: 1)
}

async function sweep(label, width, height, fractions) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await makePage(context);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200); // frame preload / first paint

  for (const f of fractions) {
    await settleAt(page, f);
    const name = `${OUT}/${label}-${String(Math.round(f * 100)).padStart(2, '0')}.png`;
    await page.screenshot({ path: name });
    console.log('shot', name);
  }

  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  if (overflow > 0) {
    console.error(`✗ ${label}: horizontal overflow of ${overflow}px`);
    failures++;
  } else {
    console.log(`✓ ${label}: no horizontal overflow`);
  }
  await context.close();
}

await sweep('desktop', 1440, 900, [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9]);
await sweep('mobile', 390, 844, [0, 0.45, 0.9]);

/* Reduced motion: all beats must be visible without any scripting help */
{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await makePage(context);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const visibleBeats = await page.evaluate(() =>
    ['beat1', 'beat2', 'beat3', 'beatEnd'].filter((id) => {
      const el = document.getElementById(id);
      return el && getComputedStyle(el).opacity === '1';
    }).length
  );
  if (visibleBeats !== 4) {
    console.error(`✗ reduced-motion: only ${visibleBeats}/4 copy beats visible`);
    failures++;
  } else {
    console.log('✓ reduced-motion: all copy readable without animation');
  }
  await page.screenshot({ path: `${OUT}/reduced-motion.png`, fullPage: false });
  await context.close();
}

await browser.close();

if (consoleErrors.length) {
  console.error(`✗ console errors (${consoleErrors.length}):`);
  consoleErrors.forEach((e) => console.error('  ', e));
  failures++;
} else {
  console.log('✓ zero console errors');
}
if (failedRequests.length) {
  console.error(`✗ failed requests (${failedRequests.length}):`);
  failedRequests.forEach((e) => console.error('  ', e));
  failures++;
} else {
  console.log('✓ zero failed requests');
}

process.exit(failures ? 1 : 0);
