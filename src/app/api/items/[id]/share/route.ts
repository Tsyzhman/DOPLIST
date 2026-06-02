import { NextResponse } from "next/server";
import { normalizeProposalData } from "@/lib/proposal";
import {
  getRequestPublicOrigin,
  publishProposal,
  regenerateProposalSlug,
  unpublishProposal,
} from "@/lib/server/proposal-store";
import type { ShareAccessMode } from "@/lib/types";

type ShareRequestBody = {
  action?: "publish" | "unpublish" | "regenerate";
  proposal?: unknown;
  accessMode?: ShareAccessMode;
  password?: string;
  expiresAt?: string;
};

type ShareRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: ShareRouteContext) {
  const { id } = await context.params;
  const origin = getRequestPublicOrigin(request);
  const body = (await request.json().catch(() => ({}))) as ShareRequestBody;
  const action = body.action || "publish";

  try {
    if (action === "unpublish") {
      const result = await unpublishProposal(id, origin);
      return NextResponse.json(toShareResponse(result));
    }

    if (action === "regenerate") {
      const result = await regenerateProposalSlug(id, origin);
      return NextResponse.json(toShareResponse(result));
    }

    const proposal = normalizeProposalData(body.proposal);

    if (!proposal) {
      return NextResponse.json(
        { error: "Invalid proposal payload" },
        { status: 400 },
      );
    }

    const result = await publishProposal(id, {
      proposal,
      origin,
      accessMode: body.accessMode,
      password: body.password,
      expiresAt: body.expiresAt,
    });

    return NextResponse.json(toShareResponse(result));
  } catch (error) {
    return NextResponse.json(
      { error: String((error as Error).message || error) },
      { status: 500 },
    );
  }
}

function toShareResponse(result: Awaited<ReturnType<typeof publishProposal>>) {
  return {
    id: result.proposal.id,
    shareSlug: result.proposal.shareSlug,
    status: result.proposal.status,
    shareSettings: result.proposal.shareSettings,
    publicUrl: result.publicUrl,
  };
}
