"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import { DesignConfigSchema, type DesignConfig } from "@/features/catalogue/design-config";

import { InvitationContentSchema, type InvitationContent } from "./content";
import { DraftConflictError, loadDraft, saveDraft, type DraftRecord } from "./drafts";

/**
 * Server actions for the Studio.
 *
 * Two rules hold here that the browser cannot be trusted with:
 *
 *   1. **The draft token is issued by the server.** It is a 128-bit uuid written to an httpOnly
 *      cookie and never accepted from the client. If the browser could choose its token, it could
 *      choose somebody else's.
 *   2. **Content is validated again on the server.** The editor validates so the customer sees
 *      which field is wrong; this validates so a hand-rolled request cannot store nonsense. The
 *      client-side check is a courtesy, not a control.
 */

const DRAFT_COOKIE = "velora_draft";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readToken(): string | null {
  const value = cookies().get(DRAFT_COOKIE)?.value;
  return value && UUID.test(value) ? value : null;
}

function issueToken(): string {
  const token = randomUUID();
  cookies().set(DRAFT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return token;
}

export interface DraftPayload {
  id: string;
  templateSlug: string;
  locale: "ar" | "en";
  content: InvitationContent;
  design: DesignConfig;
  revision: number;
  updatedAt: string;
}

/** Returns the draft this browser already owns, or null. Never creates one. */
export async function loadCurrentDraft(): Promise<DraftRecord | null> {
  const token = readToken();
  if (!token) return null;
  return loadDraft(token);
}

export type SaveOutcome =
  | { ok: true; revision: number; savedAt: string; snapshot: boolean }
  | { ok: false; conflict: boolean; message: string };

export interface SaveRequest {
  templateId: string;
  locale: "ar" | "en";
  content: unknown;
  design: unknown;
  expectedRevision: number | null;
  snapshot: boolean;
}

export async function saveCurrentDraft(request: SaveRequest): Promise<SaveOutcome> {
  // Validated here rather than trusted. The editor's own validation exists so the customer sees
  // the problem immediately; this exists so nobody can store a shape the renderer cannot draw.
  const content = InvitationContentSchema.safeParse(request.content);
  if (!content.success) {
    return {
      ok: false,
      conflict: false,
      message: `the invitation content is not valid: ${content.error.issues[0]?.message ?? "unknown"}`,
    };
  }

  const design = DesignConfigSchema.safeParse(request.design);
  if (!design.success) {
    return {
      ok: false,
      conflict: false,
      message: `the design configuration is not valid: ${design.error.issues[0]?.message ?? "unknown"}`,
    };
  }

  const token = readToken() ?? issueToken();

  try {
    const result = await saveDraft({
      token,
      templateId: request.templateId,
      locale: request.locale,
      content: content.data,
      designConfig: design.data,
      expectedRevision: request.expectedRevision,
      snapshot: request.snapshot,
    });
    return { ok: true, revision: result.revision, savedAt: result.updatedAt, snapshot: request.snapshot };
  } catch (error) {
    if (error instanceof DraftConflictError) {
      return {
        ok: false,
        conflict: true,
        message:
          "This invitation was changed somewhere else since it was opened. Reload to see the newer version.",
      };
    }
    return {
      ok: false,
      conflict: false,
      message: error instanceof Error ? error.message : "Saving failed.",
    };
  }
}
