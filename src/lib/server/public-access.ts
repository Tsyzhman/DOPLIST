import { createHmac, timingSafeEqual } from "crypto";

type AccessControlledProposal = {
  shareSlug: string;
  isPasswordProtected?: boolean;
  passwordHash?: string;
};

export function getProposalAccessCookieName(shareSlug: string) {
  return `scopelist_access_${shareSlug}`;
}

function getAccessSecret() {
  const secret = process.env.PROPOSAL_ACCESS_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PROPOSAL_ACCESS_SECRET is required in production for proposal access tokens",
    );
  }

  return "scopelist-dev-secret";
}

export function createProposalAccessToken(proposal: AccessControlledProposal) {
  const secret = getAccessSecret();
  const hashBasis = proposal.passwordHash || "no-password";

  return createHmac("sha256", secret)
    .update(`${proposal.shareSlug}:${hashBasis}`)
    .digest("hex");
}

export function hasProposalAccess(
  proposal: AccessControlledProposal,
  cookieValue?: string,
) {
  if (!proposal.isPasswordProtected) {
    return true;
  }

  if (!cookieValue) {
    return false;
  }

  const expected = Buffer.from(createProposalAccessToken(proposal), "hex");
  const actual = Buffer.from(cookieValue, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
