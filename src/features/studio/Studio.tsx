"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useReducer, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { TemplateCanvas, type BlockKey } from "@/components/invitation/TemplateCanvas";
import { Button } from "@/components/ui/Button";
import { type DesignConfig } from "@/features/catalogue/design-config";
import { saveCurrentDraft, type SaveOutcome } from "@/features/studio/actions";
import { blocksFromContent, type InvitationBlocks } from "@/features/studio/blocks";
import {
  type InvitationContent,
  type FieldIssue,
  isComplete,
} from "@/features/studio/content";
import {
  type DesignPatch,
  type PanelSelection,
  canRedo,
  canUndo,
  editorReducer,
  initialEditorState,
  isDirty,
} from "@/features/studio/editor-state";
import { type Locale } from "@/i18n/routing";

/**
 * The Wedding Studio.
 *
 * Three areas, as the brief describes: controls on one side, the invitation in the middle,
 * properties for whatever is selected on the other. The canvas is the **shared renderer** — the
 * same component the catalogue uses — so what the customer sees here is what they will get.
 *
 * Two behaviours are worth pointing at:
 *
 *   * **Undo coalesces a run of typing into one step.** The reducer decides this, not the UI, so
 *     the button, the keyboard shortcut and the history all agree by construction.
 *   * **Autosave and the explicit save write differently.** An autosave updates the draft; only an
 *     explicit save writes a version. That is why the page can say what "saved" means.
 */

const AUTOSAVE_DELAY_MS = 1600;

export interface StudioProps {
  templateId: string;
  templateSlug: string;
  templateName: string;
  locale: Locale;
  initialContent: InvitationContent;
  initialDesign: DesignConfig;
  initialRevision: number;
  initialSavedAt: string | null;
}

export function Studio({
  templateId,
  templateSlug,
  templateName,
  locale,
  initialContent,
  initialDesign,
  initialRevision,
  initialSavedAt,
}: StudioProps) {
  const t = useTranslations("editor");

  const [state, dispatch] = useReducer(
    editorReducer,
    { content: initialContent, design: initialDesign },
    (snapshot) => initialEditorState(snapshot, initialRevision),
  );
  const [zoom, setZoom] = useState(100);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [isPending, startTransition] = useTransition();

  // The snapshot the server last confirmed, so autosave can tell "still dirty" from "already saved".
  const savedRef = useRef(JSON.stringify({ content: initialContent, design: initialDesign }));
  const revisionRef = useRef(initialRevision);
  const lastSavedAt = useRef<string | null>(initialSavedAt);

  const blocks: InvitationBlocks = useMemo(
    () => blocksFromContent(state.present.content, locale),
    [state.present.content, locale],
  );

  const issues = state.issues;
  const complete = isComplete(state.present.content);

  const persist = useCallback(
    async (snapshot: boolean) => {
      const payload = JSON.stringify(state.present);
      dispatch({ type: "saveStarted" });
      let outcome: SaveOutcome;
      try {
        outcome = await saveCurrentDraft({
          templateId,
          locale,
          content: state.present.content,
          design: state.present.design,
          expectedRevision: revisionRef.current,
          snapshot,
        });
      } catch (error) {
        dispatch({
          type: "saveFailed",
          conflict: false,
          message: error instanceof Error ? error.message : "Saving failed.",
        });
        return;
      }

      if (!outcome.ok) {
        dispatch({ type: "saveFailed", conflict: outcome.conflict, message: outcome.message });
        return;
      }

      savedRef.current = payload;
      revisionRef.current = outcome.revision;
      lastSavedAt.current = outcome.savedAt;
      dispatch({ type: "saveSucceeded", revision: outcome.revision, at: outcome.savedAt });
    },
    [locale, state.present, templateId],
  );

  // Autosave: a debounce, so a customer typing a name writes once rather than once per letter.
  useEffect(() => {
    if (!isDirty(state)) return;
    if (JSON.stringify(state.present) === savedRef.current) return;

    const timer = setTimeout(() => {
      startTransition(() => {
        void persist(false);
      });
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state, persist]);

  // Undo and redo on the keyboard, as any editor is expected to behave.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        dispatch({ type: "undo" });
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
      } else if (key === "s") {
        event.preventDefault();
        void persist(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [persist]);

  // Leaving with unsaved work is the one thing a customer cannot undo.
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty(state)) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [state]);

  const selection = state.selection;
  const highlight = selectionBlock(selection);

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 py-8 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="text-3xl text-ink">{t("title")}</h1>
          <p className="text-sm text-ink-muted">
            {templateName} · <span className="ltr-token">{templateSlug}</span>
          </p>
        </div>
        <SaveIndicator
          status={state.status}
          savedAt={lastSavedAt.current}
          error={state.error}
          pending={isPending}
          onSave={() => void persist(true)}
          onRetry={() => void persist(true)}
        />
      </header>

      {!complete ? (
        <div
          role="status"
          className="rounded-md border border-warning bg-warning-ground px-4 py-3 text-sm text-warning"
        >
          {t("incomplete", {
            count: issues.length,
            countText: new Intl.NumberFormat("en-BH", { numberingSystem: "latn" }).format(
              issues.length,
            ),
          })}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)_340px]">
        <aside className="order-2 flex flex-col gap-4 lg:order-none" aria-label={t("panels.controls")}>
          <DesignControls
            design={state.present.design}
            selection={selection}
            onSelect={(next) => dispatch({ type: "select", selection: next })}
            onChange={(patch) => dispatch({ type: "editDesign", patch })}
            onResetRequest={() => setConfirmingReset(true)}
          />
          {confirmingReset ? (
            <div
              role="alertdialog"
              aria-label={t("design.resetTitle")}
              className="flex flex-col gap-3 rounded-md border border-danger bg-danger-ground p-4 text-sm text-danger"
            >
              <p>{t("design.resetBody")}</p>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  onClick={() => {
                    dispatch({ type: "resetDesign", design: initialDesign });
                    setConfirmingReset(false);
                  }}
                >
                  {t("design.resetConfirm")}
                </Button>
                <Button variant="secondary" onClick={() => setConfirmingReset(false)}>
                  {t("cancel")}
                </Button>
              </div>
            </div>
          ) : null}
        </aside>

        <section
          className="order-1 flex flex-col gap-3 lg:order-none"
          aria-label={t("panels.canvas")}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => dispatch({ type: "undo" })}
                disabled={!canUndo(state)}
              >
                {t("undo")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => dispatch({ type: "redo" })}
                disabled={!canRedo(state)}
              >
                {t("redo")}
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              {t("zoom")}
              <input
                type="range"
                min={50}
                max={140}
                step={5}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="w-32"
              />
              <span className="ltr-token tabular-nums">{zoom}%</span>
            </label>
          </div>

          <div className="flex justify-center rounded-lg border border-line bg-ground-recipe p-4">
            <div style={{ width: `${zoom}%`, maxWidth: 560 }}>
              <div className="overflow-hidden rounded-md border border-line shadow-sm">
                <TemplateCanvas
                  design={state.present.design}
                  blocks={blocks}
                  locale={locale}
                  label={t("canvasLabel")}
                  highlight={highlight}
                />
              </div>
            </div>
          </div>
        </section>

        <aside
          className="order-3 flex flex-col gap-4 lg:order-none"
          aria-label={t("panels.properties")}
        >
          <PropertiesPanel
            selection={selection}
            content={state.present.content}
            issues={issues}
            onEdit={(field, value) => dispatch({ type: "editContent", field, value })}
            onSelect={(next) => dispatch({ type: "select", selection: next })}
          />
        </aside>
      </div>
    </div>
  );
}

