/**
 * The VELORA mark, taken from the brand file — not redrawn.
 *
 * Both paths are copied byte-for-byte from `public/brand/monogram.svg`, which is generated from
 * `brand/monogram.mjs`. Nothing here edits, simplifies or re-draws the geometry: the only change is
 * that they are wrapped in a `<g>` so they can be placed and masked.
 *
 * **Why the reveal is a mask and not a stroke draw.** The brand mark is filled geometry — the file
 * contains no `stroke` attribute at all — so `stroke-dashoffset` cannot draw it without re-outlining
 * it, which would change how it looks. A mask edge sweeping across the *existing* paths animates the
 * paint and leaves every coordinate and fill exactly as the brand defines them. That is the least
 * invasive reveal available, and the reason this component exists rather than an inline <img>.
 */

/** The six-point silhouette, from public/brand/monogram.svg. */
export const BRAND_SILHOUETTE =
  "M4.16 7.21 L9.04 4.67 L16 18 L22.96 4.67 L27.84 7.21 L17.33 27.34 L14.67 27.34 Z";

/** The lit half, drawn over the silhouette. */
export const BRAND_LIT = "M4.16 7.21 L9.04 4.67 L16 18 L16 27.34 L14.67 27.34 Z";

/** The artwork's own bounds, used to re-wrap the viewBox without touching a coordinate. */
export const BRAND_BOX = { x: 4.16, y: 4.67, width: 23.68, height: 22.67 } as const;

export function BrandMark({
  size = 32,
  color = "currentColor",
  className = "",
  maskId,
  wipe = false,
}: {
  size?: number;
  color?: string;
  className?: string;
  /** When `wipe`, the marks are revealed by an animated mask edge instead of appearing at once. */
  maskId?: string;
  wipe?: boolean;
}) {
  const paths = (
    <>
      <path d={BRAND_SILHOUETTE} fill={color} fillOpacity="0.74" />
      <path d={BRAND_LIT} fill={color} />
    </>
  );

  return (
    <svg
      className={className}
      viewBox="4.16 4.67 23.68 22.67"
      width={size}
      height={size}
      aria-label="VELORA"
      role="img"
    >
      {wipe && maskId ? (
        <>
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
              <rect x="0" y="0" width="32" height="32" fill="black" />
              {/* The edge that travels. `mask-wipe` is defined in styles/invitation.css. */}
              <rect className="mark-wipe" x="0" y="0" width="32" height="32" fill="white" />
            </mask>
          </defs>
          <g mask={`url(#${maskId})`}>{paths}</g>
        </>
      ) : (
        paths
      )}
    </svg>
  );
}