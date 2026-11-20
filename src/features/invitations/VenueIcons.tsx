import { type CSSProperties } from "react";

/**
 * The two hall icons.
 *
 * Drawn rather than illustrated: a single weight of gold line, no fills, no emoji, no raster. What
 * makes them read as luxury is the same thing that makes the invitations read that way — restraint,
 * symmetry, and a curve that is actually a curve.
 *
 * The variant comes from the template. A design already decides whether it is Moorish, geometric or
 * bare (`design.layout` and `design.ornament` in the configuration), and an icon in a different
 * idiom than the card above it is the sort of mismatch a guest cannot name but can see. Four variants
 * plus a default, chosen by `iconVariantFor()`.
 *
 * Both icons are drawn in a 96×120 box so they sit at the same optical size, and every stroke is
 * `currentColor` so the accent comes from the design rather than from here.
 */

export type IconVariant = "moorish" | "deco" | "floral" | "minimal";
export type HallIcon = "women" | "men" | "shared";

/**
 * The variant a design implies.
 *
 * `layout` is the coarse answer and `ornament.frame` the fine one: a double frame is a formal,
 * geometric design; a hairline frame with a short rule is the classical one; no frame at all is the
 * minimal one. Anything unrecognised gets the classical default, which is the safest of the four.
 */
export function iconVariantFor(design: { layout?: string; ornament?: { frame?: string } } | null | undefined): IconVariant {
  const frame = design?.ornament?.frame;
  const layout = design?.layout;
  if (frame === "double" || layout === "deco") return "deco";
  if (frame === "none" && layout === "editorial") return "minimal";
  if (layout === "stacked") return "floral";
  if (frame === "hairline") return "moorish";
  return "moorish";
}

function Arch({ variant }: { variant: IconVariant }) {
  // One path per idiom, all the same height and width so the two icons never disagree about scale.
  if (variant === "deco") {
    // A stepped arch with a sunburst crown.
    return (
      <>
        <path d="M18 108V56l10-8V38l10-7V20h12L60 14l10 6v11l10 7v10l10 8v52" />
        <path d="M60 14v10M44 20l6 8M76 20l-6 8" strokeWidth="1.1" />
      </>
    );
  }
  if (variant === "minimal") {
    return <path d="M20 108V54a40 40 0 0 1 80 0v54" />;
  }
  if (variant === "floral") {
    // The classical arch, with leaves turning out of its shoulders.
    return (
      <>
        <path d="M20 108V58a40 40 0 0 1 80 0v50" />
        <path d="M20 58c-6-2-10-7-11-13 6 0 11 3 14 8" strokeWidth="1.1" />
        <path d="M100 58c6-2 10-7 11-13-6 0-11 3-14 8" strokeWidth="1.1" />
      </>
    );
  }
  // Moorish: a horseshoe arch, whose widest point is above the springing line.
  return (
    <>
      <path d="M22 108V62c0-22 17-38 38-38s38 16 38 38v46" />
      <path d="M26 74h68" strokeWidth="1.1" />
    </>
  );
}

/** The rose in the women's window: a lotus seen from above, four petals and a heart. */
function Rose() {
  return (
    <g strokeWidth="1.2">
      <path d="M60 74c-7 0-13 5-13 11s6 11 13 11 13-5 13-11-6-11-13-11z" />
      <path d="M60 74c3-6 8-9 13-9-1 6-5 10-10 12" />
      <path d="M60 74c-3-6-8-9-13-9 1 6 5 10 10 12" />
      <path d="M60 96v11" />
    </g>
  );
}

/** The crescent and its small star, above the women's arch. */
function Crescent() {
  return (
    <g strokeWidth="1.1">
      <path d="M60 24a11 11 0 0 0 0 22 13 13 0 0 1 0-22z" />
      <path d="M74 31l1.6 3.6 3.9.4-2.9 2.6.8 3.8-3.4-1.9-3.4 1.9.8-3.8-2.9-2.6 3.9-.4z" />
    </g>
  );
}

/** The dallah: body, neck, lid finial, spout and handle. Recognisably a coffee pot or it is nothing. */
function Dallah() {
  return (
    <g strokeWidth="1.2">
      {/* body */}
      <path d="M50 76h20l6 14-4 18H48l-4-18z" />
      {/* lid and finial */}
      <path d="M52 76l3-7h10l3 7" />
      <path d="M60 69v-6" />
      {/* spout */}
      <path d="M70 80l14-8-3-4-11 8" />
      {/* handle */}
      <path d="M50 82c-7 0-10 5-10 11s4 9 9 9" strokeWidth="1.1" />
    </g>
  );
}

/** The eight-point star, the men's mark. */
function EightPointStar() {
  return (
    <g strokeWidth="1.1">
      <path d="M60 20l4.2 8.4 9.4.8-6.9 6.5 1.9 9.3L60 40.6l-8.6 4.4 1.9-9.3-6.9-6.5 9.4-.8z" />
    </g>
  );
}

export function VenueIcon({
  kind,
  variant,
  className = "",
  style,
}: {
  kind: HallIcon;
  variant: IconVariant;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 120 130"
      className={className}
      style={{ color: "currentColor", ...(style ?? {}) }}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <Arch variant={variant} />
      {kind === "women" ? (
        <>
          <Crescent />
          <Rose />
          {/* The window's sill. */}
          <path d="M16 108h88" strokeWidth="1.8" />
        </>
      ) : kind === "men" ? (
        <>
          <EightPointStar />
          <Dallah />
          <path d="M16 108h88" strokeWidth="1.8" />
        </>
      ) : (
        <>
          {/* One shared venue: the arch and both marks, because it serves both. */}
          <EightPointStar />
          <Rose />
          <path d="M16 108h88" strokeWidth="1.8" />
        </>
      )}
    </svg>
  );
}
