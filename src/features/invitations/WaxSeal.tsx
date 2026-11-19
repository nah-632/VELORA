"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

/**
 * The wax-seal entrance — ADDENDUM D1, the signature first impression.
 *
 * Sequence: a sealed envelope with the guest's name written on it, a gold seal bearing the couple's
 * monogram, a prompt to touch it, and on touch: the seal breaks, the flap opens, the card rises out,
 * and the invitation takes over.
 *
 * Four decisions that matter more than the animation:
 *
 *   1. **It plays once per session.** `sessionStorage`, not a cookie: it is a property of this visit,
 *      not of the guest, and it should not survive into tomorrow's look at the invitation. On a
 *      second visit the invitation is simply there.
 *   2. **The invitation is always in the DOM.** The entrance is an overlay in front of it, not a gate
 *      in front of it. A guest with JavaScript disabled, a search engine, or a screen reader gets the
 *      invitation; only the decoration depends on the script.
 *   3. **Skip is always available**, not only during the animation, and it does the same thing a tap
 *      does.
 *   4. **Reduced motion removes the sequence**, in CSS (see styles/invitation.css), and the region is
 *      marked `aria-hidden` while it is decorative so nobody has to tab through it.
 *
 * Colours come from the event's design, so a burgundy template gets a burgundy seal without a
 * second code path.
 */
export function WaxSeal({
  children,
  guestName,
  monogram,
  palette,
  locale,
  animation,
  labels,
  sessionKey,
}: {
  children: ReactNode;
  guestName: string;
  monogram: string | null;
  palette: { ground: string; ink: string; accent: string };
  locale: "ar" | "en";
  animation: "wax_seal" | "curtain" | "none";
  labels: { prompt: string; skip: string };
  sessionKey: string;
}) {
  // `null` until mounted: the server must not guess whether this browser has seen the entrance, and
  // guessing either way produces a flash of the wrong thing.
  const [phase, setPhase] = useState<"sealed" | "opening" | "open" | null>(null);

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
    try {
      window.sessionStorage.setItem(sessionKey, "1");
    } catch {
      // Nothing to do: the entrance will play again next time, which is harmless.
    }
    // The flap and the card animate in CSS; the state change is what hands the page over.
    window.setTimeout(() => setPhase("open"), 900);
  }, [sessionKey]);

  const letter = (monogram ?? guestName).trim().slice(0, 2);

  return (
    <div className="seal-stage" data-phase={phase ?? "sealed"}>
      {/*
        The entrance. `aria-hidden` because everything it says — that the guest's name is on the
        envelope, that touching the seal opens it — is said better by the invitation underneath,
        which a screen reader reaches immediately.
      */}
      <div className="seal-stage__entrance absolute inset-0 grid place-items-center" aria-hidden="true">
        <div className="envelope" data-phase={phase ?? "sealed"}>
          <div className="envelope__body" style={{ background: palette.ground, borderColor: palette.accent }} />
          <div className="envelope__card" style={{ background: palette.ground, border: `1px solid ${palette.accent}` }} />
          <div
            className="envelope__flap"
            style={{
              background: `linear-gradient(180deg, ${palette.ground} 0%, ${palette.accent}22 100%)`,
              borderBottom: `1px solid ${palette.accent}`,
            }}
          />

          <button
            type="button"
            className="seal"
            data-broken={phase === "opening" || phase === "open" ? "true" : "false"}
            onClick={open}
            style={{ color: palette.accent }}
            tabIndex={phase === "sealed" ? 0 : -1}
          >
            <span className="seal__ring" />
            <svg viewBox="0 0 100 100" role="img" aria-label={labels.prompt}>
              <defs>
                {/* A metallic edge: the seal is the one place the brief asks for a gold finish. */}
                <radialGradient id="seal-face" cx="35%" cy="30%" r="75%">
                  <stop offset="0%" stopColor={palette.accent} stopOpacity="0.95" />
                  <stop offset="55%" stopColor={palette.accent} stopOpacity="0.78" />
                  <stop offset="100%" stopColor={palette.ink} stopOpacity="0.55" />
                </radialGradient>
              </defs>
              {/* An irregular disc: a wax seal is pressed, not stamped by a machine. */}
              <path
                d="M50 4c7 0 11 4 17 6s13 0 17 6-2 12 0 18 6 10 2 16-10 6-14 11-4 13-11 15-12-3-19-3-13 5-20 2-7-10-12-14-12-6-13-13 3-12 5-18-1-13 3-18 11-4 16-7S43 4 50 4z"
                fill="url(#seal-face)"
              />
              <text
                x="50"
                y="50"
                textAnchor="middle"
                dominantBaseline="central"
                fill={palette.ink}
                fillOpacity="0.82"
                fontSize="34"
                fontWeight="600"
                style={{ fontFamily: "var(--font-display-arab), serif" }}
              >
                {letter}
              </text>
            </svg>
          </button>

          <p className="seal__prompt" style={{ color: palette.ink }}>
            {labels.prompt}
          </p>
        </div>
      </div>

      {/* The skip control is outside the decorative region on purpose: it is a real control. */}
      {phase === "sealed" ? (
        <button
          type="button"
          className="seal-skip"
          onClick={open}
          style={{ color: palette.ink }}
        >
          {labels.skip}
        </button>
      ) : null}

      <div className="invitation-reveal relative z-10">{children}</div>
    </div>
  );
}
