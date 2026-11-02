import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("h-8 w-8", className)}>
      <rect width="32" height="32" rx="9" className="fill-navy" />
      <path d="M16.5 6.5 L16.5 21 L24 21 Z" className="fill-ocean" />
      <path d="M15 9 L15 21 L9 21 Z" className="fill-navy-foreground" />
      <path
        d="M7 24.2c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1"
        fill="none"
        strokeWidth="1.6"
        strokeLinecap="round"
        className="stroke-navy-foreground"
      />
    </svg>
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
