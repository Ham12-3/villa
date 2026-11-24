// Measures how smooth the camera is under steppy wheel input, and checks the spline itself.
//   node scripts/motion.mjs
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(process.env.VILLA_URL ?? 'http://localhost:5173/');
await page.waitForSelector('.loader.is-done', { timeout: 60000 });
await page.waitForTimeout(1000);

// 1. the spline: sampled densely, tilt must never decrease and nothing may jump
const spline = await page.evaluate(async () => {
  const { createCameraPath } = await import('/src/animation/cameraPath.ts');
  const f = createCameraPath(false);
  const o = { tx: 0, ty: 0, tz: 0, radius: 0, polar: 0, azimuth: 0, fov: 30 };
  let prev = null, minPolar = 1e9, polarDrops = 0, maxStep = 0, maxAccel = 0, prevV = null;
  for (let i = 0; i <= 2000; i++) {
    const p = { ...f(i / 20, o) };
    minPolar = Math.min(minPolar, p.polar);
    if (prev) {
      if (p.polar < prev.polar - 1e-9) polarDrops++;
      const v = { polar: p.polar - prev.polar, az: p.azimuth - prev.azimuth, r: p.radius - prev.radius };
      maxStep = Math.max(maxStep, Math.abs(v.polar), Math.abs(v.az), Math.abs(v.r));
      if (prevV) maxAccel = Math.max(maxAccel, Math.abs(v.polar - prevV.polar), Math.abs(v.az - prevV.az), Math.abs(v.r - prevV.r));
      prevV = v;
    }
    prev = p;
  }
  return { minPolar, polarDrops, maxStepPer0_05pct: +maxStep.toFixed(4), maxVelocityChange: +maxAccel.toFixed(5) };
});
console.log('spline', spline);

// 2. live motion: coarse wheel ticks, sample the real camera every frame
await page.evaluate(() => {
  window.__rec = [];
  const tick = (t) => {
    const c = window.__villa.cam;
    window.__rec.push([t, c.polar, c.azimuth, c.radius, window.scrollY]);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await page.mouse.move(700, 450);
const run = async (dir, n) => {
  for (let i = 0; i < n; i++) {
    await page.mouse.wheel(0, dir * 240);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(3500);
};
const analyse = async (label) => {
  const r = await page.evaluate(() => {
    const rec = window.__rec; window.__rec = [];
    let maxPolar = 0, maxAz = 0, maxR = 0, maxScroll = 0, dts = [];
    for (let i = 1; i < rec.length; i++) {
      dts.push(rec[i][0] - rec[i - 1][0]);
      maxPolar = Math.max(maxPolar, Math.abs(rec[i][1] - rec[i - 1][1]));
      maxAz = Math.max(maxAz, Math.abs(rec[i][2] - rec[i - 1][2]));
      maxR = Math.max(maxR, Math.abs(rec[i][3] - rec[i - 1][3]));
      maxScroll = Math.max(maxScroll, Math.abs(rec[i][4] - rec[i - 1][4]));
    }
    dts.sort((a, b) => a - b);
    const last = rec[rec.length - 1];
    return {
      frames: rec.length,
      medianFrameMs: +dts[dts.length >> 1].toFixed(1),
      p95FrameMs: +dts[Math.floor(dts.length * 0.95)].toFixed(1),
      longestFrameMs: +dts[dts.length - 1].toFixed(1),
      framesOver50ms: dts.filter((d) => d > 50).length,
      maxScrollPxPerFrame: Math.round(maxScroll),
      maxPolarDegPerFrame: +maxPolar.toFixed(3),
      maxAzimuthDegPerFrame: +maxAz.toFixed(3),
      maxRadiusMPerFrame: +maxR.toFixed(3),
      end: { polar: +last[1].toFixed(2), azimuth: +last[2].toFixed(2), scrollY: Math.round(last[4]) },
    };
  });
  console.log(label, r);
};
await run(1, 34);   // down through the plan -> tilt
await analyse('forward');
await run(-1, 40);  // and all the way back
await analyse('reverse');
await browser.close();
