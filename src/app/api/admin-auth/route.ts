import { NextResponse } from "next/server";
import {
  ADMIN_ACCESS_COOKIE_NAME,
  createAdminAccessToken,
  getAdminAccessCookieOptions,
  getAdminAuthStatus,
  isAdminSecretValid,
  sanitizeAdminNextPath,
} from "@/lib/server/admin-auth";

type AdminAuthRequestBody = {
  secret?: string;
  nextPath?: string;
};

export async function POST(request: Request) {
  const status = getAdminAuthStatus();
  const body = (await request.json().catch(() => ({}))) as AdminAuthRequestBody;
  const nextPath = sanitizeAdminNextPath(body.nextPath);

  if (status === "misconfigured") {
    return NextResponse.json(
      { error: "ADMIN_ACCESS_TOKEN is not configured" },
      { status: 500 },
    );
  }

  if (!isAdminSecretValid(String(body.secret || ""))) {
    return NextResponse.json({ error: "Invalid access key" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, nextPath });
  const token = createAdminAccessToken();

  if (token) {
    response.cookies.set(
      ADMIN_ACCESS_COOKIE_NAME,
      token,
      getAdminAccessCookieOptions(),
    );
  }

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set(
    ADMIN_ACCESS_COOKIE_NAME,
    "",
    getAdminAccessCookieOptions(0),
  );

  return response;
}
