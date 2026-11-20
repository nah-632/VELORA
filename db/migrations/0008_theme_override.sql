-- 0008_theme_override.sql
--
-- The template's identity lives in `templates`; what an operator may change *for one event* lives
-- here. Kept as its own column rather than merged into `templates.design_config` because the two
-- have different lifetimes: the template is a document shipped with the code, the override is a
-- decision about one wedding, and resetting the override must never touch the template.
--
-- Shape enforced by `ThemeOverrideSchema` (src/lib/templates/schema.ts) at the boundary; the column
-- itself only insists that it is an object, because a CHECK constraint cannot hold a subquery.

alter table public.events add column if not exists theme_override jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_theme_override_is_object') then
    alter table public.events add constraint events_theme_override_is_object
      check (jsonb_typeof(theme_override) = 'object');
  end if;
end
$$;

comment on column public.events.theme_override is
  'Per-event palette/font/seal overrides, validated by ThemeOverrideSchema. Empty means "the template".';

-- The Golden Palace template row, so the picker can offer it.
--
-- `templates` is the table the console reads; the token system is code. This row carries the display
-- metadata and a `design_config` that the older renderer understands, so an event can select it
-- before the token renderer is the only path — and the token renderer reads the slug.
update public.templates
   set name_ar = 'قصر ذهبي', name_en = 'Golden Palace',
       description_ar = 'فناء قصر مغربي عند الغروب: عاجي وذهب عتيق، قوس محراب، وشمع عنابي.',
       description_en = 'A Moorish palace courtyard at dusk: ivory and antique gold, a mihrab arch, burgundy wax.'
 where slug = 'golden-palace';

insert into public.templates (slug, name_ar, name_en, description_ar, description_en, opening_animation_type, design_config, preview_content, sort_order)
values (
  'golden-palace', 'قصر ذهبي', 'Golden Palace',
  'فناء قصر مغربي عند الغروب: عاجي وذهب عتيق، قوس محراب، وشمع عنابي.',
  'A Moorish palace courtyard at dusk: ivory and antique gold, a mihrab arch, burgundy wax.',
  'wax_seal',
  -- `design_config` is what the existing renderer reads, and it must stay valid for it: T1's five
  -- palette values are mapped onto the three roles that renderer understands (ivory → ground,
  -- ink → ink, gold → accent) so the template is usable from the moment it is picked. The token
  -- renderer reads the same row plus the slug, and gets the full five.
  '{"version":1,"canvas":{"ratio":"5:7"},"palette":{"ground":"#F6EEDC","ink":"#2B1B12","accent":"#B8913A"},"typography":{"displayLatn":"cormorant","displayArab":"aref","bodyLatn":"manrope","bodyArab":"plex","align":"center","uppercaseEyebrow":true},"ornament":{"frame":"double","rule":"short"},"layout":"classic"}'::jsonb,
  '{"isSample":true,"eyebrow":{"ar":"دعوة زفاف","en":"Wedding Invitation"},"names":{"ar":"خالد ونور","en":"Khalid & Noor"},"footer":{"ar":"مملكة البحرين","en":"Kingdom of Bahrain"}}'::jsonb,
  5
)
on conflict (slug) do update
  set name_ar = excluded.name_ar,
      name_en = excluded.name_en,
      description_ar = excluded.description_ar,
      description_en = excluded.description_en;
