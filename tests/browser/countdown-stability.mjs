#!/usr/bin/env node
/**
 * tests/browser/countdown-stability.mjs
 *
 * Countdown layout-stability harness for the production Velora invitation page.
 * Measurement only: it never writes to src/ or db/.
 *
 * Usage:
 *   node tests/browser/countdown-stability.mjs \
 *     [--url <url>] [--ticks 130] [--viewports 320x800,390x844] \
 *     [--langs base,en,ar] [--reveal false,true] [--tolerance 0.5] [--out file]
 *
 * For every (viewport x lang-parameter x reveal-state) configuration it:
 *   a. opens the production invitation page
 *   b. waits for [role="timer"] (the countdown) to exist
 *   c. records the bounding box of the countdown wrapper and of each of its
 *      4 unit cells
 *   d. re-records the same boxes on 130 consecutive ticks (1000 ms apart, so a
 *      minute boundary is always crossed at least twice) and reports, per box,
 *      how many ticks moved it by more than --tolerance px, the maximum delta
 *      per coordinate, the list of boxes that ever differed, and the timestamp
 *      of every differing tick
 *   e. the lang parameter is reported honestly: whether ?lang=en / ?lang=ar is
 *      honoured by the server at all, and whether it changes the script
 *      (Latin / Arabic-Indic / Extended Arabic-Indic) of the rendered digits
 *
 * Delta definition (documented, because "changed by more than 0.5px" is
 * ambiguous): for each box we compare {x, y, width, height} against the
 * baseline recorded in step (c). A tick "changed" a box when
 *   max(|dx|, |dy|, |dwidth|, |dheight|) > tolerance
 * The box's reported max delta is the largest such magnitude over all ticks.
 */

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const DEFAULT_URL =
  "https://velora-lnurqz.cranl.net/i/1iqgFu8CQFC604mLYQeeOr-Npg8";

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : def;
};
const positional = argv.filter(
  (a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--"))
);

const baseUrl = opt("url", positional[0] || DEFAULT_URL);
const TICKS = Number.parseInt(opt("ticks", "130"), 10);
const TOLERANCE = Number.parseFloat(opt("tolerance", "0.5"));
const TICK_INTERVAL_MS = 1000;
const SETTLE_MS = 1500;
const OUT = opt("out", null);

const VIEWPORTS = opt("viewports", "320x800,390x844")
  .split(",")
  .map((s) => {
    const [w, h] = s.trim().split("x");
    return { width: Number.parseInt(w, 10), height: Number.parseInt(h, 10) };
  });

const LANGS = opt("langs", "base,en,ar")
  .split(",")
  .map((s) => s.trim());

const REVEALS = opt("reveal", "false")
  .split(",")
  .map((s) => s.trim() === "true");

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
function buildUrl(base, lang) {
  if (lang === "base") return base;
  const u = new URL(base);
  u.searchParams.set("lang", lang);
  return u.toString();
}

function detectDigitScript(text) {
  const found = new Set();
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (c >= 0x30 && c <= 0x39) found.add("Latin/ASCII (U+0030-U+0039)");
    else if (c >= 0x0660 && c <= 0x0669)
      found.add("Arabic-Indic (U+0660-U+0669)");
    else if (c >= 0x06f0 && c <= 0x06f9)
      found.add("Extended Arabic-Indic/Persian (U+06F0-U+06F9)");
    else if (c >= 0x0966 && c <= 0x096f) found.add("Devanagari (U+0966-U+096F)");
    else if (c >= 0x0e50 && c <= 0x0e59) found.add("Thai (U+0E50-U+0E59)");
    else if (!/\s/.test(ch)) found.add("other:" + ch);
  }
  return Array.from(found);
}

