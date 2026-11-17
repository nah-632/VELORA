"use client";

import { type CSSProperties } from "react";

import { type DesignConfig, resolveDesign } from "@/features/catalogue/design-config";
import { type InvitationBlocks } from "@/features/studio/blocks";
import { type Locale } from "@/i18n/routing";

/**
 * Renders an invitation from a design configuration and a set of blocks.
 *
 * This is the **shared renderer** the brief insists on: the catalogue thumbnail, the Studio's live
 * preview and the invitation a customer finally receives are all this component. There is no
 * second "preview renderer" that merely resembles the real one, because that is how a preview
 * becomes a lie.
 *
 * It knows nothing about where the blocks came from — sample wording or a customer's own — only
 * that they are words to place. Content and design meet here and nowhere else.
 *
 * Sizing uses container query units, so one component serves a 200px catalogue card and a
 * full-page invitation without a size prop or a second set of numbers. A baseline font size sits
 * on the container, so an engine without container queries falls back to something readable
 * rather than to nothing.
 *
 * Client component because the Studio selects blocks inside it. It renders fine on the server too.
 */

export type BlockKey = "eyebrow" | "names" | "details" | "footer" | "message" | "verse" | "notes";

export interface TemplateCanvasProps {
  design: DesignConfig;
  blocks: InvitationBlocks;
  locale: Locale;
  /** Accessible description of what is being shown. */
  label: string;
  /** The block the properties panel is editing, outlined so the connection is visible. */
  highlight?: BlockKey | null;
  className?: string;
}

export function TemplateCanvas({
  design,
  blocks,
  locale,
  label,
  highlight = null,
  className = "",
}: TemplateCanvasProps) {
  const resolved = resolveDesign(design, locale);
  const arabic = locale === "ar";
  const { ornament, layout, typography } = design;

  const frameInset = layout === "editorial" ? "7cqw" : "5.5cqw";
  const padding = layout === "editorial" ? "13cqw" : "10cqw";
  const gap = layout === "classic" ? "4.2cqw" : layout === "editorial" ? "5.4cqw" : "3cqw";

  const alignment = resolved.align === "center" ? "center" : "start";

  function outline(key: BlockKey): CSSProperties | undefined {
    if (highlight !== key) return undefined;
    return {
      outline: `0.6cqw dashed ${resolved.accent}`,
      outlineOffset: "1cqw",
    };
  }

  // Uppercase and tracking are Latin devices. In an Arabic canvas they are simply not applied:
  // Arabic has no case, and letter-spacing breaks its joins.
  const eyebrowStyle: CSSProperties = {
    fontFamily: resolved.bodyFamily,
    fontSize: "3.2cqw",
    color: resolved.accent,
    letterSpacing: arabic || !typography.uppercaseEyebrow ? undefined : "0.28em",
    textTransform: !arabic && typography.uppercaseEyebrow ? "uppercase" : undefined,
    ...outline("eyebrow"),
  };

  const nameStyle: CSSProperties = {
    fontFamily: resolved.displayFamily,
    fontSize: layout === "editorial" ? "11cqw" : "9.6cqw",
    color: resolved.ink,
    lineHeight: arabic ? 1.5 : 1.2,
    letterSpacing: arabic ? undefined : "0.02em",
    ...outline("names"),
  };

  const detailStyle: CSSProperties = {
    fontFamily: resolved.bodyFamily,
    fontSize: "3.1cqw",
    color: resolved.ink,
    opacity: 0.88,
    lineHeight: 1.7,
    ...outline("details"),
  };

  const bodyStyle: CSSProperties = {
    fontFamily: resolved.bodyFamily,
    fontSize: "2.9cqw",
    color: resolved.ink,
    opacity: 0.8,
    lineHeight: 1.8,
    maxWidth: "78%",
    ...outline("message"),
  };

  const verseStyle: CSSProperties = {
    fontFamily: resolved.displayFamily,
    fontSize: "3.6cqw",
    color: resolved.ink,
    opacity: 0.92,
    lineHeight: 1.8,
    maxWidth: "82%",
    ...outline("verse"),
  };

  const footerStyle: CSSProperties = {
    fontFamily: resolved.bodyFamily,
    fontSize: "3cqw",
    color: resolved.ink,
    opacity: 0.82,
    ...outline("footer"),
  };

  const ruleStyle: CSSProperties = {
    backgroundColor: resolved.accent,
    height: "0.55cqw",
    width: ornament.rule === "short" ? "16%" : ornament.rule === "long" ? "52%" : "0%",
  };

  const shell: CSSProperties = {
    aspectRatio: resolved.aspect,
    backgroundColor: resolved.ground,
    containerType: "inline-size",
    position: "relative",
    overflow: "hidden",
    color: resolved.ink,
    fontSize: "12px",
  };

  return (
    <div
      className={className}
      style={shell}
      role="img"
      aria-label={label}
      dir={arabic ? "rtl" : "ltr"}
    >
      {ornament.frame !== "none" ? (
        <>
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: frameInset,
              border: `1px solid ${resolved.accent}`,
              opacity: ornament.frame === "double" ? 0.85 : 0.5,
            }}
          />
          {ornament.frame === "double" ? (
            <span
              aria-hidden
              style={{
                position: "absolute",
                inset: "7.4cqw",
                border: `1px solid ${resolved.accent}`,
                opacity: 0.45,
              }}
            />
          ) : null}
        </>
      ) : null}

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: alignment === "center" ? "center" : "flex-start",
          gap,
          padding,
          textAlign: alignment,
        }}
      >
        <p style={eyebrowStyle}>{blocks.eyebrow}</p>

        {ornament.rule !== "none" ? <span aria-hidden style={ruleStyle} /> : null}

        <p style={nameStyle}>{blocks.names}</p>

        {blocks.details.length > 0 ? (
          <ul style={{ ...detailStyle, listStyle: "none", margin: 0, padding: 0 }}>
            {blocks.details.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}

        {blocks.message ? <p style={bodyStyle}>{blocks.message}</p> : null}
        {blocks.verse ? <p style={verseStyle}>{blocks.verse}</p> : null}

        <p style={footerStyle}>{blocks.footer}</p>
      </div>
    </div>
  );
}
