import type { ChannelContext, ChannelError, ListingSnapshot } from "./types";

/** Test helpers: a valid listing and a channel context with no real network or clock. */
export function listing(overrides: Partial<ListingSnapshot> = {}): ListingSnapshot {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    reference: "CB-0001",
    type: "flat",
    operation: "sale",
    status: "active",
    price: 189000,
    bedrooms: 2,
    bathrooms: 1,
    area: 78,
    plotArea: null,
    town: "Torrevieja",
    province: "Alicante",
    latitude: 37.978,
    longitude: -0.682,
    translations: [
      {
        locale: "en",
        title: "Bright flat 300 m from the beach",
        description:
          "Renovated flat with a south-facing terrace and partial sea views. Close to shops, restaurants and the promenade.",
      },
      { locale: "es", title: "Piso luminoso", description: "Piso reformado con terraza al sur." },
    ],
    photos: ["https://res.cloudinary.com/demo/image/upload/v1/a.jpg"],
    pageUrls: {
      es: "https://casacast.example/es/homes/cb-0001-bright-flat",
      en: "https://casacast.example/en/homes/cb-0001-bright-flat",
      uk: "https://casacast.example/uk/homes/cb-0001-bright-flat",
    },
    updatedAt: new Date("2026-10-22T09:30:00Z"),
    ownerRole: "admin",
    ...overrides,
  };
}

export function context(overrides: Partial<ChannelContext> = {}): ChannelContext {
  return {
    siteUrl: new URL("https://casacast.example"),
    config: {},
    env: {},
    now: new Date("2026-10-22T10:00:00Z"),
    fetch: (() => {
      throw new Error("No network in tests");
    }) as unknown as typeof fetch,
    random: () => 0.99,
    sleep: async () => {},
    ...overrides,
  };
}

/** Resolves to the error a call fails with, and fails the test if the call succeeds. */
export function failure(promise: Promise<unknown>): Promise<ChannelError> {
  return promise.then(
    () => {
      throw new Error("Expected the call to fail");
    },
    (error: ChannelError) => error,
  );
}
