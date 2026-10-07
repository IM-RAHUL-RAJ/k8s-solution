// Renders the mascot artwork to PNG for e-mails (most mail clients show no SVG).
// Usage: node scripts/render-mascots.mjs [contact-sheet.png]
// Needs Node 22.18+ (it imports the TypeScript artwork directly) and a Playwright Chromium:
//   npm run e2e:install
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { MASCOT_TYPES, mascotSvg } from '../src/app/core/mascot/mascot-svg.ts';

const POSES = ['happy', 'sad', 'thinking', 'wave'];
const OUT = 'public/mascots/email';
const SIZE = 320;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });

for (const type of MASCOT_TYPES) {
  for (const pose of POSES) {
    const svg = mascotSvg(type, pose).replace('<svg ', `<svg width="${SIZE}" height="${SIZE}" `);
    await page.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
    const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: SIZE, height: SIZE } });
    writeFileSync(join(OUT, `${type}-${pose}.png`), png);
  }
}

// Optional contact sheet, to look at all twelve at once.
const sheetPath = process.argv[2];
if (sheetPath) {
  const cells = MASCOT_TYPES.flatMap((type) =>
    ['idle', ...POSES].map((pose) => `<figure style="margin:0;text-align:center;font:12px sans-serif">${mascotSvg(type, pose).replace('<svg ', '<svg width="180" height="180" ')}<figcaption>${type} ${pose}</figcaption></figure>`)
  );
  const sheet = await browser.newPage({ viewport: { width: 5 * 190, height: 3 * 210 } });
  await sheet.setContent(`<body style="margin:0;background:#f5f5f7;display:grid;grid-template-columns:repeat(5,190px);gap:0 0">${cells.join('')}</body>`);
  await sheet.screenshot({ path: sheetPath });
}

await browser.close();
console.log(`Wrote ${MASCOT_TYPES.length * POSES.length} PNGs to ${OUT}`);
