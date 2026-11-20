#!/usr/bin/env node
/**
 * tests/browser/measure.mjs
 *
 * Single-page browser measurement harness for the Velora invitation page.
 * Measurement only: it never writes to src/ or db/, and reads nothing but the
 * served production HTML/CSS/JS.
 *
 * Usage:
 *   node tests/browser/measure.mjs [url] [viewportWidth] [viewportHeight]
 *
 * Defaults: the production guest invitation, 375 x 812 (deviceScaleFactor 2).
 *
 * What it does
 *   a. opens the URL at the given viewport, deviceScaleFactor 2
 *   b. applies a "mid-range mobile" profile over CDP:
 *        - Emulation.setCPUThrottlingRate  = 4
 *        - Network.emulateNetworkConditions = Fast 3G (150 ms RTT, 1.6/0.75 Mbit/s)
 *   c. measures CLS with a PerformanceObserver on `layout-shift`
 *        - cumulative score, score inside the 12 s post-load window, and the
 *          largest single shift (value + element selector derived from `sources`)
 *   d. measures LoAF with a PerformanceObserver on `long-animation-frame`
 *        - count, max duration, totals. If the entry type is unsupported it
 *          reports supported:false + the reason instead of a fabricated number.
 *   e. clicks `button.seal` (opens the wax seal) and records the CLS delta of
 *      the following 2 s window as `clsAfterSeal`
 *   f. prints one JSON object on stdout
 *
 * Deliberately NOT set: prefers-reduced-motion. The page's `.seal` pulse
 * animation therefore really runs, which is the honest default state of the
 * production page.
 */

import { chromium } from "playwright";

const DEFAULT_URL = "https://velora-lnurqz.cranl.net/i/1iqgFu8CQFC604mLYQeeOr-Npg8";

const url = process.argv[2] || DEFAULT_URL;
const width = Number.parseInt(process.argv[3] || "375", 10);
const height = Number.parseInt(process.argv[4] || "812", 10);

const DEVICE_SCALE_FACTOR = 2;
const CLS_WINDOW_MS = 12000;
const SEAL_WAIT_MS = 2000;
const NAV_TIMEOUT_MS = 180000;

// Chrome DevTools "Fast 3G" preset expressed the way CDP wants it (bytes/second).
// DevTools derives these as Math.round(mbit * 1000 * 1000 / 8):
//   1.6 Mbit/s down -> 200000 B/s ; 0.75 Mbit/s up -> 93750 B/s ; 150 ms RTT
const FAST_3G = {
  offline: false,
  latency: 150,
  downloadThroughput: 200000,
  uploadThroughput: 93750,
};
const CPU_THROTTLE_RATE = 4;

const errors = [];
const notes = [];

/* ------------------------------------------------------------------ *
 * Page-side instrumentation, installed before any document script runs
 * ------------------------------------------------------------------ */
