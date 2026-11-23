// Shoot the REAL page: sealed (AR + EN) and the lining, from one run.
import { chromium } from "playwright";

const token = process.argv[2];
const tag = process.argv[3] || "l2";
const base = "http://localhost:3210";
const browser = await chromium.launch();

async function openPage(url) {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: "load", timeout: 180000 });
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(2000);
  return page;
}

const measure = () => {
  const q = (s) => document.querySelector(s);
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
  const liner = q(".envelope__liner");
  return {
    phase: q(".envelope")?.dataset.phase,
    envelope: box(q(".envelope")),
    flap: box(q(".envelope__flap")),
    flapClip: q(".envelope__flap") ? getComputedStyle(q(".envelope__flap")).clipPath : null,
    liner: box(liner),
    linerOpacity: liner ? getComputedStyle(liner).opacity : null,
    linerBg: liner ? getComputedStyle(liner).backgroundColor : null,
    cardOpacity: q(".envelope__card") ? getComputedStyle(q(".envelope__card")).opacity : null,
  };
};

// --- sealed, AR and EN ---
for (const [lang, url] of [["ar", `${base}/i/${token}`], ["en", `${base}/i/${token}?lang=en`]]) {
  const page = await openPage(url);
  console.log("sealed-" + lang, JSON.stringify(await page.evaluate(measure)));
  await page.screenshot({ path: `/tmp/${tag}-sealed-${lang}.png` });
  await page.close();
}

// --- the lining: press the seal on the real page and hold the fold open ---
{
  const page = await openPage(`${base}/i/${token}`);
  // A real press of the real control, not a class change.
  await page.click("button.seal").catch(() => {});
  await page.waitForTimeout(1100);
  const m = await page.evaluate(measure);
  console.log("lining", JSON.stringify(m));
  await page.screenshot({ path: `/tmp/${tag}-liner.png` });
  await page.close();
}
await browser.close();
