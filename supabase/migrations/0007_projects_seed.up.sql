-- =====================================================================
-- 0007 (UP) — Authoritative project catalog (20 signed master plans)
-- Idempotent UPSERT on the natural key (organization_id, name) added in 0006.
-- category + ownership_eligibility drive the copilots' hard eligibility rule:
--   ITC            → all_nationalities  (foreign investors OK; the residency story)
--   future_cities  → gcc_omani_only     (Sultan Haitham City)
--   surooh         → gcc_omani_only
-- Ministry follows the app's ownership rule: ITC = Ministry of Heritage and
-- Tourism; Future Cities + Surooh = Ministry of Housing and Urban Planning
-- (pending final MoHUP confirmation).
-- Config data (not mock business data). Reversible: 0007_projects_seed.down.sql
-- =====================================================================

insert into projects (organization_id, name, developer, location, category, ownership_eligibility, ministry, branded_residence, notes)
values
  -- ITC — all nationalities (Ministry of Heritage and Tourism) ---------------
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Jebel Sifah / Hawana Salalah','Muriya','Sifah / Salalah','ITC','all_nationalities','Ministry of Heritage and Tourism',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Al Mouj Muscat','Al Mouj Muscat (MAF)','Seeb','ITC','all_nationalities','Ministry of Heritage and Tourism','St. Regis',null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','AIDA','Dar Global (with OMRAN)','Yiti','ITC','all_nationalities','Ministry of Heritage and Tourism','Trump / Marriott / Nickelodeon / Fendi Casa',null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','The Sustainable City — Yiti','Diamond Developers','Yiti','ITC','all_nationalities','Ministry of Heritage and Tourism',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Muscat Bay','Saraya Bandar Jissah','Bandar Jissah','ITC','all_nationalities','Ministry of Heritage and Tourism',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Opal','Alnama','Muscat Hills','ITC','all_nationalities','Ministry of Heritage and Tourism',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Golf Hills / The Pearl','Alosool','Muscat Hills','ITC','all_nationalities','Ministry of Heritage and Tourism',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Vistal','Leo Development','Al Mouj','ITC','all_nationalities','Ministry of Heritage and Tourism','Victoria Swarovski',null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Bellevue','Ideal Buildings','Al Mouj','ITC','all_nationalities','Ministry of Heritage and Tourism',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Residences at Mandarin Oriental','Eagle Hills','Shatti Al Qurum','ITC','all_nationalities','Ministry of Heritage and Tourism','Mandarin Oriental',null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Yamal','Talaat Mostafa Group (with Al Muhaidib)','Al Manuma, Seeb','ITC','all_nationalities','Ministry of Heritage and Tourism',null,'Flag: confirm ITC vs Housing classification'),
  -- Future Cities — GCC/Omani only, Sultan Haitham City (MoHUP) --------------
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Wadi Zaha','Al Ahly Sabbour','Sultan Haitham City','future_cities','gcc_omani_only','Ministry of Housing and Urban Planning',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Sarooj Oasis','Sarooj Development','Sultan Haitham City','future_cities','gcc_omani_only','Ministry of Housing and Urban Planning',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Hay Al Wafa','Al Abrar','Sultan Haitham City','future_cities','gcc_omani_only','Ministry of Housing and Urban Planning',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Yenaier Residences / Hay Al We''am','Adrak / Adanté','Sultan Haitham City','future_cities','gcc_omani_only','Ministry of Housing and Urban Planning',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Jood','Talaat Mostafa Group (with Al Muhaidib)','Sultan Haitham City','future_cities','gcc_omani_only','Ministry of Housing and Urban Planning',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Hay Al Ahlam','Dream Villa','Sultan Haitham City','future_cities','gcc_omani_only','Ministry of Housing and Urban Planning',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Hay Al Nuha','Tibian','Sultan Haitham City','future_cities','gcc_omani_only','Ministry of Housing and Urban Planning',null,null),
  -- Surooh — GCC/Omani only (MoHUP) -----------------------------------------
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Hay Al Naseem','Adrak / Adanté','Barka','surooh','gcc_omani_only','Ministry of Housing and Urban Planning',null,null),
  ('6a32be59-155d-4662-9058-3a74fb2b6872','Hay Al Majd','Almajd Real Estate','Sohar','surooh','gcc_omani_only','Ministry of Housing and Urban Planning',null,null)
on conflict (organization_id, name) do update set
  developer             = excluded.developer,
  location              = excluded.location,
  category              = excluded.category,
  ownership_eligibility = excluded.ownership_eligibility,
  ministry              = excluded.ministry,
  branded_residence     = excluded.branded_residence,
  notes                 = coalesce(excluded.notes, projects.notes),
  updated_at            = now();
