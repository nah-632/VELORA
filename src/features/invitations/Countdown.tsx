"use client";

import { useEffect, useRef, useState } from "react";

import { remaining, type Remaining } from "./countdown";

const UNITS = ["days", "hours", "minutes", "seconds"] as const;
type Unit = (typeof UNITS)[number];

/**
 * The countdown.
 *
 * It used to shake the screen once a second, and the causes were all in how it was written rather
 * than in what it showed:
 *
 *   1. **Every tick was a React render.** Four numbers changed, React reconciled four text nodes, and
 *      the browser re-laid-out the row — which is what a 1 Hz reflow of a page containing an
 *      invitation looks like. Now the digits are written with `textContent` on refs: no render, no
 *      reconciliation, no layout.
 *   2. **The cells were sized by their content.** "59" is wider than "11", and in Arabic-Indic digits
 *      in a proportional Arabic font it is wider still, so the row breathed. The cells are now a fixed
 *      inline size and height with centred text, and the number inside cannot influence either.
 *   3. **The timer was `setInterval(1000)`.** It drifts, so ticks arrived at arbitrary points inside
 *      the second, and a tick that crossed a boundary could fire twice in a frame. It now aligns to
 *      the second boundary and re-aligns after every pause.
 *   4. **It ran while nobody was looking.** A hidden tab kept ticking. It now stops on
 *      `visibilitychange` and recomputes from the absolute target when it returns, so a phone in a
 *      pocket is not a phone burning battery.
 *
 * The first value is still rendered by the server from the same instant the page was rendered, so
 * hydration matches and there is no flash of zeros.
 */
export function Countdown({
  targetIso,
  initial,
  labels,
  finishedMessage,
}: {
  targetIso: string;
  initial: Remaining;
  labels: { days: string; hours: string; minutes: string; seconds: string };
  finishedMessage: string;
}) {
  const cells = useRef<Partial<Record<Unit, HTMLSpanElement | null>>>({});
  const [done, setDone] = useState(initial.finished);

  useEffect(() => {
    const target = Date.parse(targetIso);
    if (Number.isNaN(target)) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timeout: number | undefined;
    let interval: number | undefined;
    let stopped = false;

    /** Writes only what changed, and never touches innerHTML or the element tree. */
    const paint = (state: Remaining) => {
      const values: Record<Unit, number> = {
        days: state.days,
        hours: state.hours,
        minutes: state.minutes,
        seconds: state.seconds,
      };
      for (const unit of UNITS) {
        const element = cells.current[unit];
        if (!element) continue;
        const text = String(values[unit]).padStart(2, "0");
        if (element.textContent === text) continue;
        element.textContent = text;
        if (!reduced) {
          // Opacity only: it cannot change the box, so it cannot move anything.
          element.dataset.ticking = "true";
          window.setTimeout(() => {
            delete element.dataset.ticking;
          }, 160);
        }
      }
    };

    const stop = () => {
      stopped = true;
      if (timeout !== undefined) window.clearTimeout(timeout);
      if (interval !== undefined) window.clearInterval(interval);
      timeout = undefined;
      interval = undefined;
    };

    const tick = () => {
      const state = remaining(Date.now(), target);
      if (state.finished) {
        stop();
        setDone(true);
        return;
      }
      paint(state);
    };

    /** Align to the second boundary, then keep the beat. */
    const start = () => {
      if (stopped) return;
      const delay = 1000 - (Date.now() % 1000);
      timeout = window.setTimeout(() => {
        tick();
        interval = window.setInterval(tick, 1000);
      }, delay);
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
        stopped = false;
      } else {
        // Recomputed from the absolute target on the way back, so a paused countdown is not a
        // countdown that lost time.
        tick();
        start();
      }
    };

    tick();
    if (!stopped) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [targetIso]);

  if (done) {
    return (
      <p className="countdown__finished" role="status">
        {finishedMessage}
      </p>
    );
  }

  const initialValues: Record<Unit, number> = {
    days: initial.days,
    hours: initial.hours,
    minutes: initial.minutes,
    seconds: initial.seconds,
  };

  return (
    <div className="countdown" role="timer" aria-live="off">
      {UNITS.map((unit) => (
        <div className="countdown__unit" key={unit}>
          <span
            className="countdown__value ltr-token"
            dir="ltr"
            ref={(element) => {
              cells.current[unit] = element;
            }}
          >
            {String(initialValues[unit]).padStart(2, "0")}
          </span>
          <span className="countdown__label">{labels[unit]}</span>
        </div>
      ))}
    </div>
  );
}
