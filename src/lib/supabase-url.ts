/** Normalize Supabase URLs copied from a project reference or dashboard field. */
export function normalizeSupabaseUrl(value: string | undefined | null): string | undefined {
  const raw = value?.trim().replace(/^['"]|['"]$/g, "");
  if (!raw) return undefined;

  const scheme = raw.match(/^(https?):\/\//i)?.[1] ?? "https";
  const hostname = raw.replace(/^(?:(?:https?):\/\/)+/i, "");
  const normalized = `${scheme}://${hostname}`.replace(/\/+$/, "");

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}
