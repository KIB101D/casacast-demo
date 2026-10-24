import { describe, expect, it } from "vitest";
import {
  assertWithinLimits,
  canModifyProperty,
  LimitError,
  LIMITS,
  remainingQuota,
  canSeeLead,
} from "./permissions";

describe("assertWithinLimits", () => {
  it("lets the demo user create listings below the limit", () => {
    expect(() => assertWithinLimits("demo", "createProperty", 9)).not.toThrow();
  });

  it("stops the demo user at the limit", () => {
    expect(() => assertWithinLimits("demo", "createProperty", 10)).toThrow(LimitError);
  });

  it("never limits the admin", () => {
    expect(() => assertWithinLimits("admin", "createProperty", 1_000_000)).not.toThrow();
  });

  it("explains the limit in the error message", () => {
    expect(() => assertWithinLimits("demo", "createProperty", 10)).toThrow(/up to 10 listings/);
  });
});

describe("photo limits", () => {
  it("caps demo listings at 10 photos and admin listings at 50", () => {
    expect(() => assertWithinLimits("demo", "photosPerProperty", 9)).not.toThrow();
    expect(() => assertWithinLimits("demo", "photosPerProperty", 10)).toThrow(/up to 10 photos/);
    expect(() => assertWithinLimits("admin", "photosPerProperty", 49)).not.toThrow();
    expect(() => assertWithinLimits("admin", "photosPerProperty", 50)).toThrow(/up to 50 photos/);
  });
});

describe("remainingQuota", () => {
  it("counts down and never goes below zero", () => {
    expect(remainingQuota("demo", "createProperty", 3)).toBe(LIMITS.demo.createProperty - 3);
    expect(remainingQuota("demo", "createProperty", 99)).toBe(0);
  });
});

describe("canModifyProperty", () => {
  const admin = { id: "admin-1", role: "admin" as const };
  const demo = { id: "demo-1", role: "demo" as const };

  it("lets the admin change any listing", () => {
    expect(canModifyProperty(admin, { createdById: "someone-else" })).toBe(true);
  });

  it("lets the demo user change its own listings", () => {
    expect(canModifyProperty(demo, { createdById: "demo-1" })).toBe(true);
  });

  it("protects seed listings from the demo user", () => {
    expect(canModifyProperty(demo, { createdById: "admin-1" })).toBe(false);
  });
});

describe("canSeeLead", () => {
  const admin = { id: "a", role: "admin" as const };
  const demo = { id: "d", role: "demo" as const };

  it("shows the admin every enquiry, general ones included", () => {
    expect(canSeeLead(admin, "someone")).toBe(true);
    expect(canSeeLead(admin, null)).toBe(true);
  });

  it("shows the demo user only enquiries about its own listings", () => {
    expect(canSeeLead(demo, "d")).toBe(true);
    expect(canSeeLead(demo, "a")).toBe(false);
  });

  it("keeps general contact-page enquiries from the demo user", () => {
    expect(canSeeLead(demo, null)).toBe(false);
  });
});
