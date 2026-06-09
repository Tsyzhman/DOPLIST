import assert from "node:assert/strict";
import test from "node:test";
import {
  hashProposalPassword,
  verifyProposalPassword,
} from "./proposal-store.ts";

test("hashProposalPassword and verifyProposalPassword round-trip", async () => {
  const hash = hashProposalPassword("correct horse battery staple");

  assert.equal(
    await verifyProposalPassword(hash, "correct horse battery staple"),
    true,
  );
  assert.equal(await verifyProposalPassword(hash, "wrong password"), false);
});

test("verifyProposalPassword rejects malformed hashes", async () => {
  assert.equal(await verifyProposalPassword(undefined, "password"), false);
  assert.equal(await verifyProposalPassword("", "password"), false);
  assert.equal(await verifyProposalPassword("not:scrypt", "password"), false);
  assert.equal(await verifyProposalPassword("scrypt:salt:not-base64", ""), false);
});
