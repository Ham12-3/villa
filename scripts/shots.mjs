// Screenshots the scroll story at fixed scroll positions.
//   node scripts/shots.mjs [label] [--mobile] [--reverse] [--reduced] [--size=1024x768] [--at=40,55]
// Needs the dev server on :5173 and uses the installed Edge/Chrome (no browser download).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const label = args.find((a) => !a.startsWith('--')) ?? 'run';
const mobile = args.includes('--mobile');
const reverse = args.includes('--reverse');
const reduced = args.includes('--reduced');
const sizeArg = args.find((a) => a.startsWith('--size='));
const size = sizeArg ? sizeArg.slice(7).split('x').map(Number) : [1440, 900];
const at = args.find((a) => a.startsWith('--at='));
let stops = at ? at.slice(5).split(',').map(Number) : [0, 15, 25, 40, 55, 70, 80, 90, 100];
// --units: positions are story units (0..238, see STORY_END in src/data/chapters.ts)
// instead of percent of the page scroll
const STORY_END = 238;
const units = args.includes('--units');
const toPercent = (v) => (units ? (v / STORY_END) * 100 : v);
if (reverse) stops = [...stops].reverse();

const url = process.env.VILLA_URL ?? 'http://localhost:5173/';
const out = `shots/${label}`;
mkdirSync(out, { recursive: true });

let browser;
for (const channel of ['msedge', 'chrome']) {
  try {
    browser = await chromium.launch({
      channel,
      headless: true,
      args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--enable-unsafe-swiftshader'],
    });
    break;
  } catch {}
}
if (!browser) throw new Error('No Edge or Chrome found for Playwright.');

const page = await browser.newPage({
  viewport: mobile ? { width: 390, height: 844 } : { width: size[0], height: size[1] },
  deviceScaleFactor: mobile ? 2 : 1,
  isMobile: mobile,
  hasTouch: mobile,
  reducedMotion: reduced ? 'reduce' : 'no-preference',
});
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: 'load' });
await page.waitForSelector('.loader.is-done', { timeout: 60000 });
await page.waitForTimeout(1200);

if (reverse) {
  // go all the way down first so every stop is reached scrolling backwards
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(4500);
}

for (const p of stops) {
  await page.evaluate((pc) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, (pc / 100) * max);
  }, toPercent(p));
  await page.waitForTimeout(reduced ? 3000 : 4200); // let the weighted scroll + camera settle
  const name = `${out}/${mobile ? 'm-' : ''}${sizeArg ? size.join('x') + '-' : ''}${reverse ? 'rev-' : ''}${String(p).padStart(3, '0')}.png`;
  await page.screenshot({ path: name });
  console.log('saved', name);
}

if (errors.length) console.log('CONSOLE ERRORS:\n' + [...new Set(errors)].slice(0, 12).join('\n'));
await browser.close();
