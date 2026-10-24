/**
 * Towns the agency works in, offered as a list so the same town is always spelled the same way
 * (the catalogue filters and the portals group by it). Anything else goes in "Other".
 */
export const TOWNS = [
  "Alicante",
  "Altea",
  "Benidorm",
  "Benissa",
  "Calpe",
  "Dénia",
  "Elche",
  "Guardamar del Segura",
  "Jávea",
  "La Nucía",
  "Moraira",
  "Orihuela Costa",
  "Pilar de la Horadada",
  "Santa Pola",
  "Torrevieja",
  "Villajoyosa",
] as const;

/** The value of the "Other…" option; the town is then typed into `townOther`. */
export const OTHER_TOWN = "__other";

export function isListedTown(town: string) {
  return (TOWNS as readonly string[]).includes(town);
}
