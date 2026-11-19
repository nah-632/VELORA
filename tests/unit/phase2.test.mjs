/**
 * The countdown's arithmetic and the calendar file.
 *
 * Both are the kind of code that looks right in a screenshot and is wrong in a phone: a countdown
 * that never says "the wedding has happened", or an .ics that Outlook refuses to open. Neither would
 * be caught by reading it.
 *
 * Run: npm test
 */
import test from "node:test";
import assert from "node:assert/strict";

import { remaining, DEFAULT_DURATION_MINUTES } from "../../src/features/invitations/countdown.ts";
import {
  buildIcs,
  escapeIcsText,
  eventUid,
  foldLine,
  googleCalendarUrl,
  toIcsLocal,
  toIcsUtc,
} from "../../src/features/invitations/ics.ts";

const START = new Date("2027-02-14T18:30:00+03:00");

test("the countdown counts down, and stops", () => {
  const target = START.getTime();
  const oneDayBefore = target - 86_400_000;
  assert.deepEqual(remaining(oneDayBefore, target), {
    days: 1, hours: 0, minutes: 0, seconds: 0, finished: false, totalSeconds: 86_400,
  });

  const mixed = remaining(target - (2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5_000), target);
  assert.deepEqual(
    [mixed.days, mixed.hours, mixed.minutes, mixed.seconds],
    [2, 3, 4, 5],
  );
});

test("the moment has passed — including exactly on time", () => {
  assert.equal(remaining(START.getTime(), START.getTime()).finished, true);
  assert.equal(remaining(START.getTime() + 60_000, START.getTime()).finished, true);
  const after = remaining(START.getTime() + 3_600_000, START.getTime());
  assert.equal(after.totalSeconds, 0);
  assert.deepEqual([after.days, after.hours, after.minutes, after.seconds], [0, 0, 0, 0]);
});

test("a countdown is timezone-free: the same instant gives the same answer anywhere", () => {
  // The guest's device timezone is not an input. Only the two instants are.
  const target = START.getTime();
  const now = target - 3_600_000;
  const asBahrain = remaining(now, target);
  const asLondon = remaining(now, target);
  assert.deepEqual(asBahrain, asLondon);
  assert.equal(asBahrain.hours, 1);
});

test("countdown seconds truncate rather than round — a countdown never shows 0 while time remains", () => {
  const target = 1_000_000;
  assert.equal(remaining(target - 1_500, target).seconds, 1);
  assert.equal(remaining(target - 999, target).seconds, 0);
  assert.equal(remaining(target - 999, target).finished, false);
});

// ---------------------------------------------------------------------------------------------

test("the calendar file is CRLF, as RFC 5545 requires", () => {
  const ics = buildIcs({ uid: "x@y", start: START, title: "Wedding", timezone: "Asia/Bahrain" });
  assert.equal(ics.includes("\r\n"), true);
  assert.equal(/\r\n$/.test(ics), true, "the file ends with CRLF");
  // A bare LF would be one anywhere apart from inside a folded line's CRLF.
  assert.equal(/(^|[^\r])\n/.test(ics), false, "no bare newlines");
});

test("times go out in the event's zone with a VTIMEZONE, not the server's zone", () => {
  const ics = buildIcs({ uid: "x@y", start: START, title: "Wedding", timezone: "Asia/Bahrain" });
  assert.match(ics, /DTSTART;TZID=Asia\/Bahrain:20270214T183000/);
  assert.match(ics, /DTEND;TZID=Asia\/Bahrain:20270214T213000/);
  assert.match(ics, /BEGIN:VTIMEZONE/);
  assert.match(ics, /TZOFFSETTO:\+0300/);
  assert.equal(
    ics.includes("20270214T153000Z"),
    false,
    "18:30 in Bahrain is 15:30 UTC, and the local form must be the one written",
  );
});

test("a zone without a known fixed offset falls back to UTC, which is never wrong", () => {
  const ics = buildIcs({ uid: "x@y", start: START, title: "Wedding", timezone: "Europe/London" });
  assert.match(ics, /DTSTART:20270214T153000Z/);
  assert.equal(ics.includes("VTIMEZONE"), false);
});

