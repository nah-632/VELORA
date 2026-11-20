# Velora — Luxury Template Reference

*AUTHORITATIVE DESIGN REFERENCE. 24 templates (T1–T24), shared principles, fonts, wax-seal spec, ornament recipes, mix-and-match system, palette presets. Personal-use project. All ornaments are generated in-house (SVG/CSS) and all fonts are free Google Fonts (OFL), so there are no third-party asset licenses to track.*

Template index: T1 Golden Palace · T2 Marble · T3 Floral Garden · T4 Desert & Palm · T5 Minimal · T6 Royal Dark · T7 Andalusian Tiles · T8 Mashrabiya · T9 Pearl of the Gulf · T10 Illuminated Manuscript · T11 Ottoman Tulip · T12 Henna Night · T13 Rose Gold Blush · T14 Sapphire Luxe · T15 Emerald Royal · T16 Burgundy Velvet · T17 Celestial · T18 Midnight Garden · T19 Olive & Stone · T20 Sunrise Peach · T21 Black & White Editorial · T22 Parisian Atelier · T23 Terrazzo Modern · T24 Ivory Lace

## 1. Shared principles

- **Luxury through restraint:** wide spacing, few elements per screen, slow calm motion, thin gold hairlines, one focal point at a time.
- **Arabic first:** default RTL. Every template is designed in Arabic first, then mirrored to English (LTR) with its own font pairing. Never letter-space Arabic. Arabic line-height at least 1.9.
- **Gold foil effect (names only):** a linear gradient on text (`#8A6A2F → #E6CB8A → #B08D57 → #F3E2AE → #9A7733`) with a very soft shimmer sweep every 6–8 seconds. Disabled under `prefers-reduced-motion`.
- **Divider motif:** thin line, small four-point star (✦) in the center, thin line. Reused everywhere as the Velora signature.
- **Performance budget:** no video, no raster ornaments. Ornaments are inline SVG or CSS gradients. Total first-load JS under 120 KB. Fonts self-hosted, subset, preloaded. Animations use only `transform` and `opacity`.
- **Structure of every invitation (top to bottom):** envelope and wax seal → greeting with the guest's name → personal line (if any) → couple names → verse → date (Gregorian + Hijri) → countdown → timeline → venues (women's hall / men's hall) and map buttons → dress code and notes → RSVP → add to calendar → footer with the Velora mark.
- **Shared UI details:** buttons are pill-shaped with a 1px gold border and subtle fill; the primary button (Confirm) is filled gold with dark text, the secondary (Decline) is outlined. Countdown digits use a tabular-lining serif, each unit in a thin-bordered card with a FIXED size (no layout shift per tick).

## 2. Fonts (all OFL, self-hosted via next/font)

| Role | Arabic | Latin |
|---|---|---|
| Couple names | Aref Ruqaa (or Aref Ruqaa Ink for bolder) | Cormorant Garamond Italic, Bodoni Moda, or Pinyon Script (flourish only) |
| Verse and quotes | Amiri | Cormorant Garamond |
| Headings and labels | Reem Kufi | Cinzel or Jost (wide tracking, small caps) |
| Body text | Noto Naskh Arabic | Jost Light or Cormorant Garamond |
| Decorative single words | Katibeh (display only, never body) | Italiana |

Templates pick their own pairing (see below); the operator can override per event.

## 3. The six core templates

### T1 — Golden Palace (قصر ذهبي) · Moorish
**Mood:** a Moroccan/Andalusian palace courtyard at dusk. Warm, grand, ornate but ordered.
**Palette:** ivory `#F6EEDC`, antique gold `#B8913A`, deep emerald `#0F3D3E`, burgundy `#6B1E2E`, ink brown `#2B1B12`.
**Fonts:** Aref Ruqaa names, Amiri verse, Reem Kufi labels; Cormorant Garamond and Cinzel for English.
**Ornament system (generate in SVG):**
- Eight-point star (khatam) tessellation as a very low-opacity background (6–8%), built from two overlapping rotated squares with thin strokes, repeated with `<pattern>`.
- Horseshoe (mihrab) arch frame around the couple's names: one path with two concentric strokes, gold outer, emerald inner.
- Muqarnas-inspired stepped corner pieces in each section corner (simple stacked arcs).
- Zellige-style border strip at section dividers using alternating star and diamond tiles.
**Wax seal:** deep burgundy wax, gold eight-point star in the center.
**Envelope:** emerald paper, gold arabesque liner revealed when the flap opens.
**Motion:** the arch frame draws itself (stroke-dashoffset) when the card slides out; the star pattern fades in slowly.

