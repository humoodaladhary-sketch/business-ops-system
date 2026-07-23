-- =====================================================================
-- 0007 (DOWN) — remove the seeded project catalog
-- NOTE: units.project_id references projects ON DELETE CASCADE — deleting a
-- seeded project also removes any units later attached to it. Reassign such
-- units before reverting if you need to keep them.
-- =====================================================================
delete from projects
where organization_id = '6a32be59-155d-4662-9058-3a74fb2b6872'
  and name in (
    'Jebel Sifah / Hawana Salalah','Al Mouj Muscat','AIDA','The Sustainable City — Yiti',
    'Muscat Bay','Opal','Golf Hills / The Pearl','Vistal','Bellevue',
    'Residences at Mandarin Oriental','Yamal',
    'Wadi Zaha','Sarooj Oasis','Hay Al Wafa','Yenaier Residences / Hay Al We''am','Jood',
    'Hay Al Ahlam','Hay Al Nuha',
    'Hay Al Naseem','Hay Al Majd'
  );
