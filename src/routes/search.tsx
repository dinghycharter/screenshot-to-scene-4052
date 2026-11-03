import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarDays, SlidersHorizontal, X } from "lucide-react";
import { getFilterOptions, searchBoats, searchSchema, type SearchFilters } from "@/lib/catalog.functions";
import { BoatCard, BoatCardSkeleton } from "@/components/boats/BoatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatPrice } from "@/lib/format";
import { ClassNameWithLogo } from "@/components/boats/ClassNameWithLogo";

const filterOptionsQuery = queryOptions({ queryKey: ["filter-options"], queryFn: () => getFilterOptions(), staleTime: 1000 * 60 * 10 });
const searchQuery = (filters: SearchFilters) =>
  queryOptions({ queryKey: ["search", filters], queryFn: () => searchBoats({ data: filters }) });

const MAX_PRICE = 250;

export const Route = createFileRoute("/search")({
  validateSearch: (search) => searchSchema.catch({}).parse(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(filterOptionsQuery),
      context.queryClient.ensureQueryData(searchQuery(deps)),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Search charter dinghies — DinghyCharter" },
      { name: "description", content: "Search race-ready charter dinghies by class, event, location, dates and price." },
      { property: "og:title", content: "Search charter dinghies — DinghyCharter" },
      { property: "og:description", content: "Search race-ready charter dinghies by class, event, location, dates and price." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const { data: options } = useSuspenseQuery(filterOptionsQuery);
  const results = useQuery({ ...searchQuery(filters), placeholderData: (prev) => prev });

  const setFilter = (patch: Partial<SearchFilters>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true, resetScroll: false });

  const activeCount = Object.values(filters).filter((v) => v !== undefined && v !== "" && v !== false).length;
  const eventName = options.events.find((e) => e.slug === filters.event)?.name;
  const className = options.classes.find((c) => c.slug === filters.class)?.name;

  const filterPanel = <Filters filters={filters} options={options} setFilter={setFilter} />;

  return (
    <div className="container-page py-8 md:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold md:text-4xl">
            {className ? `${className} charter boats` : eventName ? `Boats for ${eventName}` : "Find a charter boat"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {results.data ? `${results.data.length} boat${results.data.length === 1 ? "" : "s"} available` : "Searching…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => navigate({ search: {}, replace: true })}>
              <X /> Clear filters
            </Button>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="lg:hidden">
                <SlidersHorizontal /> Filters {activeCount > 0 && <span className="rounded-full bg-navy px-1.5 text-xs text-navy-foreground">{activeCount}</span>}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[340px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-left">Filters</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-8">{filterPanel}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-border p-5">{filterPanel}</div>
        </aside>

        <div>
          {results.isLoading && !results.data ? (
            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <BoatCardSkeleton key={i} />)}
            </div>
          ) : results.data && results.data.length > 0 ? (
            <div className={`grid gap-x-6 gap-y-10 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${results.isFetching ? "opacity-60" : ""}`}>
              {results.data.map((b, i) => <BoatCard key={b.id} boat={b} index={i} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-6 py-20 text-center">
              <h2 className="text-xl font-semibold">No boats match these filters</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                Try widening your dates, removing the price limit or choosing another location.
              </p>
              <Button className="mt-6" variant="outline" onClick={() => navigate({ search: {}, replace: true })}>
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type Options = Awaited<ReturnType<typeof getFilterOptions>>;

function Filters({
  filters,
  options,
  setFilter,
}: {
  filters: SearchFilters;
  options: Options;
  setFilter: (patch: Partial<SearchFilters>) => void;
}) {
  const [location, setLocation] = useState(filters.location ?? "");
  const [price, setPrice] = useState(filters.maxPrice ?? MAX_PRICE);

  useEffect(() => setLocation(filters.location ?? ""), [filters.location]);
  useEffect(() => setPrice(filters.maxPrice ?? MAX_PRICE), [filters.maxPrice]);

  useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.location ?? "") !== location) setFilter({ location: location.trim() || undefined });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const range: DateRange | undefined = filters.from
    ? { from: parseISO(filters.from), to: filters.to ? parseISO(filters.to) : undefined }
    : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Boat class</Label>
        <Select value={filters.class ?? "all"} onValueChange={(v) => setFilter({ class: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any class</SelectItem>
            {options.classes.map((c) => <SelectItem key={c.slug} value={c.slug}><ClassNameWithLogo name={c.name} slug={c.slug} /></SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input id="location" className="h-11 rounded-xl" placeholder="City or country" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Event</Label>
        <Select value={filters.event ?? "all"} onValueChange={(v) => setFilter({ event: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any event</SelectItem>
            {options.events.map((e) => <SelectItem key={e.slug} value={e.slug}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Dates</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-11 w-full justify-start rounded-xl font-normal">
              <CalendarDays className="text-muted-foreground" />
              {range?.from
                ? `${format(range.from, "d MMM")}${range.to ? ` – ${format(range.to, "d MMM yyyy")}` : ""}`
                : <span className="text-muted-foreground">Any dates</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              numberOfMonths={1}
              selected={range}
              disabled={{ before: new Date() }}
              onSelect={(r) =>
                setFilter({
                  from: r?.from ? format(r.from, "yyyy-MM-dd") : undefined,
                  to: r?.to ? format(r.to, "yyyy-MM-dd") : undefined,
                })
              }
            />
            {range && (
              <div className="border-t border-border p-2">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setFilter({ from: undefined, to: undefined })}>
                  Clear dates
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Max price / day</Label>
          <span className="text-sm font-semibold">{price >= MAX_PRICE ? "Any" : formatPrice(price)}</span>
        </div>
        <Slider
          min={20}
          max={MAX_PRICE}
          step={5}
          value={[price]}
          onValueChange={([v]) => setPrice(v)}
          onValueCommit={([v]) => setFilter({ maxPrice: v >= MAX_PRICE ? undefined : v })}
        />
      </div>

      <div className="flex items-center justify-between rounded-xl bg-surface p-3.5">
        <div>
          <Label htmlFor="available">Available only</Label>
          <p className="text-xs text-muted-foreground">Hide boats without open dates</p>
        </div>
        <Switch id="available" checked={!!filters.available} onCheckedChange={(v) => setFilter({ available: v || undefined })} />
      </div>
    </div>
  );
}