### T2 — Marble (رخام) · Quiet Luxury
**Mood:** a private gallery. Cool, silent, expensive. Almost no ornament.
**Palette:** marble white `#F4F1EC`, stone `#D9D4CB`, warm grey `#8C8579`, gold hairline `#B89B5E`, ink `#2A2724`.
**Fonts:** Cormorant Garamond or Bodoni Moda (English), Amiri light and Noto Naskh (Arabic), Aref Ruqaa only for the couple's names.
**Ornament system:**
- Marble veining via SVG `feTurbulence` plus `feColorMatrix`, tinted warm grey with an occasional faint gold vein, rendered once as a background and cached. Opacity under 12%.
- Embossed monogram: text-shadow with one light and one dark offset to give a pressed-paper effect.
- Hairline frame inset 24px from the screen edge, 0.5px gold.
**Wax seal:** champagne-gold wax with a pressed monogram, no color.
**Envelope:** thick off-white paper, deckled edge, soft long shadow.
**Motion:** very slow fades (900–1200 ms), no bounce.

### T3 — Floral Garden (زهور)
**Mood:** a spring garden at golden hour. Soft, romantic, feminine without being sweet.
**Palette:** cream `#FFF8F1`, blush `#F7E6E1`, dusty rose `#D9A5A0`, sage `#A9B8A0`, deep olive `#4A5A44`, gold `#BFA06A`.
**Fonts:** Aref Ruqaa names, Amiri verse; Cormorant Garamond Italic with Pinyon Script flourishes for English.
**Ornament system:**
- Botanical line-art in SVG: stems as single thin strokes with leaf and bud shapes drawn as paths (olive for stems, rose for blooms, gold for tiny accents). Place in corners and as a vertical divider.
- Watercolor washes: stacked `radial-gradient` blobs in blush and sage at low opacity behind the sections.
- Optional falling petals (12 maximum, CSS only, disabled on low-end devices and reduced motion).
**Wax seal:** dusty-rose wax with a small gold sprig.
**Envelope:** blush paper with a pressed-flower liner.
**Motion:** stems grow in (stroke draw), blooms fade up, 1.2 s staggered.

### T4 — Desert & Palm (صحراء ونخيل)
**Mood:** a Gulf desert wedding at sunset, warm, natural, rooted in the region.
**Palette:** sand `#E9D5B5`, terracotta `#B5603A`, date-brown `#4A2E1D`, palm green `#5F6F4A`, sunset gold `#E0A84B`, night sky `#1B2238` for the countdown section.
**Fonts:** Reem Kufi for headings, Aref Ruqaa names, Amiri verse; Cormorant Garamond and Jost for English.
**Ornament system:**
- Layered dunes: 3–4 SVG wave paths in graduated sand tones at the page bottom and between sections (parallax by a few pixels only).
- Palm silhouettes: simple SVG paths (trunk plus 7–9 fronds) in date-brown, placed at the edges.
- Crescent and single star in the night section; faint twinkling stars (CSS, 20 maximum).
- Sadu-inspired woven band (simple zigzag and diamond stripe pattern) as divider.
**Wax seal:** terracotta wax with a palm or crescent imprint.
**Envelope:** kraft-sand paper with a Sadu-band liner.
**Motion:** sun gradient slowly shifts from gold to terracotta as the page scrolls; sand-grain particles optional and off by default.

### T5 — Minimal (مينيمال)
**Mood:** modern gallery invitation. Confident, calm, nothing extra.
**Palette:** white `#FFFFFF`, bone `#F3F0EA`, charcoal `#1F1F1F`, one gold `#B08D57`.
**Fonts:** Jost Light in wide tracking and Cormorant Garamond (English); Noto Naskh Arabic and Amiri light, Aref Ruqaa for names only.
**Ornament system:** none except the star divider and thin hairlines. Large type, large whitespace, one centered column (max-width 520px).
**Wax seal:** matte charcoal wax with a thin gold V.
**Envelope:** plain white with a single gold line.
**Motion:** opacity-only fades, 600 ms.

