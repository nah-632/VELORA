/**
 * Wall-clock time, and the instant it means.
 *
 * `datetime-local` in a form gives a *wall clock*: "2027-02-14T18:30", with no zone attached. The
 * operator typing it means 18:30 in Bahrain, because that is where the wedding is. `new Date(wall)`
 * reads it in the **server's** zone — which is UTC in a container — so 18:30 entered became 18:30Z,
 * and the invitation and the calendar file both said 21:30.
 *
 * That is not a display bug, and fixing the display would have made it worse: the stored instant was
 * wrong, so the countdown was counting to the wrong moment. The conversion has to happen on the way
 * in, and it has to know the event's zone.
 *
 * `Intl` is the only zone database available in plain Node without a dependency, and the standard
 * way to ask it for an offset is to format an instant in the target zone and compare. Around a
 * daylight-saving transition that comparison is ambiguous for one hour a year; for the Gulf, which
 * has no DST, it is exact, and for a zone that does have it the worst case is an hour once a year in
 * an event's start time.
 */

/** `YYYY-MM-DDTHH:mm` (what a form sends) → the same text with seconds. */
function normaliseWallClock(wallClock: string): string {
  const trimmed = wallClock.trim().replace(" ", "T");
  return trimmed.length === 16 ? `${trimmed}:00` : trimmed;
}

/** The offset of `timeZone` at `instant`, in minutes east of UTC. */
export function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) parts[part.type] = part.value;
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asIfUtc - instant.getTime()) / 60_000);
}

/**
 * A wall clock in a named zone → the instant it refers to.
 *
 * Two passes: assume UTC to get a first guess at the offset, then correct with the offset that is
 * actually in force at the resulting instant. One pass is wrong on the two days a year when the
 * correction crosses a transition.
 */
export function zonedToUtc(wallClock: string, timeZone: string): Date {
  const normalised = normaliseWallClock(wallClock);
  const asUtc = new Date(`${normalised}Z`);
  if (Number.isNaN(asUtc.getTime())) return new Date(NaN);

  const firstGuess = new Date(asUtc.getTime() - zoneOffsetMinutes(asUtc, timeZone) * 60_000);
  const corrected = new Date(asUtc.getTime() - zoneOffsetMinutes(firstGuess, timeZone) * 60_000);
  return corrected;
}

/** The instant → `YYYY-MM-DDTHH:mm` in a named zone, which is what the edit form wants to show. */
export function wallClockIn(instant: Date, timeZone: string): string {
  // `sv-SE` formats as `YYYY-MM-DD HH:mm`, which is the shortest way to get a form-ready string out
  // of Intl without hand-rolling the padding.
  const formatted = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant);
  return formatted.replace(" ", "T").slice(0, 16);
}
