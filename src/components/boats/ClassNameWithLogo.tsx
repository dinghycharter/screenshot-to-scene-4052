import { cn } from "@/lib/utils";

type ClassNameWithLogoProps = {
  name: string;
  slug: string;
  className?: string;
  logoClassName?: string;
};

const classLogos: Record<string, string> = {
  "29er": "/class-logos/29er.jpg",
  "49er": "/class-logos/49er_black.svg",
  "49erfx": "/class-logos/49er-FX.webp",
  "420": "/class-logos/420.png",
  "470": "/class-logos/470.png",
  "finn": "/class-logos/Finn.png",
  "ilca4": "/class-logos/ilca.png",
  "ilca6": "/class-logos/ilca.png",
  "ilca7": "/class-logos/ilca.png",
  "nacra17": "/class-logos/Nacra17.png",
  "optimist": "/class-logos/optimist.png",
};

export function ClassNameWithLogo({ name, slug, className, logoClassName }: ClassNameWithLogoProps) {
  const logo = classLogos[slug.toLowerCase().replace(/[^a-z0-9]/g, "")];

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <span className="truncate">{name}</span>
      {logo && <img src={logo} alt="" aria-hidden="true" loading="lazy" className={cn("h-4 w-7 shrink-0 object-contain", logoClassName)} />}
    </span>
  );
}