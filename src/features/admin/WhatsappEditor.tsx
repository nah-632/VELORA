"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { DEFAULT_WHATSAPP, WHATSAPP_LABELS, WHATSAPP_PURPOSES, type WhatsappPurpose } from "@/features/invitations/messages";
import { saveWhatsappTemplatesAction } from "./actions";

/**
 * The four messages the operator sends, in both languages.
 *
 * Settings rather than per-event, because the voice of an operator's WhatsApp does not change wedding
 * to wedding — and because editing 50 messages by hand is not a thing anybody does twice.
 *
 * The defaults are placeholders, not values, so an untouched field says "this is what will be sent"
 * without freezing it.
 */
export function WhatsappEditor({
  initial,
  labels,
}: {
  initial: Record<string, Record<string, string>>;
  labels: { title: string; hint: string; arabic: string; english: string; save: string; variables: string; reset: string };
}) {
  const [values, setValues] = useState<Record<string, Record<string, string>>>(() => {
    const start: Record<string, Record<string, string>> = {};
    for (const purpose of WHATSAPP_PURPOSES) {
      start[purpose] = { ar: initial[purpose]?.ar ?? "", en: initial[purpose]?.en ?? "" };
    }
    return start;
  });
  const [locale, setLocale] = useState<"ar" | "en">("ar");

  const set = (purpose: WhatsappPurpose, value: string) =>
    setValues((current) => ({ ...current, [purpose]: { ...current[purpose], [locale]: value } }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-medium text-ink">{labels.title}</h2>
        <p className="mt-1 text-xs text-ink-muted">{labels.hint}</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className={`min-h-11 rounded-md border px-4 text-sm ${locale === "ar" ? "border-gold-deep text-gold-deep" : "border-line text-ink"}`}
          onClick={() => setLocale("ar")}
          aria-pressed={locale === "ar"}
        >
          {labels.arabic}
        </button>
        <button
          type="button"
          className={`min-h-11 rounded-md border px-4 text-sm ${locale === "en" ? "border-gold-deep text-gold-deep" : "border-line text-ink"}`}
          onClick={() => setLocale("en")}
          aria-pressed={locale === "en"}
        >
          {labels.english}
        </button>
      </div>

      <form action={saveWhatsappTemplatesAction} className="flex flex-col gap-4">
        {/* One hidden field carries the whole set, and the action validates it. */}
        <input type="hidden" name="message_templates" value={JSON.stringify(values)} />
        <input type="hidden" name="locale" value={locale} />
        {WHATSAPP_PURPOSES.map((purpose) => (
          <label key={purpose} className="flex flex-col gap-1 text-sm">
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-ink">{WHATSAPP_LABELS[purpose][locale]}</span>
              <button
                type="button"
                className="text-xs text-ink-muted underline underline-offset-4"
                onClick={() => set(purpose, "")}
              >
                {labels.reset}
              </button>
            </span>
            <textarea
              value={values[purpose]?.[locale] ?? ""}
              onChange={(event) => set(purpose, event.target.value)}
              placeholder={DEFAULT_WHATSAPP[purpose][locale]}
              rows={5}
              dir={locale === "ar" ? "rtl" : "ltr"}
              className="rounded-md border border-line bg-ground-paper p-3 text-sm"
            />
          </label>
        ))}
        <p className="text-xs text-ink-muted" dir="ltr">
          {labels.variables}: {"{guest_name} {groom} {bride} {date} {link} {venue_name_for_guest} {venue_map_url_for_guest}"}
        </p>
        <div>
          <Button type="submit">{labels.save}</Button>
        </div>
      </form>
    </div>
  );
}