### T6 — Royal Dark (ملكي داكن) · Art Deco
**Mood:** a black-tie evening at a grand hotel. Dramatic, glamorous, high contrast.
**Palette:** midnight `#0B0F1A`, navy ink `#101626`, gold `#C9A24B`, champagne `#EADBB0`, burgundy `#4A0F1D`.
**Fonts:** Cinzel or Bodoni Moda (English); Reem Kufi for headings (its geometric forms suit Deco), Aref Ruqaa names, Amiri verse.
**Ornament system:**
- Sunburst or fan motif: radiating thin gold lines from a bottom-center point, drawn as SVG lines with decreasing opacity.
- Stepped (ziggurat) corners and chevron borders in 1px gold.
- Double hairline frame with notched corners.
- Subtle gold-dust noise via a tiny tiled SVG at 4% opacity.
**Wax seal:** gold wax with a Deco fan imprint on a black envelope.
**Envelope:** black matte with gold foil edge and a champagne liner.
**Motion:** the sunburst lines sweep open like a fan when the card emerges; strong gold shimmer on names.

## 4. Wax-seal and envelope specification (all templates)

- **Sequence (4–6 s, skippable):** brand fade-in → envelope appears with the guest's name written in calligraphy (handwriting-style reveal) → seal pulses with a prompt ("اضغط على الختم" / "Tap the seal") → on tap the seal cracks into 2–3 SVG pieces, the flap opens, the card slides up and expands.
- **Seal construction (SVG):** circular wax shape with an irregular edge (path with slight noise and soft drips), radial gradient for depth, raised outer ring, inner embossed ring, specular highlight, soft inner and outer shadows. The imprint is the monogram or template emblem, with an inner shadow to look pressed.
- **Color variants per template:** gold, burgundy, emerald, rose gold, champagne, black.
- **Fallback:** a simple fade for reduced motion and low-end devices.
- **Language switch** is visible from the first screen and never restarts the animation.

## 5. Section styles (applied per template via tokens)

- **Couple names:** large, foil-gold, centered; "&" (و) as a small ornament between names.
- **Verse:** italic or Amiri, narrow column, thin quotation ornament above.
- **Countdown:** four bordered cells (days, hours, minutes, seconds) with fixed width and height, tabular numerals, labels in small caps (Arabic labels unspaced), seconds tick with a soft opacity fade, never a flip that resizes the cell.
- **Timeline:** vertical thin gold line with small star nodes; each step has time, title, and one line of detail; items can be tagged women / men / all.
- **Venues:** two luxury line-art icons (women's hall, men's hall) with labels «موقع قاعة النساء» / «موقع قاعة الرجال»; tapping opens a dialog with address, time, map, entrance, parking, dress code, notes.
- **RSVP:** two buttons (Confirm filled gold, Decline outlined), companions selector as a small stepper capped by the guest's allowance, then a thank-you message that differs by answer.
- **Personal line:** handwritten/italic style under the greeting, in a narrow column with a small star above it.
- **Footer:** Velora mark, tagline, thin line.

## 6. Ornament recipes the agent should generate (no downloads)

1. **Eight-point star tile:** two squares of equal size, one rotated 45 degrees, strokes only, 1px; repeat with `<pattern>` at 64–96px.
2. **Mihrab arch:** path with straight sides rising to a horseshoe curve, then a pointed apex; draw twice with 8px offset for a double line.
3. **Art Deco fan:** 12–24 lines radiating from one point, spacing equal, opacity decreasing outward; add two concentric arcs.
4. **Dunes:** 3–4 `path` curves using cubic Béziers, filled with graduated sand tones.
5. **Palm:** one curved trunk path plus 7–9 leaf paths fanned from the top (mirror for symmetry).
6. **Botanical stem:** one thin cubic curve with small leaf shapes (almond paths) at alternating intervals and a bud at the tip.
7. **Marble:** `feTurbulence` (baseFrequency about 0.008, numOctaves 4) tinted by `feColorMatrix` to warm grey; render at low opacity.
8. **Gold foil text:** `background-clip: text` with the gradient above and a masked shimmer pseudo-element.
9. **Sadu band:** repeating zigzag and diamond rows in two or three tones.
10. **Wax seal:** noisy-edge circle path, radial gradient, inner ring, highlight ellipse, imprint with inner shadow.

