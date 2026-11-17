import { type DesignConfig } from "@/features/catalogue/design-config";
import { type InvitationContent } from "@/features/studio/content";
import { getLocalDatabase, getSupabaseClient, dataSourceKind } from "@/lib/data-source";
import { type Locale } from "@/i18n/routing";

/**
 * Reading and writing a draft.
 *
 * Same shape as the catalogue: the work happens in a SQL function, and only the transport differs
 * between a local PostgreSQL and Supabase. The token is the capability — it is generated
 * server-side and never accepted from the browser.
 */

export interface DraftRecord {
  id: string;
  templateId: string;
  templateSlug: string;
  locale: Locale;
  content: unknown;
  designConfig: unknown;
  revision: number;
  updatedAt: string;
}

export interface SaveDraftInput {
  token: string;
  templateId: string;
  locale: Locale;
  content: InvitationContent;
  designConfig: DesignConfig;
  /** The revision the editor last read. A mismatch is refused rather than overwritten. */
  expectedRevision: number | null;
  /** True for an explicit save, which also writes a version. Autosaves do not. */
  snapshot: boolean;
}

export interface SaveDraftResult {
  id: string;
  revision: number;
  updatedAt: string;
}

export class DraftConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftConflictError";
  }
}

function isConflict(message: string): boolean {
  return message.includes("changed since it was last read");
}

export async function loadDraft(token: string): Promise<DraftRecord | null> {
  if (dataSourceKind() === "supabase") {
    const client = await getSupabaseClient();
    const { data, error } = await client.rpc("draft_load", { p_token: token });
    if (error) throw new Error(`draft_load failed: ${error.message}`);
    return toRecord(((data ?? []) as RawDraft[])[0]);
  }

  const db = await getLocalDatabase();
  const result = await db.query<RawDraft>("select * from public.draft_load($1)", [token]);
  return toRecord(result.rows[0]);
}

export async function saveDraft(input: SaveDraftInput): Promise<SaveDraftResult> {
  const params = {
    p_token: input.token,
    p_template_id: input.templateId,
    p_locale: input.locale,
    p_content: input.content,
    p_design_config: input.designConfig,
    p_expected_revision: input.expectedRevision,
    p_snapshot: input.snapshot,
  };

  if (dataSourceKind() === "supabase") {
    const client = await getSupabaseClient();
    const { data, error } = await client.rpc("draft_save", params);
    if (error) {
      if (isConflict(error.message)) throw new DraftConflictError(error.message);
      throw new Error(`draft_save failed: ${error.message}`);
    }
    const row = ((data ?? []) as RawSave[])[0];
    if (!row) throw new Error("draft_save returned nothing");
    return { id: row.id, revision: Number(row.revision), updatedAt: row.updated_at };
  }

  const db = await getLocalDatabase();
  try {
    const result = await db.query<RawSave>(
      "select * from public.draft_save($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)",
      [
        params.p_token,
        params.p_template_id,
        params.p_locale,
        JSON.stringify(params.p_content),
        JSON.stringify(params.p_design_config),
        params.p_expected_revision,
        params.p_snapshot,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error("draft_save returned nothing");
    return { id: row.id, revision: Number(row.revision), updatedAt: row.updated_at };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isConflict(message)) throw new DraftConflictError(message);
    throw error;
  }
}

interface RawDraft {
  id: string;
  template_id: string;
  template_slug: string;
  locale: string;
  content: unknown;
  design_config: unknown;
  revision: number | string;
  updated_at: string;
}

interface RawSave {
  id: string;
  revision: number | string;
  updated_at: string;
}

function toRecord(row: RawDraft | undefined): DraftRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    templateId: row.template_id,
    templateSlug: row.template_slug,
    locale: row.locale === "en" ? "en" : "ar",
    content: row.content,
    designConfig: row.design_config,
    revision: Number(row.revision),
    updatedAt: row.updated_at,
  };
}
