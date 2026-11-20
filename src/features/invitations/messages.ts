/**
 * The words on an invitation, and the words in the operator's WhatsApp messages.
 *
 * Two decisions shape this file.
 *
 * **The defaults are the operator's own wording.** What is written here is the text they asked for,
 * not a placeholder a developer invented; an invitation is a piece of stationery and its voice is
 * theirs. Every slot is overridable per event, per language, and "reset to default" means deleting
 * the override rather than pasting a copy of the default back in — otherwise a later improvement to
 * the default would never reach the events that had once been reset.
 *
 * **Gender is a property of the guest, not of the message.** Arabic inflects: a button that says
 * «سأكون حاضرًا» to a woman is a small rudeness that a guest notices immediately. So the confirm
 * button has three forms and the guest's row chooses between them; everything else is written to be
 * correct for anybody, which is also why the neutral form exists rather than being a fallback.
 */

export type Locale = "ar" | "en";
export type Gender = "male" | "female" | "neutral";

/** Every text the invitation shows, and the key it is stored under. */
export const COPY_SLOTS = [
  "greeting",
  "opening",
  "body",
  "verse",
  "datetimeLine",
  "beforeRsvp",
  "confirmButtonNeutral",
  "confirmButtonMale",
  "confirmButtonFemale",
  "declineButton",
  "thankConfirmed",
  "thankDeclined",
] as const;

export type CopySlot = (typeof COPY_SLOTS)[number];

/** What the operator sees in the editor, in their own language. */
export const COPY_SLOT_LABELS: Record<CopySlot, { ar: string; en: string }> = {
  greeting: { ar: "التحية", en: "Greeting" },
  opening: { ar: "الافتتاحية", en: "Opening" },
  body: { ar: "نص الدعوة", en: "Body" },
  verse: { ar: "الآية أو الاقتباس", en: "Verse" },
  datetimeLine: { ar: "سطر التاريخ والمكان", en: "Date and place line" },
  beforeRsvp: { ar: "قبل التأكيد", en: "Before the RSVP" },
  confirmButtonNeutral: { ar: "زر التأكيد (بلا تذكير)", en: "Confirm button (neutral)" },
  confirmButtonMale: { ar: "زر التأكيد (للمخاطب)", en: "Confirm button (male)" },
  confirmButtonFemale: { ar: "زر التأكيد (للمخاطبة)", en: "Confirm button (female)" },
  declineButton: { ar: "زر الاعتذار", en: "Decline button" },
  thankConfirmed: { ar: "الشكر بعد التأكيد", en: "Thanks after confirming" },
  thankDeclined: { ar: "الشكر بعد الاعتذار", en: "Thanks after declining" },
};

/**
 * The default wording, in both languages.
 *
 * The Arabic is the operator's text verbatim. If it ever needs to change, it changes here and every
 * event that has not overridden that slot changes with it.
 */
export const DEFAULT_COPY: Record<Locale, Record<CopySlot, string>> = {
  ar: {
    greeting: "أهلًا بك يا {guest_name}، يا من نعتزّ بمحبته",
    opening: "بقلوبٍ عامرة بالفرح، وبفضل الله وتوفيقه، يسعدنا أن نشارككم أجمل لحظات العمر",
    body:
      "يتشرّف {groom} و{bride} بدعوتكم لحضور حفل زفافهما، فحضوركم يزيد الفرحة فرحًا، " +
      "ودعاؤكم أجمل هدية نتلقّاها",
    verse: "﴿ وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً ﴾",
    datetimeLine: "سنكون بانتظاركم في {date}، ونتشرف بقدومكم، فمكانكم عندنا لا يُعوَّض",
    beforeRsvp: "يسعدنا أن نعرف هل ستكونون معنا، لنُحسن استقبالكم كما تستحقون",
    confirmButtonNeutral: "سأحضر بإذن الله",
    confirmButtonMale: "بإذن الله سأكون حاضرًا",
    confirmButtonFemale: "بإذن الله سأكون حاضرة",
    declineButton: "أعتذر مع خالص محبتي",
    thankConfirmed: "شكرًا من القلب يا {guest_name}، حضورك يكمل فرحتنا، وننتظرك بكل شوق",
    thankDeclined: "نقدّر ردّك الكريم يا {guest_name}، وستبقى في قلوبنا، ودعاؤك يكفينا",
  },
  en: {
    greeting: "Dear {guest_name}, you are dear to our hearts",
    opening:
      "With hearts full of joy and gratitude, we are delighted to share the most beautiful moment " +
      "of our lives with you",
    body:
      "{groom} and {bride} warmly invite you to celebrate their wedding. Your presence will make " +
      "our joy complete, and your prayers are the greatest gift we could receive.",
    verse: "",
    datetimeLine: "We look forward to welcoming you on {date}.",
    beforeRsvp: "Please let us know if you can join us, so we can welcome you as you deserve.",
    confirmButtonNeutral: "Yes, I'll be there",
    confirmButtonMale: "Yes, I'll be there",
    confirmButtonFemale: "Yes, I'll be there",
    declineButton: "With love, I'm unable to attend",
    thankConfirmed: "Thank you, {guest_name}. Your presence completes our joy, and we cannot wait to see you.",
    thankDeclined: "We understand, {guest_name}, and you will be in our hearts. Your prayers mean the world to us.",
  },
};

/** The four messages the operator sends, and their defaults. */
export const WHATSAPP_PURPOSES = ["invite", "reminder", "beforeEvent", "afterEvent"] as const;
export type WhatsappPurpose = (typeof WHATSAPP_PURPOSES)[number];

