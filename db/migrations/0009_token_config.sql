-- 0009_token_config.sql
--
-- The two design documents, in one row.
--
-- There are two renderers and each has its own description of a design:
--
--   `design_config`  — DesignConfig v1, three palette roles (ground, ink, accent), canvas ratio,
--                      typography, ornament, layout. The catalogue, the studio and the draft
--                      preview render from this, and it has been required since 0003.
--   `token_config`   — TemplateTokens v1, five palette roles (ivory, gold, emerald, burgundy, ink)
--                      plus the seal, the envelope and the opening. Only `/i/<token>` reads it, and
--                      until now it read it out of the code (`src/lib/templates/registry.ts`).
--
-- 0008 seeded a Golden Palace row and left the token document in the code, reachable by slug. That
-- worked for one template and does not for the two added here, because the token document is the
-- part that actually differs: `velora-classic` and the already-seeded `ivory-classic` carry the same
-- three-role palette, and differ only in the seal, the envelope and the opening — which only the
-- token document describes. Two rows that look identical to the catalogue renderer and differ to the
-- guest is a drift waiting to be found by a guest rather than by us.
--
-- So the second document moves into the row it belongs to. One row, two documents, both versioned.
-- Decided 2026-11-23.
--
-- `token_config` is nullable on purpose: `getTemplateBySlug` in the code remains the fallback, so a
-- row without a token document renders exactly as it did before this migration, and a row with an
-- invalid one is rejected at the boundary by `TemplateTokensSchema.safeParse` rather than rendered
-- half-applied.

alter table public.templates add column if not exists token_config jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'templates_token_config_is_object') then
    alter table public.templates add constraint templates_token_config_is_object
      check (token_config is null or jsonb_typeof(token_config) = 'object');
  end if;
end
$$;

comment on column public.templates.token_config is
  'TemplateTokens v1 — the five-role palette plus seal/envelope/opening, validated by TemplateTokensSchema. NULL means "fall back to the code registry". Read only by /i/<token>.';

-- ---------------------------------------------------------------------------------------------
-- Golden Palace — backfill, so the code registry stops being the only copy of a shipped document.
-- ---------------------------------------------------------------------------------------------

update public.templates
   set token_config = '{"slug":"golden-palace","version":1,"name_ar":"قصر ذهبي","name_en":"Golden Palace","description_ar":"فناء قصر مغربي عند الغروب: عاجي وذهب عتيق، قوس محراب، وشمع عنابي.","description_en":"A Moorish palace courtyard at dusk: ivory and antique gold, a mihrab arch, burgundy wax.","idiom":"Moorish","palette":{"ivory":"#F6EEDC","gold":"#B8913A","emerald":"#0F3D3E","burgundy":"#6B1E2E","ink":"#2B1B12"},"fonts":{"ar":{"names":"aref","verse":"amiri","label":"reemkufi","body":"notonaskh"},"en":{"names":"cormorant","verse":"cormorant","label":"cinzel","body":"cormorant"}},"seal":{"wax":"burgundy","imprint":"eight-star","shape":"round"},"envelope":{"paper":"emerald","liner":"arabesque"},"opening":{"type":"wax_seal","duration_ms":600},"layout":{"composition":"centered","frame":"royal-double","ornaments":["khatam-tessellation","mihrab-arch","muqarnas-corners","zellige-strip"],"countdown":"framed","rsvp":"solid","divider":"zellige","foil_names":true},"is_active":true,"sort_order":5}'::jsonb
 where slug = 'golden-palace';

-- ---------------------------------------------------------------------------------------------
-- Emerald Envelope — the attachment mockups, and the shipped default.
--
-- Every token is measured, none chosen by eye. `ivory`, `gold`, `emerald` and `ink` are the `.vi`
-- tokens in `src/styles/luxe.css`, which were taken from the mockups and are what `/i/<token>`
-- already renders; the wax is the envelope mockup's own `#650E18`.
--
-- The one thing this row cannot express, and which the code carries instead: `gold` is `#BE925E`,
-- which is 2.4:1 on this paper and may never carry text — the gold that carries text is `#7A5220`.
-- `accent` below is therefore the *text* gold, not the palette's `gold`, because the three-role
-- renderer uses accent for words.
-- ---------------------------------------------------------------------------------------------

insert into public.templates (slug, name_ar, name_en, description_ar, description_en,
                              opening_animation_type, design_config, token_config,
                              preview_content, sort_order)
