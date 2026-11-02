import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Heart, LayoutDashboard, LogOut, Menu, MessageCircle, Sailboat, User } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useMediaUrls } from "@/hooks/use-media-urls";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const { pathname } = useLocation();
  const { user, profile, signOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const media = useMediaUrls([profile?.avatar_url]);
  const overHero = pathname === "/" && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const name = profile?.full_name || user?.email?.split("@")[0] || "Account";

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        overHero ? "bg-transparent" : "border-b border-border/70 bg-background/85 backdrop-blur-xl",
      )}
    >
      <div className="container-page flex h-16 items-center justify-between gap-4 md:h-[72px]">
        <Logo inverted={overHero} />

        <nav className="hidden items-center gap-1 md:flex">
          {[
            { to: "/search" as const, label: "Find a boat" },
            { to: "/events" as const, label: "Events" },
            { to: "/list-your-boat" as const, label: "List your boat" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                overHero ? "text-background/90 hover:bg-background/10" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
              activeProps={{ className: overHero ? "text-background" : "text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-2 rounded-full border p-1 pl-3 transition-shadow hover:shadow-card",
                    overHero ? "border-background/40 bg-background/10 text-background" : "border-border bg-background",
                  )}
                  aria-label="Account menu"
                >
                  <Menu className="h-4 w-4" />
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={media(profile?.avatar_url) ?? undefined} alt={name} />
                    <AvatarFallback className="bg-navy text-xs font-semibold text-navy-foreground">{initials(name)}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 rounded-xl p-1.5">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-semibold">{name}</div>
                  <div className="text-xs capitalize text-muted-foreground">{profile?.account_type ?? "member"} account</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard"><LayoutDashboard /> Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard/messages"><MessageCircle /> Messages</Link>
                </DropdownMenuItem>
                {profile?.account_type === "owner" ? (
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard/boats"><Sailboat /> My boats</Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard/saved"><Heart /> Saved boats</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/dashboard/profile"><User /> Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void signOut()}>
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button asChild variant={overHero ? "glass" : "ghost"} size="sm" className="h-9 px-4">
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild variant={overHero ? "hero" : "default"} size="sm" className="h-9 px-4">
                <Link to="/auth" search={{ mode: "signup" }}>Sign up</Link>
              </Button>
            </div>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant={overHero ? "glass" : "outline"} size="icon" className="md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px]">
              <SheetHeader>
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-1 px-4">
                <Link to="/search" className="rounded-lg px-3 py-3 font-medium hover:bg-secondary">Find a boat</Link>
                <Link to="/events" className="rounded-lg px-3 py-3 font-medium hover:bg-secondary">Events</Link>
                <Link to="/list-your-boat" className="rounded-lg px-3 py-3 font-medium hover:bg-secondary">List your boat</Link>
                {!user && (
                  <div className="mt-4 grid gap-2">
                    <Button asChild variant="outline"><Link to="/auth">Sign in</Link></Button>
                    <Button asChild><Link to="/auth" search={{ mode: "signup" }}>Create account</Link></Button>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
