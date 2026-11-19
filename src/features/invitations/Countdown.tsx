"use client";

import { useEffect, useState } from "react";

import { remaining, type Remaining } from "./countdown";

/**
 * The countdown.
 *
 * The server renders the *first* value — passed in as `initial`, computed from the same instant the
 * page was rendered — so the guest sees a number rather than a flash of zeros, and so hydration has
 * something to match. Only after mount does it start ticking, which is what keeps the server's HTML
 * and the client's first render identical.
 *
 * The target is an absolute instant. The guest's device timezone is never consulted, which is the
 * whole point: the countdown is the same for everyone, and the date beside it is printed in the
 * event's zone rather than the guest's.
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
  const [state, setState] = useState<Remaining>(initial);

  useEffect(() => {
    const target = Date.parse(targetIso);
    const tick = () => setState(remaining(Date.now(), target));
    tick();
    // One second is the resolution the display needs; a faster timer would redraw for nothing.
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [targetIso]);

  if (state.finished) {
    return (
      <p className="text-center text-sm text-ink-muted" role="status">
        {finishedMessage}
      </p>
    );
  }

  const units = [
    { value: state.days, label: labels.days },
    { value: state.hours, label: labels.hours },
    { value: state.minutes, label: labels.minutes },
    { value: state.seconds, label: labels.seconds },
  ];

  return (
    <div className="countdown" role="timer" aria-live="off">
      {units.map((unit) => (
        <div className="countdown__unit" key={unit.label}>
          {/* Numbers stay in Latin digits in both languages — the decision already taken for money. */}
          <span className="countdown__value ltr-token" dir="ltr">
            {String(unit.value).padStart(2, "0")}
          </span>
          <span className="text-xs text-ink-muted">{unit.label}</span>
        </div>
      ))}
    </div>
  );
}
