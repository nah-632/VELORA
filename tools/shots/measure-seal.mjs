// Measure the approved mark inside the seal's inner disc, at 92px, in the real page.
//
// The disc is forced to 92px with an injected stylesheet (test-only) so the number is the one the
// quality contract's B7 asks for; the ratio is scale-invariant, so the forced size does not flatter it.
import { chromium } from "playwright";

const token = process.argv[2];
const tag = process.argv[3] || "seal";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
await page.goto(`http://localhost:3210/i/${token}`, { waitUntil: "load", timeout: 180000 });
await page.evaluate(() => document.fonts.ready).catch(() => {});
await page.waitForTimeout(1500);

await page.addStyleTag({ content: `/* TEST-ONLY: the 92px the contract asks for. */
  .seal__disc { width: 92px !important; animation: none !important; transform: none !important; }` });
await page.waitForTimeout(300);

const m = await page.evaluate(() => {
  const svg = document.querySelector(".seal__svg");
  const disc = document.querySelector(".seal__disc");
  const brand = document.querySelector(".seal__brand");
  const paths = [...document.querySelectorAll(".seal__brand path")];
  if (!svg || !brand) return { error: "mark not in the DOM" };
  const vb = svg.viewBox.baseVal;
  const discRect = disc.getBoundingClientRect();
  const brandRect = brand.getBoundingClientRect();
  // the inner disc is the light ring at r 37.6 in a 120-unit viewBox
  const innerDiameterCss = discRect.width * (75.2 / vb.width);
  const markWidthCss = brandRect.width;
  const cs = getComputedStyle(paths[0]);
  return {
    discCss: +discRect.width.toFixed(2),
    viewBox: `${vb.width}x${vb.height}`,
    innerDiameterCss: +innerDiameterCss.toFixed(2),
    markWidthCss: +markWidthCss.toFixed(2),
    markHeightCss: +brandRect.height.toFixed(2),
    ratio: +((markWidthCss / innerDiameterCss) * 100).toFixed(2),
    paths: paths.length,
    fill: getComputedStyle(brand).fill,
    stroke: cs.stroke,
    toneVaries: [...new Set(paths.map((p) => getComputedStyle(p).fill))],
  };
});
console.log("SEAL " + JSON.stringify(m));
await page.screenshot({ path: `/tmp/${tag}.png` });
await browser.close();