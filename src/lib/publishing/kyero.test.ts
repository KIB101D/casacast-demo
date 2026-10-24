import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateXML } from "xmllint-wasm";
import { kyeroAdapter } from "./adapters/kyero";
import { context, failure, listing } from "./test-fixtures";
import {
  buildKyeroFeed,
  KYERO_MAX_IMAGES,
  kyeroDate,
  kyeroImageUrl,
  kyeroType,
  validateForKyero,
} from "./kyero";
import { ChannelError } from "./types";

describe("Kyero feed", () => {
  it("maps every property type to a Kyero type", () => {
    expect(kyeroType("flat")).toBe("apartment");
    expect(kyeroType("chalet")).toBe("villa");
    expect(kyeroType("country_house")).toBe("country house");
    expect(kyeroType("shop")).toBe("commercial");
  });

  it("writes the v3 header and one <property> per listing", () => {
    const xml = buildKyeroFeed([listing(), listing({ reference: "CB-0002" })]);
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<root>/);
    expect(xml).toContain("<feed_version>3</feed_version>");
    expect(xml.match(/<property>/g)).toHaveLength(2);
  });

  it("writes the fields portals read", () => {
    const xml = buildKyeroFeed([listing()]);
    for (const fragment of [
      "<id>CB-0001</id>",
      "<ref>CB-0001</ref>",
      "<date>2026-10-22 09:30:00</date>",
      "<price>189000</price>",
      "<currency>EUR</currency>",
      "<price_freq>sale</price_freq>",
      "<type>apartment</type>",
      "<town>Torrevieja</town>",
      "<beds>2</beds>",
      "<built>78</built>",
      "<latitude>37.978</latitude>",
      '<image id="1">',
      "<en>https://casacast.example/en/homes/cb-0001-bright-flat</en>",
    ]) {
      expect(xml).toContain(fragment);
    }
  });

  it("marks rentals as monthly", () => {
    expect(buildKyeroFeed([listing({ operation: "rent" })])).toContain(
      "<price_freq>month</price_freq>",
    );
  });

  it("escapes text so a title can't break the XML", () => {
    const xml = buildKyeroFeed([
      listing({
        translations: [{ locale: "en", title: "Sea & <sun>", description: 'A "quiet" flat' }],
      }),
    ]);
    expect(xml).toContain("Sea &amp; &lt;sun&gt;");
    expect(xml).toContain("A &quot;quiet&quot; flat");
  });

  it("leaves out Ukrainian, which Kyero doesn't accept", () => {
    const xml = buildKyeroFeed([
      listing({
        translations: [
          { locale: "en", title: "Flat", description: "Nice flat." },
          { locale: "uk", title: "Квартира", description: "Гарна квартира." },
        ],
      }),
    ]);
    expect(xml).not.toContain("Квартира");
    expect(xml).not.toContain("<uk>");
  });

  it(`sends at most ${KYERO_MAX_IMAGES} photos`, () => {
    const photos = Array.from({ length: 60 }, (_, i) => `https://img.example/${i}.jpg`);
    expect(buildKyeroFeed([listing({ photos })]).match(/<image /g)).toHaveLength(KYERO_MAX_IMAGES);
  });

  it("omits <location> without coordinates", () => {
    expect(buildKyeroFeed([listing({ latitude: null, longitude: null })])).not.toContain(
      "<location>",
    );
  });

  it("formats dates as the spec does, in UTC", () => {
    expect(kyeroDate(new Date("2026-01-05T08:04:09.123Z"))).toBe("2026-01-05 08:04:09");
  });
});

describe("validateForKyero", () => {
  it("accepts a complete listing", () => {
    expect(validateForKyero(listing())).toEqual([]);
  });

  it("lists everything that's missing", () => {
    const problems = validateForKyero(
      listing({
        price: 0,
        photos: [],
        translations: [{ locale: "uk", title: "Квартира", description: "Опис" }],
      }),
    );
    expect(problems).toEqual([
      "a price above zero",
      "at least one photo",
      "a description in English or Spanish",
    ]);
  });
});

describe("kyeroAdapter", () => {
  it("lets a valid listing into the feed and links the feed", async () => {
    const result = await kyeroAdapter.publish(listing(), context());
    expect(result.externalId).toBe("CB-0001");
    expect(result.url).toBe("https://casacast.example/feeds/kyero.xml");
  });

  it("refuses an invalid one for good (no retries)", async () => {
    const error = await failure(kyeroAdapter.publish(listing({ photos: [] }), context()));
    expect(error).toBeInstanceOf(ChannelError);
    expect(error.retryable).toBe(false);
    expect(error.message).toBe("Kyero needs at least one photo.");
  });

  it("removes the entry on unpublish", async () => {
    expect(await kyeroAdapter.unpublish(listing(), "CB-0001", "sold", context())).toMatchObject({
      externalId: null,
    });
  });
});