/** Which block the canvas should outline for the current selection. */
function selectionBlock(selection: PanelSelection): BlockKey | null {
  switch (selection) {
    case "couple":
      return "names";
    case "when":
    case "where":
      return "details";
    case "message":
      return "message";
    case "verse":
      return "verse";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Save status
// ---------------------------------------------------------------------------

function SaveIndicator({
  status,
  savedAt,
  error,
  pending,
  onSave,
  onRetry,
}: {
  status: string;
  savedAt: string | null;
  error: string | null;
  pending: boolean;
  onSave: () => void;
  onRetry: () => void;
}) {
  const t = useTranslations("editor");
  const failed = status === "error" || status === "conflict";

  const label =
    status === "saving"
      ? t("save.saving")
      : status === "pending"
        ? t("save.unsaved")
        : failed
          ? t("save.failed")
          : savedAt
            ? t("save.savedAt", { time: formatTime(savedAt) })
            : t("save.notYetSaved");

  return (
    <div className="flex flex-col items-end gap-2" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className={`text-sm ${failed ? "text-danger" : "text-ink-muted"}`}>{label}</span>
        <Button variant={failed ? "danger" : "primary"} onClick={failed ? onRetry : onSave} disabled={pending}>
          {failed ? t("save.retry") : t("save.saveNow")}
        </Button>
      </div>
      {error ? <p className="max-w-sm text-xs text-danger">{error}</p> : null}
    </div>
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bahrain",
    numberingSystem: "latn",
  }).format(date);
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

function DesignControls({
  design,
  selection,
  onSelect,
  onChange,
  onResetRequest,
}: {
  design: DesignConfig;
  selection: PanelSelection;
  onSelect: (selection: PanelSelection) => void;
  onChange: (patch: DesignPatch) => void;
  onResetRequest: () => void;
}) {
  const t = useTranslations("editor");

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-ground-paper p-4">
      <p className="eyebrow">{t("panels.controls")}</p>

      <ControlRow label={t("design.palette")} active={selection === "palette"} onSelect={() => onSelect("palette")}>
        <div className="flex gap-2">
          {(["ground", "ink", "accent"] as const).map((slot) => (
            <span
              key={slot}
              title={t(`design.${slot}`)}
              className="h-6 w-6 rounded-sm border border-line"
              style={{ backgroundColor: design.palette[slot] }}
            />
          ))}
        </div>
      </ControlRow>

      <ControlRow label={t("design.typography")} active={selection === "typography"} onSelect={() => onSelect("typography")}>
        <span className="ltr-token text-xs text-ink-muted">
          {design.typography.align} · {design.typography.displayArab}
        </span>
      </ControlRow>

      <ControlRow label={t("design.ornament")} active={selection === "ornament"} onSelect={() => onSelect("ornament")}>
        <span className="ltr-token text-xs text-ink-muted">
          {design.ornament.frame} · {design.ornament.rule}
        </span>
      </ControlRow>

      <ControlRow label={t("design.layout")} active={selection === "layout"} onSelect={() => onSelect("layout")}>
        <div className="flex flex-wrap gap-1">
          {(["classic", "editorial", "stacked"] as const).map((layout) => (
            <button
              key={layout}
              type="button"
              onClick={() => onChange({ layout })}
              className={`rounded-sm border px-2 py-0.5 text-xs ${
                design.layout === layout
                  ? "border-gold-deep text-gold-deep"
                  : "border-line text-ink-muted"
              }`}
            >
              {t(`layouts.${layout}`)}
            </button>
          ))}
        </div>
      </ControlRow>

      <Button variant="quiet" onClick={onResetRequest}>
        {t("design.reset")}
      </Button>
    </div>
  );
}

function ControlRow({
  label,
  active,
  onSelect,
  children,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1 rounded-md p-2 ${active ? "bg-ground-recipe" : ""}`}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className="text-start text-sm font-medium text-ink"
      >
        {label}
      </button>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

function PropertiesPanel({
  selection,
  content,
  issues,
  onEdit,
  onSelect,
}: {
  selection: PanelSelection;
  content: InvitationContent;
  issues: FieldIssue[];
  onEdit: (field: keyof InvitationContent, value: string | string[]) => void;
  onSelect: (selection: PanelSelection) => void;
}) {
  const t = useTranslations("editor");

  const sections: { key: PanelSelection; label: string }[] = [
    { key: "couple", label: t("sections.couple") },
    { key: "when", label: t("sections.when") },
    { key: "where", label: t("sections.where") },
    { key: "message", label: t("sections.message") },
    { key: "verse", label: t("sections.verse") },
  ];

  const field = (name: keyof InvitationContent, type = "text") => {
    const issue = issues.find((entry) => entry.field === name);
    return (
      <Field
        key={name}
        label={t(`fields.${name}`)}
        value={String(content[name] ?? "")}
        type={type}
        error={issue ? t(`issues.${issue.reason}`) : undefined}
        onChange={(value) => onEdit(name, value)}
      />
    );
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-ground-paper p-4">
      <p className="eyebrow">{t("panels.properties")}</p>

      <nav className="flex flex-wrap gap-1">
        {sections.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => onSelect(section.key)}
            aria-pressed={selection === section.key}
            className={`rounded-sm border px-2 py-0.5 text-xs ${
              selection === section.key ? "border-gold-deep text-gold-deep" : "border-line text-ink-muted"
            }`}
          >
            {section.label}
          </button>
        ))}
      </nav>

      <div className="flex flex-col gap-3">
        {selection === "couple" ? (
          <>
            {field("brideName")}
            {field("groomName")}
          </>
        ) : null}
        {selection === "when" ? (
          <>
            {field("weddingDate", "date")}
            {field("hijriDate")}
            {field("weddingTime", "time")}
          </>
        ) : null}
        {selection === "where" ? (
          <>
            {field("venueName")}
            {field("venueAddress")}
            {field("mapUrl", "url")}
          </>
        ) : null}
        {selection === "message" ? <>{field("message")}</> : null}
        {selection === "verse" ? <>{field("verse")}</> : null}
        {selection === "invitation" ? (
          <p className="text-sm text-ink-muted">{t("pickSection")}</p>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        type={type}
        dir="auto"
        value={value}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`min-h-10 rounded-md border bg-ground px-3 py-2 text-sm text-ink ${
          error ? "border-danger" : "border-line"
        }`}
      />
      {error ? (
        <span role="alert" className="text-xs font-medium text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}