values (
  'emerald-envelope', 'المظروف الزمردي', 'Emerald Envelope',
  'زمرد عميق وذهب، ختم عنابي، قوس ذهبي، وأسماء بخط الرفعة.',
  'Deep emerald and gold, a burgundy wax seal, a gold arch, and names in Aref Ruqaa.',
  'wax_seal',
  '{"version":1,"canvas":{"ratio":"5:7"},"palette":{"ground":"#F1DEC6","ink":"#2B1B12","accent":"#7A5220"},"typography":{"displayLatn":"cormorant","displayArab":"aref","bodyLatn":"manrope","bodyArab":"plex","align":"center","uppercaseEyebrow":true},"ornament":{"frame":"hairline","rule":"short"},"layout":"classic"}'::jsonb,
  '{"slug":"emerald-envelope","version":1,"name_ar":"المظروف الزمردي","name_en":"Emerald Envelope","description_ar":"زمرد عميق وذهب، ختم عنابي، قوس ذهبي، وأسماء بخط الرفعة.","description_en":"Deep emerald and gold, a burgundy wax seal, a gold arch, and names in Aref Ruqaa.","idiom":"Emerald & Wax","palette":{"ivory":"#F1DEC6","gold":"#BE925E","emerald":"#192A21","burgundy":"#650E18","ink":"#2B1B12"},"fonts":{"ar":{"names":"aref","verse":"amiri","label":"reemkufi","body":"notonaskh"},"en":{"names":"cormorant","verse":"cormorant","label":"cinzel","body":"cormorant"}},"seal":{"wax":"burgundy","imprint":"monogram","shape":"round"},"envelope":{"paper":"emerald","liner":"arabesque"},"opening":{"type":"wax_seal","duration_ms":600},"layout":{"composition":"centered","frame":"thin-line","ornaments":["khatam-tessellation","mihrab-arch","botanical-corners","zellige-strip"],"countdown":"framed","rsvp":"solid","divider":"zellige","foil_names":true},"is_active":true,"sort_order":4}'::jsonb,
  '{"isSample":true,"eyebrow":{"ar":"دعوة زفاف","en":"Wedding Invitation"},"names":{"ar":"خالد ونور","en":"Khalid & Noor"},"footer":{"ar":"مملكة البحرين","en":"Kingdom of Bahrain"}}'::jsonb,
  4
)
on conflict (slug) do update
  set name_ar = excluded.name_ar,
      name_en = excluded.name_en,
      description_ar = excluded.description_ar,
      description_en = excluded.description_en,
      token_config = excluded.token_config;

-- ---------------------------------------------------------------------------------------------
-- Velora Classic — the brand's own palette.
--
-- `ivory`, `gold`, `emerald` and `ink` are read from `docs/BRAND.md`, which carries measured values
-- with their contrast already recorded, rather than from the brief's approximations (~#B08D57,
-- ~#5A3E2B, ~#FAF3EA). Only the brown is the brief's: BRAND.md has no brown, and `burgundy` is a
-- required role that exists to hold an accent which is never body text.
--
-- Its three-role document is deliberately the same as `ivory-classic`'s — ground #F5F0E8, ink
-- #191A19, accent #7A5F38 — because it is the same palette, and inventing a difference there would
-- be inventing a difference in something that has none. What makes it a second design is the token
-- document: an ivory envelope instead of emerald, a plain liner, a gold wax, thin and plain rules
-- instead of zellige, an outlined RSVP instead of solid.
-- ---------------------------------------------------------------------------------------------

insert into public.templates (slug, name_ar, name_en, description_ar, description_en,
                              opening_animation_type, design_config, token_config,
                              preview_content, sort_order)
values (
  'velora-classic', 'فيلورا كلاسيك', 'Velora Classic',
  'الكلاسيكي الهادئ: عاجي، ذهب عتيق، ومساحة بيضاء سخية.',
  'Quiet luxury: ivory, antique gold, and generous whitespace.',
  'wax_seal',
  '{"version":1,"canvas":{"ratio":"5:7"},"palette":{"ground":"#F5F0E8","ink":"#191A19","accent":"#7A5F38"},"typography":{"displayLatn":"cormorant","displayArab":"aref","bodyLatn":"manrope","bodyArab":"plex","align":"center","uppercaseEyebrow":true},"ornament":{"frame":"hairline","rule":"long"},"layout":"classic"}'::jsonb,
  '{"slug":"velora-classic","version":1,"name_ar":"فيلورا كلاسيك","name_en":"Velora Classic","description_ar":"الكلاسيكي الهادئ: عاجي، ذهب عتيق، ومساحة بيضاء سخية.","description_en":"Quiet luxury: ivory, antique gold, and generous whitespace.","idiom":"Quiet Luxury","palette":{"ivory":"#F5F0E8","gold":"#B99B6C","emerald":"#263E35","burgundy":"#5A3E2B","ink":"#191A19"},"fonts":{"ar":{"names":"aref","verse":"amiri","label":"reemkufi","body":"notonaskh"},"en":{"names":"cormorant","verse":"cormorant","label":"cinzel","body":"cormorant"}},"seal":{"wax":"gold","imprint":"monogram","shape":"round"},"envelope":{"paper":"ivory","liner":"plain"},"opening":{"type":"wax_seal","duration_ms":600},"layout":{"composition":"centered","frame":"thin-line","ornaments":["eight-star","botanical-corners"],"countdown":"plain","rsvp":"outlined","divider":"ornament","foil_names":true},"is_active":true,"sort_order":6}'::jsonb,
  '{"isSample":true,"eyebrow":{"ar":"دعوة زفاف","en":"Wedding Invitation"},"names":{"ar":"خالد ونور","en":"Khalid & Noor"},"footer":{"ar":"مملكة البحرين","en":"Kingdom of Bahrain"}}'::jsonb,
  6
)
on conflict (slug) do update
  set name_ar = excluded.name_ar,
      name_en = excluded.name_en,
      description_ar = excluded.description_ar,
      description_en = excluded.description_en,
      token_config = excluded.token_config;
