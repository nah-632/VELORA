/**
 * Renderer guard — there is one invitation renderer, and every surface uses it.
 *
 * The brief requires that the live preview "use the same rendering logic as the eventual
 * customer-facing invitation", and forbids a separate preview that differs from the final result.
 * That requirement is easy to state and easy to break: someone adds a "simple" renderer for a
 * thumbnail, or inlines a copy of the canvas into a page "just for now", and from then on the
 * preview is a promise nobody is keeping.
 *
 * So the invariant is checked structurally. It is a proxy for behaviour, and it is honest about
 * being one: a second renderer would have to size its own canvas, and this fails if one appears.
 *
 * Usage: node tests/ui/check-renderer.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(ROOT, "src");

const RENDERER = join("components", "invitation", "TemplateCanvas.tsx");

/**
 * The canvas's own signature: a container-query-sized box with an aspect ratio.
 *
 * Two markers, because one is not enough to distinguish *painting* an invitation from *showing*
 * its colours. The Studio displays palette swatches and the reducer patches the palette; neither
 * draws an invitation. Applying the resolved ground colour to a surface is what only the renderer
 * does.
 */
const CANVAS_SIGNATURE = "containerType";
const PAINTS_WITH = "resolved.ground";

const SURFACES = [
  join("app", "[locale]", "templates", "page.tsx"),
  join("app", "[locale]", "templates", "[slug]", "page.tsx"),
  join("app", "[locale]", "invitation", "page.tsx"),
  join("features", "studio", "Studio.tsx"),
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (["node_modules", ".next"].includes(entry)) continue;
      yield* walk(full);
    } else if ([".ts", ".tsx"].includes(extname(full))) {
      yield full;
    }
  }
}

let passed = 0;
let failed = 0;

function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail ? `  — ${detail}` : ""}`);
  }
}

console.log("VELORA renderer guard\n");

const files = [...walk(SRC)];

// ---------------------------------------------------------------------------
console.log("one renderer");
// ---------------------------------------------------------------------------

const withSignature = files.filter((file) =>
  readFileSync(file, "utf8").includes(CANVAS_SIGNATURE),
);
check(
  "exactly one file sizes an invitation canvas",
  withSignature.length === 1,
  withSignature.map((f) => relative(SRC, f)).join(", ") || "none found",
);
check(
  "and it is the shared renderer",
  withSignature.length === 1 && relative(SRC, withSignature[0]) === RENDERER,
  withSignature.length === 1 ? relative(SRC, withSignature[0]) : "",
);

const paintingFiles = files.filter((file) => readFileSync(file, "utf8").includes(PAINTS_WITH));
check(
  "exactly one file applies a design's colours to a surface",
  paintingFiles.length === 1,
  paintingFiles.map((f) => relative(SRC, f)).join(", ") || "none found",
);
check(
  "and it is the shared renderer",
  paintingFiles.length === 1 && relative(SRC, paintingFiles[0]) === RENDERER,
  paintingFiles.length === 1 ? relative(SRC, paintingFiles[0]) : "",
);

// ---------------------------------------------------------------------------
console.log("\nevery surface uses it");
// ---------------------------------------------------------------------------

for (const surface of SURFACES) {
  const full = join(SRC, surface);
  let source = "";
  try {
    source = readFileSync(full, "utf8");
  } catch {
    check(`${surface} exists`, false, "file not found");
    continue;
  }
  check(
    `${surface} renders through TemplateCanvas`,
    source.includes("TemplateCanvas"),
    "a surface that draws its own invitation is a second renderer",
  );
}

// ---------------------------------------------------------------------------
console.log("\ncontent and design meet in one place");
// ---------------------------------------------------------------------------

// The adapters are the seam between content and rendering. Both the Studio and the finished
// invitation must go through them rather than assembling blocks inline.
const studio = readFileSync(join(SRC, "features", "studio", "Studio.tsx"), "utf8");
const invitation = readFileSync(join(SRC, "app", "[locale]", "invitation", "page.tsx"), "utf8");
check("the Studio builds its blocks with blocksFromContent", studio.includes("blocksFromContent"));
check(
  "the finished invitation builds them the same way",
  invitation.includes("blocksFromContent"),
  "the same adapter, so the two cannot disagree about what the canvas is handed",
);
check(
  "the catalogue builds them with blocksFromPreview",
  readFileSync(join(SRC, "app", "[locale]", "templates", "page.tsx"), "utf8").includes(
    "blocksFromPreview",
  ),
);

console.log(`\nrenderer guard: ${passed}/${passed + failed} expectations met`);
if (failed > 0) {
  console.log("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
