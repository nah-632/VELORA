// Photograph the card from the real page, and sample its face.
//
// FROZEN FRAME, declared: the card's revealed state is forced with an injected stylesheet, and the
// invitation is held back so it cannot cover the card. The invitation currently fades in over the
// card because the "card carries the invitation" restructure is not in this commit — so this is the
// only frame in which the card can be seen. The seal is hidden too: test-only, so its old tan wax
// cannot land inside a sample window.
import { chromium } from "playwright";

const token = process.argv[2];
const tag = process.argv[3] || "card";
const browser = await chromium.launch();

for (const [lang, url] of [["ar", `http://localhost:3210/i/${token}`],
                           ["en", `http://localhost:3210/i/${token}?lang=en`]]) {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: "load", timeout: 180000 });
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: `
    /* TEST-ONLY: freeze the card in its revealed state, hold the invitation back, hide the seal. */
    .envelope__card { transform: translateY(0) !important; opacity: 1 !important; transition: none !important; }
    .envelope__flap { transform: rotateX(-172deg) !important; transition: none !important; }
    .invitation-reveal { opacity: 0 !important; transition: none !important; }
    .seal__disc, .seal__motes { display: none !important; }
  `});
  await page.waitForTimeout(300);

  const m = await page.evaluate(() => {
    const env = document.querySelector(".envelope").getBoundingClientRect();
    const card = document.querySelector(".envelope__card");
    const r = card.getBoundingClientRect();
    const cs = getComputedStyle(card);
    const pct = (v) => +(((v - env.y) / env.height) * 100).toFixed(1);
    return {
      envelope: { x: env.x, y: env.y, w: env.width, h: env.height },
      card: { x: r.x, y: r.y, w: r.width, h: r.height },
      topPct: pct(r.y), bottomPct: pct(r.bottom),
      background: cs.backgroundImage.slice(0, 70),
      border: cs.borderTopColor,
      ornament: !!document.querySelector(".envelope__card-ornament svg"),
    };
  });
  console.log(lang, JSON.stringify(m));
  await page.screenshot({ path: `/tmp/${tag}-${lang}.png` });
  await page.close();
}
await browser.close();
