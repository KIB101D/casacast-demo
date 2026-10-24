import { describe, expect, it } from "vitest";
import { uk } from "@/i18n/admin/uk";
import { OTHER_TOWN } from "@/lib/properties/towns";
import { filledTranslations, parsePropertyForm } from "./property";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const fields: Record<string, string> = {
    type: "flat",
    operation: "sale",
    status: "draft",
    price: "189000",
    bedrooms: "2",
    bathrooms: "1",
    area: "78",
    town: "Torrevieja",
    latitude: "",
    longitude: "",
    "translations.es.title": "Piso luminoso cerca de la playa",
    "translations.es.description": "Piso reformado con terraza orientada al sur.",
    "translations.en.title": "",
    "translations.en.description": "",
    "translations.uk.title": "",
    "translations.uk.description": "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("parsePropertyForm", () => {
  it("accepts a minimal valid listing and turns numbers into numbers", () => {
    const result = parsePropertyForm(form());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.price).toBe(189000);
    expect(result.data.province).toBe("Alicante");
    expect(result.data.latitude).toBeUndefined();
  });

  it("requires the Spanish title and description", () => {
    const result = parsePropertyForm(
      form({ "translations.es.title": "", "translations.es.description": "" }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors["translations.es.title"]).toBeDefined();
    expect(result.fieldErrors["translations.es.description"]).toBeDefined();
  });

  it("lets English and Ukrainian stay empty, but not half-filled", () => {
    const result = parsePropertyForm(form({ "translations.en.title": "Bright flat by the beach" }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors["translations.en.description"]).toBeDefined();
    expect(result.fieldErrors["translations.en.title"]).toBeUndefined();
  });

  it("rejects prices that aren't whole euros", () => {
    const result = parsePropertyForm(form({ price: "1999.5" }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.price?.[0]).toMatch(/whole number/);
  });

  it("rejects text in number fields", () => {
    const result = parsePropertyForm(form({ bedrooms: "two" }));
    expect(result.success).toBe(false);
  });

  it("needs both coordinates or neither", () => {
    const result = parsePropertyForm(form({ latitude: "37.98" }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.longitude).toBeDefined();
  });

  it("accepts both coordinates", () => {
    const result = parsePropertyForm(form({ latitude: "37.98", longitude: "-0.68" }));
    expect(result.success).toBe(true);
  });

  it("treats an empty number field as missing, not as 0", () => {
    const result = parsePropertyForm(form({ bedrooms: "", bathrooms: "" }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.bedrooms?.[0]).toBe("Enter the bedrooms.");
    expect(result.fieldErrors.bathrooms).toBeDefined();
  });

  it("still accepts an explicit 0 bedrooms", () => {
    expect(parsePropertyForm(form({ bedrooms: "0" })).success).toBe(true);
  });

  it("reports description errors together with other field errors", () => {
    // Regression: schema refinements used to be skipped once any field had failed.
    const result = parsePropertyForm(
      form({ price: "12.5", "translations.es.title": "", "translations.es.description": "" }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.price).toBeDefined();
    expect(result.fieldErrors["translations.es.title"]).toBeDefined();
  });

  it("rejects an unknown property type", () => {
    const result = parsePropertyForm(form({ type: "castle" }));
    expect(result.success).toBe(false);
  });
});

describe("filledTranslations", () => {
  it("returns only the languages that were filled in", () => {
    const result = parsePropertyForm(
      form({
        "translations.uk.title": "Світла квартира біля моря",
        "translations.uk.description": "Квартира після ремонту з терасою на південь.",
      }),
    );
    if (!result.success) throw new Error("expected a valid form");
    expect(filledTranslations(result.data).map((t) => t.locale)).toEqual(["es", "uk"]);
  });
});

describe("plot area", () => {
  it("is optional", () => {
    const result = parsePropertyForm(form({ plotArea: "" }));
    expect(result.success && result.data.plotArea).toBeUndefined();
  });

  it("takes a whole number of square metres", () => {
    const result = parsePropertyForm(form({ type: "chalet", plotArea: "900" }));
    expect(result.success && result.data.plotArea).toBe(900);
  });

  it("refuses text and fractions", () => {
    for (const plotArea of ["big", "12.5", "0"]) {
      const result = parsePropertyForm(form({ plotArea }));
      expect(result.success ? [] : result.fieldErrors.plotArea).toHaveLength(1);
    }
  });
});

describe("parsePropertyForm: town", () => {
  it("takes a town from the list", () => {
    const result = parsePropertyForm(form({ town: "Altea" }));
    expect(result.success && result.data.town).toBe("Altea");
  });

  it("takes the typed town when Other is chosen", () => {
    const result = parsePropertyForm(form({ town: OTHER_TOWN, townOther: "  Finestrat " }));
    expect(result.success && result.data.town).toBe("Finestrat");
  });

  it("asks to choose a town when none is picked", () => {
    const result = parsePropertyForm(form({ town: "" }));
    expect(!result.success && result.fieldErrors.town?.[0]).toBe("Choose the town.");
  });

  it("puts the error on the text box when Other is chosen but left empty", () => {
    const result = parsePropertyForm(form({ town: OTHER_TOWN, townOther: "" }));
    expect(!result.success && result.fieldErrors.townOther?.[0]).toBe("Enter the town.");
  });

  it("speaks the agent's language", () => {
    const result = parsePropertyForm(form({ bedrooms: "" }), uk.validation);
    expect(!result.success && result.fieldErrors.bedrooms?.[0]).toBe("Вкажіть кількість спалень.");
  });
});
