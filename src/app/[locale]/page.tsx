import { getTranslations, unstable_setRequestLocale } from "next-intl/server";

import { Button } from "@/components/ui/Button";
import { Card, SectionHeading, StatePanel } from "@/components/ui/Card";
import { Field, TextareaField } from "@/components/ui/Field";
import { isLocale } from "@/i18n/routing";

/**
 * Foundation verification page.
 *
 * This is not the homepage and does not pretend to be. It exists so the token set, the type
 * stack, the direction handling and the base components can be *measured* in both locales
 * before any public page is built on top of them.
 *
 * The ratios shown are the measured output of scripts/check-contrast.py, not estimates.
 */
const SWATCHES = [
  { token: "--obsidian", className: "bg-brand-obsidian", hex: "#191A19", ratio: "15.39:1" },
  { token: "--ivory", className: "bg-brand-ivory", hex: "#F5F0E8", ratio: "ground" },
  { token: "--gold", className: "bg-brand-gold", hex: "#B99B6C", ratio: "2.32:1" },
  { token: "--gold-deep", className: "bg-brand-gold-deep", hex: "#7A5F38", ratio: "5.26:1" },
  { token: "--taupe", className: "bg-brand-taupe", hex: "#B9ADA0", ratio: "1.94:1" },
  { token: "--emerald", className: "bg-brand-emerald", hex: "#263E35", ratio: "10.16:1" },
  { token: "--ink-muted", className: "bg-ink-muted", hex: "#5B5F5C", ratio: "5.72:1" },
  { token: "--line", className: "bg-line", hex: "#DED6C8", ratio: "1.27:1" },
] as const;

export default async function FoundationPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  if (!isLocale(locale)) return null;
  unstable_setRequestLocale(locale);

  const t = await getTranslations("foundation");
  const brand = await getTranslations("brand");
  // The other direction, on purpose: this string must render inside the opposite context
  // without inheriting its alignment, its typeface, or its punctuation.
  const otherDirectionSample =
    locale === "ar"
      ? "The Art of Inviting — Latin inside Arabic"
      : "فنّ الدعوة — نصٌّ عربي داخل الإنجليزية";

  return (
    <div className="mx-auto flex max-w-shell flex-col gap-16 px-6 py-16">
      <section className="flex flex-col gap-3">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="font-display text-4xl text-ink md:text-5xl">{t("title")}</h1>
        <p className="max-w-prose text-ink-muted">{t("intro")}</p>
        <p className="text-sm text-ink-muted">
          {brand("name")} · {brand("positioning")} · {brand("tagline")}
        </p>
      </section>

      <section>
        <SectionHeading title={t("sections.colors")}>
          {t.rich("colorNotes.measured", {
            code: (chunks) => <code className="ltr-token">{chunks}</code>,
          })}
        </SectionHeading>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SWATCHES.map((swatch) => (
            <div key={swatch.token} className="flex flex-col gap-2">
              <div className={`h-20 rounded-md border border-line ${swatch.className}`} />
              <code className="ltr-token text-xs text-ink">{swatch.token}</code>
              <span className="ltr-token text-xs text-ink-muted">
                {swatch.hex} · {swatch.ratio}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <StatePanel kind="error" message={t("colorNotes.gold")} />
          <StatePanel kind="success" message={t("colorNotes.goldDeep")} />
        </div>
      </section>

      <section>
        <SectionHeading title={t("sections.typography")} />
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <p className="eyebrow mb-2">display</p>
            <p className="font-display text-3xl text-ink">{brand("tagline")}</p>
            <p className="eyebrow mt-4">body</p>
            <p className="text-ink">{t("intro")}</p>
          </Card>
          <Card tone="recipe">
            <p className="eyebrow mb-2">direction context</p>
            <p dir="auto" className="bidi-content text-lg text-ink">
              {otherDirectionSample}
            </p>
            <p className="mt-4 text-sm text-ink-muted">{t("typeSample")}</p>
            <p className="text-sm text-ink-muted">{t("typeSampleLatin")}</p>
          </Card>
        </div>
      </section>

      <section>
        <SectionHeading title={t("sections.components")} />
        <Card className="flex flex-wrap items-center gap-3">
          <Button>primary</Button>
          <Button variant="secondary">secondary</Button>
          <Button variant="quiet">quiet</Button>
          <Button variant="danger">danger</Button>
          <Button disabled>disabled</Button>
          <Button size="lg">large</Button>
        </Card>
      </section>

      <section>
        <SectionHeading title={t("sections.fields")} />
        <Card className="grid gap-6 md:grid-cols-2">
          <Field
            label={t("demo.fullName")}
            placeholder={locale === "ar" ? "فاطمة الزياني" : "Fatima Al Zayani"}
            hint={t("demo.fullNameHint")}
          />
          <Field
            label={t("demo.email")}
            type="email"
            defaultValue="not-an-email"
            error={t("demo.emailError")}
          />
          <Field label={t("demo.phone")} placeholder="+973 3xxx xxxx" />
          <TextareaField label={t("demo.message")} rows={3} />
        </Card>
      </section>

      <section>
        <SectionHeading title={t("sections.states")} />
        <div className="flex flex-col gap-3">
          <StatePanel kind="loading" message={t("states.loading")} />
          <StatePanel kind="empty" message={t("states.empty")} />
          <StatePanel
            kind="error"
            message={t("states.error")}
            action={<Button variant="secondary">retry</Button>}
          />
          <StatePanel kind="success" message={t("states.success")} />
        </div>
      </section>
    </div>
  );
}