## 7. Sample copy (editable by the operator)

**Arabic greeting:** « أهلًا بك يا {guest_name}، يا من نعتزّ بمحبته » — **English:** "Dear {guest_name}, you are dear to our hearts"
**Confirm thank-you (AR):** « شكرًا من القلب يا {guest_name}، حضورك يكمل فرحتنا، وننتظرك بكل شوق » — **EN:** "Thank you, {guest_name}. Your presence completes our joy, and we cannot wait to see you."
**Decline thank-you (AR):** « نقدّر ردّك الكريم يا {guest_name}، وستبقى في قلوبنا، ودعاؤك يكفينا » — **EN:** "We understand, {guest_name}, and you will be in our hearts. Your prayers mean the world to us."

## 8. Quality checklist (each template must pass)

- Looks luxurious in a 375px-wide viewport in both languages, with no overflow and correct RTL/LTR mirroring.
- Arabic names render in the intended calligraphic font with no fallback flash.
- Lighthouse performance 90+ on mid-range mobile; Cumulative Layout Shift near zero, including during countdown ticks, venue dialog open/close, and language switch.
- Animations respect `prefers-reduced-motion`; text contrast at least 4.5:1 on all backgrounds (check gold on ivory and gold on dark carefully).
- Envelope, countdown, RSVP, calendar button, venue dialog, and language switch all work in every template.
- No external images or scripts beyond the allowed hosts; all ornaments inline.
- If the project is ever sold or offered to the public, re-check licenses first (fonts here are OFL and ornaments are in-house, so the risk is low).

## 9. Extended template library (T7–T24)

These add to the six core templates. Same rules apply: in-house SVG/CSS ornaments, OFL fonts, Arabic-first, reduced-motion fallback, performance budget. Each entry lists mood, palette, fonts, ornament system, seal and envelope, and signature motion.

### Heritage and Arabian

#### T7 — Andalusian Tiles (زليج أندلسي)
**Mood:** painted ceramic courtyard, bright and cultured.
**Palette:** cobalt `#1F4E9C`, white `#FBFAF6`, turquoise `#2A9DA8`, gold `#C9A24B`, ink `#1A2540`.
**Fonts:** Aref Ruqaa names, Amiri verse, Reem Kufi labels; Cormorant Garamond for English.
**Ornament:** azulejo-style tile border from repeating 4-petal rosette and diamond cells (SVG pattern, blue strokes on white); tile band as section dividers; arched window frame for names.
**Seal/envelope:** cobalt wax with a white rosette; white envelope with tile-pattern liner.
**Motion:** tiles "assemble" at the border edges, one by one, 800 ms total.

#### T8 — Mashrabiya (مشربية)
**Mood:** Hejazi wooden lattice, warm light filtering through a window.
**Palette:** warm wood `#6B4A2F`, cream `#F7EFE2`, amber light `#E9B872`, deep olive `#3E4A33`, gold `#B8913A`.
**Fonts:** Amiri and Aref Ruqaa, Reem Kufi labels; Cormorant Garamond English.
**Ornament:** lattice grid made of turned-square pattern in SVG, used as an overlay that casts a soft light-and-shadow pattern (a gradient masked by the lattice) across the page background; carved panel frames.
**Seal/envelope:** dark wood-tone wax with a lattice imprint; envelope shows a lattice cut-out revealing the card.
**Motion:** the lattice doors slide apart (two halves translate outward) to reveal the card.

#### T9 — Pearl of the Gulf (لؤلؤ الخليج)
**Mood:** pearl diving heritage, sea light, soft and rare. Strong regional identity.
**Palette:** pearl `#F5F1EA`, sea aqua `#7FB7B2`, deep sea `#1E4A5C`, soft gold `#C2A15C`, shell pink `#E7D2CC`.
**Fonts:** Aref Ruqaa names, Amiri verse, Noto Naskh body; Cormorant Garamond Italic English.
**Ornament:** gentle wave lines (layered sine paths) at the base; strings of pearls as dividers (circles with radial gradient and highlight); shell and oyster outline at the seal; shimmering particles very subtle.
**Seal/envelope:** pearl-white wax with a pearl in the center; aqua-tinted envelope with wave liner.
**Motion:** a pearl rolls across the divider and settles; waves drift 4 px.