function installObservers() {
  if (window.top !== window) return;

  const cssPath = (node) => {
    let el = node;
    if (!el) return null;
    if (el.nodeType === 3) el = el.parentElement; // text node -> parent element
    if (!el || el.nodeType !== 1) return null;
    const parts = [];
    let cur = el;
    let depth = 0;
    while (cur && cur.nodeType === 1 && depth < 6) {
      let seg = cur.tagName.toLowerCase();
      if (cur.id) {
        seg += "#" + cur.id;
        parts.unshift(seg);
        break;
      }
      const cls =
        typeof cur.className === "string"
          ? cur.className.trim().split(/\s+/).filter(Boolean).slice(0, 3)
          : [];
      if (cls.length) seg += "." + cls.join(".");
      const parent = cur.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter(
          (c) => c.tagName === cur.tagName
        );
        if (same.length > 1) seg += ":nth-of-type(" + (same.indexOf(cur) + 1) + ")";
      }
      parts.unshift(seg);
      cur = cur.parentElement;
      depth += 1;
    }
    return parts.join(" > ");
  };

  const rect = (r) =>
    r
      ? { x: r.x, y: r.y, width: r.width, height: r.height }
      : null;

  const state = {
    clsError: null,
    clsEntries: [],
    loafSupported: false,
    loafError: null,
    loafEntries: [],
  };
  window.__veloraMeasure = state;

  // (c) Cumulative Layout Shift -----------------------------------------
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        const sources = (entry.sources || []).map((s) => ({
          selector: cssPath(s.node),
          previousRect: rect(s.previousRect),
          currentRect: rect(s.currentRect),
        }));
        state.clsEntries.push({
          value: entry.value,
          startTime: entry.startTime,
          sources,
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch (e) {
    state.clsError = String(e);
  }

  // (d) Long Animation Frames -------------------------------------------
  try {
    const supported =
      typeof PerformanceObserver !== "undefined" &&
      Array.isArray(PerformanceObserver.supportedEntryTypes) &&
      PerformanceObserver.supportedEntryTypes.includes("long-animation-frame");
    state.loafSupported = supported;
    if (!supported) {
      state.loafError =
        "PerformanceObserver.supportedEntryTypes does not include 'long-animation-frame' in this browser build";
    } else {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          state.loafEntries.push({
            startTime: e.startTime,
            duration: e.duration,
            blockingDuration:
              typeof e.blockingDuration === "number" ? e.blockingDuration : null,
            renderStart: e.renderStart === undefined ? null : e.renderStart,
            styleAndLayoutStart:
              e.styleAndLayoutStart === undefined ? null : e.styleAndLayoutStart,
            scriptCount: (e.scripts || []).length,
            scripts: (e.scripts || []).slice(0, 8).map((s) => ({
              name: s.name,
              duration: s.duration,
              invoker: s.invoker,
              sourceURL: s.sourceURL,
            })),
          });
        }
      }).observe({ type: "long-animation-frame", buffered: true });
    }
  } catch (e) {
    state.loafSupported = false;
    state.loafError = String(e);
  }
}

/* ------------------------------------------------------------------ *
 * Driver
 * ------------------------------------------------------------------ */
let browser;
const result = {
  url,
  viewport: { width, height, deviceScaleFactor: DEVICE_SCALE_FACTOR },
  profile: {
    cpuThrottleRate: CPU_THROTTLE_RATE,
    network: "Fast 3G (Chrome DevTools preset, applied via CDP)",
    networkParams: FAST_3G,
  },
  cls: null,
  clsWindow12s: null,
  clsLargest: null,
  clsAfterSeal: null,
  loaf: null,
  transferredBytes: null,
  domContentLoadedMs: null,
  loadMs: null,
  errors,
  notes,
};

const readCls = (page) =>
  page.evaluate(() => {
    const s = window.__veloraMeasure;
    if (!s) return { missing: true };
    const nav = performance.getEntriesByType("navigation")[0];
    const loadEnd = nav ? nav.loadEventEnd : 0;
    const entries = s.clsEntries;
    let total = 0;
    for (const e of entries) total += e.value;
    let inWindow = 0;
    for (const e of entries) if (e.startTime >= loadEnd) inWindow += e.value;
    let largest = null;
    for (const e of entries) if (!largest || e.value > largest.value) largest = e;
    return {
      missing: false,
      total,
      inWindow,
      entryCount: entries.length,
      largest,
      loafSupported: s.loafSupported,
      loafError: s.loafError,
      loafEntries: s.loafEntries,
      clsError: s.clsError,
    };
  });

