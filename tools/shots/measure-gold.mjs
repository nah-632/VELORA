// Measure the pocket's gold diagonals ON THE RENDER, from the DOM, not from the build parameters.
//
// TEST-ONLY: the old tan wax seal is hidden by an injected stylesheet so it cannot pollute the gold
// detector — it sits in the same lower half and any colour mask that finds the fold finds it too.
// The injected rule exists only inside this measurement and is never committed to the stylesheet.
import { chromium } from "playwright";

const token = process.argv[2];
const tag = process.argv[3] || "gold";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
await page.goto(`http://localhost:3210/i/${token}`, { waitUntil: "load", timeout: 180000 });
await page.evaluate(() => document.fonts.ready).catch(() => {});
await page.waitForTimeout(1500);

await page.addStyleTag({ content: `
  /* TEST-ONLY: remove the old seal from the measurement, not from the product. */
  .seal__disc { display: none !important; }
`});
await page.waitForTimeout(200);

const geometry = await page.evaluate(() => {
  const env = document.querySelector(".envelope").getBoundingClientRect();
  const paths = [...document.querySelectorAll(".ent-gold")];
  const lines = paths.map((path) => {
    const L = path.getTotalLength();
    const ctm = path.getScreenCTM();
    const at = (t) => { const pt = path.getPointAtLength(t); const m = new DOMPoint(pt.x, pt.y).matrixTransform(ctm); return { x: +m.x.toFixed(1), y: +m.y.toFixed(1) }; };
    const a = at(0), b = at(L);
    const cs = getComputedStyle(path);
    return {
      d: path.getAttribute("d"),
      start: a, end: b,
      angleDeg: +Math.abs(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI).toFixed(2),
      startPct: +(((a.y - env.y) / env.height) * 100).toFixed(1),
      endPct: +(((b.y - env.y) / env.height) * 100).toFixed(1),
      stroke: cs.stroke, strokeWidth: cs.strokeWidth, opacity: cs.strokeOpacity,
    };
  });
  // the two meeting points: left pair = 0&1, right pair = 2&3
  const cross = (p, q) => {
    const d1x = p.end.x - p.start.x, d1y = p.end.y - p.start.y;
    const d2x = q.end.x - q.start.x, d2y = q.end.y - q.start.y;
    const den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-6) return null;
    const t = ((q.start.x - p.start.x) * d2y - (q.start.y - p.start.y) * d2x) / den;
    return { x: p.start.x + t * d1x, y: p.start.y + t * d1y };
  };
  const asPct = (pt) => pt ? { xPct: +(((pt.x - env.x) / env.width) * 100).toFixed(1),
                               yPct: +(((pt.y - env.y) / env.height) * 100).toFixed(1) } : null;
  return {
    envelope: { x: env.x, y: env.y, w: env.width, h: env.height },
    lines,
    meetLeft: asPct(cross(lines[2], lines[0])),
    meetRight: asPct(cross(lines[3], lines[1])),
  };
});
console.log("GEOMETRY " + JSON.stringify(geometry));

await browser.close();