export const WHATSAPP_LABELS: Record<WhatsappPurpose, { ar: string; en: string }> = {
  invite: { ar: "الدعوة", en: "Invitation" },
  reminder: { ar: "تذكير لمن لم يرد", en: "Reminder for non-responders" },
  beforeEvent: { ar: "تذكير اليوم السابق", en: "The day before" },
  afterEvent: { ar: "شكر بعد الحفل", en: "Thanks after the event" },
};

export const DEFAULT_WHATSAPP: Record<WhatsappPurpose, Record<Locale, string>> = {
  invite: {
    ar:
      "السلام عليكم ورحمة الله وبركاته\n" +
      "أهلًا يا {guest_name} 🤍\n" +
      "بقلوب مليئة بالفرح، يسرّنا دعوتك لحفل زفاف {groom} و{bride}.\n" +
      "هذه دعوتك الخاصة، تفضّل بفتحها:\n" +
      "{link}\n" +
      "يسعدنا تأكيد حضورك من خلالها 🌿",
    en:
      "Peace and blessings be upon you.\n" +
      "Dear {guest_name} 🤍\n" +
      "With hearts full of joy, we would be honoured to have you at the wedding of {groom} and {bride}.\n" +
      "This is your own invitation — please open it:\n" +
      "{link}\n" +
      "We would be delighted if you could confirm through it 🌿",
  },
  reminder: {
    ar:
      "أهلًا يا {guest_name}، نذكّرك بمحبة بموعد حفلنا في {date}.\n" +
      "يسعدنا تأكيد حضورك لنُجهّز لاستقبالك على أكمل وجه: {link}",
    en:
      "Dear {guest_name}, a gentle reminder that our celebration is on {date}.\n" +
      "It would help us welcome you properly if you could confirm: {link}",
  },
  beforeEvent: {
    ar:
      "يا {guest_name}، موعدنا غدًا بإذن الله ✨\n" +
      "{venue_name_for_guest} · {date}\n" +
      "موقع القاعة: {venue_map_url_for_guest}\n" +
      "بانتظارك بكل شوق",
    en:
      "Dear {guest_name}, we look forward to seeing you tomorrow ✨\n" +
      "{venue_name_for_guest} · {date}\n" +
      "Location: {venue_map_url_for_guest}\n" +
      "We cannot wait to welcome you.",
  },
  afterEvent: {
    ar: "شكرًا يا {guest_name} على حضورك ودعواتك، كنتَ جزءًا من أجمل أيام عمرنا. جزاك الله خيرًا",
    en: "Thank you, {guest_name}, for being with us and for your prayers — you were part of the most beautiful days of our lives.",
  },
};

export interface CopyVariables {
  guest_name?: string;
  groom?: string;
  bride?: string;
  date?: string;
  venue?: string;
  map_url?: string;
  link?: string;
  venue_name_for_guest?: string;
  venue_map_url_for_guest?: string;
}

/**
 * `{name}` substitution.
 *
 * Nothing is interpreted: an unknown placeholder is left as written, so an operator who mistypes one
 * sees `{guest_nmae}` on the invitation they are previewing rather than a silently empty line. The
 * output is plain text that React escapes on the way to the DOM — these values are the operator's and
 * the guests' own, and they are never used as markup.
 */
export function renderTemplate(template: string, variables: CopyVariables): string {
  return template.replace(/\{([a-z_]+)\}/g, (whole, key: string) =>
    key in variables && variables[key as keyof CopyVariables] !== undefined
      ? String(variables[key as keyof CopyVariables])
      : whole,
  );
}

/** The placeholders a slot understands, for the editor's hint text. */
export function placeholdersIn(template: string): string[] {
  return [...new Set([...template.matchAll(/\{([a-z_]+)\}/g)].map((match) => match[1]!))];
}

export interface CopyOverride {
  [slot: string]: string | undefined;
}

/**
 * The wording for one guest: the operator's override if there is one, the default otherwise.
 *
 * `gender` selects among the three confirm buttons, and the two used-differently slots are keyed
 * separately on purpose — a single "confirm" override would have to be written to suit everybody,
 * and Arabic does not allow that.
 */
export function resolveCopy(
  locale: Locale,
  overrides: { ar?: CopyOverride; en?: CopyOverride } | null | undefined,
  gender: Gender,
): Record<CopySlot, string> {
  const defaults = DEFAULT_COPY[locale];
  const chosen = overrides?.[locale] ?? {};
  const resolved = {} as Record<CopySlot, string>;
  for (const slot of COPY_SLOTS) {
    const override = chosen[slot];
    resolved[slot] = typeof override === "string" && override.trim().length > 0 ? override : defaults[slot];
  }
  return resolved;
}

/** The confirm label for this guest, in their language and their grammatical gender. */
export function confirmLabel(copy: Record<CopySlot, string>, gender: Gender): string {
  if (gender === "male") return copy.confirmButtonMale;
  if (gender === "female") return copy.confirmButtonFemale;
  return copy.confirmButtonNeutral;
}

/** Which gender an audience implies, for the operator's convenience when overriding one. */
export function audienceForGender(gender: Gender): "women" | "men" | "both" {
  if (gender === "female") return "women";
  if (gender === "male") return "men";
  return "both";
}

/** The audience that applies to a guest: what the operator set, or what the gender implies. */
export function resolveAudience(
  gender: Gender,
  audience: string | null | undefined,
): "women" | "men" | "both" {
  if (audience === "women" || audience === "men" || audience === "both") return audience;
  return audienceForGender(gender);
}