/** Reads every box in one round trip. Runs in the page. */
function readBoxes() {
  const wrap = document.querySelector('[role="timer"]');
  if (!wrap) return null;
  const boxes = [];
  const push = (id, selector, el) => {
    if (!el) {
      boxes.push({ id, selector, exists: false, rect: null });
      return;
    }
    const r = el.getBoundingClientRect();
    boxes.push({
      id,
      selector,
      exists: true,
      rect: {
        x: Number(r.x.toFixed(4)),
        y: Number(r.y.toFixed(4)),
        width: Number(r.width.toFixed(4)),
        height: Number(r.height.toFixed(4)),
      },
    });
  };
  push("wrapper", '[role="timer"]', wrap);
  push("outerWrapper", '[role="timer"] > parentElement', wrap.parentElement);
  const units = Array.from(wrap.querySelectorAll(".countdown__unit"));
  for (let i = 0; i < 4; i += 1) {
    push(
      "unit" + (i + 1),
      '[role="timer"] .countdown__unit:nth-of-type(' + (i + 1) + ")",
      units[i] || null
    );
  }
  const values = Array.from(wrap.querySelectorAll(".countdown__value"));
  const labels = Array.from(wrap.querySelectorAll(".countdown__unit")).map(
    (u) => {
      const v = u.querySelector(".countdown__value");
      const l = Array.from(u.children).find((c) => c !== v);
      return l ? l.textContent.trim() : null;
    }
  );
  return {
    boxes,
    unitCount: units.length,
    digits: values.map((v) => v.textContent),
    digitDir: values.map((v) => v.getAttribute("dir")),
    labels,
    documentLang: document.documentElement.lang,
    documentDir: document.documentElement.dir,
    countdownComputed: (() => {
      const cs = getComputedStyle(wrap);
      return {
        fontVariantNumeric: cs.fontVariantNumeric,
        direction: cs.direction,
        display: cs.display,
        gap: cs.gap,
      };
    })(),
  };
}

