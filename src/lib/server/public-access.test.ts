import assert from "node:assert/strict";
import test from "node:test";
import { createProposalAccessToken } from "./public-access.ts";

const proposal = {
  shareSlug: "share-slug",
  passwordHash: "scrypt:salt:hash",
  isPasswordProtected: true,
};

test("createProposalAccessToken keeps dev fallback outside production", () => {
  const originalSecret = process.env.PROPOSAL_ACCESS_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  delete process.env.PROPOSAL_ACCESS_SECRET;
  process.env.NODE_ENV = "test";

  try {
    assert.match(createProposalAccessToken(proposal), /^[a-f0-9]{64}$/);
  } finally {
    restoreEnv("PROPOSAL_ACCESS_SECRET", originalSecret);
    restoreEnv("NODE_ENV", originalNodeEnv);
  }
});

test("createProposalAccessToken requires production secret", () => {
  const originalSecret = process.env.PROPOSAL_ACCESS_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  delete process.env.PROPOSAL_ACCESS_SECRET;
  process.env.NODE_ENV = "production";

  try {
    assert.throws(
      () => createProposalAccessToken(proposal),
      /PROPOSAL_ACCESS_SECRET is required/,
    );
  } finally {
    restoreEnv("PROPOSAL_ACCESS_SECRET", originalSecret);
    restoreEnv("NODE_ENV", originalNodeEnv);
  }
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