#### T10 — Illuminated Manuscript (مخطوطة مزخرفة)
**Mood:** Quranic-manuscript elegance, parchment and ink, dignified. Good for Katb Kitab.
**Palette:** parchment `#F1E6CC`, ink `#2B2118`, lapis `#1F3F7A`, gold leaf `#C9A24B`, madder red `#7A2630`.
**Fonts:** Amiri (main), Aref Ruqaa names, Katibeh for single decorative words; Cormorant Garamond English.
**Ornament:** tezhip-style illuminated corner pieces (scrolling vine + palmette, SVG), a gold-edged medallion (shamsa) above the names, double ruled border in gold and red.
**Seal/envelope:** gold seal with a shamsa medallion; envelope as a book cover (leather-brown with gold border).
**Motion:** the book cover opens (a 3D hinge transform) to reveal the page.

#### T11 — Ottoman Tulip (لالة عثمانية)
**Mood:** Iznik tiles and imperial borders, rich red and blue.
**Palette:** Iznik red `#B3262E`, cobalt `#1B4D9B`, turquoise `#2C9AA0`, ivory `#F8F1E3`, gold `#C9A24B`.
**Fonts:** Aref Ruqaa names, Amiri verse, Reem Kufi labels; Cinzel and Cormorant English.
**Ornament:** stylized tulip and carnation motifs as simple filled paths; a repeating border of tulips; ogee-arch frame.
**Seal/envelope:** red wax with a tulip imprint; ivory envelope with blue tulip band.
**Motion:** tulips bloom (scale from 0.6 to 1 with petal fade) along the border.

#### T12 — Henna Night (ليلة الحناء)
**Mood:** festive, warm, joyful. Made for the henna-night event type.
**Palette:** saffron `#E8A23A`, henna brown `#5A2E1A`, deep green `#1F4D3A`, fuchsia `#C2336E`, cream `#FBF1DE`.
**Fonts:** Reem Kufi headings, Aref Ruqaa names, Amiri body; Cormorant Garamond and Jost English.
**Ornament:** henna-style hand-drawn patterns (paisley, dots, vine) in brown strokes on cream, as border and background; small colorful lantern shapes; confetti of petals.
**Seal/envelope:** henna-orange wax with a paisley imprint; fabric-like patterned envelope.
**Motion:** henna lines draw themselves (stroke draw) around the names; a soft confetti burst on RSVP confirm.

### Luxury modern

#### T13 — Rose Gold Blush (روز جولد)
**Mood:** soft modern luxury, feminine, polished.
**Palette:** blush `#F6E3DD`, rose gold `#B76E79` to `#E3B7A6` gradient, ivory `#FFF8F3`, mocha `#4B3A38`, champagne `#E6D3B3`.
**Fonts:** Aref Ruqaa names, Noto Naskh body; Cormorant Garamond and Pinyon Script English.
**Ornament:** rose-gold foil gradient on names and hairlines; thin geometric frame with rounded corners; subtle sparkle dots.
**Seal/envelope:** rose-gold metallic wax; blush envelope with satin sheen.
**Motion:** slow shimmer; sparkles twinkle at the seal.

#### T14 — Sapphire Luxe (ياقوت أزرق)
**Mood:** cool, crystalline, regal, evening gala.
**Palette:** sapphire `#14308A`, navy `#0A1747`, silver `#C9CFD8`, platinum gold `#D9C9A0`, ice `#EAF0FA`.
**Fonts:** Cinzel and Bodoni Moda English; Reem Kufi headings, Aref Ruqaa names, Amiri verse.
**Ornament:** faceted gem shapes (polygon facets with gradient), thin silver filigree lines, light-ray streaks from the top.
**Seal/envelope:** sapphire wax with a faceted gem imprint; navy envelope with silver edge.
**Motion:** a light sweep glides across the gem and names.

