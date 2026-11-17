import { type DesignConfig } from "@/features/catalogue/design-config";
import {
  type InvitationContent,
  type FieldIssue,
  validateContent,
} from "@/features/studio/content";

/**
 * The editor's state machine.
 *
 * A reducer rather than a state library, because the editor's state is one document plus a
 * pointer — that is a reducer, not a framework. Everything the brief asks for that touches
 * history lives here, so undo, redo, autosave-dirtiness and validation cannot disagree with each
 * other: they are all derived from the same transition.
 *
 * **Coalescing** is the detail that makes undo usable. A customer typing a name produces one
 * history entry, not one per keystroke: consecutive edits that share a key replace the present
 * without pushing. Any other action ends the run.
 */

export interface EditorSnapshot {
  content: InvitationContent;
  design: DesignConfig;
}

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error" | "conflict";

export interface EditorState {
  present: EditorSnapshot;
  past: EditorSnapshot[];
  future: EditorSnapshot[];
  /** Which control the properties panel is showing. */
  selection: PanelSelection;
  /** Non-null while a run of edits is being coalesced into one history entry. */
  coalesceKey: string | null;
  revision: number;
  status: SaveStatus;
  lastSavedAt: string | null;
  error: string | null;
  issues: FieldIssue[];
}

export type PanelSelection =
  | "invitation"
  | "couple"
  | "when"
  | "where"
  | "message"
  | "verse"
  | "palette"
  | "typography"
  | "ornament"
  | "layout";

export type EditorAction =
  | { type: "editContent"; field: keyof InvitationContent; value: string | string[] }
  | { type: "editDesign"; patch: DesignPatch }
  | { type: "select"; selection: PanelSelection }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "resetDesign"; design: DesignConfig }
  | { type: "replace"; snapshot: EditorSnapshot; revision: number; status?: SaveStatus }
  | { type: "saveStarted" }
  | { type: "saveSucceeded"; revision: number; at: string }
  | { type: "saveFailed"; message: string; conflict: boolean };

/** A partial design change, deep enough for the nested groups the configuration has. */
export interface DesignPatch {
  palette?: Partial<DesignConfig["palette"]>;
  typography?: Partial<DesignConfig["typography"]>;
  ornament?: Partial<DesignConfig["ornament"]>;
  layout?: DesignConfig["layout"];
  canvas?: Partial<DesignConfig["canvas"]>;
}

const HISTORY_LIMIT = 60;

export function initialEditorState(snapshot: EditorSnapshot, revision = 0): EditorState {
  return {
    present: snapshot,
    past: [],
    future: [],
    selection: "invitation",
    coalesceKey: null,
    revision,
    status: "idle",
    lastSavedAt: null,
    error: null,
    issues: validateContent(snapshot.content),
  };
}

function applyPatch(design: DesignConfig, patch: DesignPatch): DesignConfig {
  return {
    ...design,
    ...(patch.canvas ? { canvas: { ...design.canvas, ...patch.canvas } } : {}),
    ...(patch.palette ? { palette: { ...design.palette, ...patch.palette } } : {}),
    ...(patch.typography ? { typography: { ...design.typography, ...patch.typography } } : {}),
    ...(patch.ornament ? { ornament: { ...design.ornament, ...patch.ornament } } : {}),
    ...(patch.layout ? { layout: patch.layout } : {}),
  };
}

/** Pushes the current present onto the history, unless this edit continues the previous run. */
function withHistory(
  state: EditorState,
  next: EditorSnapshot,
  coalesceKey: string | null,
): Pick<EditorState, "present" | "past" | "future" | "coalesceKey"> {
  const continues = coalesceKey !== null && state.coalesceKey === coalesceKey;
  const past = continues ? state.past : [...state.past, state.present].slice(-HISTORY_LIMIT);
  return { present: next, past, future: continues ? state.future : [], coalesceKey };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "editContent": {
      const content = { ...state.present.content, [action.field]: action.value } as InvitationContent;
      const next: EditorSnapshot = { ...state.present, content };
      return {
        ...state,
        ...withHistory(state, next, `content:${action.field}`),
        status: "pending",
        issues: validateContent(content),
      };
    }

    case "editDesign": {
      const design = applyPatch(state.present.design, action.patch);
      const next: EditorSnapshot = { ...state.present, design };
      // The patch's own shape is the coalescing key, so dragging a slider is one undo step while
      // changing a different control starts a new one.
      const key = `design:${Object.keys(action.patch).sort().join(",")}:${JSON.stringify(action.patch)}`;
      return {
        ...state,
        ...withHistory(state, next, key),
        status: "pending",
      };
    }

    case "select":
      return { ...state, selection: action.selection, coalesceKey: null };

    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1] as EditorSnapshot;
      return {
        ...state,
        present: previous,
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future].slice(0, HISTORY_LIMIT),
        coalesceKey: null,
        status: "pending",
        issues: validateContent(previous.content),
      };
    }

    case "redo": {
      if (state.future.length === 0) return state;
      const next = state.future[0] as EditorSnapshot;
      return {
        ...state,
        present: next,
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        coalesceKey: null,
        status: "pending",
        issues: validateContent(next.content),
      };
    }

    case "resetDesign":
      // Destructive, but undoable: the previous design is on the history stack immediately.
      return {
        ...state,
        ...withHistory(state, { ...state.present, design: action.design }, null),
        status: "pending",
      };

    case "replace":
      return initialEditorState(action.snapshot, action.revision);

    case "saveStarted":
      return { ...state, status: "saving", error: null };

    case "saveSucceeded":
      return {
        ...state,
        status: "saved",
        revision: action.revision,
        lastSavedAt: action.at,
        error: null,
      };

    case "saveFailed":
      return {
        ...state,
        status: action.conflict ? "conflict" : "error",
        error: action.message,
      };

    default:
      return state;
  }
}

export const canUndo = (state: EditorState): boolean => state.past.length > 0;
export const canRedo = (state: EditorState): boolean => state.future.length > 0;

/** True when there is unsaved work — what the autosave effect watches. */
export const isDirty = (state: EditorState): boolean =>
  state.status === "pending" || state.status === "error" || state.status === "conflict";