async function runConfig(browser, { viewport, lang, reveal, url }) {
  const run = {
    key: `${viewport.width}x${viewport.height}|lang=${lang}|reveal=${reveal}`,
    url,
    viewport: { ...viewport, deviceScaleFactor: 2 },
    lang,
    reveal,
    requestedTicks: TICKS,
    tickIntervalMs: TICK_INTERVAL_MS,
    tolerancePx: TOLERANCE,
    completedTicks: 0,
    boxes: [],
    boxesEverDiffered: [],
    ticksAnyBoxChanged: 0,
    differingTicks: [],
    digits: null,
    documentLang: null,
    documentDir: null,
    countdownUnitCount: null,
    errors: [],
    notes: [],
  };

  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "load", timeout: 120000 });
  } catch (e) {
    run.errors.push("navigation: " + String(e));
  }

  try {
    await page.waitForSelector('[role="timer"]', {
      state: "attached",
      timeout: 60000,
    });
  } catch (e) {
    run.errors.push('waitForSelector [role="timer"]: ' + String(e));
    await context.close();
    return run;
  }

  if (reveal) {
    const clicked = await page.evaluate(() => {
      const el = document.querySelector("button.seal");
      if (!el) return false;
      el.click();
      return true;
    });
    if (!clicked) {
      run.notes.push("reveal requested but button.seal was not present");
    }
    try {
      await page.waitForFunction(
        () => {
          const el = document.querySelector(".seal-stage");
          return el && el.dataset.phase === "open";
        },
        null,
        { timeout: 8000 }
      );
    } catch (e) {
      run.notes.push("seal-stage never reached data-phase=open: " + String(e));
    }
  }

  // settle before the baseline: fonts, hydration, entrance animation
  await page.waitForTimeout(SETTLE_MS);

  const base = await page.evaluate(readBoxes);
  if (!base) {
    run.errors.push("[role=timer] disappeared before the baseline read");
    await context.close();
    return run;
  }

  run.documentLang = base.documentLang;
  run.documentDir = base.documentDir;
  run.countdownUnitCount = base.unitCount;
  run.countdownComputed = base.countdownComputed;
  run.labels = base.labels;
  run.digitDir = base.digitDir;
  run.revealPhase = await page.evaluate(() => {
    const el = document.querySelector(".seal-stage");
    return el ? el.dataset.phase : null;
  });

  const tracked = base.boxes.map((b) => ({
    id: b.id,
    selector: b.selector,
    existsAtBaseline: b.exists,
    baseline: b.rect,
    maxDelta: { dx: 0, dy: 0, dw: 0, dh: 0, magnitude: 0 },
    differingTickIndexes: [],
  }));
  const byId = new Map(tracked.map((t) => [t.id, t]));

  const digits = { first: base.digits.slice(), last: base.digits.slice(), distinct: new Set(), scriptEver: new Set() };
  digits.distinct.add(base.digits.join("|"));
  for (const s of detectDigitScript(base.digits.join(""))) digits.scriptEver.add(s);

  for (let tick = 1; tick <= TICKS; tick += 1) {
    await page.waitForTimeout(TICK_INTERVAL_MS);

    let snap;
    try {
      snap = await page.evaluate(readBoxes);
    } catch (e) {
      run.errors.push("tick " + tick + " evaluate: " + String(e));
      continue;
    }
    if (!snap) {
      run.errors.push("tick " + tick + ": [role=timer] no longer in the DOM");
      continue;
    }
    run.completedTicks = tick;

    digits.last = snap.digits.slice();
    digits.distinct.add(snap.digits.join("|"));
    for (const s of detectDigitScript(snap.digits.join(""))) digits.scriptEver.add(s);

    const tickChanges = {};
    let anyChanged = false;

    for (const trackedBox of tracked) {
      const now = (snap.boxes.find((b) => b.id === trackedBox.id) || {}).rect;
      if (!trackedBox.baseline || !now) continue;
      const dx = Number((now.x - trackedBox.baseline.x).toFixed(4));
      const dy = Number((now.y - trackedBox.baseline.y).toFixed(4));
      const dw = Number((now.width - trackedBox.baseline.width).toFixed(4));
      const dh = Number((now.height - trackedBox.baseline.height).toFixed(4));
      const magnitude = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dw), Math.abs(dh));
      const m = trackedBox.maxDelta;
      if (Math.abs(dx) > Math.abs(m.dx)) m.dx = dx;
      if (Math.abs(dy) > Math.abs(m.dy)) m.dy = dy;
      if (Math.abs(dw) > Math.abs(m.dw)) m.dw = dw;
      if (Math.abs(dh) > Math.abs(m.dh)) m.dh = dh;
      if (magnitude > m.magnitude) m.magnitude = Number(magnitude.toFixed(4));
      if (magnitude > TOLERANCE) {
        trackedBox.differingTickIndexes.push(tick);
        tickChanges[trackedBox.id] = {
          dx, dy, dw, dh,
          magnitude: Number(magnitude.toFixed(4)),
          rect: now,
        };
        anyChanged = true;
      }
    }

    if (anyChanged) {
      run.ticksAnyBoxChanged += 1;
      run.differingTicks.push({
        tick,
        timestamp: new Date().toISOString(),
        elapsedMsFromStart: tick * TICK_INTERVAL_MS,
        digits: snap.digits.slice(),
        boxes: tickChanges,
      });
    }
  }

  run.boxes = tracked.map((t) => ({
    id: t.id,
    selector: t.selector,
    existsAtBaseline: t.existsAtBaseline,
    baseline: t.baseline,
    maxDelta: t.maxDelta,
    maxMagnitudePx: t.maxDelta.magnitude,
    differed: t.maxDelta.magnitude > TOLERANCE,
    differingTickCount: t.differingTickIndexes.length,
    differingTicks: t.differingTickIndexes,
  }));
  run.boxesEverDiffered = run.boxes.filter((b) => b.differed).map((b) => b.id);
  run.digits = {
    first: digits.first,
    last: digits.last,
    distinctDigitStringsObserved: digits.distinct.size,
    scriptsObserved: Array.from(digits.scriptEver),
    scriptChangedDuringRun: digits.scriptEver.size > 1,
  };

  await context.close();
  return run;
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */
const out = {
  harness: "tests/browser/countdown-stability.mjs",
  baseUrl,
  baseUrlQueryHandling: null,
  generatedAt: new Date().toISOString(),
  ticksPerRun: TICKS,
  tickIntervalMs: TICK_INTERVAL_MS,
  tolerancePx: TOLERANCE,
  deltaDefinition:
    "per box: max(|delta x|, |delta y|, |delta width|, |delta height|) vs the baseline in step (c); a tick counts as changed when that magnitude > tolerancePx",
  runs: [],
  languageComparison: null,
  errors: [],
};

