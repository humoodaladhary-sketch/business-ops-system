// The private Supabase Storage bucket holding every Alwalaa media asset.
// Bucket ids are CASE-SENSITIVE in Supabase Storage — the live bucket is
// `ALWALAA`, so a lowercase literal resolves to "Bucket not found" and every
// signed URL fails. Kept in one place (and env-overridable) so a preview or
// staging project can point at its own bucket without editing call sites.
export const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "ALWALAA";
