import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { eventCatalog, classLogos } from "@/lib/event-catalog";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Regattas & events — Charter a dinghy | DinghyCharter" },
      { name: "description", content: "Browse the regattas and championships available for dinghy charter in 2027." },
      { property: "og:title", content: "Regattas & events — DinghyCharter" },
      { property: "og:description", content: "Find charter dinghies for regattas and world championships." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  return (
    <div className="container-page py-12 md:py-16">
      <p className="text-sm font-semibold text-ocean">Events for 2027</p>
      <h1 className="mt-2 max-w-2xl text-4xl font-semibold md:text-5xl">Find a boat for your next regatta</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">Browse the events currently on our calendar. Dates marked as to be confirmed are provisional.</p>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {eventCatalog.map((event) => (
          <article key={event.slug} className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
            <div className="flex min-h-36 items-center justify-center border-b border-border bg-surface p-6">
              {event.logo ? (
                <img src={event.logo} alt={`${event.name} logo`} className="max-h-28 max-w-full object-contain" loading="lazy" />
              ) : (
                <div className="text-center font-display text-2xl font-bold tracking-tight text-navy dark:text-foreground">
                  {event.slug === "kiel-week" ? <><span className="text-ocean">KIELER</span> WOCHE</> : event.name}
                </div>
              )}
            </div>
            <div className="p-6">
              <h2 className="text-xl font-semibold md:text-2xl">{event.name}</h2>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{event.dateLabel}</span>
                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{event.city}{event.country !== "—" ? `, ${event.country}` : ""}</span>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3" aria-label={`Classes at ${event.name}`}>
                {event.classes.map((name) => {
                  const logo = classLogos[name];
                  return (
                    <span key={name} title={name} className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-border bg-background px-2" aria-label={name}>
                      {logo ? <img src={logo} alt={name} className="h-6 max-w-12 object-contain" loading="lazy" /> : <span className="text-[10px] font-bold text-muted-foreground">{name}</span>}
                    </span>
                  );
                })}
              </div>
              <Link to="/search" search={{ event: event.slug }} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-ocean hover:underline">
                Find boats for this event <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
