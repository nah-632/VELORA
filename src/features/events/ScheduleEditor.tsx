"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";

/**
 * The running order, as a list the operator builds.
 *
 * Client-side because this is genuinely interactive — add, remove, move — and because a form that
 * round-trips to the server on every "move up" would lose whatever else was half-typed on the page.
 * The finished list leaves as one hidden JSON field, so the server still sees a single value it can
 * validate in one place.
 *
 * The inputs have no `name`: they are this component's own state and are submitted only through the
 * hidden field, which is what keeps them from arriving at the action as an accidental second copy.
 */
export interface ScheduleItemValue {
  time: string;
  title_ar: string;
  title_en: string;
  detail_ar: string;
  detail_en: string;
}

const EMPTY: ScheduleItemValue = { time: "", title_ar: "", title_en: "", detail_ar: "", detail_en: "" };

export function ScheduleEditor({
  initial,
  labels,
}: {
  initial: ScheduleItemValue[];
  labels: {
    time: string;
    titleAr: string;
    titleEn: string;
    detailAr: string;
    detailEn: string;
    add: string;
    remove: string;
    up: string;
    down: string;
    empty: string;
    item: string;
  };
}) {
  const [items, setItems] = useState<ScheduleItemValue[]>(initial.length > 0 ? initial : []);

  const update = (index: number, key: keyof ScheduleItemValue, value: string) => {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  };

  const move = (index: number, direction: -1 | 1) => {
    setItems((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* The one thing the form actually submits. */}
      <input type="hidden" name="schedule" value={JSON.stringify(items)} />

      {items.length === 0 ? (
        <p className="text-xs text-ink-muted">{labels.empty}</p>
      ) : null}

      {items.map((item, index) => (
        <div key={index} className="rounded-md border border-line p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs text-ink-muted">
              {labels.item} {index + 1}
            </span>
            <span className="flex items-center gap-1">
              <button
                type="button"
                className="rounded px-2 py-1 text-xs text-ink-muted hover:text-ink disabled:opacity-40"
                onClick={() => move(index, -1)}
                disabled={index === 0}
              >
                ↑ {labels.up}
              </button>
              <button
                type="button"
                className="rounded px-2 py-1 text-xs text-ink-muted hover:text-ink disabled:opacity-40"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
              >
                ↓ {labels.down}
              </button>
              <button
                type="button"
                className="rounded px-2 py-1 text-xs text-danger"
                onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
              >
                {labels.remove}
              </button>
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-muted">{labels.time}</span>
              <input
                value={item.time}
                onChange={(event) => update(index, "time", event.target.value)}
                placeholder="20:30"
                dir="ltr"
                className="ltr-token min-h-11 rounded-md border border-line bg-ground-paper px-3 text-sm"
              />
            </label>
            <div />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-muted">{labels.titleAr}</span>
              <input
                value={item.title_ar}
                onChange={(event) => update(index, "title_ar", event.target.value)}
                dir="rtl"
                className="min-h-11 rounded-md border border-line bg-ground-paper px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-muted">{labels.titleEn}</span>
              <input
                value={item.title_en}
                onChange={(event) => update(index, "title_en", event.target.value)}
                dir="ltr"
                className="ltr-token min-h-11 rounded-md border border-line bg-ground-paper px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-muted">{labels.detailAr}</span>
              <input
                value={item.detail_ar}
                onChange={(event) => update(index, "detail_ar", event.target.value)}
                dir="rtl"
                className="min-h-11 rounded-md border border-line bg-ground-paper px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-muted">{labels.detailEn}</span>
              <input
                value={item.detail_en}
                onChange={(event) => update(index, "detail_en", event.target.value)}
                dir="ltr"
                className="ltr-token min-h-11 rounded-md border border-line bg-ground-paper px-3 text-sm"
              />
            </label>
          </div>
        </div>
      ))}

      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setItems((current) => [...current, { ...EMPTY }])}
        >
          {labels.add}
        </Button>
      </div>
    </div>
  );
}
