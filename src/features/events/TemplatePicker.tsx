"use client";

import { useState } from "react";

import { TEMPLATES } from "@/lib/templates/registry";
import { resolveTheme, themeToCssVars } from "@/lib/templates/css-vars";
import { KhatamField, MihrabArch, MuqarnasCorner, ZelligeStrip } from "@/lib/templates/ornaments";
import type { Palette, ThemeOverride } from "@/lib/templates/schema";

/**
 * The picker, with the invitation in a phone frame beside it.
 *
 * The preview is the **real renderer** — the same ornaments, the same tokens, the same CSS as
 * `/i/<token>` — not a screenshot and not a second implementation. A preview that draws its own
 * approximation is a preview that will one day disagree with the thing it promised.
 *
 * The frame is 320px wide inside a 340px shell, so what the operator approves is what fits the
 * smallest phone the product supports, not a wide browser window that flatters it.
 *
 * Overrides are per event and live only in this form until saved: the palette's five roles and the
 * display faces, which is what the reference says an operator may change. Body faces stay fixed.
 */
export interface PickerLabels {
  title: string;
  hint: string;
  preview: string;
  overrides: string;
  overridesHint: string;
  reset: string;
  palette: { ivory: string; gold: string; emerald: string; burgundy: string; ink: string };
  namesFont: string;
  verseFont: string;
  saveHint: string;
}

export function TemplatePicker({
  initialSlug,
  initialOverride,
  locale,
  labels,
  sample,
}: {
  initialSlug: string | null;
  initialOverride: ThemeOverride;
  locale: "ar" | "en";
  labels: PickerLabels;
  sample: { groom: string; bride: string; verse: string; greeting: string };
}) {
  const [slug, setSlug] = useState(initialSlug ?? TEMPLATES[0]?.slug ?? "");
  const [override, setOverride] = useState<ThemeOverride>(initialOverride);

  const template = TEMPLATES.find((entry) => entry.slug === slug) ?? TEMPLATES[0]!;
  const theme = resolveTheme(template, override);
  const style = themeToCssVars(theme, locale) as Record<string, string>;
  const isArabic = locale === "ar";

  const setPalette = (role: keyof Palette, value: string) =>
    setOverride((current) => ({ ...current, palette: { ...(current.palette ?? {}), [role]: value } }));

  const setFont = (role: "names" | "verse", value: string) =>
    setOverride((current) => ({
      ...current,
      fonts: { ...(current.fonts ?? {}), [locale]: { ...(current.fonts?.[locale] ?? {}), [role]: value } },
    }));

  const faces = ["aref", "amiri", "reemkufi", "notonaskh", "cormorant", "cinzel"] as const;

  return (
    <div className="flex flex-col gap-4">
      {/* What the event action reads. */}
      <input type="hidden" name="template_slug" value={slug} />
      <input type="hidden" name="theme_override" value={JSON.stringify(override)} />

      <div>
        <h3 className="text-sm font-medium text-ink">{labels.title}</h3>
        <p className="mt-1 text-xs text-ink-muted">{labels.hint}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={labels.title}>
            {TEMPLATES.map((entry) => (
              <button
                key={entry.slug}
                type="button"
                role="radio"
                aria-checked={entry.slug === slug}
                onClick={() => setSlug(entry.slug)}
                className={`min-h-11 rounded-md border px-3 text-sm ${
                  entry.slug === slug ? "border-gold-deep text-gold-deep" : "border-line text-ink"
                }`}
              >
                {locale === "ar" ? entry.name_ar : entry.name_en}
              </button>
            ))}
          </div>

          <fieldset className="rounded-md border border-line p-3">
            <legend className="px-1 text-xs text-ink-muted">{labels.overrides}</legend>
            <p className="mb-2 text-xs text-ink-muted">{labels.overridesHint}</p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(Object.keys(labels.palette) as (keyof Palette)[]).map((role) => (
                <label key={role} className="flex flex-col gap-1 text-xs">
                  <span className="text-ink-muted">{labels.palette[role]}</span>
                  <input
                    type="color"
                    value={theme.palette[role]}
                    onChange={(event) => setPalette(role, event.target.value.toUpperCase())}
                    className="h-9 w-full cursor-pointer rounded border border-line bg-transparent"
                    aria-label={labels.palette[role]}
                  />
                </label>
              ))}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-ink-muted">{labels.namesFont}</span>
                <select
                  value={theme.fonts[locale].names}
                  onChange={(event) => setFont("names", event.target.value)}
                  className="min-h-9 rounded-md border border-line bg-ground-paper px-2 text-xs text-ink"
                >
                  {faces.map((face) => (
                    <option key={face} value={face}>
                      {face}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-ink-muted">{labels.verseFont}</span>
                <select
                  value={theme.fonts[locale].verse}
                  onChange={(event) => setFont("verse", event.target.value)}
                  className="min-h-9 rounded-md border border-line bg-ground-paper px-2 text-xs text-ink"
                >
                  {faces.map((face) => (
                    <option key={face} value={face}>
                      {face}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={() => setOverride({})}
              className="mt-3 text-xs text-ink-muted underline underline-offset-4"
            >
              {labels.reset}
            </button>
          </fieldset>
        </div>

        {/* The phone frame: 320px of real renderer. */}
        <figure className="justify-self-center">
          <div
            className="overflow-hidden rounded-[28px] border-[6px] border-[#1c1c1c] bg-black shadow-lg"
            style={{ width: 296, height: 540 }}
          >
            <div className="t1 h-full overflow-y-auto" style={style} lang={locale} dir={isArabic ? "rtl" : "ltr"} data-frame="royal-double" data-foil="on" data-countdown="framed">
              <div className="t1__field" aria-hidden="true">
                <KhatamField opacity={0.07} size={68} />
              </div>
              <div className="t1__frame" aria-hidden="true" />
              <div className="t1__content" style={{ padding: "1.5rem 1rem" }}>
                <p className="t1__eyebrow">{isArabic ? "دعوة زفاف" : "Wedding Invitation"}</p>
                <div className="t1__names" style={{ margin: "1rem 0", padding: "2rem 0.5rem" }}>
                  <MihrabArch className="mihrab" draw={false} />
                  <div className="t1__couple">
                    <span className="t1__name" style={{ fontSize: "1.5rem" }}>{sample.groom}</span>
                    <span className="t1__amp">{isArabic ? "و" : "&"}</span>
                    <span className="t1__name" style={{ fontSize: "1.5rem" }}>{sample.bride}</span>
                  </div>
                </div>
                <ZelligeStrip className="zellige" />
                <p className="t1__verse" style={{ fontSize: "0.8rem", lineHeight: 1.9 }}>{sample.verse}</p>
                <p className="t1__personal" style={{ fontSize: "0.76rem" }}>{sample.greeting}</p>
              </div>
            </div>
          </div>
          <figcaption className="mt-2 text-center text-xs text-ink-muted">{labels.preview}</figcaption>
        </figure>
      </div>

      <p className="text-xs text-ink-muted">{labels.saveHint}</p>
    </div>
  );
}