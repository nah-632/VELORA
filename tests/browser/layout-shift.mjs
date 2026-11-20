#!/usr/bin/env node
/**
 * Layout shift, and long animation frames, on a mid-range phone.
 *
 * The operator's complaint was jitter, and Cumulative Layout Shift is the number that quantifies it.
 * This measures the page through the whole entrance — load, the seal breaking, the invitation
 * revealing — under CPU throttling, because a fast desktop hides exactly the jank a phone shows.
 *
 * Usage
 *   node tests/browser/layout-shift.mjs
 *   node tests/browser/layout-shift.mjs --url http://localhost:3000/i/<token> --cpu 4 --seconds 12
 *
 * Options: --url, --cpu (throttling multiplier, default 4 = "mid-range phone"), --seconds,
 * --viewport WxH, --out. Requires Playwright with Chromium (see countdown-stability.mjs).
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const DEFAULT_URL = "https://velora-lnurqz.cranl.net/i/1iqgFu8CQFC604mLYQeeOr-Npg8";

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const url = arg("url", DEFAULT_URL);
const cpu = Number(arg("cpu", "4"));
const seconds = Number(arg("seconds", "12"));
const out = arg("out", "");
const [width, height] = arg("viewport", "390x844").split("x").map(Number);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: width || 390, height: height || 844 },
  deviceScaleFactor: 2,
});
const session = await page.context().newCDPSession(page);

// CPU throttling is what makes this a measurement of a phone rather than of this machine.
await session.send("Emulation.setCPUThrottlingRate", { rate: cpu });

// Collect the shifts and the long frames across load, the entrance and the reveal.
const collect = () => {
  window.__measured = { cls: 0, largest: 0, largestSource: null, loafCount: 0, loafMax: 0, loafSupported: true, clsBeforeSeal: 0 };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.hadRecentInput) continue;
      window.__measured.cls += entry.value;
      if (entry.value > window.__measured.largest) {
        window.__measured.largest = entry.value;
        const node = entry.sources && entry.sources[0] && entry.sources[0].node;
        window.__measured.largestSource = node ? `${node.tagName ?? "?"}${node.className ? `.${String(node.className).split(" ")[0]}` : ""}` : null;
      }
    }
  }).observe({ type: "layout-shift", buffered: true });
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__measured.loafCount += 1;
        window.__measured.loafMax = Math.max(window.__measured.loafMax, entry.duration);
      }
    }).observe({ type: "long-animation-frame", buffered: true });
  } catch (error) {
    window.__measured.loafSupported = false;
    window.__measured.loafReason = String(error).slice(0, 100);
  }
};

await page.addInitScript(collect);
const started = Date.now();
await page.goto(url, { waitUntil: "load" });

// Half the window sealed, then the seal is touched and the other half covers the reveal.
await page.waitForTimeout(Math.round((seconds * 1000) / 2));
const beforeSeal = await page.evaluate(() => window.__measured.cls);
const seal = await page.$("button.seal");
let sealed = false;
if (seal) {
  // `force` because the seal pulses — an infinite animation means it is never "stable" by
  // Playwright's definition, and waiting for stability waits forever. The pulse is the invitation to
  // touch it, so it is the page that is right and the automation that has to adapt.
  await seal.click({ force: true });
  sealed = true;
}
await page.waitForTimeout(Math.round((seconds * 1000) / 2));

const measured = await page.evaluate(() => window.__measured);
const report = {
  url,
  viewport: `${width}x${height}`,
  cpuThrottling: `${cpu}x`,
  windowSeconds: seconds,
  sealWasPresent: sealed,
  clsTotal: Math.round(measured.cls * 100000) / 100000,
  clsBeforeSeal: Math.round(beforeSeal * 100000) / 100000,
  clsAfterSeal: Math.round((measured.cls - beforeSeal) * 100000) / 100000,
  largestShift: Math.round(measured.largest * 100000) / 100000,
  largestShiftSource: measured.largestSource,
  longAnimationFrames: { supported: measured.loafSupported, count: measured.loafCount, maxMs: Math.round(measured.loafMax) },
  wallClockSeconds: Math.round((Date.now() - started) / 1000),
};

await browser.close();
const text = JSON.stringify(report, null, 2);
if (out) writeFileSync(out, text);
console.log(text);
