import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PublicProposalView } from "@/components/PublicProposalView";
import {
  getProposalAccessCookieName,
  hasProposalAccess,
} from "@/lib/server/public-access";
import {
  getPublishedProposalByShareSlug,
  proposalToProposalData,
  recordProposalEvent,
  sanitizeProposalForPublic,
} from "@/lib/server/proposal-store";

type PublicProposalPageProps = {
  params: Promise<{ shareSlug: string }>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PublicProposalPage({
  params,
}: PublicProposalPageProps) {
  const { shareSlug } = await params;
  const proposal = await getPublishedProposalByShareSlug(shareSlug);

  if (!proposal) {
    notFound();
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(
    getProposalAccessCookieName(shareSlug),
  )?.value;

  if (!hasProposalAccess(proposal, cookieValue)) {
    redirect(`/p/${shareSlug}/password`);
  }

  const requestHeaders = await headers();
  await recordProposalEvent(proposal, "view", {
    userAgent: requestHeaders.get("user-agent") || undefined,
    referrer: requestHeaders.get("referer") || undefined,
  });

  const publicProposal = sanitizeProposalForPublic(proposal);
  const data = proposalToProposalData(publicProposal);

  return (
    <PublicProposalView
      data={data}
      shareSlug={shareSlug}
      allowPackageSelection={
        publicProposal.shareSettings?.allowPackageSelection !== false
      }
    />
  );
}
