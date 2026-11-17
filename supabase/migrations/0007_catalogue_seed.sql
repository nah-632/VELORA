-- 0007_catalogue_seed.sql
--
-- The opening catalogue: eight designs across the seven categories named in the brief.
--
-- These are rows, not code. An administrator can edit, unpublish or replace any of them without a
-- deployment — which is the whole point of the brief's requirement that the library be data-driven.
--
-- Two things are deliberately *not* invented here:
--   * **Prices.** `base_price_fils` is left NULL for every design. Pricing is a business decision
--     the brief forbids guessing at, so the catalogue ships unpriced and the interface says so.
--   * **Couples.** `preview_content` holds the field labels themselves ("Bride and Groom"), not
--     invented names, and is flagged `isSample`. A catalogue must not look like it has customers.
--
-- Every palette is asserted for contrast against the design it is used in by tests/db/catalogue.mjs,
-- so a design that cannot be read fails the build rather than shipping.

insert into public.templates (
  slug, category_id, name_en, name_ar, description_en, description_ar,
  design_config, preview_content, supported_locales, customization_options,
  base_price_fils, status, is_featured, sort_order, published_at
)
select
  v.slug,
  c.id,
  v.name_en,
  v.name_ar,
  v.description_en,
  v.description_ar,
  v.design_config::jsonb,
  v.preview_content::jsonb,
  v.supported_locales::text[],
  '{"colorSlots":["ground","ink","accent"],"displayFonts":["cormorant","aref"],"layouts":["classic","editorial","stacked"]}'::jsonb,
  null,
  'published',
  v.is_featured,
  v.sort_order,
  now()
