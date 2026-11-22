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
  const edges = document.querySelector(".envelope__front-edges");
  const path = edges ? edges.querySelector("path") : null;
  if (!path) return { error: "no path" };
  const L = path.getTotalLength();
  const ctm = path.getScreenCTM();
  const toScreen = (p) => {
    const pt = path.getPointAtLength(p);
    const m = new DOMPoint(pt.x, pt.y).matrixTransform(ctm);
    return { x: m.x, y: m.y };
  };
  const p0 = toScreen(0), p1 = toScreen(L / 2), p2 = toScreen(L);
  const deg = (a, b) => Math.abs(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI);
  const cs = getComputedStyle(path);
  return {
    envelope: { x: env.x, y: env.y, w: env.width, h: env.height },
    totalLength: +L.toFixed(1),
    p0, p1, p2,
    leftAngleDeg: +deg(p0, p1).toFixed(2),
    rightAngleDeg: +deg(p1, p2).toFixed(2),
    apexYPercent: +(((p1.y - env.y) / env.height) * 100).toFixed(2),
    leftEdgeYPercent: +(((p0.y - env.y) / env.height) * 100).toFixed(2),
    stroke: cs.stroke,
    strokeWidth: cs.strokeWidth,
    strokeOpacity: path.getAttribute("stroke-opacity"),
    hasStrokeAttr: path.getAttribute("stroke"),
  };
});
console.log("GEOMETRY " + JSON.stringify(geometry));

// pixels along each segment, at 25 / 50 / 75 of its own length
const samples = await page.evaluate(async ({ p0, p1, p2 }) => {
  const out = [];
  const at = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  for (const [name, a, b] of [["left", p0, p1], ["right", p1, p2]]) {
    for (const t of [0.25, 0.5, 0.75]) out.push({ name, t, ...at(a, b, t) });
  }
  return out;
}, geometry);

await page.screenshot({ path: `/tmp/${tag}.png` });
await browser.close();

console.log("SAMPLES " + JSON.stringify(samples));