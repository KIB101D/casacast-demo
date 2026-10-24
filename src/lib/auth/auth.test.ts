import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";
import { signSession, verifySessionToken } from "./token";

const SECRET = "a".repeat(32);

describe("session token", () => {
  it("round-trips the user id and role", async () => {
    const token = await signSession({ userId: "user-1", role: "demo" }, SECRET);
    await expect(verifySessionToken(token, SECRET)).resolves.toEqual({
      userId: "user-1",
      role: "demo",
    });
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signSession({ userId: "user-1", role: "admin" }, "b".repeat(32));
    await expect(verifySessionToken(token, SECRET)).resolves.toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await signSession({ userId: "user-1", role: "demo" }, SECRET);
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "user-1", role: "admin" })).toString(
      "base64url",
    );
    await expect(
      verifySessionToken(`${header}.${forgedPayload}.${signature}`, SECRET),
    ).resolves.toBeNull();
  });

  it("returns null when there is no cookie", async () => {
    await expect(verifySessionToken(undefined, SECRET)).resolves.toBeNull();
  });

  it("refuses a short secret", async () => {
    await expect(signSession({ userId: "u", role: "demo" }, "short")).rejects.toThrow(
      /SESSION_SECRET/,
    );
  });
});

describe("safeNextPath", () => {
  it("keeps admin paths", () => {
    expect(safeNextPath("/admin/properties")).toBe("/admin/properties");
  });

  it.each([["https://evil.example"], ["//evil.example"], ["/admin\\evil"], ["/"], [null]])(
    "falls back to /admin for %s",
    (next) => {
      expect(safeNextPath(next)).toBe("/admin");
    },
  );
});
