import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, CalendarDays, MapPin, MessageCircle, Search, ShieldCheck, Star } from "lucide-react";
import heroImage from "@/assets/hero-fleet.jpg";
import { getHomeData } from "@/lib/catalog.functions";
import { BoatCard } from "@/components/boats/BoatCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateRange } from "@/lib/format";

const homeQuery = queryOptions({ queryKey: ["home"], queryFn: () => getHomeData() });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DinghyCharter — Find the perfect charter boat for your next regatta" },
      {
        name: "description",
        content: "The global marketplace for dinghy charter boats. Charter ILCA, 420, 470, 49er, Nacra 17 and Optimist boats at regattas and training camps worldwide.",
      },
      { property: "og:title", content: "DinghyCharter — Find the perfect charter boat for your next regatta" },
      { property: "og:description", content: "The global marketplace for dinghy charter boats." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  component: HomePage,
});

function HomePage() {
  const { data } = useSuspenseQuery(homeQuery);
  return (
    <>
      <Hero classes={data.classes} />
      <EventsSection events={data.events} />
      <ClassesSection classes={data.classes} />
      <FeaturedSection boats={data.featured} />
      <HowItWorks />
      <OwnerBand />
    </>
  );
}

type HomeData = Awaited<ReturnType<typeof getHomeData>>;

