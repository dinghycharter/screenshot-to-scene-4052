import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/site/Logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            The global marketplace for dinghy charter boats. Race-ready boats from trusted owners, at the regattas that matter.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Sailors</h4>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li><Link to="/search" className="hover:text-foreground">Find a boat</Link></li>
            <li><Link to="/events" className="hover:text-foreground">Regattas & events</Link></li>
            <li><Link to="/auth" search={{ mode: "signup" }} className="hover:text-foreground">Create an account</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Owners</h4>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li><Link to="/list-your-boat" className="hover:text-foreground">List your boat</Link></li>
            <li><Link to="/dashboard/boats/new" className="hover:text-foreground">Add a boat</Link></li>
            <li><Link to="/dashboard" className="hover:text-foreground">Owner dashboard</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Popular classes</h4>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            {[
              ["ilca-7", "ILCA 7"],
              ["470", "470"],
              ["49er", "49er"],
              ["optimist", "Optimist"],
            ].map(([slug, name]) => (
              <li key={slug}>
                <Link to="/search" search={{ class: slug }} className="hover:text-foreground">{name} charter</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col items-start justify-between gap-2 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} DinghyCharter. All rights reserved.</p>
          <p>DinghyCharter is a marketplace and does not own any boats.</p>
        </div>
      </div>
    </footer>
  );
}