#### T15 — Emerald Royal (زمرد ملكي)
**Mood:** deep, jewel-toned, powerful, Mughal-meets-Gulf grandeur.
**Palette:** emerald `#0B4D3B`, deep green `#06281F`, gold `#C9A24B`, ivory `#F5EEDC`, ruby accent `#8A1F35`.
**Fonts:** Aref Ruqaa names, Amiri verse, Reem Kufi labels; Cinzel and Cormorant English.
**Ornament:** multi-foil arch (cusped arches) as frame; floral lattice (jaali) overlay in gold at 8% opacity; tassel dividers.
**Seal/envelope:** gold wax on an emerald envelope with gold foil edge.
**Motion:** jaali lattice fades in behind the card; arch lines draw in gold.

#### T16 — Burgundy Velvet (مخمل عنابي)
**Mood:** theater and opera night, velvet and gold.
**Palette:** burgundy `#4A0F1D` to `#6B1E2E`, gold `#C9A24B`, champagne `#EADBB0`, black `#120A0C`.
**Fonts:** Bodoni Moda and Cinzel English; Reem Kufi headings, Aref Ruqaa names, Amiri verse.
**Ornament:** velvet texture (layered gradients plus a faint noise tile), gold tassel and rope border, curtain folds as vertical gradients.
**Seal/envelope:** **no envelope: a theater curtain** that opens left and right on tap; a small gold tassel pull.
**Motion:** curtain sweep (translateX both halves) with a spotlight vignette fading in on the names.

#### T17 — Celestial (سمائي)
**Mood:** a night sky wedding, stars, moon, romantic and dreamy.
**Palette:** night `#0C1230`, deep violet `#2B1E5A`, starlight gold `#E8D08A`, silver `#D7DBE6`, soft rose `#C99AB0`.
**Fonts:** Cormorant Garamond Italic and Cinzel English; Aref Ruqaa names, Amiri verse.
**Ornament:** constellation lines connecting small star points (SVG circles and thin lines); crescent moon and moon-phase row as a timeline accent; faint nebula gradients.
**Seal/envelope:** dark envelope with star-dotted flap; gold wax with a crescent and star.
**Motion:** stars twinkle (20 max); a shooting star crosses once after opening.

### Nature and organic

#### T18 — Midnight Garden (حديقة الليل)
**Mood:** dark romantic botanical, moody and rich.
**Palette:** forest black `#0F1B16`, deep green `#1F3B2E`, gold `#C9A24B`, blush `#E3B7B0`, cream `#F3EBDD`.
**Fonts:** Aref Ruqaa names, Amiri verse; Cormorant Garamond Italic English.
**Ornament:** gold botanical line-art on dark (leaves, ferns, blooms), moonlit vignette, small fireflies (12 max).
**Seal/envelope:** gold wax with a leaf sprig; dark green envelope with gold botanical liner.
**Motion:** botanical lines draw in gold; fireflies drift.

#### T19 — Olive & Stone (زيتون وحجر)
**Mood:** Mediterranean, linen and sun, relaxed luxury.
**Palette:** linen `#F2ECE0`, olive `#6B7A4B`, sage `#A7B38C`, stone `#CFC6B5`, terracotta accent `#B8643C`.
**Fonts:** Cormorant Garamond and Jost English; Noto Naskh, Amiri, Aref Ruqaa names.
**Ornament:** olive branch line-art with small ovate leaves, linen texture via fine noise, arch-window crop for any photo.
**Seal/envelope:** olive-green wax with a leaf; linen envelope tied with a thin twine line.
**Motion:** branch grows leaf by leaf, calm.

#### T20 — Sunrise Peach (فجر)
**Mood:** dreamy morning light, gentle gradients, contemporary and fresh.
**Palette:** peach `#FFD9C2`, apricot `#F6B79A`, lilac `#D9C8E8`, cream `#FFF7EF`, deep plum text `#4A2F45`, soft gold `#C9A66B`.
**Fonts:** Cormorant Garamond and Jost English; Noto Naskh and Amiri, Aref Ruqaa names.
**Ornament:** mesh gradient background (3–4 radial gradients), thin arc lines like sunrise rays, floating soft circles.
**Seal/envelope:** peach wax with a sun-arc imprint; translucent vellum-style envelope.
**Motion:** the background gradient slowly shifts hue by 10 degrees over 20 seconds.

