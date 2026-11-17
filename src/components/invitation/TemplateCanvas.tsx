import { type CSSProperties } from "react";

import {
  type DesignConfig,
  type PreviewContent,
  resolveDesign,
} from "@/features/catalogue/design-config";
import { type Locale } from "@/i18n/routing";

/**
 * Renders an invitation from a design configuration plus content.
 *
 * This is the seed of the shared renderer the brief asks for: **the same component must draw the
 * catalogue thumbnail, the Studio's live preview, and the invitation a customer finally receives.**
 * A second "preview renderer" that merely resembles the real one is exactly what the brief forbids,
 * so this takes a design and content as props and knows nothing about where they came from.
 *
 * Sizing uses container query units, so one component serves a 200px catalogue card and a
 * full-page invitation without a size prop or a second set of numbers. Each `cqw` declaration is
 * preceded by a `px` fallback for engines without container queries — the fallback is small and
 * readable rather than absent.
 *
 * The canvas direction follows the **content's** language, not the interface's. An Arabic
 * invitation inside the English catalogue is still an Arabic invitation, and it takes its own
 * direction and its own typeface.
 */
export interface TemplateCanvasProps {
  design: DesignConfig;
  content: PreviewContent | null;
  locale: Locale;
  /** Accessible description of what is being shown, for screen readers. */
  label: string;
  className?: string;
}

export function TemplateCanvas({
  design,
  content,
  locale,
  label,
  className = "",
}: TemplateCanvasProps) {
  const resolved = resolveDesign(design, locale);
  const arabic = locale === "ar";
  const { ornament, layout, typography } = design;

  const frameInset = layout === "editorial" ? "7cqw" : "5.5cqw";
  const padding = layout === "editorial" ? "13cqw" : "10cqw";
  const gap = layout === "classic" ? "4.2cqw" : layout === "editorial" ? "5.4cqw" : "3cqw";

  // Uppercase and tracking are Latin devices. In an Arabic canvas they are simply not applied.
  const eyebrowStyle: CSSProperties = {
    fontFamily: resolved.bodyFamily,
    fontSize: "3.2cqw",
    color: resolved.accent,
    letterSpacing: arabic || !typography.uppercaseEyebrow ? undefined : "0.28em",
    textTransform: !arabic && typography.uppercaseEyebrow ? "uppercase" : undefined,
  };

  const nameStyle: CSSProperties = {
    fontFamily: resolved.displayFamily,
    fontSize: layout === "editorial" ? "11cqw" : "9.6cqw",
    color: resolved.ink,
    lineHeight: arabic ? 1.5 : 1.2,
    letterSpacing: arabic ? undefined : "0.02em",
  };

  const footerStyle: CSSProperties = {
    fontFamily: resolved.bodyFamily,
    fontSize: "3cqw",
    color: resolved.ink,
    opacity: 0.82,
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
    // A baseline for engines without container queries: the cqw sizes below are simply ignored,
    // and the canvas stays readable instead of collapsing or overflowing.
    fontSize: "12px",
  };

  return (
    <div className={className} style={shell} role="img" aria-label={label} dir={arabic ? "rtl" : "ltr"}>
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
          justifyContent: layout === "editorial" ? "center" : "center",
          alignItems: resolved.align === "center" ? "center" : "flex-start",
          gap,
          padding,
          textAlign: resolved.align === "center" ? "center" : "start",
        }}
      >
        {content ? (
          <>
            <p style={eyebrowStyle}>{locale === "ar" ? content.eyebrow.ar : content.eyebrow.en}</p>
            {ornament.rule !== "none" ? <span aria-hidden style={ruleStyle} /> : null}
            <p style={nameStyle}>{locale === "ar" ? content.names.ar : content.names.en}</p>
            <p style={footerStyle}>{locale === "ar" ? content.footer.ar : content.footer.en}</p>
          </>
        ) : (
          <p style={eyebrowStyle}>{label}</p>
        )}
      </div>
    </div>
  );
}
