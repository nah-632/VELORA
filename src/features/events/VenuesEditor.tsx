"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { isGoogleMapsUrl } from "@/lib/maps";

/**
 * The halls.
 *
 * Two questions, in the order the operator answers them: *are there two halls or one?* and *what is in
 * each?* The mode switch decides which rows exist, because that is a decision about the event rather
 * than about a form — and because "one shared venue" is a genuinely different invitation (one icon,
 * one address), not a women's hall with the men's fields left empty.
 *
 * "Copy from the other hall" exists because two halls are usually the same building: the operator
 * types the address once, copies, and edits the parts that differ.
 *
 * The whole set leaves as one hidden JSON field, so the server validates it in one place — the same
 * shape the programme uses.
 */
export interface VenueFormValue {
  kind: "women" | "men" | "shared";
  name_ar: string;
  name_en: string;
  address_ar: string;
  address_en: string;
  map_url: string;
  start_time: string;
  entrance_ar: string;
  entrance_en: string;
  parking_ar: string;
  parking_en: string;
  dress_code_ar: string;
  dress_code_en: string;
  notes_ar: string;
  notes_en: string;
  contact_phone: string;
}

export const EMPTY_VENUE: VenueFormValue = {
  kind: "women",
  name_ar: "", name_en: "",
  address_ar: "", address_en: "",
  map_url: "", start_time: "",
  entrance_ar: "", entrance_en: "",
  parking_ar: "", parking_en: "",
  dress_code_ar: "", dress_code_en: "",
  notes_ar: "", notes_en: "",
  contact_phone: "",
};

export interface VenueEditorLabels {
  title: string;
  hint: string;
  modeSeparate: string;
  modeShared: string;
  womenHall: string;
  menHall: string;
  sharedHall: string;
  copyFromOther: string;
  nameAr: string; nameEn: string;
  addressAr: string; addressEn: string;
  mapUrl: string;
  mapHint: string;
  openToTest: string;
  startTime: string;
  entranceAr: string; entranceEn: string;
  parkingAr: string; parkingEn: string;
  dressAr: string; dressEn: string;
  notesAr: string; notesEn: string;
  phone: string;
}

/**
 * Checked before it is saved, and the rule is the server's rule (`isGoogleMapsUrl`) rather than a
 * second opinion that can drift from it. The field ends up inside the guest's map button, so a link
 * that is not Google's is not this field's business — an operator sending guests to a page they do
 * not control is the failure this prevents.
 */
export function mapUrlLooksValid(value: string): boolean {
  return isGoogleMapsUrl(value);
}

function Field({
  label,
  value,
  onChange,
  dir = "auto",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dir?: "auto" | "rtl" | "ltr";
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        dir={dir}
        placeholder={placeholder}
        className={`min-h-11 rounded-md border border-line bg-ground-paper px-3 text-sm ${dir === "ltr" ? "ltr-token" : ""}`}
      />
    </label>
  );
}

