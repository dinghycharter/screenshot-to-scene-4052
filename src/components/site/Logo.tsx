import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import logoMark from "@/assets/dinghycharter-logo.png";

export function LogoMark({ className }: { className?: string }) {
  return (
    <img src={logoMark} alt="" aria-hidden="true" className={cn("h-8 w-8 rounded-xl object-cover", className)} />
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <Link to="/" className={cn("group inline-flex items-center gap-2.5", className)} aria-label="DinghyCharter home">
      <LogoMark className="transition-transform duration-300 group-hover:-rotate-6" />
      <span
        className={cn(
          "font-display text-[17px] font-semibold tracking-tight",
          inverted ? "text-background" : "text-navy dark:text-foreground",
        )}
      >
        Dinghy<span className={inverted ? "text-background/80" : "text-ocean"}>Charter</span>
      </span>
    </Link>
  );
}
