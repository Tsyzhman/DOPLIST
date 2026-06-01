#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");

const deleteTargets = [
  ".next",
  ".next-cache",
  ".playwright-cli",
  ".data/proposals.json",
  "tsconfig.tsbuildinfo",
];

const emptyTargets = ["output", "screenshots"];

for (const target of deleteTargets) {
  await removePath(path.join(root, target));
}

for (const target of emptyTargets) {
  await emptyDirectory(path.join(root, target));
}

for (const entry of await fs.readdir(root, { withFileTypes: true })) {
  if (entry.isFile() && /^dev-server.*(?:\.err)?\.log$/.test(entry.name)) {
    await removePath(path.join(root, entry.name));
  }
}

async function emptyDirectory(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    await removePath(path.join(directory, entry.name));
  }
}

async function removePath(target) {
  const resolved = path.resolve(target);

  if (!resolved.startsWith(`${root}${path.sep}`) && resolved !== root) {
    throw new Error(`Refusing to remove outside workspace: ${resolved}`);
  }

  if (dryRun) {
    console.log(`[clean] would remove ${path.relative(root, resolved)}`);
    return;
  }

  await fs.rm(resolved, { force: true, recursive: true });
}