### Editorial and contemporary

#### T21 — Black & White Editorial (أبيض وأسود)
**Mood:** fashion magazine, bold and confident.
**Palette:** black `#0B0B0B`, white `#FFFFFF`, light grey `#E6E6E6`, a single gold accent `#C9A24B`.
**Fonts:** Bodoni Moda (large, high contrast) English; Reem Kufi and Aref Ruqaa Arabic.
**Ornament:** huge type, thin rules, grid layout, oversized numerals for the date.
**Seal/envelope:** black wax with a white V; envelope in white with black lining.
**Motion:** hard, crisp reveals (clip-path wipes), no bounce.

#### T22 — Parisian Atelier (أتليه باريسي)
**Mood:** couture atelier, ivory and champagne, cultured and light.
**Palette:** ivory `#FAF6EE`, champagne `#E6D3B3`, charcoal `#2B2B2B`, dusty blue `#8FA3B5`, gold `#B8913A`.
**Fonts:** Italiana and Cormorant Garamond Italic English; Noto Naskh Arabic and Amiri, Aref Ruqaa names.
**Ornament:** wrought-iron balcony line motif, French-style cartouche frame, delicate ribbon bow in SVG.
**Seal/envelope:** champagne wax with a ribbon-bow imprint; ivory envelope with a thin ribbon band.
**Motion:** the ribbon unties as the card emerges.

#### T23 — Terrazzo Modern (تيرازو)
**Mood:** playful modern, colorful and youthful, for engagements and casual celebrations.
**Palette:** off-white `#F7F4EE`, terracotta `#C9694A`, mustard `#D9A441`, sage `#9DB08A`, dusty blue `#7C97B5`, charcoal `#2A2A2A`.
**Fonts:** Jost and Cormorant Garamond English; Reem Kufi headings, Aref Ruqaa names, Noto Naskh body.
**Ornament:** terrazzo flecks (random organic polygons in 4–5 colors, SVG), color-block arches and circles, rounded cards.
**Seal/envelope:** terracotta wax, colorful envelope with terrazzo liner.
**Motion:** shapes pop in with a small spring (kept subtle).

#### T24 — Ivory Lace (دانتيل عاجي)
**Mood:** bridal lace, vintage romance, delicate and heirloom.
**Palette:** ivory `#FBF6EC`, cream `#F1E7D3`, pearl `#EDE6DA`, soft gold `#C2A15C`, dusty rose `#D8B4AE`.
**Fonts:** Cormorant Garamond Italic and Pinyon Script English; Amiri, Aref Ruqaa names.
**Ornament:** lace border built from repeating scalloped arcs and small flower dots (SVG pattern), pearl-button dividers, floral corner motifs.
**Seal/envelope:** pearl wax with a small lace imprint; ivory envelope with scalloped flap edge.
**Motion:** lace edge draws along the card as it emerges.

## 10. Template catalog by occasion

| Occasion | Suggested templates |
|---|---|
| Formal grand wedding | T1 Golden Palace, T6 Royal Dark, T15 Emerald Royal, T16 Burgundy Velvet, T14 Sapphire Luxe |
| Katb Kitab / religious ceremony | T10 Illuminated Manuscript, T7 Andalusian Tiles, T2 Marble, T5 Minimal |
| Henna night | T12 Henna Night, T4 Desert & Palm, T11 Ottoman Tulip |
| Engagement / casual | T23 Terrazzo, T20 Sunrise Peach, T13 Rose Gold, T5 Minimal |
| Garden / outdoor | T3 Floral, T18 Midnight Garden, T19 Olive & Stone |
| Evening / night events | T17 Celestial, T6 Royal Dark, T21 Black & White |
| Regional identity (Gulf) | T9 Pearl of the Gulf, T4 Desert & Palm, T8 Mashrabiya |
| Soft modern | T13, T20, T22, T24 |

## 11. Mix-and-match system (build custom looks from parts)

A template is a combination of **palette + type pairing + ornament set + envelope style + seal style + opening animation + layout + divider + countdown style + RSVP style + venue icon set**. Store each as a token set so the operator can pick a base template and swap any part in the editor, with live preview.

