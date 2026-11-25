// Frame-time and loading checks at a few scroll positions.
//   node scripts/perf.mjs [query ...]      e.g. node scripts/perf.mjs "" "?msaa=0"
import { chromium } from 'playwright-core';

const queries = process.argv.slice(2).length ? process.argv.slice(2) : [''];
const base = process.env.VILLA_URL ?? 'http://localhost:5173/';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });

for (const q of queries) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const requests = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfinished', (r) => requests.push(r.url()));
  const t0 = Date.now();
  await page.goto(base + q);
  await page.waitForSelector('.loader.is-done', { timeout: 90000, state: 'attached' });
  const ready = Date.now() - t0;
  await page.waitForTimeout(3500);

  // frames actually rendered by the canvas while nothing is happening
  const idle = await page.evaluate(
    () =>
      new Promise((res) => {
        const gl = document.querySelector('canvas').getContext('webgl2');
        let draws = 0;
        const orig = gl.drawArrays.bind(gl);
        const origE = gl.drawElements.bind(gl);
        gl.drawArrays = (...a) => (draws++, orig(...a));
        gl.drawElements = (...a) => (draws++, origE(...a));
        setTimeout(() => {
          gl.drawArrays = orig;
          gl.drawElements = origE;
          res(draws);
        }, 2000);
      }),
  );

  const rows = [];
  for (const at of [0.25, 0.68, 0.87, 0.97]) {
    await page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), at);
    await page.waitForTimeout(600);
    // measure while the camera is still travelling (that is when it must be smooth)
    const r = await page.evaluate(
      () =>
        new Promise((res) => {
          const t = [];
          let last = performance.now();
          const f = (n) => {
            t.push(n - last);
            last = n;
            t.length < 150 ? requestAnimationFrame(f) : (t.sort((a, b) => a - b), res([+t[75].toFixed(1), +t[142].toFixed(1), +t[149].toFixed(1)]));
          };
          requestAnimationFrame(f);
        }),
    );
    rows.push(`${Math.round(at * 100)}%: median ${r[0]} / p95 ${r[1]} / max ${r[2]} ms`);
    await page.waitForTimeout(2500);
  }
  const ktx = requests.filter((u) => u.endsWith('.ktx2')).length;
  const dpr = await page.evaluate(() => document.querySelector('canvas').width / document.querySelector('canvas').clientWidth);
  console.log(`\n[${q || 'default'}] ready in ${ready} ms, ${ktx} KTX2 files loaded, canvas pixel ratio ${dpr.toFixed(2)}`);
  console.log(`  idle on the hero: ${idle} draw calls in 2 s`);
  for (const r of rows) console.log('  ' + r);
  console.log('  console errors:', errors.length ? [...new Set(errors)].slice(0, 4) : 'none');
  await page.close();
}
await browser.close();