let browser;
try {
  // VELORA_PROXY: see the note in tests/browser/measure.mjs - a SOCKS5 relay is
  // needed because the production edge resets direct TLS handshakes from this
  // Codespace's datacenter egress IP.
  const PROXY = process.env.VELORA_PROXY || "";
  const launchArgs = ["--disable-dev-shm-usage"];
  if (PROXY) launchArgs.push("--proxy-server=" + PROXY);
  out.proxy = PROXY || null;
  browser = await chromium.launch({ headless: true, args: launchArgs });

  for (const viewport of VIEWPORTS) {
    for (const lang of LANGS) {
      for (const reveal of REVEALS) {
        const url = buildUrl(baseUrl, lang);
        const started = Date.now();
        const run = await runConfig(browser, { viewport, lang, reveal, url });
        run.wallClockMs = Date.now() - started;
        out.runs.push(run);
        process.stderr.write(
          `[countdown-stability] ${run.key} ticks=${run.completedTicks}/${TICKS} changedTicks=${run.ticksAnyBoxChanged} wall=${run.wallClockMs}ms\n`
        );
      }
    }
  }
} catch (e) {
  out.errors.push("harness: " + String(e));
} finally {
  if (browser) await browser.close();
}

/* Language comparison: does ?lang= change anything at all? */
function firstRun(viewport, lang, reveal) {
  return out.runs.find(
    (r) =>
      r.viewport.width === viewport.width &&
      r.viewport.height === viewport.height &&
      r.lang === lang &&
      r.reveal === reveal
  );
}

const comparison = [];
for (const viewport of VIEWPORTS) {
  const base = firstRun(viewport, "base", REVEALS[0]);
  const en = firstRun(viewport, "en", REVEALS[0]);
  const ar = firstRun(viewport, "ar", REVEALS[0]);
  const entry = {
    viewport: `${viewport.width}x${viewport.height}`,
    documentLang: {
      base: base ? base.documentLang : null,
      en: en ? en.documentLang : null,
      ar: ar ? ar.documentLang : null,
    },
    documentDir: {
      base: base ? base.documentDir : null,
      en: en ? en.documentDir : null,
      ar: ar ? ar.documentDir : null,
    },
    firstDigitStrings: {
      base: base ? base.digits.first.join("|") : null,
      en: en ? en.digits.first.join("|") : null,
      ar: ar ? ar.digits.first.join("|") : null,
    },
    digitsScript: {
      base: base ? base.digits.scriptsObserved : null,
      en: en ? en.digits.scriptsObserved : null,
      ar: ar ? ar.digits.scriptsObserved : null,
    },
    digitScriptChangedByLangParam: null,
    renderedOutputChangedByLangParam: null,
  };
  const scripts = [
    entry.digitsScript.base,
    entry.digitsScript.en,
    entry.digitsScript.ar,
  ]
    .filter(Boolean)
    .map((s) => s.join(","));
  entry.digitScriptChangedByLangParam = new Set(scripts).size > 1;
  const langs = [
    entry.documentLang.base,
    entry.documentLang.en,
    entry.documentLang.ar,
  ];
  const digits = [
    (entry.firstDigitStrings.base || "").replace(/\d+/g, "N"),
    (entry.firstDigitStrings.en || "").replace(/\d+/g, "N"),
    (entry.firstDigitStrings.ar || "").replace(/\d+/g, "N"),
  ];
  // Only the digit *shape* can be compared for equality across runs; the values
  // themselves advance with the wall clock.
  entry.renderedOutputChangedByLangParam = new Set(digits).size > 1;
  comparison.push(entry);
}
out.languageComparison = {
  note:
    "?lang=en and ?lang=ar were appended to the production URL. next.config.mjs uses next-intl with no locale route segment and no `locales` array, and /en/i/... and /ar/i/... return 404, so the query parameter is only observable if the server reads it.",
  perViewport: comparison,
  digitScriptChangedByLangParamAnywhere: comparison.some(
    (c) => c.digitScriptChangedByLangParam
  ),
};

const json = JSON.stringify(out, null, 2);
if (OUT) writeFileSync(OUT, json);
console.log(json);
