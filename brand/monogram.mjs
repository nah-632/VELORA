/**
 * VELORA monogram — geometry.
 *
 * The idea: **a strip of card, folded once, read as the letter V.**
 *
 * The brief asks for the letter V explored through "a folded invitation or refined paper
 * geometry" and rules out crowns, hearts, rings and flourishes, so there is no borrowed wedding
 * symbol in the mark. What there is: one continuous strip, folded at its middle, with a paper cut
 * at each end and the folded edge facing the viewer.
 *
 * Why the shape is built this way:
 *
 *   1. The fold is a **vertical crease through the apex**, carried by **tone**, not by a drawn
 *      line. A crease drawn as a hairline disappears at 24px and turns to grey mush at 16px. A
 *      tonal difference between two planes survives to the smallest size.
 *   2. The strip's ends are **cut perpendicular to its length**, so the top edge is slanted —
 *      what a cut strip actually looks like, and what separates this from a generic chevron.
 *   3. The point is **squared into a small flat foot**: the folded edge seen edge-on. A true
 *      miter would spike to y≈31 on this grid, past the artwork, and read as a blade.
 *   4. Nothing depends on a feature finer than 1 unit. In a single colour the two planes merge
 *      into a clean solid V; nothing breaks.
 *
 * First attempt, thrown away after rendering: two separate arm triangles, one tonally lighter.
 * At 160px it read as two blades or a pair of misplaced highlights, not folded paper — because
 * the tone break sat between two *disjoint* shapes instead of across a fold. A single-band
 * construction fixes exactly that. A screenshot was needed to see it.
 *
 * Rendering model: the silhouette is drawn once at the turned-away tone, then the lit half is
 * drawn over it at full strength. Painting the union first is what prevents an antialiasing
 * hairline along the crease, which is precisely where a two-shape construction shows a seam.
 */

export const GRID = 32;

/** The six defining points, for the construction diagram. */
export const VERTICES = {
  outerTopLeft: [4.16, 7.21],
  innerTopLeft: [9.04, 4.67],
  notch: [16, 18.0],
  footLeft: [14.67, 27.34],
  footRight: [17.33, 27.34],
  innerTopRight: [22.96, 4.67],
  outerTopRight: [27.84, 7.21],
};

/** The whole mark as one path. Drawn first so the two planes can never show a seam. */
export const SILHOUETTE =
  "M4.16 7.21 L9.04 4.67 L16 18 L22.96 4.67 L27.84 7.21 L17.33 27.34 L14.67 27.34 Z";

/** The half the light falls on. Drawn over the silhouette at full strength. */
export const LIT_FACE = "M4.16 7.21 L9.04 4.67 L16 18 L16 27.34 L14.67 27.34 Z";

/** How much the turned-away plane is held back. One value, used everywhere. */
export const PLANE_OPACITY = 0.74;

/** Clear space around the mark: half its width, on every side. */
export const CLEAR_SPACE = 12;

/** The smallest sizes the mark is expected to hold. Below 16px it is a coloured square. */
export const MINIMUM_SIZES = {
  favicon: 16,
  compact: 24,
  avatar: 32,
  standard: 48,
  print: 12, // millimetres
};
