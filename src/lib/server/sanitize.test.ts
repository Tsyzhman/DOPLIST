import assert from "node:assert/strict";
import test from "node:test";
import {
  createDefaultProposalData,
  createEmptyChangeItem,
} from "../proposal.ts";
import {
  sanitizeProposalForPublic,
  type StoredProposal,
} from "./proposal-store.ts";

test("sanitizeProposalForPublic strips sensitive proposal fields", () => {
  const data = createDefaultProposalData();
  data.project.notes = "internal project notes";
  data.items = [
    {
      ...createEmptyChangeItem(),
      internalNote: "internal item note",
    },
  ];

  const publicProposal = sanitizeProposalForPublic({
    id: "proposal-id",
    shareSlug: "public-slug",
    status: "published",
    passwordHash: "scrypt:salt:hash",
    internalNotes: "internal stored notes",
    proposalData: data,
    shareSettings: {
      isPublished: true,
      shareSlug: "public-slug",
      accessMode: "password",
      expiresAt: "2026-12-31",
      allowPackageSelection: true,
      allowClientComment: false,
      showPrices: true,
      showTimeline: true,
      showComparisonTable: true,
      noIndex: true,
    },
  } as StoredProposal);

  assert.equal("passwordHash" in publicProposal, false);
  assert.equal("internalNotes" in publicProposal, false);
  assert.equal(publicProposal.proposalData?.project.notes, "");
  assert.equal(publicProposal.proposalData?.items[0].internalNote, "");
});
