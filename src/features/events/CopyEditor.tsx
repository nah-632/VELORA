"use client";

import { useState } from "react";

import { COPY_SLOTS, COPY_SLOT_LABELS, DEFAULT_COPY, type CopySlot } from "@/features/invitations/messages";

/**
 * The wording, per event.
 *
 * Every text the invitation shows, editable, in both languages, with "reset" meaning **delete the
 * override** rather than paste the default back in. That distinction is the whole design: an event
 * that has been reset keeps following the default, so an improvement to the default reaches it. An
 * event that has been pasted-to keeps yesterday's sentence forever.
 *
 * The defaults are shown in the field as a placeholder rather than as its value, so an operator can
 * see what they are replacing and can tell at a glance which slots they have changed.
 */
export interface CopyEditorLabels {
  title: string;
  hint: string;
  language: string;
  arabic: string;
  english: string;
  reset: string;
  resetAll: string;
  changed: string;
  defaultLabel: string;
  placeholders: string;
}

export function CopyEditor({
  initial,
  labels,
}: {
  initial: { ar?: Record<string, string>; en?: Record<string, string> };
  labels: CopyEditorLabels;
}) {
  const [overrides, setOverrides] = useState<{ ar: Record<string, string>; en: Record<string, string> }>({
    ar: { ...(initial.ar ?? {}) },
    en: { ...(initial.en ?? {}) },
  });
  const [locale, setLocale] = useState<"ar" | "en">("ar");

  const current = overrides[locale];
  const changedCount = Object.values(current).filter((value) => value && value.trim()).length;

  const setSlot = (slot: CopySlot, value: string) => {
    setOverrides((state) => {
      const next = { ...state, [locale]: { ...state[locale] } };
      if (value.trim().length === 0) delete next[locale][slot];
      else next[locale][slot] = value;
      return next;
    });
  };

  const slotPlaceholders = (slot: CopySlot) =>
    [...new Set([...DEFAULT_COPY[locale][slot].matchAll(/\{([a-z_]+)\}/g)].map((match) => match[1]!))].join(", ");

  return (
    <div className="flex flex-col gap-4">
      {/* The whole set leaves as one value, which is what the action validates. */}
      <input type="hidden" name="copy_templates" value={JSON.stringify(overrides)} />

      <div>
        <h3 className="text-sm font-medium text-ink">{labels.title}</h3>
        <p className="mt-1 text-xs text-ink-muted">{labels.hint}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
        <span className="text-xs text-ink-muted">{labels.changed.replace("{count}", String(changedCount))}</span>
        {changedCount > 0 ? (
          <button
            type="button"
            className="text-xs text-ink-muted underline underline-offset-4"
            onClick={() => setOverrides((state) => ({ ...state, [locale]: {} }))}
          >
            {labels.resetAll}
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        {COPY_SLOTS.map((slot) => {
          const value = current[slot] ?? "";
          const isOverridden = value.trim().length > 0;
          const placeholders = slotPlaceholders(slot);
          return (
            <label key={slot} className="flex flex-col gap-1 text-sm">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-ink">{COPY_SLOT_LABELS[slot][locale]}</span>
                {isOverridden ? (
                  <button
                    type="button"
                    className="text-xs text-ink-muted underline underline-offset-4"
                    onClick={() => setSlot(slot, "")}
                  >
                    {labels.reset}
                  </button>
                ) : (
                  <span className="text-xs text-ink-muted">{labels.defaultLabel}</span>
                )}
              </span>
              <textarea
                value={value}
                onChange={(event) => setSlot(slot, event.target.value)}
                placeholder={DEFAULT_COPY[locale][slot]}
                rows={slot === "body" || slot === "opening" ? 3 : 2}
                dir={locale === "ar" ? "rtl" : "ltr"}
                className="rounded-md border border-line bg-ground-paper p-3 text-sm"
              />
              {placeholders ? (
                <span className="text-xs text-ink-muted" dir="ltr">
                  {labels.placeholders}: {placeholders}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </div>
  );
}
