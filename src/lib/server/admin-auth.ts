import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_ACCESS_COOKIE_NAME = "scopelist_admin_access";
export const ADMIN_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const TOKEN_VERSION = "v1";
const TOKEN_CLOCK_SKEW_SECONDS = 60;

export type AdminAuthStatus = "disabled" | "enabled" | "misconfigured";

export function isAdminRequestAuthorized(request: Request): boolean {
  const expected = readAdminAccessToken();

  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }

  const provided = request.headers.get("x-scopelist-admin-token") || "";

  if (isSecretMatch(provided, expected)) {
    return true;
  }

  const cookieToken = readCookieValue(
    request.headers.get("cookie"),
    ADMIN_ACCESS_COOKIE_NAME,
  );

  return hasValidAdminAccessToken(cookieToken);
}

export function getAdminAuthStatus(): AdminAuthStatus {
  if (readAdminAccessToken()) {
    return "enabled";
  }

  return process.env.NODE_ENV === "production" ? "misconfigured" : "disabled";
}

export function isAdminAuthConfigured() {
  return getAdminAuthStatus() === "enabled";
}

export function isAdminSecretValid(provided: string): boolean {
  const expected = readAdminAccessToken();

  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }

  return isSecretMatch(provided, expected);
}

export function createAdminAccessToken(nowMs = Date.now()): string {
  const secret = readAdminAccessToken();

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_ACCESS_TOKEN is required in production");
    }

    return "";
  }

  const issuedAt = Math.floor(nowMs / 1000);
  const signature = signAdminAccessToken(secret, issuedAt);

  return `${TOKEN_VERSION}.${issuedAt}.${signature}`;
}

export function hasValidAdminAccessToken(
  value: string | undefined | null,
  nowMs = Date.now(),
): boolean {
  const secret = readAdminAccessToken();

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  if (!value) {
    return false;
  }

  const [version, issuedAtRaw, signature] = value.split(".");
  const issuedAt = Number(issuedAtRaw);
  const nowSeconds = Math.floor(nowMs / 1000);

  if (
    version !== TOKEN_VERSION ||
    !Number.isInteger(issuedAt) ||
    issuedAt > nowSeconds + TOKEN_CLOCK_SKEW_SECONDS ||
    nowSeconds - issuedAt > ADMIN_ACCESS_MAX_AGE_SECONDS ||
    !signature
  ) {
    return false;
  }

  return isSecretMatch(signature, signAdminAccessToken(secret, issuedAt));
}

export function getAdminAccessCookieOptions(maxAge = ADMIN_ACCESS_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function sanitizeAdminNextPath(value: unknown) {
  if (typeof value !== "string") {
    return "/";
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  if (value === "/login" || value.startsWith("/login?")) {
    return "/";
  }

  if (value === "/" || value === "/lists/new" || /^\/lists\/[^/]+\/edit$/.test(value)) {
    return value;
  }

  return "/";
}

function readAdminAccessToken() {
  return process.env.ADMIN_ACCESS_TOKEN?.trim() || "";
}

function signAdminAccessToken(secret: string, issuedAt: number) {
  return createHmac("sha256", secret)
    .update(`${ADMIN_ACCESS_COOKIE_NAME}:${issuedAt}`)
    .digest("base64url");
}

function isSecretMatch(provided: string, expected: string) {
  if (!provided || !expected) {
    return false;
  }

  const actualBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function readCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = part.trim().split("=");

    if (rawName === name) {
      const rawValue = rawValueParts.join("=");

      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue;
      }
    }
  }

  return undefined;
}
