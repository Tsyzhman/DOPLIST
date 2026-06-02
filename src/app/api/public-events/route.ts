import { NextResponse } from "next/server";
import {
  getPublishedProposalByShareSlug,
  isProposalEventType,
  recordProposalEvent,
} from "@/lib/server/proposal-store";

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

  const proposal = await getPublishedProposalByShareSlug(body.shareSlug);

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  await recordProposalEvent(proposal, body.eventType, {
    metadata: body.metadata,
    packageId: body.packageId,
    userAgent: request.headers.get("user-agent") || undefined,
    referrer: request.headers.get("referer") || undefined,
  });

  return NextResponse.json({ ok: true });
}
