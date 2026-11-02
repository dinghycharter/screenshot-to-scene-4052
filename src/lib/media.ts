import type { SupabaseClient } from "@supabase/supabase-js";

// Media references are stored as one of:
//  - "/images/..."             bundled static file
//  - "https://..."             external URL (e.g. Google avatar)
//  - "storage://<bucket>/<path>"  private storage object, served through a signed URL
export const STORAGE_PREFIX = "storage://";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7;

export function toStorageRef(bucket: string, path: string) {
  return `${STORAGE_PREFIX}${bucket}/${path}`;
}

export function isStorageRef(ref: string | null | undefined): ref is string {
  return !!ref && ref.startsWith(STORAGE_PREFIX);
}

export function parseStorageRef(ref: string) {
  const rest = ref.slice(STORAGE_PREFIX.length);
  const slash = rest.indexOf("/");
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

// Returns a map from reference -> displayable URL.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveMediaUrls(client: SupabaseClient<any>, refs: Array<string | null | undefined>) {
  const map = new Map<string, string>();
  const byBucket = new Map<string, string[]>();
  for (const ref of refs) {
    if (!ref) continue;
    if (!isStorageRef(ref)) {
      map.set(ref, ref);
      continue;
    }
    const { bucket, path } = parseStorageRef(ref);
    const list = byBucket.get(bucket) ?? [];
    if (!list.includes(path)) list.push(path);
    byBucket.set(bucket, list);
  }
  await Promise.all(
    [...byBucket.entries()].map(async ([bucket, paths]) => {
      const { data } = await client.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_TTL);
      data?.forEach((item) => {
        if (item.signedUrl && item.path) map.set(toStorageRef(bucket, item.path), item.signedUrl);
      });
    }),
  );
  return map;
}