**Opening animations (choose one):** wax-seal envelope; theater curtain; lattice doors that slide apart; book cover opening; scroll unrolling; lantern (fanous) lighting up then revealing; flower bloom; gate/arch doors opening; card flip with foil reveal; simple fade (minimal).

**Envelope styles:** classic flap; deckled paper; vellum (translucent); fabric/linen; velvet; wood panel; leather book; kraft; metallic foil edge; no envelope (direct reveal).

**Seal styles:** classic wax (round); oval wax; star-shaped wax; metal coin seal; ribbon-and-seal; embossed paper seal (no color); pearl; tassel-and-seal.

**Layout variants:** centered single column (default); arch-window hero; split screen (names left/details right on desktop, stacked on mobile); card stack (sections as stacked cards that slide); story scroll (full-screen scenes); vertical scroll book with page turns.

**Divider styles:** star divider (Velora signature); pearl string; vine line; zigzag Sadu; Art Deco chevron; lace scallop; geometric star band; single hairline.

**Countdown styles:** bordered cells (default); circular progress rings; elegant inline text ("١٢ يوم، ٣ ساعات…"); hourglass; moon-phase. All must use fixed-size cells and never shift layout per tick.

**RSVP styles:** two pill buttons (default); reply card with stub and perforation; seal-stamp (guest presses a stamp to confirm); slider "slide to confirm".

**Backgrounds:** solid with hairline frame; marble; linen noise; mesh gradient; pattern tile at 6–10% opacity; scene (dunes, garden, night sky); velvet.

**Venue icon sets:** women's hall (ornate arched window with a blooming rose/lotus and a small crescent star) and men's hall (Arabian majlis arch with a dallah and a small eight-point star), drawn per template style (Moorish, Art Deco, floral, minimal), gold line-art SVG.

**Type pairings (presets):**
1. Classic: Aref Ruqaa + Amiri / Cormorant Garamond + Cinzel.
2. Modern: Reem Kufi + Noto Naskh / Jost + Cormorant Garamond.
3. Romantic: Aref Ruqaa + Amiri / Pinyon Script + Cormorant Garamond Italic.
4. Dramatic: Reem Kufi + Amiri / Bodoni Moda + Cinzel.
5. Manuscript: Amiri + Katibeh accents / Cormorant Garamond.
6. Editorial: Reem Kufi + Noto Naskh / Bodoni Moda + Jost.
7. Airy: Noto Naskh + Amiri light / Italiana + Jost Light.

## 12. Custom palette presets (for quick recolor of any template)

| Name | Main | Accent | Background | Text |
|---|---|---|---|---|
| Classic Gold | `#B08D57` | `#5A3E2B` | `#FAF3EA` | `#2B1B12` |
| Emerald Gold | `#0B4D3B` | `#C9A24B` | `#F5EEDC` | `#06281F` |
| Royal Navy | `#14308A` | `#D9C9A0` | `#EAF0FA` | `#0A1747` |
| Burgundy Gold | `#6B1E2E` | `#C9A24B` | `#F7EDE2` | `#2B0A12` |
| Blush Rose | `#B76E79` | `#E6D3B3` | `#FFF8F3` | `#4B3A38` |
| Sage Cream | `#6B7A4B` | `#B8913A` | `#F2ECE0` | `#2F3A22` |
| Desert Sand | `#B5603A` | `#E0A84B` | `#E9D5B5` | `#4A2E1D` |
| Midnight | `#0B0F1A` | `#C9A24B` | `#101626` | `#EADBB0` |
| Pearl Aqua | `#1E4A5C` | `#C2A15C` | `#F5F1EA` | `#14323F` |
| Lilac Peach | `#4A2F45` | `#C9A66B` | `#FFF7EF` | `#4A2F45` |

## 13. Rules for adding new templates later

- A new template must reuse the token structure above and pass the quality checklist in section 8.
- Ornaments are generated or hand-built; if any external asset is ever used, record its source and license in `LICENSES.md` first.
- Provide a preview thumbnail (generated from the live render), AR and EN sample content, and at least two palette variants.
- Test on a low-end Android phone; remove any effect that drops below 50 fps.
