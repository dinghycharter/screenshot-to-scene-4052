import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { resolveMediaUrls } from "@/lib/media";
import { normalizeSupabaseUrl } from "@/lib/supabase-url";

// Public, read-only catalog data for SSR (home, search, boat pages).
// Uses the publishable key; RLS only exposes public rows.
function createPublicClient() {
  // Vercel currently provides the public Supabase config as VITE_* variables.
  // Keep the unprefixed names as a backwards-compatible option for local/server deployments.
  const url = normalizeSupabaseUrl(import.meta.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"]);
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    const missing = [!url && "VITE_SUPABASE_URL", !key && "VITE_SUPABASE_PUBLISHABLE_KEY"].filter(Boolean);
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(", ")}`);
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

type PublicClient = ReturnType<typeof createPublicClient>;

export type DateWindow = { start_date: string; end_date: string };

export type BoatCardData = {
  id: string;
  title: string;
  city: string;
  country: string;
  dailyPrice: number;
  currency: string;
  className: string;
  classSlug: string;
  ownerName: string;
  ownerAvatar: string | null;
  rating: number | null;
  reviewCount: number;
  photo: string | null;
  availability: DateWindow[];
};

const CARD_SELECT =
  "id, title, city, country, daily_price, currency, owner_id, created_at, class:classes(slug, name), owner:profiles!boats_owner_id_fkey(full_name, avatar_url), photos:boat_photos(url, position), availability(start_date, end_date)";

type CardRow = {
  id: string;
  title: string;
  city: string;
  country: string;
  daily_price: number;
  currency: string;
  owner_id: string;
  class: { slug: string; name: string } | null;
  owner: { full_name: string; avatar_url: string | null } | null;
  photos: { url: string; position: number }[];
  availability: DateWindow[];
};

async function toCards(client: PublicClient, rows: CardRow[]): Promise<BoatCardData[]> {
  const ownerIds = [...new Set(rows.map((r) => r.owner_id))];
  const { data: ratings } = ownerIds.length
    ? await client.from("owner_ratings").select("owner_id, avg_rating, review_count").in("owner_id", ownerIds)
    : { data: [] };
  const ratingMap = new Map((ratings ?? []).map((r) => [r.owner_id, r]));
  const firstPhotos = rows.map((r) => [...r.photos].sort((a, b) => a.position - b.position)[0]?.url ?? null);
  const media = await resolveMediaUrls(client, [...firstPhotos, ...rows.map((r) => r.owner?.avatar_url)]);
  const today = new Date().toISOString().slice(0, 10);

  return rows.map((r, i) => {
    const rating = ratingMap.get(r.owner_id);
    const photo = firstPhotos[i];
    return {
      id: r.id,
      title: r.title,
      city: r.city,
      country: r.country,
      dailyPrice: Number(r.daily_price),
      currency: r.currency,
      className: r.class?.name ?? "",
      classSlug: r.class?.slug ?? "",
      ownerName: r.owner?.full_name ?? "Owner",
      ownerAvatar: r.owner?.avatar_url ? (media.get(r.owner.avatar_url) ?? null) : null,
      rating: rating?.avg_rating != null ? Number(rating.avg_rating) : null,
      reviewCount: rating?.review_count ?? 0,
      photo: photo ? (media.get(photo) ?? null) : null,
      availability: r.availability
        .filter((a) => a.end_date >= today)
        .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    };
  });
}

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const client = createPublicClient();
  const [events, classes, boats] = await Promise.all([
    client.from("events").select("*").order("sort_order"),
    client.from("classes").select("*").order("sort_order"),
    client.from("boats").select(CARD_SELECT).eq("is_published", true).order("created_at", { ascending: false }).limit(8),
  ]);
  const { data: classCounts } = await client.from("boats").select("class_id").eq("is_published", true);
  const counts = new Map<string, number>();
  (classCounts ?? []).forEach((b) => counts.set(b.class_id, (counts.get(b.class_id) ?? 0) + 1));

  return {
    events: events.data ?? [],
    classes: (classes.data ?? []).map((c) => ({ ...c, boatCount: counts.get(c.id) ?? 0 })),
    featured: await toCards(client, (boats.data ?? []) as unknown as CardRow[]),
  };
});

export const getFilterOptions = createServerFn({ method: "GET" }).handler(async () => {
  const client = createPublicClient();
  const [events, classes] = await Promise.all([
    client.from("events").select("id, slug, name, city, country, start_date, end_date").order("start_date"),
    client.from("classes").select("id, slug, name").order("sort_order"),
  ]);
  return { events: events.data ?? [], classes: classes.data ?? [] };
});

export const searchSchema = z.object({
  class: z.string().optional(),
  location: z.string().optional(),
  event: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  maxPrice: z.coerce.number().positive().optional(),
  available: z.coerce.boolean().optional(),
});
export type SearchFilters = z.infer<typeof searchSchema>;

export const searchBoats = createServerFn({ method: "GET" })
  .inputValidator((input: SearchFilters) => searchSchema.parse(input))
  .handler(async ({ data }) => {
    const client = createPublicClient();
    let query = client.from("boats").select(CARD_SELECT).eq("is_published", true);

    if (data.class) {
      const { data: cls } = await client.from("classes").select("id").eq("slug", data.class).maybeSingle();
      if (!cls) return [];
      query = query.eq("class_id", cls.id);
    }
    if (data.event) {
      const { data: ev } = await client.from("events").select("id").eq("slug", data.event).maybeSingle();
      if (!ev) return [];
      const { data: links } = await client.from("boat_events").select("boat_id").eq("event_id", ev.id);
      const ids = (links ?? []).map((l) => l.boat_id);
      if (!ids.length) return [];
      query = query.in("id", ids);
    }
    if (data.location) {
      const term = data.location.replace(/[%,()*]/g, " ").trim();
      if (term) query = query.or(`city.ilike.%${term}%,country.ilike.%${term}%`);
    }
    if (data.maxPrice) query = query.lte("daily_price", data.maxPrice);

    const { data: rows } = await query.order("daily_price", { ascending: true }).limit(200);
    let cards = await toCards(client, (rows ?? []) as unknown as CardRow[]);

    if (data.from || data.to) {
      const from = data.from ?? data.to!;
      const to = data.to ?? data.from!;
      cards = cards.filter((c) => c.availability.some((w) => w.start_date <= from && w.end_date >= to));
    } else if (data.available) {
      cards = cards.filter((c) => c.availability.length > 0);
    }
    return cards;
  });

export const getBoat = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const client = createPublicClient();
    const { data: boat } = await client
      .from("boats")
      .select(
        "*, class:classes(slug, name, category, crew), owner:profiles!boats_owner_id_fkey(id, full_name, avatar_url, bio, home_club, country, languages, created_at), photos:boat_photos(url, position), availability(id, start_date, end_date, note), boat_events(event:events(slug, name, city, start_date, end_date))",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!boat) return null;

    const [reviews, rating, booked, ownerBoats] = await Promise.all([
      client
        .from("reviews")
        .select("id, rating, comment, created_at, reviewer:profiles!reviews_reviewer_id_fkey(full_name, avatar_url, country)")
        .eq("owner_id", boat.owner_id)
        .order("created_at", { ascending: false })
        .limit(12),
      client.from("owner_ratings").select("avg_rating, review_count").eq("owner_id", boat.owner_id).maybeSingle(),
      client.rpc("boat_booked_ranges", { _boat_id: boat.id }),
      client.from("boats").select("id", { count: "exact", head: true }).eq("owner_id", boat.owner_id).eq("is_published", true),
    ]);

    const photos = [...(boat.photos ?? [])].sort((a, b) => a.position - b.position);
    const media = await resolveMediaUrls(client, [
      ...photos.map((p) => p.url),
      boat.owner?.avatar_url,
      ...(reviews.data ?? []).map((r) => r.reviewer?.avatar_url),
    ]);
    const today = new Date().toISOString().slice(0, 10);

    return {
      ...boat,
      daily_price: Number(boat.daily_price),
      security_deposit: Number(boat.security_deposit),
      specs: (boat.specs ?? {}) as Record<string, string>,
      photoUrls: photos.map((p) => media.get(p.url)).filter((u): u is string => !!u),
      ownerAvatar: boat.owner?.avatar_url ? (media.get(boat.owner.avatar_url) ?? null) : null,
      availability: (boat.availability ?? [])
        .filter((a) => a.end_date >= today)
        .sort((a, b) => a.start_date.localeCompare(b.start_date)),
      events: (boat.boat_events ?? []).map((be) => be.event).filter((e): e is NonNullable<typeof e> => !!e),
      bookedRanges: booked.data ?? [],
      rating: rating.data?.avg_rating != null ? Number(rating.data.avg_rating) : null,
      reviewCount: rating.data?.review_count ?? 0,
      ownerBoatCount: ownerBoats.count ?? 1,
      reviews: (reviews.data ?? []).map((r) => ({
        ...r,
        reviewerAvatar: r.reviewer?.avatar_url ? (media.get(r.reviewer.avatar_url) ?? null) : null,
      })),
    };
  });

export type BoatDetail = NonNullable<Awaited<ReturnType<typeof getBoat>>>;
