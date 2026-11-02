import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { getFilterOptions } from "@/lib/catalog.functions";
import { formatDateRange } from "@/lib/format";

const optionsQuery = queryOptions({ queryKey: ["filter-options"], queryFn: () => getFilterOptions(), staleTime: 1000 * 60 * 10 });

export const Route = createFileRoute("/events")({
  loader: ({ context }) => context.queryClient.ensureQueryData(optionsQuery),
  head: () => ({
    meta: [
      { title: "Regattas & events — Charter a dinghy | DinghyCharter" },
      { name: "description", content: "Charter boats for Trofeo Princesa Sofia, French Olympic Week, Kiel Week, Lake Garda Meeting and world championships." },
      { property: "og:title", content: "Regattas & events — DinghyCharter" },
      { property: "og:description", content: "Find charter dinghies for the biggest regattas and world championships." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  const { data } = useSuspenseQuery(optionsQuery);
  return (
    <div className="container-page py-12 md:py-16">
      <p className="text-sm font-semibold text-ocean">Regattas & events</p>
      <h1 className="mt-2 max-w-2xl text-4xl font-semibold md:text-5xl">Charter a boat for the events that matter</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">Fly in, pick up a race-ready boat at the venue and focus on racing.</p>

      <div className="mt-12 divide-y divide-border rounded-3xl border border-border">
        {data.events.map((ev) => (
          <Link
            key={ev.id}
            to="/search"
            search={{ event: ev.slug }}
            className="group flex flex-col gap-3 p-6 transition-colors hover:bg-surface sm:flex-row sm:items-center sm:justify-between md:p-8"
          >
            <div>
              <h2 className="text-xl font-semibold transition-colors group-hover:text-ocean md:text-2xl">{ev.name}</h2>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{formatDateRange(ev.start_date, ev.end_date)}</span>
                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{ev.city}, {ev.country}</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-ocean">
              See boats <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
