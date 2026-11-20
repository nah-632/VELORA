"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";

import { crackWedges, sealMonogram, sealPalette, waxPath } from "./seal";

/**
 * The wax-seal entrance — ADDENDUM D1, the signature first impression.
 *
 * Sequence: a sealed envelope with the guest's name written on it, a gold seal bearing the couple's
 * monogram, a prompt to touch it, and on touch: the seal breaks into three pieces that drop and
 * fade, the flap opens, the card rises, and the invitation takes over.
 *
 * What the seal is made of, and why each part is there:
 *
 *   - an **irregular wax edge**, generated from a fixed seed, with soft bulges where the wax ran —
 *     a regular polygon reads as a sticker;
 *   - a **radial gradient** for depth, a **raised outer ring** and an **inner embossed ring**, which
 *     together are what makes it look pressed rather than printed;
 *   - a **specular highlight** off-centre, because the light in a photograph of a wax seal is never
 *     straight on;
 *   - the **monogram pressed into** the wax — dark on dark with a soft inner shadow, not a label on
 *     top of it;
 *   - an **outer drop shadow**, so the seal sits on the paper rather than beside it.
 *
 * All of it is SVG and CSS. No raster images, no video, nothing that has to download before the
 * entrance can play.
 *
 * Four behaviours that matter more than the drawing:
 *
 *   1. **It plays once per session** (`sessionStorage`): a property of this visit, not of the guest.
 *   2. **The invitation is always in the DOM.** The entrance is an overlay in front of it, not a gate
 *      in front of it.
 *   3. **Skip is a real button**, outside the decorative region.
 *   4. **Reduced motion removes the sequence**, in CSS, and the seal is still a button so the
 *      interaction is discoverable without it.
 */