export function VenuesEditor({
  initial,
  labels,
}: {
  initial: VenueFormValue[];
  labels: VenueEditorLabels;
}) {
  const hasTwo = initial.some((venue) => venue.kind === "women") && initial.some((venue) => venue.kind === "men");
  const [separate, setSeparate] = useState(hasTwo || initial.length === 0);
  const [venues, setVenues] = useState<VenueFormValue[]>(() => {
    if (initial.length > 0) return initial;
    return [{ ...EMPTY_VENUE, kind: "women" }, { ...EMPTY_VENUE, kind: "men" }];
  });
  const shown: VenueFormValue[] = separate
    ? [
        venues.find((venue) => venue.kind === "women") ?? { ...EMPTY_VENUE, kind: "women" },
        venues.find((venue) => venue.kind === "men") ?? { ...EMPTY_VENUE, kind: "men" },
      ]
    : [venues.find((venue) => venue.kind === "shared") ?? { ...EMPTY_VENUE, kind: "shared" }];

  const submitted = shown;

  const update = (kind: string, key: keyof VenueFormValue, value: string) => {
    setVenues((current) => {
      const next = [...current];
      const index = next.findIndex((venue) => venue.kind === kind);
      if (index === -1) next.push({ ...EMPTY_VENUE, kind: kind as VenueFormValue["kind"], [key]: value });
      else next[index] = { ...next[index]!, [key]: value };
      return next;
    });
  };

  const copyAcross = (from: string, to: string) => {
    const source = venues.find((venue) => venue.kind === from);
    if (!source) return;
    setVenues((current) => {
      const next = [...current];
      const index = next.findIndex((venue) => venue.kind === to);
      const target = { ...(next[index] ?? { ...EMPTY_VENUE, kind: to as VenueFormValue["kind"] }) };
      // The name is deliberately not copied: two halls in one building still have two names, and an
      // operator who has to retype it will notice they are editing the wrong card.
      for (const key of ["address_ar", "address_en", "map_url", "parking_ar", "parking_en", "dress_code_ar", "dress_code_en", "notes_ar", "notes_en", "contact_phone"] as const) {
        target[key] = source[key];
      }
      if (index === -1) next.push(target);
      else next[index] = target;
      return next;
    });
  };

  const card = (venue: VenueFormValue, title: string, otherKind: string | null) => (
    <div className="rounded-md border border-line p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-ink">{title}</h4>
        {otherKind ? (
          <button
            type="button"
            className="text-xs text-ink-muted underline underline-offset-4 hover:text-ink"
            onClick={() => copyAcross(otherKind, venue.kind)}
          >
            {labels.copyFromOther}
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={labels.nameAr} value={venue.name_ar} onChange={(v) => update(venue.kind, "name_ar", v)} dir="rtl" />
        <Field label={labels.nameEn} value={venue.name_en} onChange={(v) => update(venue.kind, "name_en", v)} dir="ltr" />
        <Field label={labels.addressAr} value={venue.address_ar} onChange={(v) => update(venue.kind, "address_ar", v)} dir="rtl" />
        <Field label={labels.addressEn} value={venue.address_en} onChange={(v) => update(venue.kind, "address_en", v)} dir="ltr" />

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-ink-muted">{labels.mapUrl}</span>
          <span className="flex gap-2">
            <input
              value={venue.map_url}
              onChange={(event) => update(venue.kind, "map_url", event.target.value)}
              dir="ltr"
              placeholder="https://maps.apple.com/?q=…"
              className="ltr-token min-h-11 w-full rounded-md border border-line bg-ground-paper px-3 text-sm"
            />
            {venue.map_url.trim() ? (
              <a
                className="inline-flex min-h-11 items-center rounded-md border border-line px-3 text-xs text-ink"
                href={venue.map_url}
                target="_blank"
                rel="noreferrer noopener"
              >
                {labels.openToTest}
              </a>
            ) : null}
          </span>
          {mapUrlLooksValid(venue.map_url) ? (
            <span className="text-xs text-ink-muted">{labels.mapHint}</span>
          ) : (
            <span role="alert" className="text-xs text-danger">
              {labels.mapHint}
            </span>
          )}
        </label>

        <Field label={labels.startTime} value={venue.start_time} onChange={(v) => update(venue.kind, "start_time", v)} dir="ltr" placeholder="20:30" />
        <Field label={labels.phone} value={venue.contact_phone} onChange={(v) => update(venue.kind, "contact_phone", v)} dir="ltr" />

        <Field label={labels.entranceAr} value={venue.entrance_ar} onChange={(v) => update(venue.kind, "entrance_ar", v)} dir="rtl" />
        <Field label={labels.entranceEn} value={venue.entrance_en} onChange={(v) => update(venue.kind, "entrance_en", v)} dir="ltr" />
        <Field label={labels.parkingAr} value={venue.parking_ar} onChange={(v) => update(venue.kind, "parking_ar", v)} dir="rtl" />
        <Field label={labels.parkingEn} value={venue.parking_en} onChange={(v) => update(venue.kind, "parking_en", v)} dir="ltr" />
        <Field label={labels.dressAr} value={venue.dress_code_ar} onChange={(v) => update(venue.kind, "dress_code_ar", v)} dir="rtl" />
        <Field label={labels.dressEn} value={venue.dress_code_en} onChange={(v) => update(venue.kind, "dress_code_en", v)} dir="ltr" />
        <Field label={labels.notesAr} value={venue.notes_ar} onChange={(v) => update(venue.kind, "notes_ar", v)} dir="rtl" />
        <Field label={labels.notesEn} value={venue.notes_en} onChange={(v) => update(venue.kind, "notes_en", v)} dir="ltr" />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="venues" value={JSON.stringify(submitted)} />

      <div>
        <h3 className="text-sm font-medium text-ink">{labels.title}</h3>
        <p className="mt-1 text-xs text-ink-muted">{labels.hint}</p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={labels.title}>
        <Button type="button" variant={separate ? "primary" : "secondary"} onClick={() => setSeparate(true)}>
          {labels.modeSeparate}
        </Button>
        <Button type="button" variant={separate ? "secondary" : "primary"} onClick={() => setSeparate(false)}>
          {labels.modeShared}
        </Button>
      </div>

      {separate ? (
        <div className="flex flex-col gap-4">
          {card(shown[0]!, labels.womenHall, "men")}
          {card(shown[1]!, labels.menHall, "women")}
        </div>
      ) : (
        card(shown[0]!, labels.sharedHall, null)
      )}

      {/* The switch above decides which rows exist; this only announces the change to a reader who
          cannot see the two cards appear and disappear. */}
      <p className="sr-only" aria-live="polite">
        {separate ? labels.modeSeparate : labels.modeShared}
      </p>
    </div>
  );
}
