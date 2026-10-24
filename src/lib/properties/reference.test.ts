import { describe, expect, it } from "vitest";
import { nextReference } from "./reference";

describe("nextReference", () => {
  it("starts at CB-0001", () => {
    expect(nextReference(null)).toBe("CB-0001");
  });

  it("increments and keeps the padding", () => {
    expect(nextReference("CB-0009")).toBe("CB-0010");
  });

  it("keeps counting past 9999", () => {
    expect(nextReference("CB-9999")).toBe("CB-10000");
  });

  it("ignores references from another scheme", () => {
    expect(nextReference("XX-0042")).toBe("CB-0001");
  });
});
