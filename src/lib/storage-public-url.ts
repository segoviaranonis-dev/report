/**
 * URL pública de un objeto en Supabase Storage (bucket público).
 * Misma convención que usa la web RIMEC / vistas (…/storage/v1/object/public/…).
 */
export function publicStorageObjectUrl(bucket: string, objectPath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) {
    return "";
  }
  const clean = objectPath.replace(/^\/+/, "");
  return `${base}/storage/v1/object/public/${bucket}/${clean}`;
}
