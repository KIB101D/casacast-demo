import type { Locale, PropertyType } from "./schema";

type SeedProperty = {
  reference: string;
  type: PropertyType;
  operation: "sale" | "rent";
  price: number;
  bedrooms: number;
  bathrooms: number;
  area: number;
  /** Plot, m², for houses with land. */
  plotArea?: number;
  town: string;
  latitude: number;
  longitude: number;
  translations: Record<Locale, { title: string; description: string }>;
};

export const seedChannels = [
  { type: "site", name: "Agency website" },
  { type: "kyero", name: "Kyero XML feed" },
  { type: "telegram", name: "Telegram channel" },
  { type: "mock_portal", name: "Partner portal (mock)" },
] as const;

/** Fictional listings for a fictional agency. Prices in whole euros. */
export const seedProperties: SeedProperty[] = [
  {
    reference: "CB-0001",
    type: "flat",
    operation: "sale",
    price: 189000,
    bedrooms: 2,
    bathrooms: 1,
    area: 78,
    town: "Torrevieja",
    latitude: 37.978,
    longitude: -0.682,
    translations: {
      es: {
        title: "Piso luminoso a 300 m de la playa del Cura",
        description:
          "Piso reformado con terraza orientada al sur y vistas parciales al mar. Cerca de tiendas, restaurantes y el paseo marítimo.",
      },
      en: {
        title: "Bright flat 300 m from Playa del Cura",
        description:
          "Renovated flat with a south-facing terrace and partial sea views. Close to shops, restaurants and the promenade.",
      },
      uk: {
        title: "Світла квартира за 300 м від пляжу Playa del Cura",
        description:
          "Квартира після ремонту з терасою на південь і частковим видом на море. Поруч магазини, ресторани й набережна.",
      },
    },
  },
  {
    reference: "CB-0002",
    type: "chalet",
    operation: "sale",
    price: 545000,
    bedrooms: 4,
    bathrooms: 3,
    area: 210,
    plotArea: 900,
    town: "Jávea",
    latitude: 38.789,
    longitude: 0.166,
    translations: {
      es: {
        title: "Villa con piscina privada y vistas al Montgó",
        description:
          "Villa de una planta en parcela de 900 m² con piscina, jardín mediterráneo y garaje. A 5 minutos en coche del Arenal.",
      },
      en: {
        title: "Villa with private pool and views of Montgó",
        description:
          "Single-storey villa on a 900 m² plot with a pool, Mediterranean garden and garage. Five minutes' drive to the Arenal beach.",
      },
      uk: {
        title: "Вілла з власним басейном і видом на гору Монтго",
        description:
          "Одноповерхова вілла на ділянці 900 м² з басейном, середземноморським садом і гаражем. 5 хвилин машиною до пляжу Arenal.",
      },
    },
  },
  {
    reference: "CB-0003",
    type: "bungalow",
    operation: "sale",
    price: 134500,
    bedrooms: 2,
    bathrooms: 1,
    area: 62,
    town: "Orihuela Costa",
    latitude: 37.934,
    longitude: -0.744,
    translations: {
      es: {
        title: "Bungalow con solárium en urbanización con piscina",
        description:
          "Bungalow en planta alta con solárium privado. Urbanización cerrada con piscina comunitaria, cerca de Playa Flamenca.",
      },
      en: {
        title: "Bungalow with solarium in a gated complex with pool",
        description:
          "Upper-floor bungalow with a private solarium. Gated complex with a communal pool, near Playa Flamenca.",
      },
      uk: {
        title: "Бунгало із солярієм в закритому комплексі з басейном",
        description:
          "Бунгало на верхньому поверсі з власним солярієм. Закритий комплекс зі спільним басейном, поруч Playa Flamenca.",
      },
    },
  },
  {
    reference: "CB-0004",
    type: "flat",
    operation: "rent",
    price: 950,
    bedrooms: 2,
    bathrooms: 2,
    area: 85,
    town: "Alicante",
    latitude: 38.346,
    longitude: -0.49,
    translations: {
      es: {
        title: "Piso amueblado en el centro, alquiler de larga estancia",
        description:
          "Piso exterior con dos baños, aire acondicionado y ascensor. A 10 minutos a pie de la Explanada y la estación de tranvía.",
      },
      en: {
        title: "Furnished city-centre flat, long-term rental",
        description:
          "Bright flat with two bathrooms, air conditioning and a lift. Ten minutes' walk to the Explanada and the tram station.",
      },
      uk: {
        title: "Мебльована квартира в центрі, довгострокова оренда",
        description:
          "Світла квартира з двома ванними, кондиціонером і ліфтом. 10 хвилин пішки до Explanada і зупинки трамвая.",
      },
    },
  },
  {
    reference: "CB-0005",
    type: "country_house",
    operation: "sale",
    price: 312000,
    bedrooms: 3,
    bathrooms: 2,
    area: 165,
    plotArea: 2500,
    town: "Elche",
    latitude: 38.267,
    longitude: -0.698,
    translations: {
      es: {
        title: "Casa de campo con palmeras y huerto",
        description:
          "Casa tradicional rehabilitada en parcela de 2.500 m² con palmeras, huerto y pozo propio. A 10 minutos del centro de Elche.",
      },
      en: {
        title: "Country house with palm trees and an orchard",
        description:
          "Restored traditional house on a 2,500 m² plot with palms, an orchard and its own well. Ten minutes from central Elche.",
      },
      uk: {
        title: "Заміський будинок з пальмами і городом",
        description:
          "Відреставрований традиційний будинок на ділянці 2 500 м² з пальмами, городом і власною криницею. 10 хвилин до центру Ельче.",
      },
    },
  },
  {
    reference: "CB-0006",
    type: "flat",
    operation: "sale",
    price: 425000,
    bedrooms: 3,
    bathrooms: 2,
    area: 112,
    town: "Altea",
    latitude: 38.599,
    longitude: -0.051,
    translations: {
      es: {
        title: "Ático con terraza de 60 m² frente al mar",
        description:
          "Ático en primera línea con terraza panorámica, plaza de garaje y trastero. Paseo marítimo y casco antiguo a pocos pasos.",
      },
      en: {
        title: "Seafront penthouse with a 60 m² terrace",
        description:
          "Frontline penthouse with a panoramic terrace, a parking space and a storage room. Steps from the promenade and the old town.",
      },
      uk: {
        title: "Пентхаус на першій лінії з терасою 60 м²",
        description:
          "Пентхаус на першій лінії моря з панорамною терасою, паркомісцем і коморою. Набережна й старе місто поруч.",
      },
    },
  },
  {
    reference: "CB-0007",
    type: "land",
    operation: "sale",
    price: 98000,
    bedrooms: 0,
    bathrooms: 0,
    area: 1200,
    town: "Calpe",
    latitude: 38.645,
    longitude: 0.045,
    translations: {
      es: {
        title: "Parcela urbana con vistas al Peñón de Ifach",
        description:
          "Parcela de 1.200 m² con licencia para vivienda unifamiliar. Agua y luz en la parcela, orientación sur.",
      },
      en: {
        title: "Building plot with views of the Peñón de Ifach",
        description:
          "1,200 m² plot zoned for a detached house. Water and electricity at the plot, south-facing.",
      },
      uk: {
        title: "Ділянка під забудову з видом на скелю Пеньон-де-Іфач",
        description:
          "Ділянка 1 200 м² під будівництво окремого будинку. Вода й електрика підведені, орієнтація на південь.",
      },
    },
  },
  {
    reference: "CB-0008",
    type: "shop",
    operation: "rent",
    price: 1400,
    bedrooms: 0,
    bathrooms: 1,
    area: 95,
    town: "Benidorm",
    latitude: 38.538,
    longitude: -0.131,
    translations: {
      es: {
        title: "Local comercial en zona de paso, Levante",
        description:
          "Local a pie de calle con escaparate de 8 metros, salida de humos y baño. Ideal para cafetería o tienda.",
      },
      en: {
        title: "Retail unit on a busy street, Levante",
        description:
          "Street-level unit with an 8-metre shopfront, extraction outlet and toilet. Suits a café or a shop.",
      },
      uk: {
        title: "Комерційне приміщення на прохідній вулиці, Леванте",
        description:
          "Приміщення на першому поверсі з вітриною 8 метрів, витяжкою і санвузлом. Підійде для кав'ярні чи магазину.",
      },
    },
  },
  {
    reference: "CB-0009",
    type: "bungalow",
    operation: "rent",
    price: 780,
    bedrooms: 2,
    bathrooms: 1,
    area: 58,
    town: "Santa Pola",
    latitude: 38.192,
    longitude: -0.566,
    translations: {
      es: {
        title: "Bungalow con jardín cerca del Gran Alacant",
        description:
          "Bungalow en planta baja con jardín privado y piscina comunitaria. Alquiler anual, admite mascotas.",
      },
      en: {
        title: "Bungalow with a garden near Gran Alacant",
        description:
          "Ground-floor bungalow with a private garden and a communal pool. Annual rental, pets welcome.",
      },
      uk: {
        title: "Бунгало з садом біля Гран-Алаканта",
        description:
          "Бунгало на першому поверсі з власним садом і спільним басейном. Оренда на рік, можна з тваринами.",
      },
    },
  },
  {
    reference: "CB-0010",
    type: "chalet",
    operation: "sale",
    price: 689000,
    bedrooms: 5,
    bathrooms: 4,
    area: 280,
    plotArea: 1100,
    town: "Dénia",
    latitude: 38.84,
    longitude: 0.106,
    translations: {
      es: {
        title: "Chalet moderno en Les Rotes con acceso a calas",
        description:
          "Chalet de diseño con piscina infinita, domótica y cinco dormitorios en suite. A 200 m de las calas de Les Rotes.",
      },
      en: {
        title: "Modern chalet in Les Rotes near the coves",
        description:
          "Designer chalet with an infinity pool, smart-home system and five en-suite bedrooms. 200 m from the Les Rotes coves.",
      },
      uk: {
        title: "Сучасне шале в Лес-Ротес біля бухт",
        description:
          "Дизайнерське шале з infinity-басейном, системою «розумний дім» і п'ятьма спальнями з власними ванними. 200 м до бухт Лес-Ротес.",
      },
    },
  },
];
