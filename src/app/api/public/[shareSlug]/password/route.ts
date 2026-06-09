import { NextResponse } from "next/server";
import {
  createProposalAccessToken,
  getProposalAccessCookieName,
} from "@/lib/server/public-access";
import {
  getPublishedProposalByShareSlug,
  recordProposalEvent,
  verifyProposalPassword,
} from "@/lib/server/proposal-store";
import { checkRateLimit } from "@/lib/server/rate-limit";

type PasswordRouteContext = {
  params: Promise<{ shareSlug: string }>;
};

export async function POST(request: Request, context: PasswordRouteContext) {
  const { shareSlug } = await context.params;
  const proposal = await getPublishedProposalByShareSlug(shareSlug);

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { password?: string };
  const userAgent = request.headers.get("user-agent") || undefined;
  const referrer = request.headers.get("referer") || undefined;
  const password = String(body.password || "");
  const limit = checkRateLimit(`pwd:${shareSlug}`, 10, 60_000);

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts" },
      {
        status: 429,
        headers: {
          "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)),
        },
      },
    );
  }

  const isValid = await verifyProposalPassword(proposal.passwordHash, password);

  await recordProposalEvent(proposal, isValid ? "password_success" : "password_failed", {
    userAgent,
    referrer,
  });

  if (!isValid) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  const maxAge = getCookieMaxAge(proposal.expiresAt);

  response.cookies.set(
    getProposalAccessCookieName(shareSlug),
    createProposalAccessToken(proposal),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: `/p/${shareSlug}`,
      maxAge,
    },
  );

  return response;
}

function getCookieMaxAge(expiresAt?: string) {
  if (!expiresAt) {
    return 60 * 60 * 24 * 30;
  }

  const expires = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(expiresAt)
      ? `${expiresAt}T23:59:59.999Z`
      : expiresAt,
  );

  if (Number.isNaN(expires.getTime())) {
    return 60 * 60 * 24 * 30;
  }

  return Math.max(60, Math.floor((expires.getTime() - Date.now()) / 1000));
}
