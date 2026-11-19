/**
 * The countdown, and the moment it stops being one.
 *
 * The brief asks for a live countdown "based on the event's timezone, not the guest's device". Those
 * are two different requirements and only one of them is about arithmetic:
 *
 *   - the *target* is an absolute instant (`events.event_datetime` is a timestamptz), so the countdown
 *     is correct for a guest in Manama, London or Sydney without knowing where they are;
 *   - the *date shown beside it* is formatted in the event's zone, not the guest's, so the invitation
 *     cannot read "14 February, 18:30" in one country and "14 February, 15:30" in another. That
 *     formatting lives in the page; what is here is the arithmetic and the words for "it has passed".
 *
 * This module is deliberately free of `Date.now()`: the caller supplies both instants, which is what
 * makes it testable and what stops the server-rendered value and the client ticked value from drifting
 * apart in a way nobody can reproduce.
 */

export interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True once the event has started. The grace message is the page's job, not this one's. */
  finished: boolean;
  totalSeconds: number;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function remaining(nowMs: number, targetMs: number): Remaining {
  const delta = targetMs - nowMs;

  if (delta <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, finished: true, totalSeconds: 0 };
  }

  return {
    days: Math.floor(delta / DAY),
    hours: Math.floor((delta % DAY) / HOUR),
    minutes: Math.floor((delta % HOUR) / MINUTE),
    seconds: Math.floor((delta % MINUTE) / SECOND),
    finished: false,
    totalSeconds: Math.floor(delta / SECOND),
  };
}

/**
 * The default duration of the event, for the calendar file: a wedding is an evening.
 *
 * Stored nowhere, because the brief's data model has one datetime and inventing a second one in the
 * schema would be inventing a requirement. Three hours is the assumption, it is stated here, and the
 * calendar entry says so rather than guessing silently.
 */
export const DEFAULT_DURATION_MINUTES = 180;
