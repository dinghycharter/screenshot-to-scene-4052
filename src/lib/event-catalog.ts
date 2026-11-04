export type CatalogEvent = {
  slug: string;
  name: string;
  city: string;
  country: string;
  startDate?: string;
  endDate?: string;
  dateLabel: string;
  classes: string[];
  logo?: string;
};

// Event and class entries are taken from eventos.xlsx. Unconfirmed dates stay
// as labels instead of being presented as fixed dates.
export const eventCatalog: CatalogEvent[] = [
  {
    slug: "trofeo-princesa-sofia", name: "Trofeo Princesa Sofía Mallorca by FERGUS Hotels",
    city: "Palma de Mallorca", country: "Spain", dateLabel: "March–April 2027",
    classes: ["ILCA 6", "ILCA 7", "49er", "49erFX", "470", "Nacra 17", "iQFOiL", "Formula Kite"],
    logo: "https://media05.adonnante.com/media/2025/01/logo-Trofeo-Princesa-Sofia.png",
  },
  {
    slug: "french-olympic-week", name: "Semaine Olympique Française – Hyères TPM",
    city: "Hyères", country: "France", dateLabel: "April 2027",
    classes: ["ILCA 6", "ILCA 7", "49er", "49erFX", "470", "Nacra 17", "iQFOiL", "Formula Kite"],
    logo: "https://sof.ffvoile.fr/media/qqbhxnfx/cover-site-web-sof-2026.jpg",
  },
  {
    slug: "kiel-week", name: "Kieler Woche",
    city: "Kiel", country: "Germany", dateLabel: "19–27 June 2027",
    startDate: "2027-06-19", endDate: "2027-06-27",
    classes: ["ILCA 6", "ILCA 7", "49er", "49erFX", "470", "Nacra 17", "29er"],
  },
  {
    slug: "world-sailing-fortaleza", name: "World Sailing Championships",
    city: "Fortaleza", country: "Brazil", dateLabel: "15–23 January 2027",
    startDate: "2027-01-15", endDate: "2027-01-23", classes: ["ILCA 7", "ILCA 6 (Women)", "iQFOiL", "Formula Kite"],
  },
  {
    slug: "ilca-under-21-worlds", name: "ILCA Under-21 World Championship",
    city: "Sandringham", country: "Australia", dateLabel: "10–17 January 2027",
    startDate: "2027-01-10", endDate: "2027-01-17", classes: ["ILCA 6"],
  },
  {
    slug: "ilca-4-youth-worlds", name: "ILCA 4 Youth World Championship",
    city: "Qinhuangdao", country: "China", dateLabel: "22–30 June 2027",
    startDate: "2027-06-22", endDate: "2027-06-30", classes: ["ILCA 4"],
  },
  {
    slug: "ilca-4-youth-europeans", name: "ILCA 4 Youth European Championship",
    city: "Quiberon", country: "France", dateLabel: "24–31 July 2027",
    startDate: "2027-07-24", endDate: "2027-07-31", classes: ["ILCA 4"],
  },
  {
    slug: "ilca-6-youth-worlds", name: "ILCA 6 Youth World Championship",
    city: "Volos", country: "Greece", dateLabel: "21–29 August 2027",
    startDate: "2027-08-21", endDate: "2027-08-29", classes: ["ILCA 6 Youth"],
  },
  {
    slug: "ilca-6-men-worlds", name: "ILCA 6 Men World Championship",
    city: "Volos", country: "Greece", dateLabel: "13–20 August 2027",
    startDate: "2027-08-13", endDate: "2027-08-20", classes: ["ILCA 6 (Men)"],
  },
  {
    slug: "ilca-6-masters-worlds", name: "ILCA 6 Masters World Championship",
    city: "Vilamoura", country: "Portugal", dateLabel: "25 September–3 October 2027",
    startDate: "2027-09-25", endDate: "2027-10-03", classes: ["ILCA 6"],
  },
  {
    slug: "ilca-7-masters-worlds", name: "ILCA 7 Masters World Championship",
    city: "Vilamoura", country: "Portugal", dateLabel: "5–13 October 2027",
    startDate: "2027-10-05", endDate: "2027-10-13", classes: ["ILCA 7"],
  },
  {
    slug: "world-sailing-gdynia", name: "World Sailing Championships",
    city: "Gdynia", country: "Poland", dateLabel: "July 2027 · dates to be confirmed",
    classes: ["49er", "49erFX", "470", "Nacra 17"],
  },
  {
    slug: "29er-worlds", name: "29er World Championship",
    city: "Marseille", country: "France", dateLabel: "3–10 July 2027",
    startDate: "2027-07-03", endDate: "2027-07-10", classes: ["29er"],
  },
  {
    slug: "29er-europeans", name: "29er European Championship",
    city: "Lake Balaton", country: "Hungary", dateLabel: "1–8 August 2027",
    startDate: "2027-08-01", endDate: "2027-08-08", classes: ["29er"],
  },
  {
    slug: "420-worlds", name: "420 World Championship",
    city: "Venue to be announced", country: "—", dateLabel: "Summer 2027 · dates to be confirmed",
    classes: ["420"],
  },
  {
    slug: "420-europeans", name: "420 European Championship",
    city: "Venue to be announced", country: "—", dateLabel: "Summer 2027 · dates to be confirmed",
    classes: ["420"],
  },
  {
    slug: "optimist-worlds", name: "Optimist World Championship",
    city: "Venue to be announced", country: "—", dateLabel: "2027 · dates to be confirmed",
    classes: ["Optimist"],
  },
  {
    slug: "optimist-europeans", name: "Optimist European Championship",
    city: "Venue to be announced", country: "—", dateLabel: "2027 · dates to be confirmed",
    classes: ["Optimist"],
  },
];

export const classLogos: Record<string, string> = {
  "29er": "/class-logos/29er.jpg",
  "420": "/class-logos/420.png",
  "470": "/class-logos/470.png",
  "49er": "/class-logos/49er_black.svg",
  "49erFX": "/class-logos/49er-FX.webp",
  "ILCA 4": "/class-logos/ilca.png",
  "ILCA 6": "/class-logos/ilca.png",
  "ILCA 6 (Women)": "/class-logos/ilca.png",
  "ILCA 6 (Men)": "/class-logos/ilca.png",
  "ILCA 6 Youth": "/class-logos/ilca.png",
  "ILCA 7": "/class-logos/ilca.png",
  "Finn": "/class-logos/Finn.png",
  "Nacra 17": "/class-logos/Nacra17.png",
  Optimist: "/class-logos/optimist.png",
};