from (
  values
    (
      'ivory-classic', 'classic-royal',
      'Ivory Classic', 'عاجي كلاسيكي',
      'A centred, formal invitation with a hairline frame and a short rule above the names.',
      'دعوة رسمية متمركزة بإطار رفيع وخط قصير فوق الأسماء.',
      '{"version":1,"canvas":{"ratio":"5:7"},"palette":{"ground":"#F5F0E8","ink":"#191A19","accent":"#7A5F38"},"typography":{"displayLatn":"cormorant","displayArab":"aref","bodyLatn":"manrope","bodyArab":"plex","align":"center","uppercaseEyebrow":true},"ornament":{"frame":"hairline","rule":"short"},"layout":"classic"}',
      '{"isSample":true,"eyebrow":{"ar":"دعوة زفاف","en":"Wedding Invitation"},"names":{"ar":"اسم العروس واسم العريس","en":"Bride and Groom"},"footer":{"ar":"مملكة البحرين","en":"Kingdom of Bahrain"}}',
      '{ar,en}', true, 10
    ),
    (
      'emerald-royal', 'classic-royal',
      'Emerald Royal', 'زمردي ملكي',
      'Deep emerald ground with a double frame. The most formal design in the collection.',
      'خلفية زمردية داكنة بإطار مزدوج. أكثر التصاميم رسمية في المجموعة.',
      '{"version":1,"canvas":{"ratio":"5:7"},"palette":{"ground":"#263E35","ink":"#F5F0E8","accent":"#D8C49B"},"typography":{"displayLatn":"cormorant","displayArab":"aref","bodyLatn":"manrope","bodyArab":"plex","align":"center","uppercaseEyebrow":true},"ornament":{"frame":"double","rule":"long"},"layout":"classic"}',
      '{"isSample":true,"eyebrow":{"ar":"دعوة زفاف","en":"Wedding Invitation"},"names":{"ar":"اسم العروس واسم العريس","en":"Bride and Groom"},"footer":{"ar":"مملكة البحرين","en":"Kingdom of Bahrain"}}',
      '{ar,en}', true, 20
    ),
    (
      'sand-editorial', 'luxury-editorial',
      'Sand Editorial', 'رملي تحريري',
      'Left aligned, wide margins, an oversized rule. Set like a magazine spread.',
      'محاذاة إلى البداية وهوامش واسعة وخط عريض. بأسلوب المجلات.',
      '{"version":1,"canvas":{"ratio":"5:7"},"palette":{"ground":"#ECE5D9","ink":"#191A19","accent":"#7A5F38"},"typography":{"displayLatn":"cormorant","displayArab":"aref","bodyLatn":"manrope","bodyArab":"plex","align":"start","uppercaseEyebrow":true},"ornament":{"frame":"none","rule":"long"},"layout":"editorial"}',
      '{"isSample":true,"eyebrow":{"ar":"دعوة زفاف","en":"Wedding Invitation"},"names":{"ar":"اسم العروس واسم العريس","en":"Bride and Groom"},"footer":{"ar":"مملكة البحرين","en":"Kingdom of Bahrain"}}',
      '{ar,en}', true, 30
    ),
    (
      'paper-minimal', 'modern-minimal',
      'Paper Minimal', 'ورقي بسيط',
      'No frame, no rule. Names in a single face with a great deal of space around them.',
      'بلا إطار أو خط. الأسماء بخط واحد مع مساحة واسعة حولها.',
      '{"version":1,"canvas":{"ratio":"5:7"},"palette":{"ground":"#FFFFFF","ink":"#191A19","accent":"#5B5F5C"},"typography":{"displayLatn":"manrope","displayArab":"plex","bodyLatn":"manrope","bodyArab":"plex","align":"start","uppercaseEyebrow":false},"ornament":{"frame":"none","rule":"none"},"layout":"editorial"}',
      '{"isSample":true,"eyebrow":{"ar":"دعوة زفاف","en":"Wedding Invitation"},"names":{"ar":"اسم العروس واسم العريس","en":"Bride and Groom"},"footer":{"ar":"مملكة البحرين","en":"Kingdom of Bahrain"}}',
      '{ar,en}', false, 40
    ),
    (
      'rose-letterpress', 'romantic',
      'Rose Letterpress', 'وردي بارز',
      'A soft rose ground with a hairline frame and centred, stacked text.',
      'خلفية وردية ناعمة بإطار رفيع ونص متمركز متراكب.',
      '{"version":1,"canvas":{"ratio":"5:7"},"palette":{"ground":"#F7EFEC","ink":"#2A2224","accent":"#8F4F55"},"typography":{"displayLatn":"cormorant","displayArab":"aref","bodyLatn":"manrope","bodyArab":"plex","align":"center","uppercaseEyebrow":true},"ornament":{"frame":"hairline","rule":"short"},"layout":"stacked"}',
      '{"isSample":true,"eyebrow":{"ar":"دعوة زفاف","en":"Wedding Invitation"},"names":{"ar":"اسم العروس واسم العريس","en":"Bride and Groom"},"footer":{"ar":"مملكة البحرين","en":"Kingdom of Bahrain"}}',
      '{ar,en}', false, 50
    ),
    (
      'sage-botanical', 'floral',
      'Sage Botanical', 'زيتوني نباتي',
      'Muted sage ground with generous margins. Quiet rather than decorative.',
      'خلفية زيتونية هادئة وهوامش واسعة. هادئ بعيد عن الزخرفة.',
      '{"version":1,"canvas":{"ratio":"5:7"},"palette":{"ground":"#F2F0EA","ink":"#23302A","accent":"#4F6146"},"typography":{"displayLatn":"cormorant","displayArab":"aref","bodyLatn":"manrope","bodyArab":"plex","align":"center","uppercaseEyebrow":false},"ornament":{"frame":"none","rule":"short"},"layout":"stacked"}',
      '{"isSample":true,"eyebrow":{"ar":"دعوة زفاف","en":"Wedding Invitation"},"names":{"ar":"اسم العروس واسم العريس","en":"Bride and Groom"},"footer":{"ar":"مملكة البحرين","en":"Kingdom of Bahrain"}}',
      '{ar,en}', false, 60
    ),
    (
      'naskh-heritage', 'traditional-arabic',
      'Naskh Heritage', 'نسخ تراثي',
      'Arabic only: a Naskh setting with an emerald ink and a double frame.',
      'بالعربية فقط: تنضيد بالنسخ بحبر زمردي وإطار مزدوج.',
      '{"version":1,"canvas":{"ratio":"5:7"},"palette":{"ground":"#F5F0E8","ink":"#1B2C26","accent":"#7A5F38"},"typography":{"displayLatn":"cormorant","displayArab":"aref","bodyLatn":"manrope","bodyArab":"plex","align":"center","uppercaseEyebrow":false},"ornament":{"frame":"double","rule":"long"},"layout":"classic"}',
      '{"isSample":true,"eyebrow":{"ar":"دعوة زفاف","en":"Wedding Invitation"},"names":{"ar":"اسم العروس واسم العريس","en":"Bride and Groom"},"footer":{"ar":"مملكة البحرين","en":"Kingdom of Bahrain"}}',
      '{ar}', false, 70
    ),
    (
      'ink-noir', 'contemporary',
      'Ink Noir', 'حِبري داكن',
      'An obsidian ground with ivory type in a single column. Contemporary and strong.',
      'خلفية داكنة بنص عاجي في عمود واحد. معاصر وقوي.',
      '{"version":1,"canvas":{"ratio":"5:7"},"palette":{"ground":"#191A19","ink":"#F5F0E8","accent":"#D8C49B"},"typography":{"displayLatn":"cormorant","displayArab":"aref","bodyLatn":"manrope","bodyArab":"plex","align":"start","uppercaseEyebrow":true},"ornament":{"frame":"none","rule":"long"},"layout":"editorial"}',
      '{"isSample":true,"eyebrow":{"ar":"دعوة زفاف","en":"Wedding Invitation"},"names":{"ar":"اسم العروس واسم العريس","en":"Bride and Groom"},"footer":{"ar":"مملكة البحرين","en":"Kingdom of Bahrain"}}',
      '{ar,en}', false, 80
    ),
    (
      'draft-preview-only', 'modern-minimal',
      'Unreleased Study', 'دراسة غير منشورة',
      'A design still being worked on. It must not appear to the public.',
      'تصميم قيد العمل. يجب ألا يظهر للعامة.',
      '{"version":1,"canvas":{"ratio":"5:7"},"palette":{"ground":"#F5F0E8","ink":"#191A19","accent":"#7A5F38"},"typography":{"displayLatn":"cormorant","displayArab":"aref","bodyLatn":"manrope","bodyArab":"plex","align":"center","uppercaseEyebrow":true},"ornament":{"frame":"hairline","rule":"short"},"layout":"classic"}',
      '{"isSample":true,"eyebrow":{"ar":"مسودة","en":"Draft"},"names":{"ar":"اسم العروس واسم العريس","en":"Bride and Groom"},"footer":{"ar":"مملكة البحرين","en":"Kingdom of Bahrain"}}',
      '{ar,en}', false, 90
    )
) as v(slug, category_slug, name_en, name_ar, description_en, description_ar,
       design_config, preview_content, supported_locales, is_featured, sort_order)
join public.template_categories c on c.slug = v.category_slug
on conflict (slug) do nothing;

-- The last row is deliberately a draft: it exists so the isolation suite has something that must
-- be invisible to the public and visible to an administrator. It is not a product decision.
update public.templates
   set status = 'draft', published_at = null
 where slug = 'draft-preview-only';
