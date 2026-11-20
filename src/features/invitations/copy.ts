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
      language: { label: "تغيير اللغة" },
      venues: {
        sectionTitle: "مكان الحفل",
        womenLocation: "موقع قاعة النساء",
        menLocation: "موقع قاعة الرجال",
        location: "موقع الحفل",
        yourHall: "قاعتك",
        close: "إغلاق",
        openInMaps: "افتح في الخرائط",
        copyAddress: "انسخ العنوان",
        copied: "تم النسخ",
        call: "اتصال",
        address: "العنوان",
        time: "الوقت",
        entrance: "المدخل",
        parking: "المواقف",
        dressCode: "الزي",
        notes: "ملاحظات",
        venueOne: "قاعة واحدة تستقبل الجميع",
      },
      schedule: {
        showAll: (count: number) => `إظهار كل البرنامج (${count} بندًا إضافيًا)`,
        onlyMine: "إظهار ما يخصّ قاعتي فقط",
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
          rate_limited: "محاولات كثيرة. انتظروا قليلًا ثم أعيدوا المحاولة.",
        },
      },
      busy: {
        title: "لحظة من فضلكم",
        body: "وصلت طلبات كثيرة من هذا الجهاز. انتظروا دقيقة ثم أعد فتح الرابط.",
      },
      details: {
        date: "التاريخ",
        hijri: "التاريخ الهجري",
        venue: "المكان",
        address: "العنوان",
        dressCode: "الزي المطلوب",
        parking: "المواقف",
        entrance: "المدخل",
        sections: "تنبيه",
        schedule: "برنامج الحفل",
        maps: "افتح الموقع في الخرائط",
        mapsGoogle: "افتح في خرائط جوجل",
        mapsApple: "افتح في خرائط آبل",
      },
      footer: { withLove: "صلوا معنا", brand: "VELORA — فنّ الدعوة" },
      privacy: "نحفظ الاسم ورقم الجوال والردّ فقط، لعرض الدعوة وتسجيل الحضور.",
    };
  }
  return {
    seal: {
      prompt: "Tap the seal to open your invitation",
      skip: "Skip",
    },
    language: { label: "Change language" },
    venues: {
      sectionTitle: "The Venues",
      womenLocation: "Women's Hall Location",
      menLocation: "Men's Hall Location",
      location: "Venue Location",
      yourHall: "Your hall",
      close: "Close",
      openInMaps: "Open in Maps",
      copyAddress: "Copy address",
      copied: "Copied",
      call: "Call",
      address: "Address",
      time: "Time",
      entrance: "Entrance",
      parking: "Parking",
      dressCode: "Dress code",
      notes: "Notes",
      venueOne: "One hall welcomes everyone",
    },
    schedule: {
      showAll: (count: number) => `Show the whole programme (${count} more)`,
      onlyMine: "Show only what applies to my hall",
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
        rate_limited: "Too many attempts. Please wait a moment and try again.",
      },
    },
    busy: {
      title: "One moment",
      body: "This device has made a lot of requests. Wait a minute, then open the link again.",
    },
    details: {
      date: "Date",
      hijri: "Hijri date",
      venue: "Venue",
      address: "Address",
      dressCode: "Dress code",
      parking: "Parking",
      entrance: "Entrance",
      sections: "Please note",
      schedule: "Programme",
      maps: "Open in Maps",
      mapsGoogle: "Open in Google Maps",
      mapsApple: "Open in Apple Maps",
    },
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
