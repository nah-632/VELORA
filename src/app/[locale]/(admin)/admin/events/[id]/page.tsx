import { type Metadata } from "next";
import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { Button, buttonClass } from "@/components/ui/Button";
import { Card, SectionHeading, StatePanel } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { isLocale } from "@/i18n/routing";
import { requireAdmin } from "@/features/admin/sessions";
import { deleteGuestAction, markSentAction, updateGuestAction } from "@/features/guests/actions";
import { ImportForm } from "@/features/guests/ImportForm";
import { listGuests, whatsappForGuest } from "@/features/guests/queries";
import { eventChecklist, eventReadiness } from "@/features/events/schema";
import { ScheduleEditor } from "@/features/events/ScheduleEditor";
import { VenuesEditor, type VenueFormValue } from "@/features/events/VenuesEditor";
import { CopyEditor } from "@/features/events/CopyEditor";
import { venueComplete } from "@/features/invitations/venues";
import { getEvent, listTemplateOptions, listVenues } from "@/features/events/queries";
import { updateEventAction } from "@/features/events/actions";
import { formatPhone } from "@/lib/phone";
import { getSql } from "@/lib/db";
import { wallClockIn } from "@/lib/time";

/**
 * One event: its words, its guests, and their links.
 *
 * The page is long on purpose — it is the operator's working screen, and everything between "the
 * couple's details arrived" and "50 links sent" belongs on it.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "admin.events" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function EventPage({
  params: { locale, id },
  searchParams,
}: {
  params: { locale: string; id: string };
  searchParams: { saved?: string; missing?: string; sent?: string; guest_saved?: string; guest_deleted?: string };
}) {
  if (!isLocale(locale)) return null;
  unstable_setRequestLocale(locale);
  await requireAdmin(locale);

  const event = await getEvent(id);
  if (!event) notFound();

  const t = await getTranslations("admin.events");
  const g = await getTranslations("admin.guests");
  const [guests, templates, venues, settingsRow] = await Promise.all([
    listGuests(id),
    listTemplateOptions(),
    listVenues(id),
    getSql()<{ message_templates: unknown; whatsapp_number: string }[]>`
      select message_templates, whatsapp_number from public.settings limit 1`,
  ]);
  const messageTemplates = (settingsRow[0]?.message_templates ?? {}) as Record<string, Record<string, string>>;

  const readinessFields = {
    bride_name_ar: event.bride_name_ar,
    bride_name_en: event.bride_name_en,
    groom_name_ar: event.groom_name_ar,
    groom_name_en: event.groom_name_en,
    event_datetime: event.event_datetime,
    venue_name_ar: event.venue_name_ar,
    venue_name_en: event.venue_name_en,
    venue_address_ar: event.venue_address_ar,
    venue_address_en: event.venue_address_en,
    venue_map_url: event.venue_map_url,
    notes_ar: event.notes_ar,
    notes_en: event.notes_en,
    dress_code_ar: event.dress_code_ar,
    dress_code_en: event.dress_code_en,
    parking_ar: event.parking_ar,
    parking_en: event.parking_en,
    sections_ar: event.sections_ar,
    sections_en: event.sections_en,
    schedule: Array.isArray(event.schedule) ? event.schedule : [],
    template_id: event.template_id,
    venues: venues.map((venue) => venueComplete(venue as never)),
  };
  const readiness = eventReadiness(readinessFields);
  const checklist = eventChecklist(readinessFields);
  const scheduleItems = (Array.isArray(event.schedule) ? event.schedule : []) as {
    time?: string; title_ar?: string; title_en?: string; detail_ar?: string; detail_en?: string;
  }[];

  const couple =
    locale === "ar"
      ? [event.groom_name_ar, event.bride_name_ar].filter(Boolean).join(" و ")
      : [event.groom_name_en, event.bride_name_en].filter(Boolean).join(" & ");

  const MESSAGE_NOTE = locale === "ar"
    ? "الرابط رسالة واحدة لكل ضيف. اضغط زر واتساب ليفتح المحادثة مع الرسالة جاهزة، ثم علّم المُرسَل."
    : "One message per guest. The WhatsApp button opens the chat with the message ready — then mark it sent.";

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <SectionHeading eyebrow={event.status} title={couple || t("untitled")}>
        {`${t("slug")}: ${event.slug}`}
      </SectionHeading>

      {searchParams.saved ? (
        <div className="mb-6">
          {readiness.ready ? (
            <StatePanel kind="success" message={t("savedReady")} />
          ) : (
            <StatePanel kind="empty" message={`${t("savedNotReady")} ${readiness.missing.join(", ")}`} />
          )}
        </div>
      ) : null}
      {searchParams.sent ? (
        <div className="mb-6">
          <StatePanel kind="success" message={t("markedSent", { count: Number(searchParams.sent) })} />
        </div>
      ) : null}

      <Card className="mb-6">
        <h2 className="text-sm font-medium text-ink">{t("checklist")}</h2>
        <p className="mt-1 text-xs text-ink-muted">{t("checklistHint")}</p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {checklist.map((entry) => (
            <li key={entry.key} className={entry.done ? "text-ink-muted" : entry.required ? "text-danger" : "text-ink"}>
              {entry.done ? "✓" : entry.required ? "✗" : "○"} {t(`check.${entry.key}`)}
              {entry.required ? "" : ` (${t("optional")})`}
            </li>
          ))}
        </ul>
      </Card>

      <details className="mb-6">
        <summary className="cursor-pointer text-sm font-medium text-ink underline-offset-4 hover:underline">
          {t("edit")}
        </summary>
        <Card className="mt-3">
          <form action={updateEventAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="event_id" value={event.id} />

            <Field label={t("groomAr")} name="groom_name_ar" defaultValue={event.groom_name_ar ?? ""} dir="rtl" />
            <Field label={t("brideAr")} name="bride_name_ar" defaultValue={event.bride_name_ar ?? ""} dir="rtl" />
            <Field label={t("groomEn")} name="groom_name_en" defaultValue={event.groom_name_en ?? ""} className="ltr-token" dir="ltr" />
            <Field label={t("brideEn")} name="bride_name_en" defaultValue={event.bride_name_en ?? ""} className="ltr-token" dir="ltr" />

            <Field
              label={t("date")}
              name="event_datetime"
              type="datetime-local"
              defaultValue={wallClockIn(event.event_datetime, event.timezone)}
              className="ltr-token"
              dir="ltr"
            />
            <Field label={t("hijri")} name="hijri_date_text" defaultValue={event.hijri_date_text ?? ""} />
            <Field label={t("timezone")} name="timezone" defaultValue={event.timezone} className="ltr-token" dir="ltr" />

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">{t("template")}</span>
              <select
                name="template_id"
                defaultValue={event.template_id ?? ""}
                className="min-h-11 rounded-md border border-line bg-ground-paper px-3 text-sm text-ink"
              >
                <option value="">{t("noTemplate")}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {locale === "ar" ? template.name_ar : template.name_en}
                  </option>
                ))}
              </select>
            </label>

            <Field label={t("venueAr")} name="venue_name_ar" defaultValue={event.venue_name_ar ?? ""} dir="rtl" />
            <Field label={t("venueEn")} name="venue_name_en" defaultValue={event.venue_name_en ?? ""} className="ltr-token" dir="ltr" />
            <Field label={t("addressAr")} name="venue_address_ar" defaultValue={event.venue_address_ar ?? ""} dir="rtl" />
            <Field label={t("addressEn")} name="venue_address_en" defaultValue={event.venue_address_en ?? ""} className="ltr-token" dir="ltr" />
            <Field label={t("mapUrl")} name="venue_map_url" defaultValue={event.venue_map_url ?? ""} className="ltr-token" dir="ltr" />
            <div />
            <Field label={t("parkingAr")} name="parking_ar" defaultValue={event.parking_ar ?? ""} dir="rtl" />
            <Field label={t("parkingEn")} name="parking_en" defaultValue={event.parking_en ?? ""} className="ltr-token" dir="ltr" />
            <Field label={t("entranceAr")} name="entrance_ar" defaultValue={event.entrance_ar ?? ""} dir="rtl" />
            <Field label={t("entranceEn")} name="entrance_en" defaultValue={event.entrance_en ?? ""} className="ltr-token" dir="ltr" />
            <Field label={t("sectionsAr")} name="sections_ar" defaultValue={event.sections_ar ?? ""} dir="rtl" />
            <Field label={t("sectionsEn")} name="sections_en" defaultValue={event.sections_en ?? ""} className="ltr-token" dir="ltr" />
            <Field label={t("dressCodeAr")} name="dress_code_ar" defaultValue={event.dress_code_ar ?? ""} dir="rtl" />
            <Field label={t("dressCodeEn")} name="dress_code_en" defaultValue={event.dress_code_en ?? ""} className="ltr-token" dir="ltr" />

            <Field label={t("quoteAr")} name="quote_ar" defaultValue={event.quote_ar ?? ""} dir="rtl" />
            <Field label={t("quoteEn")} name="quote_en" defaultValue={event.quote_en ?? ""} className="ltr-token" dir="ltr" />
            <Field label={t("notesAr")} name="notes_ar" defaultValue={event.notes_ar ?? ""} dir="rtl" />
            <Field label={t("notesEn")} name="notes_en" defaultValue={event.notes_en ?? ""} className="ltr-token" dir="ltr" />

            <Field label={t("thankConfirmedAr")} name="thank_you_confirmed_ar" defaultValue={event.thank_you_confirmed_ar ?? ""} dir="rtl" />
            <Field label={t("thankConfirmedEn")} name="thank_you_confirmed_en" defaultValue={event.thank_you_confirmed_en ?? ""} className="ltr-token" dir="ltr" />
            <Field label={t("thankDeclinedAr")} name="thank_you_declined_ar" defaultValue={event.thank_you_declined_ar ?? ""} dir="rtl" />
            <Field label={t("thankDeclinedEn")} name="thank_you_declined_en" defaultValue={event.thank_you_declined_en ?? ""} className="ltr-token" dir="ltr" />

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">{t("status")}</span>
              <select
                name="status"
                defaultValue={event.status}
                className="min-h-11 rounded-md border border-line bg-ground-paper px-3 text-sm text-ink"
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="ended">ended</option>
              </select>
            </label>

            <div className="sm:col-span-2">
              <VenuesEditor
                initial={venues.map((venue): VenueFormValue => ({
                  kind: venue.kind as VenueFormValue["kind"],
                  name_ar: venue.name_ar ?? "", name_en: venue.name_en ?? "",
                  address_ar: venue.address_ar ?? "", address_en: venue.address_en ?? "",
                  map_url: venue.map_url ?? "", start_time: venue.start_time ?? "",
                  entrance_ar: venue.entrance_ar ?? "", entrance_en: venue.entrance_en ?? "",
                  parking_ar: venue.parking_ar ?? "", parking_en: venue.parking_en ?? "",
                  dress_code_ar: venue.dress_code_ar ?? "", dress_code_en: venue.dress_code_en ?? "",
                  notes_ar: venue.notes_ar ?? "", notes_en: venue.notes_en ?? "",
                  contact_phone: venue.contact_phone ?? "",
                }))}
                labels={{
                  title: t("venuesTitle"), hint: t("venuesHint"),
                  modeSeparate: t("venuesSeparate"), modeShared: t("venuesShared"),
                  womenHall: t("venuesWomen"), menHall: t("venuesMen"), sharedHall: t("venuesSharedHall"),
                  copyFromOther: t("venuesCopy"), nameAr: t("venuesNameAr"), nameEn: t("venuesNameEn"),
                  addressAr: t("addressAr"), addressEn: t("addressEn"),
                  mapUrl: t("mapUrl"), mapHint: t("venuesMapHint"), openToTest: t("venuesOpenTest"),
                  startTime: t("venuesTime"), entranceAr: t("entranceAr"), entranceEn: t("entranceEn"),
                  parkingAr: t("parkingAr"), parkingEn: t("parkingEn"),
                  dressAr: t("dressCodeAr"), dressEn: t("dressCodeEn"),
                  notesAr: t("notesAr"), notesEn: t("notesEn"), phone: t("venuesPhone"),
                }}
              />
            </div>

            <div className="sm:col-span-2">
              <CopyEditor
                initial={(event.copy_templates ?? {}) as { ar?: Record<string, string>; en?: Record<string, string> }}
                labels={{
                  title: t("copyTitle"), hint: t("copyHint"), language: t("copyLanguage"),
                  arabic: t("copyArabic"), english: t("copyEnglish"), reset: t("copyReset"),
                  resetAll: t("copyResetAll"), changed: t("copyChanged"),
                  defaultLabel: t("copyDefault"), placeholders: t("copyPlaceholders"),
                }}
              />
            </div>

            <div className="sm:col-span-2">
              <h3 className="text-sm font-medium text-ink">{t("schedule")}</h3>
              <p className="mb-3 text-xs text-ink-muted">{t("scheduleHint")}</p>
              <ScheduleEditor
                initial={scheduleItems.map((item) => ({
                  time: item.time ?? "",
                  title_ar: item.title_ar ?? "",
                  title_en: item.title_en ?? "",
                  detail_ar: item.detail_ar ?? "",
                  detail_en: item.detail_en ?? "",
                }))}
                labels={{
                  time: t("scheduleTime"),
                  titleAr: t("scheduleTitleAr"),
                  titleEn: t("scheduleTitleEn"),
                  detailAr: t("scheduleDetailAr"),
                  detailEn: t("scheduleDetailEn"),
                  add: t("scheduleAdd"),
                  remove: t("scheduleRemove"),
                  up: t("scheduleUp"),
                  down: t("scheduleDown"),
                  empty: t("scheduleEmpty"),
                  item: t("scheduleItem"),
                }}
              />
            </div>

            <div className="sm:col-span-2">
              <Button type="submit">{t("save")}</Button>
            </div>
          </form>
        </Card>
      </details>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium text-ink">{g("title")}</h2>
        <p className="text-xs text-ink-muted">
          {g("count", { count: guests.length })} · {g("sentCount", { count: guests.filter((x) => x.send_status === "sent").length })}
        </p>
      </div>
      <p className="mb-4 text-xs text-ink-muted">{MESSAGE_NOTE}</p>

      <ImportForm
        eventId={event.id}
        locale={locale}
        labels={{
          title: g("import"),
          hint: g("importHint"),
          placeholder: g("importPlaceholder"),
          preview: g("preview"),
          commit: g("commit"),
          // Strings with `{count}` in them, not functions: a function prop cannot cross into a
          // client component. See the note in ImportForm.
          imported: g("imported"),
          rejected: g("rejected"),
          duplicates: g("duplicates"),
          line: g("line"),
          ready: g("readyRows"),
          willSkip: g("willSkip"),
        }}
      />

      {guests.length === 0 ? (
        <div className="mt-6">
          <StatePanel kind="empty" message={g("none")} />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {/*
            One form per row, deliberately. Wrapping every row in a single "mark all sent" form and
            nesting a per-row edit form inside it produces invalid HTML — a form inside a form — and
            browsers resolve that by silently dropping the inner one, which would have looked like a
            save button that does nothing. Bulk marking belongs with the sequential-send mode in the
            sending slice, where it can be built as one form with checkboxes and no nesting.
          */}
          {guests.map((guest) => {
            const waLink = whatsappForGuest({
              guest,
              event,
              venues: venues as never,
              purpose: "invite",
              overrides: messageTemplates,
            });
            const personalLine = locale === "ar" ? guest.personal_line_ar : guest.personal_line_en;
            return (
              <Card key={guest.id} className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium text-ink">{guest.full_name}</span>
                  <span className="ltr-token text-sm text-ink-muted" dir="ltr">
                    {formatPhone(guest.phone)}
                  </span>
                  <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">
                    {guest.category}
                  </span>
                  {guest.gender !== "neutral" ? (
                    <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">
                      {g(`gender.${guest.gender}`)}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted">
                    {g(`audience.${guest.audience ?? "derived"}`)}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {guest.max_companions > 0 ? g("companions", { count: guest.max_companions }) : g("noCompanions")}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {guest.send_status === "sent" ? g("sent") : g("notSent")}
                    {guest.open_count > 0 ? ` · ${g("opens", { count: guest.open_count })}` : ""}
                    {guest.response ? ` · ${guest.response}` : ""}
                  </span>
                  <span className="ms-auto flex flex-wrap items-center gap-2">
                    <a className={buttonClass("secondary", "md")} href={waLink} target="_blank" rel="noreferrer noopener">
                      {g("whatsapp")}
                    </a>
                    <a className={buttonClass("quiet", "md")} href={`/${locale}/admin/events/${event.id}/preview/${guest.id}`}>
                      {g("previewAsGuest")}
                    </a>
                    {guest.send_status !== "sent" ? (
                      <form action={markSentAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="event_id" value={event.id} />
                        <input type="hidden" name="guest_id" value={guest.id} />
                        <Button type="submit" variant="quiet" className="px-2 text-xs">
                          {g("markThisSent")}
                        </Button>
                      </form>
                    ) : null}
                  </span>
                </div>

                {personalLine ? <p className="mt-2 text-sm text-ink-muted">{personalLine}</p> : null}

                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-ink-muted underline-offset-4 hover:underline">
                    {g("editRow")}
                  </summary>
                  <form action={updateGuestAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="event_id" value={event.id} />
                    <input type="hidden" name="guest_id" value={guest.id} />

                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-ink">{g("category")}</span>
                      <select
                        name="category"
                        defaultValue={guest.category}
                        className="min-h-11 rounded-md border border-line bg-ground-paper px-3 text-sm text-ink"
                      >
                        <option value="family">family</option>
                        <option value="friends">friends</option>
                        <option value="work">work</option>
                        <option value="other">other</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-ink">{g("genderLabel")}</span>
                      <select
                        name="gender"
                        defaultValue={guest.gender}
                        className="min-h-11 rounded-md border border-line bg-ground-paper px-3 text-sm text-ink"
                      >
                        <option value="neutral">{g("gender.neutral")}</option>
                        <option value="male">{g("gender.male")}</option>
                        <option value="female">{g("gender.female")}</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-ink">{g("audienceLabel")}</span>
                      <select
                        name="audience"
                        defaultValue={guest.audience ?? "derived"}
                        className="min-h-11 rounded-md border border-line bg-ground-paper px-3 text-sm text-ink"
                      >
                        <option value="derived">{g("audience.derived")}</option>
                        <option value="women">{g("audience.women")}</option>
                        <option value="men">{g("audience.men")}</option>
                        <option value="both">{g("audience.both")}</option>
                      </select>
                    </label>
                    <Field
                      label={g("maxCompanions")}
                      name="max_companions"
                      type="number"
                      min={0}
                      max={20}
                      defaultValue={String(guest.max_companions)}
                      className="ltr-token"
                      dir="ltr"
                    />
                    <Field label={g("personalAr")} name="personal_line_ar" defaultValue={guest.personal_line_ar ?? ""} dir="rtl" />
                    <Field label={g("personalEn")} name="personal_line_en" defaultValue={guest.personal_line_en ?? ""} dir="ltr" className="ltr-token" />

                    <div className="flex gap-2 sm:col-span-2">
                      <Button type="submit">{g("saveRow")}</Button>
                    </div>
                  </form>
                  <form action={deleteGuestAction} className="mt-2">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="event_id" value={event.id} />
                    <input type="hidden" name="guest_id" value={guest.id} />
                    <Button type="submit" variant="danger" className="px-3 text-xs">
                      {g("deleteRow")}
                    </Button>
                  </form>
                </details>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
