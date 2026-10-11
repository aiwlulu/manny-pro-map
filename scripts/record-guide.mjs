// Records the guide clips: `npx playwright` + local server on :4174 serving site/. Writes site/guide/*.mp4|png.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4174/';
const OUT = 'site/guide';
const TMP = '.guide-tmp';
mkdirSync(OUT, { recursive: true });
const W = 1280, H = 800;
const b = await chromium.launch({ channel: 'chrome' });

async function clip(name, hash, steps, { mobile = false, scheme = 'light' } = {}) {
  rmSync(TMP, { recursive: true, force: true });
  const size = mobile ? { width: 390, height: 780 } : { width: W, height: H };
  const ctx = await b.newContext({ viewport: size, deviceScaleFactor: mobile ? 2 : 1, colorScheme: scheme, recordVideo: { dir: TMP, size } });
  await ctx.addInitScript(() => { try { localStorage.setItem('pm-coach', 'true'); } catch {} });
  const p = await ctx.newPage();
  await p.goto(BASE + hash, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1800);
  const t0 = Date.now();
  await steps(p);
  const dur = (Date.now() - t0) / 1000;
  await ctx.close();
  const webm = `${TMP}/${readdirSync(TMP)[0]}`;
  // Trim the page-load part; keep the interaction
  const total = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', webm]).toString());
  const start = Math.max(0, total - dur - 0.3);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(start), '-i', webm, '-an', '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '26', '-preset', 'slow', '-movflags', '+faststart', `${OUT}/${name}.mp4`]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(start + 0.2), '-i', webm, '-frames:v', '1', '-q:v', '4', `${OUT}/${name}.jpg`]);
  console.log(name, dur.toFixed(1) + 's');
}
const pause = (p, ms = 900) => p.waitForTimeout(ms);
async function glide(p, sel, ms = 600) {
  const box = await p.locator(sel).first().boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: Math.round(ms / 16) });
}

await clip('landscape', '', async (p) => {
  await pause(p, 600);
  for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 180); await pause(p, 160); }
  await glide(p, '.tile[data-id="visa"]'); await pause(p, 1400);
  await glide(p, '.tile[data-id="stripe"]'); await pause(p, 1400);
  await p.click('.jump a[data-lane="ai"]'); await pause(p, 1800);
});
await clip('company', '', async (p) => {
  await p.click('.jump a[data-lane="semis"]'); await pause(p, 1200);
  await glide(p, '.tile[data-id="nvidia"]'); await pause(p, 500);
  await p.click('.tile[data-id="nvidia"]'); await pause(p, 1500);
  for (let i = 0; i < 4; i++) { await p.mouse.move(1100, 500); await p.mouse.wheel(0, 220); await pause(p, 500); }
  await pause(p, 800);
});
await clip('chain', '#/c/nvidia', async (p) => {
  await glide(p, '.chain-cta'); await pause(p, 400);
  await p.click('.chain-cta'); await pause(p, 2200);
  await glide(p, '.cx-node[data-id="tsmc"]'); await pause(p, 1200);
  await glide(p, '.cx-node[data-id="openai"]'); await pause(p, 600);
  await p.click('.cx-node[data-id="openai"]'); await pause(p, 2200);
});
await clip('bubbles', '#/bubbles', async (p) => {
  await p.mouse.move(820, 420);
  for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, -120); await pause(p, 120); }
  await pause(p, 700);
  await p.mouse.down(); await p.mouse.move(700, 470, { steps: 25 }); await p.mouse.up(); await pause(p, 600);
  const n = p.locator('.bm-n[data-id="openai"]');
  await glide(p, '.bm-n[data-id="openai"]'); await pause(p, 700);
  await n.click(); await pause(p, 2400);
}, { scheme: 'dark' });
await clip('search', '', async (p) => {
  await glide(p, '#q'); await p.click('#q');
  await p.keyboard.type('黃仁勳', { delay: 220 }); await pause(p, 1300);
  await p.keyboard.press('Enter'); await pause(p, 2200);
});
await clip('people', '#/people', async (p) => {
  await pause(p, 600);
  await p.click('.pf [data-col="巨人之聲"]'); await pause(p, 1300);
  await glide(p, '.pcard'); await pause(p, 400);
  await p.click('.pcard >> nth=1'); await pause(p, 2200);
});
await clip('mobile', '', async (p) => {
  for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, 260); await pause(p, 350); }
  await p.locator('.tile').nth(10).click(); await pause(p, 1600);
  await p.mouse.move(195, 600); await p.mouse.wheel(0, 300); await pause(p, 1200);
}, { mobile: true });
await b.close();
rmSync(TMP, { recursive: true, force: true });
