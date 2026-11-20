#!/usr/bin/env node
/**
 * The venue sheet: does it open without moving the page, and does it behave like a dialog?
 *
 * The operator asked for two things that are easy to get wrong and impossible to see in a screenshot:
 * a dialog that is genuinely accessible (focus goes in, Escape closes, focus comes back to the button
 * that opened it) and one that causes **no layout shift** when it opens or closes. Both are asserted
 * here, in both languages, at the two widths the operator's phone uses.
 *
 * Also asserted: switching language while the sheet is open keeps it open and does not shift the page —
 * a guest reading an address should not have the dialog close under them.
 *
 * Usage
 *   node tests/browser/venue-dialog.mjs --url http://localhost:3000/i/<token>
 * Requires Playwright with Chromium. Runs in the Codespace, not on the build device.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};

const base = arg("url", "http://localhost:3000/i/localProbeTokenAAAAAAAAAAAA");
const out = arg("out", "");
const cpu = Number(arg("cpu", "4"));
const viewports = [
  { width: 320, height: 800 },
  { width: 390, height: 844 },
];

/** Cumulative layout shift, observed across whatever happens while it is installed. */
const installer = () => {
  window.__cls = { total: 0, largest: 0 };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.hadRecentInput) continue;
      window.__cls.total += entry.value;
      window.__cls.largest = Math.max(window.__cls.largest, entry.value);
    }
  }).observe({ type: "layout-shift", buffered: true });
};

const browser = await chromium.launch();
const results = [];

for (const viewport of viewports) {
  for (const lang of ["ar", "en"]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setCPUThrottlingRate", { rate: cpu });
    await page.addInitScript(installer);

    await page.goto(`${base}?lang=${lang}`, { waitUntil: "load" });
    await page.evaluate(() => window.sessionStorage.clear());
    await page.reload({ waitUntil: "load" });
    // Skip the wax-seal entrance so the page is in its resting state.
    await page.waitForTimeout(1200);
    const seal = await page.$("button.seal");
    if (seal) {
      // Forced: the seal pulses forever, so it is never "stable" by Playwright's definition.
      await seal.click({ force: true });
      await page.waitForTimeout(1400);
    }

    const iconsShown = await page.locator("button.venue-card").count();
    const trigger = page.locator("button.venue-card").first();
    await trigger.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const clsBefore = await page.evaluate(() => window.__cls.total);

    await trigger.click();
    await page.waitForTimeout(700);
    const openState = await page.evaluate(() => {
      const dialog = document.querySelector("dialog.venue-sheet");
      return {
        open: Boolean(dialog?.open),
        labelledBy: dialog?.getAttribute("aria-labelledby"),
        titleText: document.getElementById(dialog?.getAttribute("aria-labelledby") ?? "")?.textContent ?? null,
        focusInside: Boolean(dialog?.contains(document.activeElement)),
      };
    });
    const clsAfterOpen = await page.evaluate(() => window.__cls.total);

    // Language switch while the sheet is open.
    await page.click("nav a[hreflang]");
    await page.waitForTimeout(1300);
    const afterSwitch = await page.evaluate(() => ({
      open: Boolean(document.querySelector("dialog.venue-sheet")?.open),
      cls: window.__cls.total,
    }));

    // Close with Escape.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    const closed = await page.evaluate(() => ({
      open: Boolean(document.querySelector("dialog.venue-sheet")?.open),
      focusReturnedToTrigger: document.activeElement?.classList.contains("venue-card") ?? false,
      cls: window.__cls.total,
    }));

    results.push({
      viewport: `${viewport.width}x${viewport.height}`,
      lang,
      iconsShown,
      opened: openState.open,
      title: openState.titleText,
      focusMovedInside: openState.focusInside,
      clsDuringOpen: Math.round((clsAfterOpen - clsBefore) * 100000) / 100000,
      stayedOpenAcrossLanguageSwitch: afterSwitch.open,
      clsAcrossLanguageSwitch: Math.round((afterSwitch.cls - clsAfterOpen) * 100000) / 100000,
      closedByEscape: !closed.open,
      focusReturnedToTrigger: closed.focusReturnedToTrigger,
      clsTotal: Math.round(closed.cls * 100000) / 100000,
    });

    await page.close();
  }
}

await browser.close();
const text = JSON.stringify({ url: base, cpuThrottling: `${cpu}x`, results }, null, 2);
if (out) writeFileSync(out, text);
console.log(text);
