#!/usr/bin/env node
/**
 * Is the countdown's layout stable?
 *
 * The operator reported the screen shaking once a second. The cause was that each cell was sized by
 * its content, so a wider pair of digits pushed its neighbours. This asserts the opposite: over N
 * ticks, the wrapper and all four cells keep exactly the same box.
 *
 * It measures the *rendered* geometry in a real browser, because that is the only place the claim
 * can be checked: `tsc` and the unit tests cannot see a reflow.
 *
 * Usage
 *   node tests/browser/countdown-stability.mjs                       # production defaults
 *   node tests/browser/countdown-stability.mjs --ticks 30 --url http://localhost:3000/i/<token>
 *
 * Options: --url, --ticks (default 130), --viewports (default 320x800,390x844), --tolerance (0.5px),
 * --out <file>. Requires Playwright with Chromium:
 *   npm i -D playwright && npx playwright install --with-deps chromium
 * It runs in the Codespace (`npm run test:browser:stability`), not on the build device.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const DEFAULT_URL = "https://velora-lnurqz.cranl.net/i/1iqgFu8CQFC604mLYQeeOr-Npg8";

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const url = arg("url", DEFAULT_URL);
const ticks = Number(arg("ticks", "130"));
const tolerance = Number(arg("tolerance", "0.5"));
const out = arg("out", "");
// Both widths the operator's phone uses, and the two languages the product ships.
const viewports = arg("viewports", "320x800,390x844")
  .split(",")
  .map((pair) => {
    const [width, height] = pair.split("x").map(Number);
    return { width: width || 320, height: height || 800 };
  });

const BOXES = 'wrapper and four cells';

/** The boxes, as numbers, plus the digits so a tick that did not change them is visible. */
const SAMPLE = (selector) => {
  const wrapper = document.querySelector('[role="timer"]');
  if (!wrapper) return null;
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 100) / 100);
  };
  return {
    wrapper: box(wrapper),
    cells: [...wrapper.querySelectorAll(selector)].map(box),
    digits: [...wrapper.querySelectorAll(".countdown__value")].map((el) => el.textContent),
  };
};

const browser = await chromium.launch();
const report = { url, ticks, tolerance, viewports: [] };

for (const viewport of viewports) {
  for (const lang of ["base", "en"]) {
    const target = lang === "base" ? url : `${url}?lang=${lang}`;
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
    await page.goto(target, { waitUntil: "domcontentloaded" });
    // The entrance covers the page on a first visit; localStorage/sessionStorage are per context, so
    // this page always starts sealed. Skip it — the countdown is what is being measured.
    await page.evaluate(() => window.sessionStorage.setItem("velora-seal-1iqgFu8CQFC604", "1"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[role="timer"]', { timeout: 20000 });

    const baseline = await page.evaluate(SAMPLE, ".countdown__unit");
    if (!baseline) throw new Error("no countdown found");

    const moved = [];
    let worst = 0;
    const start = Date.now();

    for (let tick = 1; tick <= ticks; tick += 1) {
      await page.waitForTimeout(1000);
      const now = await page.evaluate(SAMPLE, ".countdown__unit");
      const boxes = [["wrapper", now.wrapper, baseline.wrapper], ...now.cells.map((box, i) => [`cell-${i}`, box, baseline.cells[i]])];
      for (const [name, box, before] of boxes) {
        const delta = Math.max(...box.map((value, axis) => Math.abs(value - before[axis])));
        worst = Math.max(worst, delta);
        if (delta > tolerance) {
          moved.push({ tick, at: new Date().toISOString(), box: name, delta: Math.round(delta * 100) / 100, before, now: box });
        }
      }
    }

    report.viewports.push({
      viewport: `${viewport.width}x${viewport.height}`,
      lang,
      ticks,
      seconds: Math.round((Date.now() - start) / 1000),
      boxesMeasured: BOXES,
      maxDeltaPx: Math.round(worst * 100) / 100,
      ticksThatMovedAnything: moved.length,
      moved: moved.slice(0, 20),
      boundingBoxes: { wrapper: baseline.wrapper, cells: baseline.cells },
      digitScript: baseline.digits.join(""),
      renderedLanguage: await page.evaluate(() => document.documentElement.lang),
    });

    await page.close();
  }
}

await browser.close();
const text = JSON.stringify(report, null, 2);
if (out) writeFileSync(out, text);
console.log(text);