// Kyero's own files, as published (see kyero-spec/README.md).
const spec = (file: string) =>
  readFileSync(new URL(`./kyero-spec/${file}`, import.meta.url), "utf8");
const XSD = spec("kyeroV3.0.xsd");

async function validate(xml: string) {
  const result = await validateXML({
    xml: { fileName: "feed.xml", contents: xml },
    schema: { fileName: "kyeroV3.0.xsd", contents: XSD },
  });
  return result.errors.map((e) => e.message);
}

describe("Kyero XSD", () => {
  it("accepts Kyero's own sample feed (the validator works)", async () => {
    expect(await validate(spec("kyero_v3_test_feed.xml"))).toEqual([]);
  });

  it("rejects a feed that breaks the schema", async () => {
    const broken = buildKyeroFeed([listing()]).replace("<price_freq>sale", "<price_freq>yearly");
    expect((await validate(broken)).join("\n")).toMatch(/price_freq/);
  });

  it("accepts our feed for every kind of listing", async () => {
    const xml = buildKyeroFeed([
      listing(),
      listing({
        reference: "CB-0002",
        type: "chalet",
        price: 545000,
        bedrooms: 4,
        bathrooms: 3,
        area: 210,
        plotArea: 900,
      }),
      listing({ reference: "CB-0004", operation: "rent", price: 950 }),
      listing({ reference: "CB-0007", type: "land", bedrooms: 0, bathrooms: 0, area: 1200 }),
      listing({ reference: "CB-0008", type: "shop", latitude: null, longitude: null }),
      listing({ reference: "CB-0005", type: "country_house" }),
      listing({ reference: "CB-0003", type: "bungalow" }),
      listing({
        reference: "CB-0011",
        translations: [
          { locale: "es", title: "Piso «Sol & Mar»", description: "Línea 1\nLínea 2 <b>no</b>" },
          { locale: "uk", title: "Квартира", description: "Опис" },
        ],
        photos: Array.from(
          { length: 60 },
          (_, i) => `https://res.cloudinary.com/demo/image/upload/v1/casacast/p/${i}.webp`,
        ),
      }),
    ]);
    expect(await validate(xml)).toEqual([]);
  });
});

describe("photos for Kyero", () => {
  it("offers Cloudinary photos as JPG, which Cloudinary converts on the fly", () => {
    expect(kyeroImageUrl("https://res.cloudinary.com/demo/image/upload/v1/p/abc.webp")).toBe(
      "https://res.cloudinary.com/demo/image/upload/v1/p/abc.jpg",
    );
  });

  it("keeps JPG, PNG and GIF as they are and leaves out other WebP files", () => {
    expect(kyeroImageUrl("https://example.com/a.PNG")).toBe("https://example.com/a.PNG");
    expect(kyeroImageUrl("http://localhost:3000/uploads/a.webp")).toBeNull();
  });

  it("refuses a listing whose only photos Kyero can't read", () => {
    expect(validateForKyero(listing({ photos: ["http://localhost:3000/uploads/a.webp"] }))).toEqual(
      ["at least one photo it can read (JPG, PNG or GIF; WebP works through Cloudinary)"],
    );
  });
});

describe("Kyero text rules", () => {
  it("writes line breaks as &#13;, as the spec asks", () => {
    const xml = buildKyeroFeed([
      listing({ translations: [{ locale: "en", title: "Flat", description: "Line 1\nLine 2" }] }),
    ]);
    expect(xml).toContain("<en>Flat&#13;&#13;Line 1&#13;Line 2</en>");
  });

  it("caps the price at 8 digits", () => {
    expect(validateForKyero(listing({ price: 120_000_000 }))).toContain(
      "a price of at most 8 digits",
    );
  });
});

describe("surface area", () => {
  it("sends the built area, and the plot when a house has one", () => {
    const xml = buildKyeroFeed([listing({ type: "chalet", area: 210, plotArea: 900 })]);
    expect(xml).toContain("<built>210</built>");
    expect(xml).toContain("<plot>900</plot>");
  });

  it("sends a flat's built area only", () => {
    const xml = buildKyeroFeed([listing({ area: 78, plotArea: null })]);
    expect(xml).toContain("<built>78</built>");
    expect(xml).not.toContain("<plot>");
  });

  it("sends land as a plot, never as built area", () => {
    const xml = buildKyeroFeed([listing({ type: "land", area: 1200, bedrooms: 0, bathrooms: 0 })]);
    expect(xml).toContain("<plot>1200</plot>");
    expect(xml).not.toContain("<built>");
  });
});