function Hero({ classes }: { classes: HomeData["classes"] }) {
  const navigate = useNavigate();
  const [cls, setCls] = useState<string>("");
  const [location, setLocation] = useState("");

  return (
    <section className="relative isolate flex min-h-[640px] items-end overflow-hidden md:min-h-[760px]">
      <img
        src={heroImage}
        alt="A fleet of single-handed dinghies racing upwind on a deep blue sea"
        width={1920}
        height={1088}
        className="absolute inset-0 -z-20 h-full w-full object-cover"
        fetchPriority="high"
      />
      <div className="absolute inset-0 -z-10 bg-hero-overlay" />

      <div className="container-page pb-14 pt-32 md:pb-24">
        <div className="max-w-3xl animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-background/30 bg-background/10 px-3 py-1 text-xs font-semibold text-background backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-ocean" />
            Trusted by sailors at 40+ regattas
          </span>
          <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] text-background sm:text-5xl md:text-[68px]">
            Find the perfect charter boat for your next regatta.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-background/85 md:text-xl">The global marketplace for dinghy charter boats.</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate({
              to: "/search",
              search: { class: cls || undefined, location: location.trim() || undefined },
            });
          }}
          className="mt-9 grid max-w-3xl animate-fade-up gap-2 rounded-2xl bg-background p-2 shadow-lift [animation-delay:120ms] sm:grid-cols-[1fr_1fr_auto]"
        >
          <label className="flex flex-col rounded-xl px-4 py-2 transition-colors hover:bg-secondary">
            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">Boat class</span>
            <Select value={cls} onValueChange={(v) => setCls(v === "all" ? "" : v)}>
              <SelectTrigger className="h-7 border-0 p-0 text-[15px] text-muted-foreground shadow-none focus:ring-0">
                <SelectValue placeholder="Any class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any class</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col rounded-xl px-4 py-2 transition-colors hover:bg-secondary sm:border-l sm:border-border">
            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">Location</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Palma, Hyères, Garda…"
              className="h-7 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            />
          </label>
          <Button type="submit" variant="ocean" size="xl" className="h-auto min-h-14 rounded-xl">
            <Search /> Search boats
          </Button>
        </form>

        <div className="mt-5 flex animate-fade-up flex-wrap items-center gap-3 [animation-delay:200ms]">
          <Button asChild variant="glass" size="lg">
            <Link to="/list-your-boat">List your boat <ArrowRight /></Link>
          </Button>
          <span className="text-sm text-background/75">Earn from your boat when you're not racing it.</span>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <p className="text-sm font-semibold text-ocean">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-semibold md:text-4xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function EventsSection({ events }: { events: HomeData["events"] }) {
  return (
    <section className="container-page py-20 md:py-28">
      <SectionHeading
        eyebrow="Popular events"
        title="Charter for the regattas that matter"
        action={
          <Link to="/events" className="hidden items-center gap-1 text-sm font-semibold text-foreground hover:text-ocean sm:flex">
            All events <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />
      <div className="-mx-5 mt-10 flex snap-x gap-4 overflow-x-auto px-5 pb-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-4">
        {events.map((ev, i) => (
          <Link
            key={ev.id}
            to="/search"
            search={{ event: ev.slug }}
            className={`group relative flex min-w-[260px] snap-start flex-col justify-between overflow-hidden rounded-2xl border border-border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift md:min-w-0 ${
              i === 0 ? "bg-navy-gradient text-navy-foreground md:col-span-2 lg:row-span-2" : "bg-card"
            }`}
          >
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider ${i === 0 ? "text-navy-foreground/70" : "text-ocean"}`}>
                {formatDateRange(ev.start_date, ev.end_date)}
              </p>
              <h3 className={`mt-3 font-semibold ${i === 0 ? "text-3xl md:text-4xl" : "text-xl"}`}>{ev.name}</h3>
              {i === 0 && ev.description && <p className="mt-3 max-w-sm text-navy-foreground/80">{ev.description}</p>}
            </div>
            <div className={`mt-10 flex items-center justify-between text-sm ${i === 0 ? "text-navy-foreground/80" : "text-muted-foreground"}`}>
              <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{ev.city}, {ev.country}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ClassesSection({ classes }: { classes: HomeData["classes"] }) {
  return (
    <section className="bg-surface py-20 md:py-28">
      <div className="container-page">
        <SectionHeading eyebrow="Popular classes" title="Every class, from Optimist to Nacra 17" />
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {classes.map((c) => (
            <Link
              key={c.id}
              to="/search"
              search={{ class: c.slug }}
              className="group rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-ocean/40 hover:shadow-card"
            >
              <p className="font-display text-xl font-semibold text-navy transition-colors group-hover:text-ocean dark:text-foreground">{c.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.category}</p>
              <p className="mt-4 text-xs font-semibold text-foreground">
                {c.boatCount > 0 ? `${c.boatCount} boat${c.boatCount > 1 ? "s" : ""}` : "Be the first to list"}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedSection({ boats }: { boats: HomeData["featured"] }) {
  return (
    <section className="container-page py-20 md:py-28">
      <SectionHeading
        eyebrow="Ready to race"
        title="Recently listed boats"
        action={
          <Button asChild variant="outline" className="hidden sm:inline-flex">
            <Link to="/search">Browse all boats</Link>
          </Button>
        }
      />
      <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {boats.map((b, i) => (
          <BoatCard key={b.id} boat={b} index={i} />
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Search, title: "Find your boat", text: "Filter by class, event, location and dates. Every listing shows real photos, equipment and specs." },
    { icon: MessageCircle, title: "Request & chat", text: "Send a booking request and talk details with the owner in a secure, on-platform chat." },
    { icon: CalendarDays, title: "Pick up & race", text: "The owner confirms, you collect the boat rigged at the venue — and focus on racing." },
  ];
  return (
    <section className="border-y border-border bg-surface py-20 md:py-28">
      <div className="container-page">
        <SectionHeading eyebrow="How it works" title="From search to start line in three steps" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="rounded-2xl bg-card p-7 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-ocean-soft text-ocean">
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="font-display text-4xl font-semibold text-border">0{i + 1}</span>
              </div>
              <h3 className="mt-6 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 grid gap-6 text-sm sm:grid-cols-3">
          {[
            { icon: ShieldCheck, text: "Messages and payments stay on the platform" },
            { icon: Star, text: "Owner ratings from verified charters" },
            { icon: MapPin, text: "Boats waiting at the venue, ready to sail" },
          ].map((t) => (
            <div key={t.text} className="flex items-center gap-3 text-muted-foreground">
              <t.icon className="h-5 w-5 shrink-0 text-navy dark:text-foreground" />
              {t.text}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function OwnerBand() {
  return (
    <section className="container-page py-20 md:py-28">
      <div className="relative overflow-hidden rounded-3xl bg-navy-gradient px-8 py-14 text-navy-foreground md:px-16 md:py-20">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-ocean/30 blur-3xl" />
        <div className="relative grid items-center gap-10 md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="text-sm font-semibold text-navy-foreground/70">For boat owners</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold md:text-5xl">Your boat, racing while you're not.</h2>
            <p className="mt-4 max-w-lg text-navy-foreground/80">
              List your dinghy in minutes, set your own prices and availability, and approve every booking yourself.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <Button asChild variant="hero" size="xl">
              <Link to="/list-your-boat">List your boat <ArrowRight /></Link>
            </Button>
            <p className="text-sm text-navy-foreground/70">Free to list. You stay in control.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