export function WaxSeal({
  children,
  guestName,
  monogram,
  coupleNames,
  palette,
  locale,
  animation,
  labels,
  sessionKey,
  sealImprint,
  envelopeColor,
  sealColor,
  liner,
}: {
  children: ReactNode;
  guestName: string;
  monogram: string | null;
  coupleNames: { groom: string | null; bride: string | null };
  palette: { ground: string; ink: string; accent: string };
  /** From the template: the envelope paper colour and its liner. */
  envelopeColor?: string;
  /** The wax itself: burgundy for T1, from the template's seal spec rather than the design accent. */
  sealColor?: string;
  liner?: "arabesque" | "plain" | "sadu" | "tiles";
  locale: "ar" | "en";
  animation: "wax_seal" | "curtain" | "none";
  labels: { prompt: string; skip: string };
  sessionKey: string;
  /** From the template's seal spec: `eight-star` for T1, `monogram` otherwise. */
  sealImprint?: "eight-star" | "monogram" | "diamond";
}) {
  // `null` until mounted: the server must not guess whether this browser has seen the entrance.
  const [phase, setPhase] = useState<"sealed" | "opening" | "open" | null>(null);
  const [cracked, setCracked] = useState(false);

  // Stable ids: the gradients and filters are referenced by url(#id) and must not collide with a
  // second seal on the page.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const wax = sealPalette(sealColor ?? palette.accent);
  const shape = waxPath({ seed: 20260214 });
  const wedges = crackWedges();

  useEffect(() => {
    const seen = (() => {
      try {
        return window.sessionStorage.getItem(sessionKey) === "1";
      } catch {
        // Private mode, or storage disabled: showing the entrance again is the safe direction.
        return false;
      }
    })();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPhase(seen || reduced || animation === "none" ? "open" : "sealed");
  }, [animation, sessionKey]);

  const open = useCallback(() => {
    setPhase((current) => (current === "sealed" ? "opening" : current));
    setCracked(true);
    try {
      window.sessionStorage.setItem(sessionKey, "1");
    } catch {
      // Nothing to do: the entrance plays again next time, which is harmless.
    }
    // The pieces drop, the flap opens, the card rises; the state change then hands the page over.
    window.setTimeout(() => {
      setPhase("open");
      // The overlay is fixed, so a guest could have scrolled the invitation behind it.
      window.scrollTo({ top: 0, behavior: "auto" });
    }, 900);
  }, [sessionKey]);

  const letter = sealMonogram(monogram, coupleNames);
  /**
   * The imprint, from the template's seal spec.
   *
   * T1 presses a gold eight-point star into burgundy wax (docs/TEMPLATES.md §3). The monogram is
   * still available — a template that wants the couple's initials uses it — and the star is drawn
   * here rather than as a glyph so it stays crisp at any size.
   */
  const imprint = sealImprint ?? "monogram";
  const isArabic = locale === "ar";

  return (
    <div className="seal-stage" data-phase={phase ?? "sealed"}>
      <div className="seal-stage__entrance" aria-hidden="true">
        <div className="envelope" data-phase={phase ?? "sealed"}>
          <div
            className="envelope__body"
            style={{
              background: envelopeColor ?? palette.ground,
              borderColor: wax.ring,
            }}
          />

          {/* The liner: gold arabesque, drawn as strokes so it scales without an image. */}
          {liner === "arabesque" ? (
            <svg className="envelope__liner" viewBox="0 0 300 200" aria-hidden="true" focusable="false" fill="none">
              <g stroke="var(--tpl-gold)" strokeOpacity="0.55" strokeWidth="1">
                {Array.from({ length: 5 }, (_, row) =>
                  Array.from({ length: 8 }, (_, col) => {
                    const x = col * 38 + (row % 2 ? 19 : 0) + 8;
                    const y = row * 34 + 14;
                    return <path key={`${row}-${col}`} d={`M${x} ${y}c6-9 20-9 26 0c-6 9-20 9-26 0zM${x + 13} ${y - 7}v14`} />;
                  }),
                )}
              </g>
            </svg>
          ) : null}

          {/* The guest's name, written on the paper, revealed by a wipe across it — right to left in
              Arabic, left to right in English. The font is the calligraphic display face. */}
          <p
            className="envelope__name"
            dir={isArabic ? "rtl" : "ltr"}
            style={{ color: palette.ink, fontFamily: isArabic ? "var(--font-display-ar)" : "var(--font-display-en)" }}
          >
            {guestName}
          </p>

          <div className="envelope__card" style={{ background: palette.ground, border: `1px solid ${wax.ring}` }} />
          <div
            className="envelope__flap"
            style={{
              background: `linear-gradient(180deg, ${palette.ground} 0%, ${wax.light}22 100%)`,
              borderBottom: `1px solid ${wax.ring}`,
            }}
          />

          <button
            type="button"
            className="seal"
            data-broken={cracked ? "true" : "false"}
            onClick={open}
            style={{ color: wax.face }}
            tabIndex={phase === "sealed" ? 0 : -1}
          >
            <span className="seal__ring" />
            <svg viewBox="0 0 120 120" className="seal__svg" role="img" aria-label={labels.prompt}>
              <defs>
                {/* Depth: lit from above-left, falling into shadow at the lower-right edge. */}
                <radialGradient id={`wax-face-${uid}`} cx="36%" cy="28%" r="82%">
                  <stop offset="0%" stopColor={wax.light} />
                  <stop offset="42%" stopColor={wax.face} />
                  <stop offset="100%" stopColor={wax.dark} />
                </radialGradient>

                {/* The specular: a soft off-centre sheen, not a white dot. */}
                <radialGradient id={`wax-sheen-${uid}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                </radialGradient>

                {/* Pressed in: the monogram casts a shadow *inside* the hollow it sits in. */}
                <filter id={`wax-press-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
                  <feOffset in="SourceAlpha" dx="0.8" dy="1.2" result="offset" />
                  <feGaussianBlur in="offset" stdDeviation="1.1" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                <filter id={`wax-drop-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3.2" floodColor="#3A2818" floodOpacity="0.42" />
                </filter>

                <path id={`wax-shape-${uid}`} d={shape} />
                {wedges.map((wedge, index) => (
                  <clipPath id={`wax-piece-${uid}-${index}`} key={index}>
                    <path d={wedge} />
                  </clipPath>
                ))}
              </defs>

              <g filter={`url(#wax-drop-${uid})`}>
                {wedges.map((_, index) => (
                  <g
                    key={index}
                    className="seal__piece"
                    data-piece={index}
                    clipPath={`url(#wax-piece-${uid}-${index})`}
                    style={{ transformOrigin: "60px 60px" }}
                  >
                    <use href={`#wax-shape-${uid}`} fill={`url(#wax-face-${uid})`} />
                    {/* Raised outer ring. */}
                    <use
                      href={`#wax-shape-${uid}`}
                      fill="none"
                      stroke={wax.ring}
                      strokeWidth="2.2"
                      strokeOpacity="0.75"
                    />
                    {/* Inner embossed ring: a dark line with a light one just inside it. */}
                    <circle cx="60" cy="60" r="40" fill="none" stroke={wax.emboss} strokeWidth="1.6" strokeOpacity="0.42" />
                    <circle cx="60" cy="60" r="37.6" fill="none" stroke={wax.light} strokeWidth="0.9" strokeOpacity="0.32" />
                    {/* The imprint, pressed in: a star for T1, the monogram otherwise. */}
                    {imprint === "eight-star" ? (
                      /* The khatam: two squares of equal size, one turned 45°. Eight points by
                         construction, which is what the reference means by an eight-point star. */
                      <g filter={`url(#wax-press-${uid})`} fill="none" stroke={wax.emboss} strokeOpacity="0.85" strokeWidth="2.4">
                        <rect x="45" y="45" width="30" height="30" />
                        <rect x="45" y="45" width="30" height="30" transform="rotate(45 60 60)" />
                      </g>
                    ) : (
                      <text
                        x="60"
                        y="61"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={wax.emboss}
                        fillOpacity="0.88"
                        fontSize={letter.length > 2 ? 24 : 30}
                        fontWeight="600"
                        filter={`url(#wax-press-${uid})`}
                        style={{ fontFamily: isArabic ? "var(--tpl-font-names)" : "var(--tpl-font-names)" }}
                      >
                        {letter}
                      </text>
                    )}
                  </g>
                ))}

                {/* The sheen last, over everything, so it reads as light on the surface. */}
                <ellipse cx="44" cy="36" rx="19" ry="11" fill={`url(#wax-sheen-${uid})`} transform="rotate(-18 44 36)" />
              </g>
            </svg>
          </button>

          <p className="seal__prompt" style={{ color: palette.ink }}>
            {labels.prompt}
          </p>
        </div>
      </div>

      {/* Outside the decorative region: this is a real control. */}
      {phase === "sealed" ? (
        <button type="button" className="seal-skip" onClick={open} style={{ color: palette.ink }}>
          {labels.skip}
        </button>
      ) : null}

      <div className="invitation-reveal relative z-10">{children}</div>
    </div>
  );
}
