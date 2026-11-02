import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveMediaUrls } from "@/lib/media";

// Resolves stored media references (static, external or private storage) to displayable URLs.
export function useMediaUrls(refs: Array<string | null | undefined>) {
  const clean = [...new Set(refs.filter((r): r is string => !!r))].sort();
  const query = useQuery({
    queryKey: ["media-urls", clean],
    enabled: clean.length > 0,
    staleTime: 1000 * 60 * 60,
    queryFn: () => resolveMediaUrls(supabase, clean),
  });
  return (ref: string | null | undefined) => (ref ? (query.data?.get(ref) ?? null) : null);
}
