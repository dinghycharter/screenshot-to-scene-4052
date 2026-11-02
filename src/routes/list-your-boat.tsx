import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, CalendarCheck2, MessageCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import boatPark from "/images/boats/boatpark.jpg?url";

export const Route = createFileRoute("/list-your-boat")({
  head: () => ({
    meta: [
      { title: "List your boat — Earn from your dinghy | DinghyCharter" },
      { name: "description", content: "List your racing dinghy on DinghyCharter. Set your prices and availability and approve every booking yourself." },
      { property: "og:title", content: "List your boat on DinghyCharter" },
      { property: "og:description", content: "Earn from your dinghy when you're not racing it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ListYourBoatPage,
});

function ListYourBoatPage() {
  const { user } = useAuth();
  const cta = user ? (
    <Button asChild variant="ocean" size="xl"><Link to="/dashboard/boats/new">Add your boat <ArrowRight /></Link></Button>
  ) : (
    <Button asChild variant="ocean" size="xl">
      <Link to="/auth" search={{ mode: "signup", type: "owner", redirect: "/dashboard/boats/new" }}>Start listing <ArrowRight /></Link>
    </Button>
  );

  return (
    <>
      <section className="container-page grid items-center gap-12 py-12 md:py-20 lg:grid-cols-2">
        <div className="animate-fade-up">
          <p className="text-sm font-semibold text-ocean">For boat owners</p>
          <h1 className="mt-3 text-balance text-4xl font-semibold leading-tight md:text-6xl">Your boat, racing while you're not.</h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            Reach sailors travelling to regattas and training camps. You set the price, the dates and who sails your boat.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {cta}
            <span className="text-sm text-muted-foreground">Free to list</span>
          </div>
        </div>
        <div className="relative">
          <img src={boatPark} alt="Dinghies on trolleys in a regatta boat park" width={1280} height={960} className="aspect-[4/3] w-full rounded-3xl object-cover shadow-lift" />
          <div className="absolute -bottom-6 left-6 rounded-2xl bg-card p-4 shadow-lift">
            <p className="text-xs text-muted-foreground">Booking request</p>
            <p className="font-semibold">ILCA 7 · Princesa Sofia</p>
            <p className="mt-1 text-sm font-semibold text-success">Accept or decline in one tap</p>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-surface py-20">
        <div className="container-page grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Wallet, title: "Your price", text: "Set a daily rate and a refundable security deposit." },
            { icon: CalendarCheck2, title: "Your calendar", text: "Open only the dates and events that suit you." },
            { icon: BadgeCheck, title: "Your decision", text: "Every booking is a request — nothing is confirmed without you." },
            { icon: MessageCircle, title: "Safe messaging", text: "Chat with sailors on the platform; contact details stay private." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl bg-card p-6 shadow-soft">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-ocean-soft text-ocean"><f.icon className="h-5 w-5" /></div>
              <h2 className="mt-5 font-sans text-lg font-semibold tracking-normal">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
        <div className="container-page mt-14 text-center">{cta}</div>
      </section>
    </>
  );
}
