import { NextResponse } from "next/server";
import {
  getPublishedProposalByShareSlug,
  isProposalEventType,
  recordProposalEvent,
} from "@/lib/server/proposal-store";
import { checkRateLimit } from "@/lib/server/rate-limit";

type PublicEventBody = {
  shareSlug?: string;
  eventType?: unknown;
  metadata?: Record<string, unknown>;
  packageId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as PublicEventBody;

  if (!body.shareSlug || !isProposalEventType(body.eventType)) {
    return NextResponse.json({ error: "Invalid event payload" }, { status: 400 });
  }

  const limit = checkRateLimit(`evt:${body.shareSlug}`, 60, 60_000);

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)),
        },
      },
    );
  }

  const proposal = await getPublishedProposalByShareSlug(body.shareSlug);

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  await recordProposalEvent(proposal, body.eventType, {
    metadata: clampMetadata(body.metadata),
    packageId: body.packageId,
    userAgent: clampString(request.headers.get("user-agent") || undefined, 512),
    referrer: clampString(request.headers.get("referer") || undefined, 1024),
  });

  return NextResponse.json({ ok: true });
}

function clampString(value: string | undefined, max: number) {
  return value ? value.slice(0, max) : undefined;
}

function clampMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) {
    return undefined;
  }

  try {
    return JSON.stringify(metadata).length <= 4096 ? metadata : undefined;
  } catch {
    return undefined;
  }
}
