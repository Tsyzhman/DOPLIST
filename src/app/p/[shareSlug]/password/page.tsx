import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PublicPasswordGate } from "@/components/PublicPasswordGate";
import {
  getProposalAccessCookieName,
  hasProposalAccess,
} from "@/lib/server/public-access";
import { getPublishedProposalByShareSlug } from "@/lib/server/proposal-store";

type PublicPasswordPageProps = {
  params: Promise<{ shareSlug: string }>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PublicPasswordPage({
  params,
}: PublicPasswordPageProps) {
  const { shareSlug } = await params;
  const proposal = await getPublishedProposalByShareSlug(shareSlug);

  if (!proposal) {
    notFound();
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(
    getProposalAccessCookieName(shareSlug),
  )?.value;

  if (hasProposalAccess(proposal, cookieValue)) {
    redirect(`/p/${shareSlug}`);
  }

  return (
    <PublicPasswordGate
      shareSlug={shareSlug}
      title={proposal.title || "DOPLIST"}
    />
  );
}
