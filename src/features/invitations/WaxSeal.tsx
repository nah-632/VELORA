"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { BrandMark } from "@/lib/templates/brand-mark";
import { crackWedges, sealPalette, waxPath } from "./seal";

/**
 * The wax-seal entrance — Direction A, "Pressed Wax".
 *
 * Sequence, ~2s total: tap → the wax cracks into three pieces (520ms) → the brand mark unfurls
 * behind them by a mask wipe and 8 gold particles drift up and fade (600ms) → the flap opens and the
 * card rises (900ms) → the arch draws itself underneath. Tap feedback is 100ms; the vibration is
 * offered but never required.
 *
 * Four things make it bulletproof rather than merely pretty:
 *
 *   1. **One real `<button>` covering the whole envelope.** Not a decorative div with a click
 *      handler: a button is focusable, Enter and Space activate it, and its hit area is the envelope
 *      itself — 330×220 at 375px, far past the 72×72 floor. The seal graphic sits inside it.
 *   2. **An idempotent handler.** A ref, not the state, decides: a double tap, a rapid burst, or a
 *      tap during the animation all resolve to one opening. The state is for painting.
 *   3. **A 2.5s failsafe.** Whatever happens to the animation — a dropped frame, a suspended tab, a
 *      browser that ignores a mask — the invitation is forced open. A guest is never held at a seal
 *      that did not open.
 *   4. **The invitation is already underneath.** It is in the first HTML, an overlay is in front of
 *      it, and reduced motion replaces the sequence with a 300ms cross-fade.
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
  locale: "ar" | "en";
  animation: "wax_seal" | "curtain" | "none";
  labels: { prompt: string; skip: string };
  sessionKey: string;
  sealImprint?: "eight-star" | "monogram" | "diamond";
  envelopeColor?: string;
  sealColor?: string;
  liner?: "arabesque" | "plain" | "sadu" | "tiles";
}) {
  const [phase, setPhase] = useState<"sealed" | "opening" | "open" | null>(null);
  const [cracked, setCracked] = useState(false);
  /** The guard that makes the handler idempotent. A ref, because state is asynchronous. */
  const opening = useRef(false);
  const uid = useId();

  const wax = sealPalette(sealColor ?? palette.accent);
  const shape = waxPath({ seed: 20260214 });
  const wedges = crackWedges();
  const isArabic = locale === "ar";
  const imprint = sealImprint ?? "monogram";

  useEffect(() => {
    const seen = (() => {
      try {
        return window.sessionStorage.getItem(sessionKey) === "1";
      } catch {
        return false;
      }
    })();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPhase(seen || reduced || animation === "none" ? "open" : "sealed");
  }, [animation, sessionKey]);

  const open = useCallback(() => {
    if (opening.current) return;
    opening.current = true;

    try {
      window.sessionStorage.setItem(sessionKey, "1");
    } catch {
      /* private mode: the entrance plays again next time, which is harmless */
    }
    // A short haptic on the tap that starts it — offered, not required, and silenced by the browser
    // when the user has disabled vibration.
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate?.(12);
      } catch {
        /* ignore */
      }
    }

    setPhase("opening");
    setCracked(true);
    window.setTimeout(() => {
      setPhase("open");
      window.scrollTo({ top: 0, behavior: "auto" });
    }, 900);
  }, [sessionKey]);

  /**
   * The failsafe — armed by the tap, not by the passage of time.
   *
   * What it guards is the *animation*: a stalled frame, a suspended tab, a browser that ignores the
   * mask. Once the guest has pressed the seal they have asked to come in, so 2.5s later the
   * invitation is open whether or not the sequence finished.
   *
   * It deliberately does **not** fire while the seal is untouched. An earlier version did, and it
   * threw a guest into the invitation 2.5 seconds after the page loaded — while they were still
   * deciding, or reading the envelope, or with the page open in a background tab. A wedding
   * invitation waits to be opened; the watchdog starts when the guest asks.
   */
  useEffect(() => {
    if (phase !== "opening") return;
    const timer = window.setTimeout(() => {
      setPhase("open");
      window.scrollTo({ top: 0, behavior: "auto" });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return (
    <div className="seal-stage" data-phase={phase ?? "sealed"}>
      <div className="seal-stage__entrance" aria-hidden="true">
        <div className="envelope" data-phase={phase ?? "sealed"}>
          {/*
            The one control. It covers the envelope, so "tap anywhere on the envelope" is literally
            true, and it is a button so Enter and Space work without a keydown handler.
          */}
          <button
            type="button"
            className="seal envelope__open"
            data-broken={cracked ? "true" : "false"}
            onClick={open}
            tabIndex={phase === "sealed" ? 0 : -1}
            aria-label={labels.prompt}
          >
            <span className="envelope__body" style={{ background: envelopeColor ?? palette.ground, borderColor: wax.ring }} />

            {liner === "arabesque" ? (
              <span className="envelope__liner" aria-hidden="true">
                <svg viewBox="0 0 300 200" fill="none">
                  <g stroke="var(--tpl-gold, #B8913A)" strokeOpacity="0.55" strokeWidth="1">
                    {Array.from({ length: 5 }, (_, row) =>
                      Array.from({ length: 8 }, (_, col) => {
                        const x = col * 38 + (row % 2 ? 19 : 0) + 8;
                        const y = row * 34 + 14;
                        return <path key={`${row}-${col}`} d={`M${x} ${y}c6-9 20-9 26 0c-6 9-20 9-26 0zM${x + 13} ${y - 7}v14`} />;
                      }),
                    )}
                  </g>
                </svg>
              </span>
            ) : null}

            <span className="envelope__card" style={{ background: palette.ground, border: `1px solid ${wax.ring}` }} />

            <span
              className="envelope__flap"
              style={{
                background: `linear-gradient(180deg, ${envelopeColor ?? palette.ground} 0%, ${wax.light}22 100%)`,
                borderBottom: `1px solid ${wax.ring}`,
              }}
            />

            <span className="envelope__name" style={{ color: palette.ink }} dir={isArabic ? "rtl" : "ltr"}>
              {guestName}
            </span>

            {/* The seal disc: pure presentation, inside the button. */}
            <span className="seal__disc" aria-hidden="true">
              <svg viewBox="0 0 120 120" className="seal__svg" focusable="false">
                <defs>
                  <radialGradient id={`wax-face-${uid}`} cx="36%" cy="28%" r="82%">
                    <stop offset="0%" stopColor={wax.light} />
                    <stop offset="42%" stopColor={wax.face} />
                    <stop offset="100%" stopColor={wax.dark} />
                  </radialGradient>
                  <radialGradient id={`wax-sheen-${uid}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                  </radialGradient>
                  <filter id={`wax-press-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
                    <feOffset in="SourceAlpha" dx="0.8" dy="1.2" result="offset" />
                    <feGaussianBlur in="offset" stdDeviation="1.1" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id={`wax-drop-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
                    <feDropShadow dx="0" dy="3" stdDeviation="3.2" floodColor="#3A2818" floodOpacity="0.42" />
                  </filter>
                  <mask id={`mark-mask-${uid}`} maskUnits="userSpaceOnUse" x="30" y="30" width="60" height="60">
                    <rect x="30" y="30" width="60" height="60" fill="black" />
                    <rect className="mark-wipe" x="30" y="30" width="60" height="60" fill="white" />
                  </mask>
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
                      <use href={`#wax-shape-${uid}`} fill="none" stroke={wax.ring} strokeWidth="2.2" strokeOpacity="0.75" />
                      <circle cx="60" cy="60" r="40" fill="none" stroke={wax.emboss} strokeWidth="1.6" strokeOpacity="0.42" />
                      <circle cx="60" cy="60" r="37.6" fill="none" stroke={wax.light} strokeWidth="0.9" strokeOpacity="0.32" />

                      {/* The imprint: the brand mark, pressed. Geometry from public/brand/monogram.svg. */}
                      <g transform="translate(37 38.5) scale(1.44)" filter={`url(#wax-press-${uid})`} opacity="0.9">
                        {imprint === "monogram" || imprint === "eight-star" ? (
                          <g mask={`url(#mark-mask-${uid})`}>
                            <g className="seal__brand">
                              <path d="M4.16 7.21 L9.04 4.67 L16 18 L22.96 4.67 L27.84 7.21 L17.33 27.34 L14.67 27.34 Z" fill={wax.emboss} fillOpacity="0.74" />
                              <path d="M4.16 7.21 L9.04 4.67 L16 18 L16 27.34 L14.67 27.34 Z" fill={wax.emboss} />
                            </g>
                          </g>
                        ) : (
                          <path d="M16 5l4 11 4-11 4 11-8 13-8-13z" fill={wax.emboss} />
                        )}
                      </g>
                    </g>
                  ))}

                  <ellipse cx="44" cy="36" rx="19" ry="11" fill={`url(#wax-sheen-${uid})`} transform="rotate(-18 44 36)" />
                </g>
              </svg>

              {/* The drift: eight particles, capped, decorative, CSS only. */}
              <span className="seal__motes" aria-hidden="true">
                {Array.from({ length: 8 }, (_, index) => (
                  <span key={index} className="seal__mote" data-i={index} />
                ))}
              </span>
            </span>
          </button>

          <p className="seal__prompt" style={{ color: palette.ink }}>
            {labels.prompt}
          </p>
        </div>
      </div>

      {phase === "sealed" ? (
        <button type="button" className="seal-skip" onClick={open} style={{ color: palette.ink }}>
          {labels.skip}
        </button>
      ) : null}

      <div className="invitation-reveal relative z-10">{children}</div>
    </div>
  );
}

/** React's `useId`, kept local so this file has one import surface. */
function useId(): string {
  const ref = useRef<string>("");
  if (!ref.current) ref.current = `s${Math.random().toString(36).slice(2, 9)}`;
  return ref.current;
}