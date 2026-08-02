// Upload validation. Pure — the API route runs these checks server-side
// before anything touches storage. SVG is deliberately excluded from photo
// uploads (script-injection surface); branded SVG graphics live in code.
export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB
export const MIN_DIMENSION_PX = 320; // below this nothing is usable
export const MAX_DIMENSION_PX = 12000;

export interface UploadCandidate {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  widthPx?: number | null;
  heightPx?: number | null;
}

export interface UploadValidation {
  ok: boolean;
  errors: string[];
  /** Storage-safe file name (sanitized, lowercased, unique-ready). */
  safeName: string;
}

/** Sanitize a file name: keep letters/digits/dot/dash, collapse the rest. */
export function sanitizeFileName(name: string): string {
  const base = name.toLowerCase().replace(/\.[a-z0-9]+$/i, "");
  const ext = (name.match(/\.([a-z0-9]+)$/i)?.[1] ?? "bin").toLowerCase();
  const safeBase =
    base
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "image";
  return `${safeBase}.${ext}`;
}

export function validateUpload(candidate: UploadCandidate): UploadValidation {
  const errors: string[] = [];
  if (!ALLOWED_IMAGE_MIME.has(candidate.mimeType)) {
    errors.push(`unsupported type ${candidate.mimeType} — use JPG, PNG, WEBP or AVIF`);
  }
  if (candidate.sizeBytes <= 0) errors.push("empty file");
  if (candidate.sizeBytes > MAX_UPLOAD_BYTES) {
    errors.push(`file exceeds ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`);
  }
  const { widthPx, heightPx } = candidate;
  if (widthPx != null && heightPx != null && widthPx > 0 && heightPx > 0) {
    if (widthPx < MIN_DIMENSION_PX || heightPx < MIN_DIMENSION_PX) {
      errors.push(`too small (${widthPx}×${heightPx}) — minimum ${MIN_DIMENSION_PX}px per side`);
    }
    if (widthPx > MAX_DIMENSION_PX || heightPx > MAX_DIMENSION_PX) {
      errors.push(`too large (${widthPx}×${heightPx}) — maximum ${MAX_DIMENSION_PX}px per side`);
    }
  }
  return { ok: errors.length === 0, errors, safeName: sanitizeFileName(candidate.fileName) };
}

/** Alt-text sanity: present, not a filename, not trivially short. */
export function validateAltText(alt: string | null | undefined): { ok: boolean; reason?: string } {
  const t = (alt ?? "").trim();
  if (t.length === 0) return { ok: false, reason: "alt text is required for published imagery" };
  if (t.length < 8) return { ok: false, reason: "alt text too short to describe the image" };
  if (/\.(jpe?g|png|webp|avif)$/i.test(t)) return { ok: false, reason: "alt text must not be a file name" };
  return { ok: true };
}
