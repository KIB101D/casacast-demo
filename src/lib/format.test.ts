import { describe, expect, it } from "vitest";
import { formatPrice } from "./format";

describe("formatPrice", () => {
  it("formats sale prices in euros", () => {
    expect(formatPrice(189000, "sale")).toBe("€189,000");
  });

  it("adds the period for rentals", () => {
    expect(formatPrice(950, "rent")).toBe("€950 / month");
  });
});
