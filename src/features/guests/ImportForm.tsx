"use client";

import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Card, StatePanel } from "@/components/ui/Card";
import { type ImportDone, type ImportPreview, previewGuestImport } from "./actions";

/**
 * The paste-and-preview form.
 *
 * A client component because the preview is the point: the operator pastes a list, sees exactly
 * which rows could be read and which could not, and only then commits. Doing that without client
 * state would mean either writing rows before the operator has seen them, or round-tripping the
 * pasted text through a URL.
 */
/**
 * Every label is a plain string, and the three that need a number carry a `{count}` placeholder
 * that this component fills in.
 *
 * The first version passed ready-made functions (`(n) => t("imported", { count: n })`). React
 * cannot serialise a function across the server/client boundary, so the whole event page threw
 * — "Functions cannot be passed directly to Client Components" — and the console showed a server
 * error. Translating on the server and filling in the number here keeps the strings in the message
 * catalogues and the boundary serialisable.
 */
interface Props {
  eventId: string;
  locale: string;
  labels: {
    title: string;
    hint: string;
    placeholder: string;
    preview: string;
    commit: string;
    imported: string;
    rejected: string;
    duplicates: string;
    line: string;
    ready: string;
    willSkip: string;
  };
}

function fill(template: string, count: number): string {
  return template.replaceAll("{count}", String(count));
}

/** A submit button that knows whether the form is in flight. `useFormStatus` must be inside it. */
function SubmitButton({ label, mode }: { label: string; mode: "preview" | "commit" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="mode" value={mode} disabled={pending}>
      {pending ? "…" : label}
    </Button>
  );
}

export function ImportForm({ eventId, locale, labels }: Props) {
  const [state, formAction] = useFormState(previewGuestImport, null);

  return (
    <Card>
      <h3 className="text-sm font-medium text-ink">{labels.title}</h3>
      <p className="mt-1 text-xs text-ink-muted">{labels.hint}</p>

      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="locale" value={locale} />

        <textarea
          name="list"
          rows={7}
          dir="auto"
          className="w-full rounded-md border border-line bg-ground-paper p-3 font-mono text-sm text-ink"
          placeholder={labels.placeholder}
          defaultValue={state && state.status !== "error" && "text" in state ? state.text : ""}
        />

        <div className="flex flex-wrap gap-2">
          <SubmitButton label={labels.preview} mode="preview" />
          {state?.status === "preview" && state.guests.length > 0 ? (
            <SubmitButton label={labels.commit} mode="commit" />
          ) : null}
        </div>
      </form>

      {state?.status === "error" ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      {state?.status === "done" ? (
        <div className="mt-3">
          <StatePanel kind="success" message={fill(labels.imported, state.inserted)} />
        </div>
      ) : null}

      {state?.status === "preview" ? (
        <div className="mt-4 flex flex-col gap-2 text-sm">
          <p className="text-ink">
            {fill(labels.ready, state.guests.length)}
            {state.rejected.length > 0 ? ` · ${fill(labels.willSkip, state.rejected.length)}` : ""}
          </p>

          {state.rejected.length > 0 ? (
            <div>
              <h4 className="text-xs font-medium text-ink-muted">{labels.rejected}</h4>
              <ul className="mt-1 flex flex-col gap-0.5">
                {state.rejected.map((row) => (
                  <li key={`${row.line}-${row.reason}`} className="text-xs text-danger">
                    {labels.line} {row.line}: {row.reason} — <span className="ltr-token">{row.raw}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {state.duplicates.length > 0 ? (
            <div>
              <h4 className="text-xs font-medium text-ink-muted">{labels.duplicates}</h4>
              <ul className="mt-1 flex flex-col gap-0.5">
                {state.duplicates.map((row) => (
                  <li key={`${row.line}-${row.phone}`} className="text-xs text-ink-muted">
                    {labels.line} {row.line}: <span className="ltr-token">{row.phone}</span> ({row.firstLine})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
