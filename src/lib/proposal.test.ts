import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateGrandTotal,
  calculateItemTotal,
  calculateTotalDays,
  createEmptyChangeItem,
  createExampleProposalData,
  createScopeListAiInputExampleData,
  exportProposalDataForJson,
  normalizeProposalData,
  validateScopeListAiInputData,
  validateScopeListProposalJsonData,
} from "./proposal.ts";

test("calculateItemTotal clamps price and quantity", () => {
  assert.equal(
    calculateItemTotal({
      ...createEmptyChangeItem(),
      price: -100,
      quantity: 0,
    }),
    0,
  );
  assert.equal(
    calculateItemTotal({
      ...createEmptyChangeItem(),
      price: 100,
      quantity: 3,
    }),
    300,
  );
});

test("calculateGrandTotal includes required and selected optional items", () => {
  const required = {
    ...createEmptyChangeItem(),
    required: true,
    optional: false,
    selected: true,
    price: 100,
    quantity: 2,
  };
  const selectedOptional = {
    ...createEmptyChangeItem(),
    required: false,
    optional: true,
    selected: true,
    price: 50,
    quantity: 3,
  };
  const skippedOptional = {
    ...createEmptyChangeItem(),
    required: false,
    optional: true,
    selected: false,
    price: 1000,
    quantity: 1,
  };

  assert.equal(
    calculateGrandTotal([required, selectedOptional, skippedOptional]),
    350,
  );
});

test("calculateTotalDays includes required and selected optional items", () => {
  assert.equal(
    calculateTotalDays([
      {
        ...createEmptyChangeItem(),
        required: true,
        optional: false,
        selected: true,
        estimatedDays: 2,
      },
      {
        ...createEmptyChangeItem(),
        required: false,
        optional: true,
        selected: true,
        estimatedDays: 3,
      },
      {
        ...createEmptyChangeItem(),
        required: false,
        optional: true,
        selected: false,
        estimatedDays: 99,
      },
      {
        ...createEmptyChangeItem(),
        required: true,
        optional: false,
        selected: true,
        estimatedDays: -10,
      },
    ]),
    5,
  );
});

test("normalizeProposalData rejects invalid roots", () => {
  assert.equal(normalizeProposalData(null), null);
  assert.equal(normalizeProposalData([]), null);
  assert.equal(normalizeProposalData({ project: {}, items: "bad" }), null);
});

test("normalizeProposalData defaults and clamps malformed item fields", () => {
  const normalized = normalizeProposalData({
    project: {
      projectTitle: 123,
      currency: "rub",
      proposalArchetype: "unknown",
      processSteps: ["Step one", 42, "Step two"],
    },
    items: [
      {
        title: 42,
        pricing: {
          price: -100,
          quantity: 0,
          unit: "wat",
        },
        timeline: {
          estimatedDays: -5,
        },
        type: "optional",
        selection: {
          selected: "true",
        },
      },
    ],
    unexpected: true,
  });

  assert.ok(normalized);
  assert.equal(normalized.project.currency, "RUB");
  assert.equal(normalized.project.proposalArchetype, "comparison");
  assert.equal(normalized.items[0].title, "");
  assert.equal(normalized.items[0].price, 0);
  assert.equal(normalized.items[0].quantity, 1);
  assert.equal(normalized.items[0].unit, "fixed");
  assert.equal(normalized.items[0].estimatedDays, 0);
  assert.equal(normalized.items[0].optional, true);
  assert.equal(normalized.items[0].selected, true);
});

test("AI JSON template matches the new structure and imports", () => {
  const template = createScopeListAiInputExampleData();
  const validation = validateScopeListAiInputData(template);

  assert.deepEqual(validation, { valid: true, errors: [] });
  assert.ok(template.items.length > 0);
  assert.equal("id" in template.items[0], false);
  assert.equal(typeof template.items[0].pricing.price, "number");
  assert.equal(typeof template.items[0].timeline.estimatedDays, "number");
  assert.equal(typeof template.items[0].selection.selected, "boolean");
  assert.ok(Array.isArray(template.project.assumptions));

  const imported = normalizeProposalData(template);

  assert.ok(imported);
  assert.equal(imported.items[0].price, template.items[0].pricing.price);
  assert.equal(
    imported.items[0].estimatedDays,
    template.items[0].timeline.estimatedDays,
  );
  assert.equal(
    imported.items[0].dependencyNote,
    template.items[0].notes.dependencyNote || "",
  );
});

test("exported proposal JSON matches the system schema and imports", () => {
  const source = createExampleProposalData();
  const exported = exportProposalDataForJson(source);
  const validation = validateScopeListProposalJsonData(exported);

  assert.deepEqual(validation, { valid: true, errors: [] });
  assert.ok(exported.items.length > 0);
  assert.equal(typeof exported.items[0].id, "string");
  assert.equal(exported.items[0].pricing.source, "user_confirmed");
  assert.equal(exported.items[0].pricing.confidence, "high");

  const imported = normalizeProposalData(exported);

  assert.ok(imported);
  assert.equal(imported.project.projectTitle, source.project.projectTitle);
  assert.equal(imported.items[0].id, exported.items[0].id);
  assert.equal(imported.items[0].price, exported.items[0].pricing.price);
  assert.equal(imported.items[0].selected, exported.items[0].selection.selected);
});
