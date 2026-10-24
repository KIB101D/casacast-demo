import { jwtVerify, SignJWT } from "jose";
import type { UserRole } from "@/db/schema";

/**
 * Signing and verifying the session token. Kept free of `next/headers` and `server-only`
 * so it can run in proxy.ts and in unit tests.
 */

export type SessionPayload = {
  userId: string;
  role: UserRole;
};

export const SESSION_COOKIE = "session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getKey(secret = process.env.SESSION_SECRET) {
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters long.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload, secret?: string): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getKey(secret));
}

/** Returns the payload, or null for a missing, tampered or expired token. */
export async function verifySessionToken(
  token: string | undefined,
  secret?: string,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getKey(secret), { algorithms: ["HS256"] });
    const role = payload.role;
    if (!payload.sub || (role !== "admin" && role !== "demo")) return null;
    return { userId: payload.sub, role };
  } catch {
    return null;
  }
}