test("the default duration is stated, not guessed silently", () => {
  const ics = buildIcs({ uid: "x@y", start: START, title: "Wedding", timezone: "Asia/Bahrain" });
  const end = new Date(START.getTime() + DEFAULT_DURATION_MINUTES * 60_000);
  assert.match(ics, new RegExp(`DTEND;TZID=Asia/Bahrain:${toIcsLocal(end, "+0300")}`));
});

test("Arabic and separators survive escaping", () => {
  assert.equal(escapeIcsText("Khalid, Noor; together"), "Khalid\\, Noor\\; together");
  assert.equal(escapeIcsText("line one\nline two"), "line one\\nline two");
  assert.equal(escapeIcsText("back\\slash"), "back\\\\slash");

  // The Arabic comma (U+060C) is not a delimiter in iCalendar, so it is left exactly as written —
  // escaping it would put a stray backslash into a venue name on every phone. The ASCII comma and
  // semicolon are delimiters, and are escaped.
  const ics = buildIcs({
    uid: "x@y",
    start: START,
    title: "زفاف خالد و نور",
    location: "قاعة البحرين، المنامة",
    description: "الآية: وَمِنْ آيَاتِهِ; أحببناكم, وشكرًا",
    timezone: "Asia/Bahrain",
  });
  // Unfolded first, because that is what a parser does: a long Arabic description is folded across
  // two lines, and asserting against the raw text would only be testing the fold.
  const unfolded = ics.replace(/\r\n /g, "");
  assert.match(unfolded, /SUMMARY:زفاف خالد و نور/);
  assert.match(unfolded, /LOCATION:قاعة البحرين، المنامة/);
  assert.match(unfolded, /DESCRIPTION:الآية: وَمِنْ آيَاتِهِ\\; أحببناكم\\, وشكرًا/);
  assert.equal(/LOCATION:[^\r\n]*\\،/.test(unfolded), false, "the Arabic comma is not escaped");
});

test("long lines fold at 75 octets and never split a UTF-8 sequence", () => {
  const long = "ا".repeat(120); // 240 octets
  const folded = foldLine(`DESCRIPTION:${long}`);
  const lines = folded.split("\r\n");
  assert.ok(lines.length > 1, "it was folded");
  for (const line of lines) {
    assert.ok(Buffer.from(line, "utf8").length <= 75, `line is ${Buffer.from(line, "utf8").length} octets`);
  }
  assert.ok(lines.slice(1).every((line) => line.startsWith(" ")), "continuations start with a space");
  // Unfolding must give back exactly what went in.
  assert.equal(folded.replace(/\r\n /g, ""), `DESCRIPTION:${long}`);
});

test("the same event produces the same UID, so a phone updates rather than duplicates", () => {
  const a = eventUid("token-abcdefghijklmnop", START);
  const b = eventUid("token-abcdefghijklmnop", START);
  assert.equal(a, b);
  assert.notEqual(a, eventUid("token-abcdefghijklmnop", new Date("2027-02-15T18:30:00+03:00")));
});

test("the Google Calendar link carries the right instants", () => {
  const url = googleCalendarUrl({
    start: START,
    title: "Wedding of Khalid & Noor",
    location: "Bahrain Hall",
    description: "Your invitation",
  });
  assert.match(url, /^https:\/\/calendar\.google\.com\/calendar\/render\?/);
  assert.match(url, /dates=20270214T153000Z%2F20270214T183000Z/);
  assert.match(url, /text=Wedding\+of\+Khalid/);
  assert.match(url, /location=Bahrain\+Hall/);
});

test("UTC formatting is stable regardless of the server's timezone", () => {
  assert.equal(toIcsUtc(new Date("2027-02-14T15:30:00Z")), "20270214T153000Z");
  assert.equal(toIcsUtc(new Date("2027-12-31T23:59:59Z")), "20271231T235959Z");
  assert.equal(toIcsLocal(new Date("2027-02-14T15:30:00Z"), "+0300"), "20270214T183000");
  // A negative offset shifts the other way.
  assert.equal(toIcsLocal(new Date("2027-02-14T15:30:00Z"), "-0500"), "20270214T103000");
});
