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
  const out = { envelope: { x: env.x, y: env.y, w: env.width, h: env.height }, pairs: {} };
  const measurePair = (name, sel) => {
    const path = document.querySelector(sel);
    if (!path) { out.pairs[name] = "MISSING"; return; }
    const L = path.getTotalLength();
    const ctm = path.getScreenCTM();
    const toScreen = (t) => {
      const pt = path.getPointAtLength(t);
      const m = new DOMPoint(pt.x, pt.y).matrixTransform(ctm);
      return { x: +m.x.toFixed(1), y: +m.y.toFixed(1) };
    };
    const p0 = toScreen(0), p1 = toScreen(L / 2), p2 = toScreen(L);
    const deg = (a, b) => +Math.abs(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI).toFixed(2);
    const pct = (y) => +(((y - env.y) / env.height) * 100).toFixed(2);
    const cs = getComputedStyle(path);
    out.pairs[name] = {
      p0, p1, p2,
      leftAngleDeg: deg(p0, p1), rightAngleDeg: deg(p1, p2),
      apexYPercent: pct(p1.y), leftEdgeYPercent: pct(p0.y), rightEdgeYPercent: pct(p2.y),
      stroke: cs.stroke, strokeWidth: cs.strokeWidth,
      strokeOpacity: path.getAttribute("stroke-opacity"),
    };
  };
  measurePair("flap_upper", ".envelope__flap-edges path");
  measurePair("pocket_lower", ".envelope__front-edges path");
  return out;
});console.log("GEOMETRY " + JSON.stringify(geometry));

await browser.close();
