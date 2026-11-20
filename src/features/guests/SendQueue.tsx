"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";

/**
 * Sending, one guest at a time.
 *
 * The operator asked for sequential sending, and the reason is not throughput — it is that WhatsApp
 * punishes a number that fires fifty messages in a minute, and that a person sending one at a time
 * notices the message that looks wrong. So this walks the list: one guest, one big button, one
 * "sent" tick, next.
 *
 * Three behaviours that matter more than the walk:
 *
 *   - **"Mark sent" is a real action, not a formality.** Opening WhatsApp is not sending; the message
 *     is only recorded when the operator says it went. That is what makes the "has not opened it"
 *     column trustworthy.
 *   - **A guest who has not answered is offered a reminder**, not a second invitation — the purpose
 *     passed to the message composer changes, and so does the text.
 *   - **The window is never opened by accident**: the link is an anchor with `rel="noreferrer"`, and
 *     the "next" button is separate, so a mis-tap advances rather than sends.
 */
export interface SendGuest {
  id: string;
  name: string;
  phone: string;
  language: string;
  answered: "confirmed" | "declined" | null;
  sent: boolean;
  link: string;
}

export interface SendLabels {
  title: string;
  hint: string;
  progress: string;
  openWhatsapp: string;
  markSent: string;
  alreadySent: string;
  skip: string;
  next: string;
  done: string;
  remaining: string;
  purpose: string;
  purposes: { invite: string; reminder: string; beforeEvent: string; afterEvent: string };
  allSent: string;
}

export function SendQueue({
  guests,
  labels,
  onMarkSent,
  onRemind,
}: {
  guests: SendGuest[];
  labels: SendLabels;
  /** Server actions, passed as the action element so the client bundle stays free of them. */
  onMarkSent: (formData: FormData) => Promise<void>;
  onRemind: (formData: FormData) => Promise<void>;
}) {
  // Guests who still need their link, in the order they were imported.
  const [pending, setPending] = useState<SendGuest[]>(() => guests.filter((guest) => !guest.sent));
  const [index, setIndex] = useState(0);
  const [isPending, startTransition] = useTransition();

  const current = pending[index] ?? null;
  const total = guests.length;
  const sent = total - pending.length;

  const advance = () => setIndex((value) => Math.min(value + 1, pending.length));

  const markSent = () => {
    if (!current) return;
    const data = new FormData();
    data.set("guest_id", current.id);
    startTransition(async () => {
      await onMarkSent(data);
      setPending((list) => list.filter((guest) => guest.id !== current.id));
      setIndex((value) => Math.min(value, Math.max(pending.length - 2, 0)));
    });
  };

  if (total === 0) {
    return <p className="text-sm text-ink-muted">{labels.remaining}</p>;
  }

  return (
    <section className="mt-6 rounded-md border border-line p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-ink">{labels.title}</h2>
        <span className="text-xs text-ink-muted">
          {labels.progress.replace("{sent}", String(sent)).replace("{total}", String(total))}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">{labels.hint}</p>

      {current ? (
        <div className="mt-4 flex flex-col gap-3">
          <div className="rounded-md border border-line bg-ground-paper p-3">
            <p className="text-sm text-ink">{current.name}</p>
            <p className="text-xs text-ink-muted ltr-token" dir="ltr">
              {current.phone}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              className="inline-flex min-h-11 items-center rounded-md bg-ground-dark px-4 text-sm text-ink-inverse"
              href={current.link}
              target="_blank"
              rel="noreferrer noopener"
            >
              {labels.openWhatsapp}
            </a>
            <Button type="button" variant="secondary" onClick={markSent} disabled={isPending}>
              {labels.markSent}
            </Button>
            <Button type="button" variant="quiet" onClick={advance}>
              {labels.skip}
            </Button>
          </div>

          {/* The reminder is a separate form because it sends a different message. */}
          <form
            action={onRemind}
            className="flex flex-wrap items-center gap-2 border-t border-line pt-3"
          >
            <input type="hidden" name="guest_id" value={current.id} />
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              {labels.purpose}
              <select
                name="purpose"
                defaultValue={current.answered ? "beforeEvent" : "reminder"}
                className="min-h-9 rounded-md border border-line bg-ground-paper px-2 text-xs text-ink"
              >
                <option value="reminder">{labels.purposes.reminder}</option>
                <option value="beforeEvent">{labels.purposes.beforeEvent}</option>
                <option value="afterEvent">{labels.purposes.afterEvent}</option>
              </select>
            </label>
            <button
              type="submit"
              className="min-h-9 rounded-md border border-line px-3 text-xs text-ink"
            >
              {labels.next}
            </button>
          </form>
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">{labels.allSent}</p>
      )}
    </section>
  );
}