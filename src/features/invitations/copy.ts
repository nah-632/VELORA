/**
 * The words on a guest's invitation.
 *
 * Why these are not in `messages/{ar,en}.json` like everything else. The rest of the site is
 * locale-routed: `/ar/…` and `/en/…`, resolved by next-intl from the URL. A guest's invitation is
 * not — `/i/<token>` carries no locale, and the language comes from *their row*. Reaching into the
 * request-scoped catalogue from a route that has no request locale would mean the page could throw
 * on the one screen a stranger sees, to save keeping twelve strings in one file.
 *
 * So they live here, typed, in both languages, next to the components that use them. The two long
 * ones a couple writes themselves — the thank-yous — come from the event, with a plain default in
 * `rsvp.ts`.
 */

export type InvitationCopy = ReturnType<typeof copyFor>;

export function copyFor(locale: "ar" | "en") {
  if (locale === "ar") {
    return {
      seal: {
        prompt: "اضغط على الختم لفتح الدعوة",
        skip: "تخطّي",
      },
      countdown: { days: "يوم", hours: "ساعة", minutes: "دقيقة", seconds: "ثانية" },
      countdownFinished: "مضى موعد الحفل — شكرًا لكم.",
      calendar: { ics: "أضف إلى التقويم", google: "تقويم Google" },
      rsvp: {
        title: "تأكيد الحضور",
        confirmed: "سأحضر",
        declined: "أعتذر",
        companions: "عدد المرافقين",
        companionHint: "حتى %max%",
        submit: "إرسال الرد",
        update: "تغيير الرد",
        current: "ردّكم: %answer%",
        answers: { confirmed: "سأحضر", declined: "أعتذر" },
        errors: {
          bad_response: "تعذّر فهم الرد. جرّبوا مرة أخرى.",
          too_many_companions: "عدد المرافقين أكبر من المسموح.",
          invalid_token: "تعذّر التحقق من الرابط.",
        },
      },
      details: { date: "التاريخ", hijri: "التاريخ الهجري", venue: "المكان", maps: "افتح الموقع في الخرائط" },
      footer: { withLove: "صلوا معنا", brand: "VELORA — فنّ الدعوة" },
      privacy: "نحفظ الاسم ورقم الجوال والردّ فقط، لعرض الدعوة وتسجيل الحضور.",
    };
  }
  return {
    seal: {
      prompt: "Tap the seal to open your invitation",
      skip: "Skip",
    },
    countdown: { days: "days", hours: "hours", minutes: "minutes", seconds: "seconds" },
    countdownFinished: "The celebration has passed — thank you for being part of it.",
    calendar: { ics: "Add to calendar", google: "Google Calendar" },
    rsvp: {
      title: "Will you join us?",
      confirmed: "I will attend",
      declined: "I cannot attend",
      companions: "Companions",
      companionHint: "up to %max%",
      submit: "Send my answer",
      update: "Change my answer",
      current: "Your answer: %answer%",
      answers: { confirmed: "attending", declined: "unable to attend" },
      errors: {
        bad_response: "That answer was not understood. Please try again.",
        too_many_companions: "That is more companions than are invited.",
        invalid_token: "The link could not be verified.",
      },
    },
    details: { date: "Date", hijri: "Hijri date", venue: "Venue", maps: "Open in Maps" },
    footer: { withLove: "With love", brand: "VELORA — The Art of Inviting" },
    privacy: "We store only your name, phone number and answer, to show your invitation and count the seats.",
  };
}

/** `%key%` rather than ICU braces — these are filled in after translation, not during it. */
export function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`%${key}%`, String(value)),
    template,
  );
}
