/**
 * T1's ornaments, drawn rather than downloaded.
 *
 * Each is a pure function of its size, so the same shape renders identically on the server and the
 * client and nothing has to be hydrated. All four are strokes in `currentColor`, which is how the
 * palette reaches them: the arch is gold outside and emerald inside because the caller sets two
 * colours, not because this file knows about T1.
 *
 * The reference's recipes (§6) are followed literally:
 *
 *   1. **khatam** — two squares of equal size, one rotated 45°, strokes only, repeated with a
 *      `<pattern>`. At 6–8% opacity it reads as texture rather than as a pattern of stars.
 *   2. **mihrab** — straight sides rising to a horseshoe curve with a pointed apex, drawn twice at a
 *      small offset for the double line.
 *   3. **muqarnas corners** — stacked arcs, the stepped transition a squinch makes.
 *   4. **zellige strip** — alternating star and diamond tiles, as a border between sections.
 */

/** A tiled eight-point star field. Rendered once, at low opacity, behind everything. */
export function KhatamField({ opacity = 0.07, size = 72, className = "" }: { opacity?: number; size?: number; className?: string }) {
  const id = `khatam-${size}`;
  return (
    <svg className={className} aria-hidden="true" focusable="false" width="100%" height="100%">
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="0.9">
            {/* Two squares, one turned 45°: the khatam. */}
            <rect x={size * 0.22} y={size * 0.22} width={size * 0.56} height={size * 0.56} />
            <rect
              x={size * 0.22}
              y={size * 0.22}
              width={size * 0.56}
              height={size * 0.56}
              transform={`rotate(45 ${size / 2} ${size / 2})`}
            />
            {/* The lattice that joins one tile to the next. */}
            <path d={`M0 ${size / 2}H${size}M${size / 2} 0V${size}`} strokeOpacity="0.5" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity={opacity} />
    </svg>
  );
}

/**
 * The horseshoe arch that frames the couple's names.
 *
 * One path, drawn twice: gold on the outside and emerald inset. The `draw` prop enables the
 * stroke-dashoffset animation the reference asks for — the arch drawing itself as the card appears.
 * It is off under `prefers-reduced-motion`, where the arch is simply there.
 */
export function MihrabArch({
  className = "",
  width = 260,
  height = 340,
  outer = "var(--tpl-gold)",
  inner = "var(--tpl-emerald)",
  draw = true,
}: {
  className?: string;
  width?: number;
  height?: number;
  outer?: string;
  inner?: string;
  draw?: boolean;
}) {
  // Straight sides to 55%, then a horseshoe: wider than the springing line, narrowing to a point.
  const arch = (inset: number) => {
    const w = width - inset * 2;
    const h = height - inset * 2;
    const left = inset;
    const right = inset + w;
    const spring = inset + h * 0.55;
    const cx = inset + w / 2;
    return [
      `M${left} ${inset + h}`,
      `L${left} ${spring}`,
      `C${left} ${spring - h * 0.26} ${cx - w * 0.30} ${inset + h * 0.06} ${cx} ${inset}`,
      `C${cx + w * 0.30} ${inset + h * 0.06} ${right} ${spring - h * 0.26} ${right} ${spring}`,
      `L${right} ${inset + h}`,
    ].join(" ");
  };

  return (
    <svg
      className={`mihrab ${draw ? "mihrab--draw" : ""} ${className}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      fill="none"
      strokeLinecap="round"
    >
      <path d={arch(0)} stroke={outer} strokeWidth="1.6" pathLength={1} />
      <path d={arch(8)} stroke={inner} strokeWidth="1" pathLength={1} />
    </svg>
  );
}

/** Stepped corner pieces: the profile of a muqarnas squinch, reduced to arcs. */
export function MuqarnasCorner({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      className={`muqarnas ${className}`}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M2 62V30a12 12 0 0 1 12-12h20" />
      <path d="M2 46a8 8 0 0 1 8-8h12" opacity="0.75" />
      <path d="M2 34a8 8 0 0 1 8-8h6" opacity="0.5" />
      <path d="M62 2H30a12 12 0 0 0-12 12v4" opacity="0.35" />
    </svg>
  );
}

/** The zellige band: alternating star and diamond tiles, as a section divider. */
export function ZelligeStrip({ className = "", height = 26 }: { className?: string; height?: number }) {
  const tile = 26;
  return (
    <svg
      className={`zellige ${className}`}
      viewBox={`0 0 ${tile * 6} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.9"
    >
      {Array.from({ length: 6 }, (_, index) => {
        const cx = tile * index + tile / 2;
        const cy = height / 2;
        const r = height * 0.3;
        return index % 2 === 0 ? (
          // A star: two squares again, smaller.
          <g key={index}>
            <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} />
            <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} transform={`rotate(45 ${cx} ${cy})`} />
          </g>
        ) : (
          <path key={index} d={`M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`} />
        );
      })}
    </svg>
  );
}

/** A light rule with a small star at its centre, for between sections. */
export function StarDivider({ className = "" }: { className?: string }) {
  return (
    <svg className={`divider ${className}`} viewBox="0 0 160 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="0.9">
      <path d="M4 8h56M100 8h56" strokeOpacity="0.6" />
      <path d="M80 2l2.2 4.4 4.8.5-3.5 3.3 1 4.8L80 12.7l-4.5 2.3 1-4.8-3.5-3.3 4.8-.5z" />
    </svg>
  );
}