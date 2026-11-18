-- 0003_templates.sql
--
-- The design presets an event is built from.
--
-- The eight designs here were built and contrast-measured in the earlier milestones: each one's
-- palette, type pairing, canvas ratio and ornament are the output of `scripts/check-contrast.py`
-- (21 pairs, 0 required failures) and the renderer tests, not a new set invented for this
-- migration. What changes is where they live: they are now operator presets an event can select,
-- rather than catalogue rows a customer browsed.
--
-- The brief names six themes — classic gold, marble, floral, desert/palm, minimal, royal dark. The
-- built collection overlaps but is not identical (ivory-classic, emerald-royal, sand-editorial,
-- paper-minimal, rose-letterpress, sage-botanical, naskh-heritage, ink-noir). Renaming them to the
-- brief's six is a design decision, not a mechanical one, so nothing was renamed here: the owner's
-- set is seeded as it was designed.
--
-- `design_config` is the renderer's own document (DesignConfigSchema, version 1). The three columns
-- it replaces — palette, fonts, layout_config — are dropped rather than kept alongside it: two
-- descriptions of the same design is how they drift apart.

alter table public.templates add column if not exists design_config jsonb;
alter table public.templates add column if not exists preview_content jsonb;

insert into public.templates (slug, name_ar, name_en, description_ar, description_en,
                              design_config, preview_content, opening_animation_type, sort_order)
