import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { config } from "@/lib/env";

/** Single-owner login: email + password from .env, a signed session cookie for 7 days. */

const COOKIE = "socialix_session";
const key = () => new TextEncoder().encode(config.sessionSecret);

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function checkLogin(email: string, password: string): boolean {
  return same(email.trim().toLowerCase(), config.loginEmail.toLowerCase()) && same(password, config.loginPassword);
}

export async function createSession(): Promise<void> {
  const token = await new SignJWT({ sub: config.loginEmail }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(key());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 7 * 24 * 3600 });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/** For pages and server actions: the owner's email, or a redirect to the sign-in page. */
export async function requireSession(): Promise<string> {
  const who = await getSession();
  if (!who) redirect("/signin");
  return who;
}