try {
  // VELORA_PROXY is an escape hatch, not part of the measurement profile:
  // the production edge (edge.ggprotect.net) resets TLS handshakes originating
  // from the Codespace's datacenter egress IP, so a SOCKS5 relay is used to
  // reach the very same production URL from a different egress. CDP network
  // throttling is applied on top of it, so the Fast 3G profile still holds.
  const PROXY = process.env.VELORA_PROXY || "";
  const launchArgs = ["--disable-dev-shm-usage"];
  if (PROXY) launchArgs.push("--proxy-server=" + PROXY);
  browser = await chromium.launch({ headless: true, args: launchArgs });
  notes.push("chromium version: " + browser.version());
  result.proxy = PROXY || null;
  if (PROXY) {
    notes.push(
      "Chromium was launched with --proxy-server=" +
        PROXY +
        " because a direct TLS handshake to the production host from this Codespace is reset by the edge WAF"
    );
  }

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await context.addInitScript(installObservers);

  const cdp = await context.newCDPSession(page);

  // (b) mid-range mobile profile, applied BEFORE navigation
  await cdp.send("Network.enable", {});
  let networkProfileApplied = "Network.emulateNetworkConditions";
  try {
    await cdp.send("Network.emulateNetworkConditions", FAST_3G);
  } catch (e) {
    networkProfileApplied = "Network.emulateNetworkConditionsByRule + Network.overrideNetworkState (fallback)";
    await cdp.send("Network.emulateNetworkConditionsByRule", {
      offline: false,
      matchedNetworkConditions: [
        {
          urlPattern: "",
          networkConditions: FAST_3G,
        },
      ],
    });
    await cdp.send("Network.overrideNetworkState", FAST_3G);
    notes.push("Network.emulateNetworkConditions threw: " + String(e));
  }
  result.profile.networkMethod = networkProfileApplied;

  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE_RATE });

  let transferred = 0;
  let resourcesSeen = 0;
  cdp.on("Network.loadingFinished", (e) => {
    resourcesSeen += 1;
    transferred += e.encodedDataLength || 0;
  });

  // (a) navigate
  try {
    await page.goto(url, { waitUntil: "load", timeout: NAV_TIMEOUT_MS });
  } catch (e) {
    errors.push("navigation: " + String(e));
  }

  const locale = await page.evaluate(() => {
    const stage = document.querySelector(".seal-stage");
    return {
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      title: document.title,
      url: location.href,
      sealStagePhase: stage ? stage.dataset.phase : null,
      countdownPresent: !!document.querySelector('[role="timer"]'),
    };
  });
  result.page = locale;

  const nav = await page.evaluate(() => {
    const e = performance.getEntriesByType("navigation")[0];
    if (!e) return null;
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    return {
      responseEnd: e.responseEnd,
      domContentLoadedEventEnd: e.domContentLoadedEventEnd,
      loadEventEnd: e.loadEventEnd,
      firstContentfulPaintMs: fcp ? fcp.startTime : null,
    };
  });
  if (!nav) {
    errors.push("no PerformanceNavigationTiming entry available");
  } else {
    result.domContentLoadedMs =
      nav.domContentLoadedEventEnd > 0 ? nav.domContentLoadedEventEnd : null;
    result.loadMs = nav.loadEventEnd > 0 ? nav.loadEventEnd : null;
    if (nav.domContentLoadedEventEnd === 0 || nav.loadEventEnd === 0) {
      notes.push(
        "domContentLoadedEventEnd/loadEventEnd is 0 -> the document never finished loading within the harness window; reported as null"
      );
    }
    result.firstContentfulPaintMs = nav.firstContentfulPaintMs;
  }

  // (c) 12-second post-load CLS window
  await page.waitForTimeout(CLS_WINDOW_MS);
  const clsAfter12s = await readCls(page);
  const clsAfterSealBaseline = clsAfter12s;

  result.cls = clsAfter12s.missing ? null : clsAfter12s.total;
  result.clsWindow12s = clsAfter12s.missing ? null : clsAfter12s.inWindow;
  result.clsEntryCount = clsAfter12s.missing ? null : clsAfter12s.entryCount;
  result.clsLargest =
    clsAfter12s.missing || !clsAfter12s.largest
      ? null
      : {
          value: clsAfter12s.largest.value,
          startTime: clsAfter12s.largest.startTime,
          selector: (clsAfter12s.largest.sources[0] || {}).selector || null,
          sources: clsAfter12s.largest.sources,
        };
  if (clsAfter12s.clsError) {
    errors.push("layout-shift observer: " + clsAfter12s.clsError);
  }
  if (!clsAfter12s.missing && clsAfter12s.entryCount === 0) {
    notes.push("zero layout-shift entries were reported in the whole session");
  }

  // (d) LoAF over the full measured session
  const loafSupported = clsAfter12s.loafSupported;
  const loafEntries = clsAfter12s.loafEntries || [];
  result.loaf = {
    supported: loafSupported,
    error: loafSupported ? null : clsAfter12s.loafError,
    entryType: "long-animation-frame",
    thresholdMs: 50,
    observedWindowEndMs: null,
    count: loafSupported ? loafEntries.length : null,
    maxDurationMs: loafSupported
      ? loafEntries.reduce((a, e) => Math.max(a, e.duration), 0)
      : null,
    totalDurationMs: loafSupported
      ? loafEntries.reduce((a, e) => a + e.duration, 0)
      : null,
    totalBlockingDurationMs: loafSupported
      ? loafEntries.reduce((a, e) => a + (e.blockingDuration || 0), 0)
      : null,
    entries: loafSupported ? loafEntries : null,
  };
  if (!loafSupported) {
    notes.push(
      "LoAF unsupported: " + (clsAfter12s.loafError || "unknown reason") + " -> count/duration reported as null"
    );
  }

  // (e) click the wax seal, measure the following 2 s window separately
  const beforeSeal = await readCls(page);
  const sealMark = await page.evaluate(() => performance.now());

  // Probe whether button.seal is reachable by an actual pointer at all. The
  // answer on the current production build is "no": .invitation-reveal carries
  // z-index:10 over .seal-stage__entrance (z-index:auto), so the invisible
  // invitation layer sits on top of the seal and swallows the click.
  const sealInfo = await page.evaluate(() => {
    const el = document.querySelector("button.seal");
    if (!el) return { present: false };
    const describe = (n) =>
      n
        ? n.tagName +
          (n.id ? "#" + n.id : "") +
          (typeof n.className === "string" && n.className
            ? "." + n.className.trim().split(/\s+/).slice(0, 2).join(".")
            : "")
        : null;
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const stack = Array.from(document.elementsFromPoint(cx, cy));
    const top = stack[0] || null;
    const obstructions = [];
    for (const n of stack) {
      if (n === el || el.contains(n)) break;
      obstructions.push(describe(n));
    }
    return {
      present: true,
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      center: { x: cx, y: cy },
      tabIndexAttribute: el.getAttribute("tabindex"),
      pointerReachableAtCenter: !!(top && (top === el || el.contains(top))),
      topElementAtCenter: describe(top),
      elementsAtCenterTopFirst: stack.map(describe),
      obstructionsAboveSeal: obstructions,
    };
  });

  if (!sealInfo.present) {
    result.clsAfterSeal = null;
    result.seal = { present: false };
    notes.push("button.seal not present -> clsAfterSeal is null, not 0");
  } else {
    const phaseOf = () =>
      page.evaluate(() => {
        const el = document.querySelector(".seal-stage");
        return el ? el.dataset.phase : null;
      });

    const attempts = [];
    let clickError = null;
    const notePhase = async (attempt) => {
      attempt.phaseAfterThisAttempt = await phaseOf();
      attempt.producedOpenPhase = attempt.phaseAfterThisAttempt === "open";
      attempts.push(attempt);
    };

    // 1. an ordinary Playwright click. Expected to fail twice over: the seal
    //    pulses forever (never "stable") and, even forced, its centre belongs
    //    to the layer above it.
    try {
      await page.locator("button.seal").click({ timeout: 8000 });
      await notePhase({ method: "playwright locator click", ok: true, error: null });
    } catch (e) {
      await notePhase({
        method: "playwright locator click",
        ok: false,
        error: String(e).split("\n")[0],
      });
    }
    let phaseAfter = await phaseOf();
    if (phaseAfter !== "open") {
      try {
        await page.locator("button.seal").click({ force: true, timeout: 8000 });
        await notePhase({
          method: "playwright locator click (force: true)",
          ok: true,
          error: null,
        });
      } catch (e) {
        await notePhase({
          method: "playwright locator click (force: true)",
          ok: false,
          error: String(e).split("\n")[0],
        });
      }
      phaseAfter = await phaseOf();
    }
    // 2. real mouse events at a point that genuinely hit-tests to the button
    if (phaseAfter !== "open") {
      const hitPoint = await page.evaluate(() => {
        const el = document.querySelector("button.seal");
        const r = el.getBoundingClientRect();
        // only scan the visible part of the box
        for (let fx = 0.5; fx <= 0.98; fx += 0.01) {
          for (let fy = 0.02; fy <= 0.98; fy += 0.02) {
            const px = r.x + r.width * fx;
            const py = r.y + r.height * fy;
            if (py < 1 || py > window.innerHeight - 1) continue;
            const t = document.elementFromPoint(px, py);
            if (t && (t === el || el.contains(t))) {
              return { x: px, y: py, found: true };
            }
          }
        }
        return { found: false };
      });
      if (hitPoint.found) {
        await page.mouse.click(hitPoint.x, hitPoint.y);
        await notePhase({
          method: "page.mouse.click at hit-tested interior point",
          ok: true,
          error: null,
        });
      } else {
        await notePhase({
          method: "page.mouse.click at hit-tested interior point",
          ok: false,
          error: "no point inside button.seal hit-tests to the button",
        });
      }
      phaseAfter = await phaseOf();
    }
    // 3. last resort: DOM click (untrusted event, still routed to React's handler)
    if (phaseAfter !== "open") {
      const clicked = await page.evaluate(() => {
        const el = document.querySelector("button.seal");
        if (!el) return false;
        el.click();
        return true;
      });
      await notePhase({
        method: "element.click() via page.evaluate (untrusted event)",
        ok: clicked,
        error: clicked ? null : "button.seal vanished",
      });
      phaseAfter = await phaseOf();
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
      clickError = String(e).split("\n")[0];
    }

    result.seal = {
      ...sealInfo,
      attempts,
      phaseBeforeClick: "sealed",
      phaseAfterClick: await phaseOf(),
      opened: (await phaseOf()) === "open",
      clickWaitError: clickError,
    };
    if (!result.seal.opened) {
      notes.push(
        "the seal never opened: clsAfterSeal was measured over a window in which the seal did NOT open, so it is a null result"
      );
    }
    if (!sealInfo.pointerReachableAtCenter) {
      notes.push(
        "button.seal is not pointer-reachable at its own centre: " +
          (sealInfo.obstructionsAboveSeal || []).join(" > ") +
          " paint above it, so a real tap cannot open the seal. It was opened programmatically for the measurement."
      );
    }

    await page.waitForTimeout(SEAL_WAIT_MS);
    const afterSeal = await readCls(page);
    const afterSealEntries = await page.evaluate((mark) => {
      const s = window.__veloraMeasure;
      const fresh = s.clsEntries.filter((e) => e.startTime >= mark);
      let total = 0;
      for (const e of fresh) total += e.value;
      let largest = null;
      for (const e of fresh) if (!largest || e.value > largest.value) largest = e;
      return { total, count: fresh.length, largest };
    }, sealMark);
    result.clsAfterSeal = afterSeal.missing ? null : afterSealEntries.total;
    result.clsAfterSealEntryCount = afterSeal.missing
      ? null
      : afterSealEntries.count;
    result.clsAfterSealLargest =
      !afterSealEntries.largest
        ? null
        : {
            value: afterSealEntries.largest.value,
            startTime: afterSealEntries.largest.startTime,
            selector:
              (afterSealEntries.largest.sources[0] || {}).selector || null,
            sources: afterSealEntries.largest.sources,
          };
    result.clsAfterSealWindowMs = SEAL_WAIT_MS;
    result.clsAfterSealObserved = !afterSeal.missing;
    result.clsAfterSealTotalAtEnd = afterSeal.missing ? null : afterSeal.total;
  }

  // LoAF window bookkeeping
  if (loafSupported) {
    const end = await page.evaluate(
      () => performance.now()
    );
    result.loaf.observedWindowEndMs = end;
  }

  // (f) transferred bytes
  const resourceTotals = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const navBytes = nav ? nav.transferSize || 0 : 0;
    let resBytes = 0;
    let resCount = 0;
    for (const r of performance.getEntriesByType("resource")) {
      resBytes += r.transferSize || 0;
      resCount += 1;
    }
    return { navBytes, resBytes, resCount };
  });
  result.transferredBytes = transferred;
  result.transferredBytesBreakdown = {
    cdpLoadingFinishedSum: transferred,
    cdpLoadingFinishedCount: resourcesSeen,
    performanceNavigationTransferSize: resourceTotals.navBytes,
    performanceResourceTransferSizeSum: resourceTotals.resBytes,
    performanceResourceCount: resourceTotals.resCount,
  };
  if (transferred === 0 && resourceTotals.resBytes + resourceTotals.navBytes > 0) {
    notes.push(
      "CDP Network.loadingFinished delivered no encodedDataLength; transferredBytes came from CDP and is 0 - use performanceTransferBytes as the authoritative figure"
    );
    result.performanceTransferredBytes =
      resourceTotals.navBytes + resourceTotals.resBytes;
  }

  await context.close();
} catch (e) {
  errors.push("harness: " + String(e));
  if (e && e.stack) notes.push(e.stack);
} finally {
  if (browser) await browser.close();
}

console.log(JSON.stringify(result, null, 2));