values
  ('ivory-classic', 'عاجي كلاسيكي', 'Ivory Classic', 'تصميم من المجموعة المبنية.', 'A classic royal design from the built collection.',
   '{"version": 1, "canvas": {"ratio": "5:7"}, "palette": {"ground": "#F5F0E8", "ink": "#191A19", "accent": "#7A5F38"}, "typography": {"displayLatn": "cormorant", "displayArab": "aref", "bodyLatn": "manrope", "bodyArab": "plex", "align": "center", "uppercaseEyebrow": true}, "ornament": {"frame": "hairline", "rule": "short"}, "layout": "classic"}'::jsonb, '{"isSample": true, "eyebrow": {"ar": "دعوة زفاف", "en": "Wedding Invitation"}, "names": {"ar": "اسم العروس واسم العريس", "en": "Bride and Groom"}, "footer": {"ar": "مملكة البحرين", "en": "Kingdom of Bahrain"}}'::jsonb, 'wax_seal', 10),
  ('emerald-royal', 'زمردي ملكي', 'Emerald Royal', 'تصميم من المجموعة المبنية.', 'A classic royal design from the built collection.',
   '{"version": 1, "canvas": {"ratio": "5:7"}, "palette": {"ground": "#263E35", "ink": "#F5F0E8", "accent": "#D8C49B"}, "typography": {"displayLatn": "cormorant", "displayArab": "aref", "bodyLatn": "manrope", "bodyArab": "plex", "align": "center", "uppercaseEyebrow": true}, "ornament": {"frame": "double", "rule": "long"}, "layout": "classic"}'::jsonb, '{"isSample": true, "eyebrow": {"ar": "دعوة زفاف", "en": "Wedding Invitation"}, "names": {"ar": "اسم العروس واسم العريس", "en": "Bride and Groom"}, "footer": {"ar": "مملكة البحرين", "en": "Kingdom of Bahrain"}}'::jsonb, 'wax_seal', 20),
  ('sand-editorial', 'رملي تحريري', 'Sand Editorial', 'تصميم من المجموعة المبنية.', 'A luxury editorial design from the built collection.',
   '{"version": 1, "canvas": {"ratio": "5:7"}, "palette": {"ground": "#ECE5D9", "ink": "#191A19", "accent": "#7A5F38"}, "typography": {"displayLatn": "cormorant", "displayArab": "aref", "bodyLatn": "manrope", "bodyArab": "plex", "align": "start", "uppercaseEyebrow": true}, "ornament": {"frame": "none", "rule": "long"}, "layout": "editorial"}'::jsonb, '{"isSample": true, "eyebrow": {"ar": "دعوة زفاف", "en": "Wedding Invitation"}, "names": {"ar": "اسم العروس واسم العريس", "en": "Bride and Groom"}, "footer": {"ar": "مملكة البحرين", "en": "Kingdom of Bahrain"}}'::jsonb, 'wax_seal', 30),
  ('paper-minimal', 'ورقي بسيط', 'Paper Minimal', 'تصميم من المجموعة المبنية.', 'A modern minimal design from the built collection.',
   '{"version": 1, "canvas": {"ratio": "5:7"}, "palette": {"ground": "#FFFFFF", "ink": "#191A19", "accent": "#5B5F5C"}, "typography": {"displayLatn": "manrope", "displayArab": "plex", "bodyLatn": "manrope", "bodyArab": "plex", "align": "start", "uppercaseEyebrow": false}, "ornament": {"frame": "none", "rule": "none"}, "layout": "editorial"}'::jsonb, '{"isSample": true, "eyebrow": {"ar": "دعوة زفاف", "en": "Wedding Invitation"}, "names": {"ar": "اسم العروس واسم العريس", "en": "Bride and Groom"}, "footer": {"ar": "مملكة البحرين", "en": "Kingdom of Bahrain"}}'::jsonb, 'wax_seal', 40),
  ('rose-letterpress', 'وردي بارز', 'Rose Letterpress', 'تصميم من المجموعة المبنية.', 'A romantic design from the built collection.',
   '{"version": 1, "canvas": {"ratio": "5:7"}, "palette": {"ground": "#F7EFEC", "ink": "#2A2224", "accent": "#8F4F55"}, "typography": {"displayLatn": "cormorant", "displayArab": "aref", "bodyLatn": "manrope", "bodyArab": "plex", "align": "center", "uppercaseEyebrow": true}, "ornament": {"frame": "hairline", "rule": "short"}, "layout": "stacked"}'::jsonb, '{"isSample": true, "eyebrow": {"ar": "دعوة زفاف", "en": "Wedding Invitation"}, "names": {"ar": "اسم العروس واسم العريس", "en": "Bride and Groom"}, "footer": {"ar": "مملكة البحرين", "en": "Kingdom of Bahrain"}}'::jsonb, 'wax_seal', 50),
  ('sage-botanical', 'زيتوني نباتي', 'Sage Botanical', 'تصميم من المجموعة المبنية.', 'A floral design from the built collection.',
   '{"version": 1, "canvas": {"ratio": "5:7"}, "palette": {"ground": "#F2F0EA", "ink": "#23302A", "accent": "#4F6146"}, "typography": {"displayLatn": "cormorant", "displayArab": "aref", "bodyLatn": "manrope", "bodyArab": "plex", "align": "center", "uppercaseEyebrow": false}, "ornament": {"frame": "none", "rule": "short"}, "layout": "stacked"}'::jsonb, '{"isSample": true, "eyebrow": {"ar": "دعوة زفاف", "en": "Wedding Invitation"}, "names": {"ar": "اسم العروس واسم العريس", "en": "Bride and Groom"}, "footer": {"ar": "مملكة البحرين", "en": "Kingdom of Bahrain"}}'::jsonb, 'wax_seal', 60),
  ('naskh-heritage', 'نسخ تراثي', 'Naskh Heritage', 'تصميم من المجموعة المبنية.', 'A traditional arabic design from the built collection.',
   '{"version": 1, "canvas": {"ratio": "5:7"}, "palette": {"ground": "#F5F0E8", "ink": "#1B2C26", "accent": "#7A5F38"}, "typography": {"displayLatn": "cormorant", "displayArab": "aref", "bodyLatn": "manrope", "bodyArab": "plex", "align": "center", "uppercaseEyebrow": false}, "ornament": {"frame": "double", "rule": "long"}, "layout": "classic"}'::jsonb, '{"isSample": true, "eyebrow": {"ar": "دعوة زفاف", "en": "Wedding Invitation"}, "names": {"ar": "اسم العروس واسم العريس", "en": "Bride and Groom"}, "footer": {"ar": "مملكة البحرين", "en": "Kingdom of Bahrain"}}'::jsonb, 'wax_seal', 70),
  ('ink-noir', 'حِبري داكن', 'Ink Noir', 'تصميم من المجموعة المبنية.', 'A contemporary design from the built collection.',
   '{"version": 1, "canvas": {"ratio": "5:7"}, "palette": {"ground": "#191A19", "ink": "#F5F0E8", "accent": "#D8C49B"}, "typography": {"displayLatn": "cormorant", "displayArab": "aref", "bodyLatn": "manrope", "bodyArab": "plex", "align": "start", "uppercaseEyebrow": true}, "ornament": {"frame": "none", "rule": "long"}, "layout": "editorial"}'::jsonb, '{"isSample": true, "eyebrow": {"ar": "دعوة زفاف", "en": "Wedding Invitation"}, "names": {"ar": "اسم العروس واسم العريس", "en": "Bride and Groom"}, "footer": {"ar": "مملكة البحرين", "en": "Kingdom of Bahrain"}}'::jsonb, 'wax_seal', 80)
on conflict (slug) do nothing;

-- Now that every row carries a configuration, it can be required.
alter table public.templates alter column design_config set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'templates_design_config_shape') then
    alter table public.templates add constraint templates_design_config_shape check (
      design_config ? 'version' and design_config ? 'palette'
      and design_config ? 'typography' and design_config ? 'layout'
    );
  end if;
end
$$;

alter table public.templates drop column if exists palette;
alter table public.templates drop column if exists fonts;
alter table public.templates drop column if exists layout_config;
