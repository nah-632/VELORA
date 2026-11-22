/**
 * The mihrab arch the couple's names sit inside.
 *
 * Two concentric horseshoe lines, drawn rather than imported: it is six numbers of geometry, and a
 * traced path would be a file to keep in sync with nothing.
 *
 * `pathLength="1"` is the whole trick. The two paths are different lengths, so a real dash offset
 * would draw them at different speeds and the inner line would finish visibly late. Declaring each
 * path's length as 1 lets CSS say "undrawn" (`stroke-dashoffset: 1`) and "drawn" (`0`) in the same
 * units for both.
 *
 * It is `aria-hidden` because it says nothing: the names inside it are the content and they are real
 * text, in the document, in the reading order — the arch is not an image of a heading.
 */
export function MihrabArch() {
  return (
    <svg viewBox="0 0 300 390" aria-hidden="true" focusable="false">
      <path className="vi-arch__line" pathLength="1" d="M58 382V212C16 176 28 76 150 18C272 76 284 176 242 212V382" />
      <path className="vi-arch__line vi-arch__line--thin" pathLength="1" d="M70 382V216C34 180 46 92 150 36C254 92 266 180 230 216V382" />
    </svg>
  );
}
