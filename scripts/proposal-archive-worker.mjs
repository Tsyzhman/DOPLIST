#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const TELEGRAM_HARD_LIMIT = 4096;
const DEFAULT_CHUNK_LIMIT = 3600;
const DEFAULT_RETENTION_MONTHS = 6;
const DEFAULT_ARCHIVE_LEAD_DAYS = 7;
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOCK_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_FILE_PATH = ".data/proposals.json";

const DEFAULT_PURGE_COLUMNS = [
  "password_hash",
  "short_intro",
  "client_context",
  "client_problem",
  "business_goal",
  "proposed_solution_summary",
  "why_us",
  "payment_terms",
  "legal_notes",
  "next_step_text",
  "public_notes",
  "internal_notes",
  "share_settings",
  "assumptions",
  "out_of_scope",
  "deliverables",
  "packages",
  "process_steps",
  "proof_items",
];

async function main() {
  const config = loadConfig(process.argv.slice(2), process.env);

  if (config.selfTest) {
    runSelfTest();
    return;
  }

  const store = createStore(config);
  const telegram = new TelegramArchiveClient(config);

  if (config.once) {
    await runOnce(config, store, telegram);
    return;
  }

  console.log(
    `[archive-worker] started store=${config.storeKind} intervalMs=${config.intervalMs}`,
  );

  while (true) {
    try {
      await runOnce(config, store, telegram);
    } catch (error) {
      console.error("[archive-worker] pass failed", error);
    }

    await sleep(config.intervalMs);
  }
}

function loadConfig(argv, env) {
  const once = argv.includes("--once");
  const selfTest = argv.includes("--self-test");
  const supabaseAvailable = Boolean(
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const requestedStore = env.ARCHIVE_STORE || "auto";
  const storeKind =
    requestedStore === "auto"
      ? supabaseAvailable
        ? "supabase"
        : "file"
      : requestedStore;

  if (!["file", "supabase"].includes(storeKind)) {
    throw new Error("ARCHIVE_STORE must be one of: auto, file, supabase");
  }

  if (storeKind === "supabase" && !supabaseAvailable && !selfTest) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for supabase archive store",
    );
  }

  const dryRun = readBoolean(env.ARCHIVE_DRY_RUN, false);
  const noWrite = readBoolean(env.ARCHIVE_NO_WRITE, false);

  if (
    !selfTest &&
    !dryRun &&
    (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ARCHIVE_CHAT_ID)
  ) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN and TELEGRAM_ARCHIVE_CHAT_ID are required unless ARCHIVE_DRY_RUN=true",
    );
  }

  const chunkLimit = clamp(
    readNumber(env.ARCHIVE_TELEGRAM_CHUNK_LIMIT, DEFAULT_CHUNK_LIMIT),
    500,
    TELEGRAM_HARD_LIMIT - 400,
  );

  return {
    once,
    selfTest,
    storeKind,
    dryRun,
    noWrite,
    supabaseUrl: env.SUPABASE_URL || "",
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || "",
    proposalsTable: env.SUPABASE_PROPOSALS_TABLE || "proposals",
    deliveriesTable: env.SUPABASE_DELIVERIES_TABLE || "proposal_deliveries",
    filePath: path.resolve(
      process.cwd(),
      env.ARCHIVE_FILE_PATH || DEFAULT_FILE_PATH,
    ),
    telegramBotToken: env.TELEGRAM_BOT_TOKEN || "",
    telegramArchiveChatId: env.TELEGRAM_ARCHIVE_CHAT_ID || "",
    telegramAlertChatId: env.TELEGRAM_ALERT_CHAT_ID || "",
    retentionMonths: readNumber(
      env.ARCHIVE_RETENTION_MONTHS,
      DEFAULT_RETENTION_MONTHS,
    ),
    archiveLeadDays: readNumber(
      env.ARCHIVE_LEAD_DAYS,
      DEFAULT_ARCHIVE_LEAD_DAYS,
    ),
    batchSize: readNumber(env.ARCHIVE_BATCH_SIZE, DEFAULT_BATCH_SIZE),
    intervalMs: readNumber(env.ARCHIVE_WORKER_INTERVAL_MS, DEFAULT_INTERVAL_MS),
    lockTimeoutMs: readNumber(
      env.ARCHIVE_LOCK_TIMEOUT_MS,
      DEFAULT_LOCK_TIMEOUT_MS,
    ),
    maxAttempts: readNumber(env.ARCHIVE_MAX_ATTEMPTS, 5),
    chunkLimit,
    includeInternalNotes: readBoolean(
      env.ARCHIVE_INCLUDE_INTERNAL_NOTES,
      false,
    ),
    purgeColumns: readList(env.SUPABASE_PURGE_CONTENT_COLUMNS).length
      ? readList(env.SUPABASE_PURGE_CONTENT_COLUMNS)
      : DEFAULT_PURGE_COLUMNS,
  };
}

function createStore(config) {
  if (config.storeKind === "supabase") {
    return new SupabaseProposalStore(config);
  }

  return new FileProposalStore(config);
}

async function runOnce(config, store, telegram) {
  const now = new Date();
  const archiveDue = await store.listArchiveDue(now);
  let archived = 0;
  let archiveFailed = 0;

  console.log(`[archive-worker] archive due=${archiveDue.length}`);

  for (const proposal of archiveDue.slice(0, config.batchSize)) {
    try {
      const result = await archiveProposal(config, store, telegram, proposal, now);
      if (result) {
        archived += 1;
      }
    } catch (error) {
      archiveFailed += 1;
      console.error(
        `[archive-worker] archive failed proposal=${getProposalId(proposal)}`,
        error,
      );
    }
  }

  const purgeDue = await store.listPurgeDue(now);
  let purged = 0;

  console.log(`[archive-worker] purge due=${purgeDue.length}`);

  for (const proposal of purgeDue.slice(0, config.batchSize)) {
    try {
      await purgeProposal(store, proposal, now);
      purged += 1;
    } catch (error) {
      console.error(
        `[archive-worker] purge failed proposal=${getProposalId(proposal)}`,
        error,
      );
    }
  }

  console.log(
    `[archive-worker] pass done archived=${archived} archiveFailed=${archiveFailed} purged=${purged}`,
  );

  return { archived, archiveFailed, purged };
}

async function archiveProposal(config, store, telegram, originalProposal, now) {
  const lockedProposal = await store.markArchiving(originalProposal, now);

  if (!lockedProposal) {
    console.log(
      `[archive-worker] skipped locked proposal=${getProposalId(originalProposal)}`,
    );
    return false;
  }

  const proposalId = getProposalId(lockedProposal);
  const archiveCode = getArchiveCode(lockedProposal);
  const archiveText = renderProposalArchiveText(lockedProposal, {
    includeInternalNotes: config.includeInternalNotes,
  });
  const textHash = sha256(archiveText);
  const chunks = splitTelegramChunks(archiveText, config.chunkLimit);
  const messageIds = [];

  try {
    console.log(
      `[archive-worker] sending proposal=${proposalId} chunks=${chunks.length}`,
    );

    for (let index = 0; index < chunks.length; index += 1) {
      const header = [
        `#DOPLIST #archive #${toTelegramTag(archiveCode)}`,
        `КП: ${archiveCode}`,
        `Часть: ${index + 1}/${chunks.length}`,
        `sha256: ${textHash}`,
        "",
      ].join("\n");
      const messageId = await telegram.sendMessage(`${header}${chunks[index]}`);
      messageIds.push(messageId);
    }

    const completedMessageId = await telegram.sendMessage(
      [
        `#DOPLIST #archive #complete #${toTelegramTag(archiveCode)}`,
        "ARCHIVE COMPLETE",
        `КП: ${archiveCode}`,
        `proposal_id: ${proposalId}`,
        `parts: ${chunks.length}`,
        `sha256: ${textHash}`,
        `created_at: ${formatIso(getCreatedAt(lockedProposal))}`,
        `archived_at: ${now.toISOString()}`,
      ].join("\n"),
    );
    messageIds.push(completedMessageId);

    const archiveRecord = {
      archivedAt: now.toISOString(),
      archiveTextSha256: textHash,
      telegramArchiveChatId: String(config.telegramArchiveChatId || "dry-run"),
      telegramArchiveMessageIds: messageIds,
      archiveAfter: getArchiveAfter(lockedProposal, config).toISOString(),
      purgeAfter: getPurgeAfter(lockedProposal, config).toISOString(),
      archiveSummary: buildArchiveSummary(lockedProposal),
    };

    await store.markArchived(lockedProposal, archiveRecord);
    await store.recordDelivery(lockedProposal, archiveRecord);

    console.log(
      `[archive-worker] archived proposal=${proposalId} messages=${messageIds.join(",")}`,
    );

    return true;
  } catch (error) {
    await store.markArchiveFailed(lockedProposal, error, now);
    await telegram.notifyFailure(lockedProposal, error).catch((notifyError) => {
      console.warn("[archive-worker] failure notification failed", notifyError);
    });
    throw error;
  }
}

async function purgeProposal(store, proposal, now) {
  const proposalId = getProposalId(proposal);

  if (getArchiveState(proposal) !== "archived") {
    throw new Error(`proposal ${proposalId} is not archived`);
  }

  if (!readField(proposal, "telegramArchiveMessageIds")) {
    throw new Error(`proposal ${proposalId} has no telegram message ids`);
  }

  await store.purgeProposal(proposal, {
    purgedAt: now.toISOString(),
    archiveSummary: buildArchiveSummary(proposal),
  });

  console.log(`[archive-worker] purged proposal=${proposalId}`);
}

class TelegramArchiveClient {
  constructor(config) {
    this.config = config;
  }

  async sendMessage(text) {
    if (text.length > TELEGRAM_HARD_LIMIT) {
      throw new Error(
        `telegram message is too long: ${text.length}/${TELEGRAM_HARD_LIMIT}`,
      );
    }

    if (this.config.dryRun) {
      const messageId = Math.floor(Math.random() * 1_000_000_000);
      console.log(
        `[archive-worker] dry-run telegram message chars=${text.length} id=${messageId}`,
      );
      return messageId;
    }

    const response = await fetch(
      `https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: this.config.telegramArchiveChatId,
          text,
          disable_web_page_preview: true,
        }),
      },
    );
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.ok) {
      throw new Error(
        `telegram sendMessage failed: ${response.status} ${JSON.stringify(payload)}`,
      );
    }

    return payload.result.message_id;
  }

  async notifyFailure(proposal, error) {
    if (!this.config.telegramAlertChatId || this.config.dryRun) {
      return;
    }

    const text = [
      "#DOPLIST #archive_failed",
      `КП: ${getArchiveCode(proposal)}`,
      `proposal_id: ${getProposalId(proposal)}`,
      `error: ${String(error?.message || error).slice(0, 900)}`,
    ].join("\n");

    const response = await fetch(
      `https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: this.config.telegramAlertChatId,
          text,
          disable_web_page_preview: true,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`telegram alert failed: ${response.status}`);
    }
  }
}

class FileProposalStore {
  constructor(config) {
    this.config = config;
    this.data = null;
  }

  async listArchiveDue(now) {
    const data = await this.load();

    return data.proposals
      .filter((proposal) => {
        const state = getArchiveState(proposal);
        const attempts = Number(readField(proposal, "archiveAttempts") || 0);

        if (["archived", "purged"].includes(state)) {
          return false;
        }

        if (state === "archiving" && !isStaleArchiveLock(proposal, now, this.config)) {
          return false;
        }

        if (attempts >= this.config.maxAttempts) {
          return false;
        }

        return getArchiveAfter(proposal, this.config) <= now;
      })
      .sort(
        (left, right) =>
          getArchiveAfter(left, this.config).getTime() -
          getArchiveAfter(right, this.config).getTime(),
      );
  }

  async listPurgeDue(now) {
    const data = await this.load();

    return data.proposals
      .filter((proposal) => {
        if (getArchiveState(proposal) !== "archived") {
          return false;
        }

        if (!readField(proposal, "telegramArchiveMessageIds")) {
          return false;
        }

        return getPurgeAfter(proposal, this.config) <= now;
      })
      .sort(
        (left, right) =>
          getPurgeAfter(left, this.config).getTime() -
          getPurgeAfter(right, this.config).getTime(),
      );
  }

  async markArchiving(proposal, now) {
    const found = await this.findProposal(getProposalId(proposal));

    if (!found) {
      return null;
    }

    if (["archived", "purged"].includes(getArchiveState(found))) {
      return null;
    }

    if (
      getArchiveState(found) === "archiving" &&
      !isStaleArchiveLock(found, now, this.config)
    ) {
      return null;
    }

    found.archiveState = "archiving";
    found.archiveLockedAt = now.toISOString();
    found.archiveAttempts = Number(found.archiveAttempts || 0) + 1;
    found.archiveAfter = getArchiveAfter(found, this.config).toISOString();
    found.purgeAfter = getPurgeAfter(found, this.config).toISOString();
    await this.save();
    return found;
  }

  async markArchived(proposal, record) {
    const found = await this.findProposal(getProposalId(proposal));

    if (!found) {
      throw new Error(`proposal not found: ${getProposalId(proposal)}`);
    }

    found.archiveState = "archived";
    found.archivedAt = record.archivedAt;
    found.archiveTextSha256 = record.archiveTextSha256;
    found.telegramArchiveChatId = record.telegramArchiveChatId;
    found.telegramArchiveMessageIds = record.telegramArchiveMessageIds;
    found.archiveAfter = record.archiveAfter;
    found.purgeAfter = record.purgeAfter;
    found.archiveSummary = record.archiveSummary;
    delete found.archiveLastError;
    delete found.archiveLockedAt;
    await this.save();
  }

  async markArchiveFailed(proposal, error, now) {
    const found = await this.findProposal(getProposalId(proposal));

    if (!found) {
      return;
    }

    found.archiveState = "archive_failed";
    found.archiveLastError = String(error?.message || error).slice(0, 2000);
    found.archiveFailedAt = now.toISOString();
    delete found.archiveLockedAt;
    await this.save();
  }

  async recordDelivery() {
    return undefined;
  }

  async purgeProposal(proposal, details) {
    const data = await this.load();
    const index = data.proposals.findIndex(
      (item) => getProposalId(item) === getProposalId(proposal),
    );

    if (index === -1) {
      throw new Error(`proposal not found: ${getProposalId(proposal)}`);
    }

    const source = data.proposals[index];
    data.proposals[index] = buildPurgedProposalRecord(source, details, this.config);
    await this.save();
  }

  async findProposal(id) {
    const data = await this.load();
    return data.proposals.find((proposal) => getProposalId(proposal) === id);
  }

  async load() {
    if (this.data) {
      return this.data;
    }

    const raw = await fs.readFile(this.config.filePath, "utf8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed.proposals)) {
      throw new Error(`file store has no proposals array: ${this.config.filePath}`);
    }

    this.data = parsed;
    return this.data;
  }

  async save() {
    if (this.config.noWrite) {
      console.log("[archive-worker] no-write file store save skipped");
      return;
    }

    const directory = path.dirname(this.config.filePath);
    await fs.mkdir(directory, { recursive: true });
    const temporaryPath = `${this.config.filePath}.${process.pid}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(this.data, null, 2)}\n`);
    await fs.rename(temporaryPath, this.config.filePath);
  }
}

class SupabaseProposalStore {
  constructor(config) {
    this.config = config;
    this.client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
  }

  async listArchiveDue(now) {
    const { data, error } = await this.client
      .from(this.config.proposalsTable)
      .select("*")
      .is("purged_at", null)
      .or(
        "archive_state.is.null,archive_state.in.(active,archive_due,archive_failed,archiving)",
      )
      .order("archive_after", { ascending: true, nullsFirst: true })
      .limit(this.config.batchSize * 5);

    if (error) {
      throw error;
    }

    return data
      .filter((proposal) => {
        const attempts = Number(readField(proposal, "archiveAttempts") || 0);
        return (
          attempts < this.config.maxAttempts &&
          (getArchiveState(proposal) !== "archiving" ||
            isStaleArchiveLock(proposal, now, this.config)) &&
          getArchiveAfter(proposal, this.config) <= now
        );
      })
      .slice(0, this.config.batchSize);
  }

  async listPurgeDue(now) {
    const { data, error } = await this.client
      .from(this.config.proposalsTable)
      .select("*")
      .is("purged_at", null)
      .eq("archive_state", "archived")
      .lte("purge_after", now.toISOString())
      .order("purge_after", { ascending: true })
      .limit(this.config.batchSize);

    if (error) {
      throw error;
    }

    return data;
  }

  async markArchiving(proposal, now) {
    if (this.config.noWrite) {
      return proposal;
    }

    const attempts = Number(readField(proposal, "archiveAttempts") || 0) + 1;
    const { data, error } = await this.client
      .from(this.config.proposalsTable)
      .update({
        archive_state: "archiving",
        archive_attempts: attempts,
        archive_locked_at: now.toISOString(),
        archive_after: getArchiveAfter(proposal, this.config).toISOString(),
        purge_after: getPurgeAfter(proposal, this.config).toISOString(),
      })
      .eq("id", getProposalId(proposal))
      .not("archive_state", "in", "(archived,purged)")
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async markArchived(proposal, record) {
    if (this.config.noWrite) {
      console.log("[archive-worker] no-write supabase markArchived skipped");
      return;
    }

    const { error } = await this.client
      .from(this.config.proposalsTable)
      .update({
        archive_state: "archived",
        archived_at: record.archivedAt,
        archive_text_sha256: record.archiveTextSha256,
        telegram_archive_chat_id: record.telegramArchiveChatId,
        telegram_archive_message_ids: record.telegramArchiveMessageIds,
        archive_after: record.archiveAfter,
        purge_after: record.purgeAfter,
        archive_summary: record.archiveSummary,
        archive_last_error: null,
        archive_locked_at: null,
      })
      .eq("id", getProposalId(proposal));

    if (error) {
      throw error;
    }
  }

  async markArchiveFailed(proposal, error, now) {
    if (this.config.noWrite) {
      console.log("[archive-worker] no-write supabase markArchiveFailed skipped");
      return;
    }

    const { error: updateError } = await this.client
      .from(this.config.proposalsTable)
      .update({
        archive_state: "archive_failed",
        archive_last_error: String(error?.message || error).slice(0, 2000),
        archive_failed_at: now.toISOString(),
        archive_locked_at: null,
      })
      .eq("id", getProposalId(proposal));

    if (updateError) {
      throw updateError;
    }
  }

  async recordDelivery(proposal, record) {
    if (this.config.noWrite) {
      return;
    }

    const { error } = await this.client.from(this.config.deliveriesTable).insert({
      proposal_id: getProposalId(proposal),
      target: "archive",
      chat_id: record.telegramArchiveChatId,
      status: "sent",
      message_ids: record.telegramArchiveMessageIds,
      text_sha256: record.archiveTextSha256,
      attempts: Number(readField(proposal, "archiveAttempts") || 1),
      created_at: record.archivedAt,
      sent_at: record.archivedAt,
    });

    if (error) {
      console.warn("[archive-worker] proposal delivery insert failed", error);
    }
  }

  async purgeProposal(proposal, details) {
    if (this.config.noWrite) {
      console.log("[archive-worker] no-write supabase purge skipped");
      return;
    }

    const rpcResult = await this.client.rpc("purge_proposal_content", {
      target_proposal_id: getProposalId(proposal),
      purged_at_value: details.purgedAt,
    });

    if (!rpcResult.error) {
      return;
    }

    console.warn(
      "[archive-worker] purge_proposal_content rpc failed, falling back to direct update",
      rpcResult.error,
    );

    const patch = {
      archive_state: "purged",
      purged_at: details.purgedAt,
      archive_summary: details.archiveSummary,
      updated_at: details.purgedAt,
    };

    for (const column of this.config.purgeColumns) {
      patch[column] = null;
    }

    const { error } = await this.client
      .from(this.config.proposalsTable)
      .update(patch)
      .eq("id", getProposalId(proposal));

    if (error) {
      throw error;
    }
  }
}

function renderProposalArchiveText(proposal, options) {
  if (proposal.project && Array.isArray(proposal.items)) {
    return renderLegacyProposalData(proposal, options);
  }

  const archiveCode = getArchiveCode(proposal);
  const packages = sortByOrder(readArray(proposal, "packages"));
  const deliverables = sortByOrder(readArray(proposal, "deliverables"));
  const processSteps = sortByOrder(readArray(proposal, "processSteps"));
  const proofItems = sortByOrder(readArray(proposal, "proofItems"));
  const selectedPackage =
    packages.find((item) => item.id === readField(proposal, "selectedPackageId")) ||
    packages.find((item) => Boolean(readField(item, "isRecommended"))) ||
    packages[0];

  const lines = [
    `#DOPLIST #archive #${toTelegramTag(archiveCode)}`,
    "",
    `КП: ${archiveCode}`,
    `ID: ${getProposalId(proposal)}`,
    `Клиент: ${readField(proposal, "clientName") || "не указан"}`,
    optionalLine("Компания", readField(proposal, "clientCompany")),
    `Проект: ${readField(proposal, "title") || "без названия"}`,
    optionalLine("Версия", readField(proposal, "version")),
    optionalLine("Статус", readField(proposal, "status")),
    optionalLine("Дата КП", readField(proposal, "proposalDate")),
    optionalLine("Действует до", readField(proposal, "validUntil")),
    optionalLine("Создано", formatIso(getCreatedAt(proposal))),
    optionalLine("Подготовил", readField(proposal, "preparedBy")),
    optionalLine("Роль", readField(proposal, "preparedByRole")),
    selectedPackage
      ? `Выбранный пакет: ${readField(selectedPackage, "name")} · ${formatMoney(
          readNumberValue(selectedPackage, "price"),
          readField(proposal, "currency") || "RUB",
        )} · ${readField(selectedPackage, "duration") || "срок не указан"}`
      : "",
    "",
  ].filter(Boolean);

  pushSection(lines, "Кратко", [
    readField(proposal, "shortIntro"),
    readField(proposal, "clientContext"),
    readField(proposal, "clientProblem"),
    readField(proposal, "businessGoal"),
    readField(proposal, "proposedSolutionSummary"),
    readField(proposal, "whyUs"),
  ]);

  if (packages.length) {
    lines.push("Пакеты:");
    for (const item of packages) {
      lines.push(
        `${readField(item, "sortOrder") ?? ""}. ${readField(item, "name")} · ${formatMoney(
          readNumberValue(item, "price"),
          readField(proposal, "currency") || "RUB",
        )} · ${readField(item, "duration") || "срок не указан"}`,
      );
      pushIndented(lines, readField(item, "description"));
      for (const feature of readArray(item, "features")) {
        lines.push(`  - ${feature}`);
      }
    }
    lines.push("");
  }

  if (deliverables.length) {
    lines.push("Что входит:");
    for (const item of deliverables) {
      lines.push(`- ${readField(item, "title")}`);
      pushIndented(lines, readField(item, "description"));
      pushIndented(lines, readField(item, "clientValue"), "  Ценность: ");
    }
    lines.push("");
  }

  if (processSteps.length) {
    lines.push("Процесс:");
    for (const item of processSteps) {
      lines.push(
        `- ${readField(item, "title")} · ${readField(item, "duration") || "срок не указан"}`,
      );
      pushIndented(lines, readField(item, "description"));
    }
    lines.push("");
  }

  if (proofItems.length) {
    lines.push("Почему это сработает:");
    for (const item of proofItems) {
      lines.push(`- ${readField(item, "title")}`);
      pushIndented(lines, readField(item, "description"));
      pushIndented(lines, readField(item, "result"), "  Результат: ");
    }
    lines.push("");
  }

  pushListSection(lines, "Допущения", readArray(proposal, "assumptions"));
  pushListSection(lines, "Не входит в объем", readArray(proposal, "outOfScope"));

  pushSection(lines, "Условия и следующий шаг", [
    readField(proposal, "paymentTerms"),
    readField(proposal, "legalNotes"),
    readField(proposal, "nextStepText"),
    readField(proposal, "publicNotes"),
  ]);

  if (options.includeInternalNotes) {
    pushSection(lines, "Внутренние заметки", [readField(proposal, "internalNotes")]);
  }

  return normalizeArchiveText(lines.join("\n"));
}

function renderLegacyProposalData(data, options) {
  const project = data.project || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const requiredItems = items.filter((item) => Boolean(item.required));
  const optionalItems = items.filter((item) => Boolean(item.optional));
  const selectedOptionalItems = optionalItems.filter((item) => Boolean(item.selected));
  const currency = project.currency || "RUB";
  const archiveCode = getArchiveCode(data);
  const grandTotal = items
    .filter((item) => item.required || (item.optional && item.selected))
    .reduce((sum, item) => sum + readNumberValue(item, "price") * Math.max(1, readNumberValue(item, "quantity") || 1), 0);
  const totalDays = items
    .filter((item) => item.required || (item.optional && item.selected))
    .reduce((sum, item) => sum + readNumberValue(item, "estimatedDays"), 0);
  const lines = [
    `#DOPLIST #archive #${toTelegramTag(archiveCode)}`,
    "",
    `КП: ${archiveCode}`,
    `Клиент: ${project.clientName || "не указан"}`,
    `Проект: ${project.projectTitle || "без названия"}`,
    optionalLine("Версия", project.version),
    optionalLine("Дата КП", project.proposalDate),
    optionalLine("Подготовил", project.preparedBy),
    `Итого: ${formatMoney(grandTotal, currency)}`,
    `Срок: ${totalDays} дн.`,
    "",
  ].filter(Boolean);

  pushSection(lines, "Кратко", [project.introSummary]);
  pushChangeItems(lines, "Обязательный объем", requiredItems, currency);
  pushChangeItems(lines, "Опции", selectedOptionalItems, currency);
  pushListSection(lines, "Допущения", splitLines(project.assumptions));
  pushListSection(lines, "Не входит в объем", splitLines(project.outOfScope));
  pushSection(lines, "Условия", [project.paymentTerms]);

  if (options.includeInternalNotes) {
    pushSection(lines, "Внутренние заметки", [project.notes]);
  }

  return normalizeArchiveText(lines.join("\n"));
}

function pushChangeItems(lines, title, items, currency) {
  if (!items.length) {
    return;
  }

  lines.push(`${title}:`);
  items.forEach((item, index) => {
    const total =
      readNumberValue(item, "price") *
      Math.max(1, readNumberValue(item, "quantity") || 1);
    lines.push(
      `${index + 1}. ${readField(item, "title")} · ${formatMoney(total, currency)} · ${readNumberValue(
        item,
        "estimatedDays",
      )} дн.`,
    );
    pushIndented(lines, readField(item, "description"));
    pushIndented(lines, readField(item, "clientValue"), "  Ценность: ");
    pushListSection(lines, "  Входит", readArray(item, "deliverables"));
    pushListSection(lines, "  Не входит", readArray(item, "outOfScope"));
  });
  lines.push("");
}

function pushSection(lines, title, paragraphs) {
  const filtered = paragraphs
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  if (!filtered.length) {
    return;
  }

  lines.push(`${title}:`);
  for (const paragraph of filtered) {
    lines.push(paragraph);
  }
  lines.push("");
}

function pushListSection(lines, title, items) {
  const filtered = items.map((item) => String(item || "").trim()).filter(Boolean);

  if (!filtered.length) {
    return;
  }

  lines.push(`${title}:`);
  for (const item of filtered) {
    lines.push(`- ${item}`);
  }
  lines.push("");
}

function pushIndented(lines, value, prefix = "  ") {
  const text = String(value || "").trim();

  if (text) {
    lines.push(`${prefix}${text}`);
  }
}

function normalizeArchiveText(value) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitTelegramChunks(text, maxChars) {
  const chunks = [];
  let current = "";

  for (const line of text.split("\n")) {
    const candidate = current ? `${current}\n${line}` : line;

    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = "";
    }

    if (line.length <= maxChars) {
      current = line;
      continue;
    }

    for (let index = 0; index < line.length; index += maxChars) {
      chunks.push(line.slice(index, index + maxChars));
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.length ? chunks : [""];
}

function buildArchiveSummary(proposal) {
  if (proposal.project && Array.isArray(proposal.items)) {
    const selectedItems = proposal.items.filter(
      (item) => item.required || (item.optional && item.selected),
    );

    return {
      title: proposal.project.projectTitle || null,
      clientName: proposal.project.clientName || null,
      proposalDate: proposal.project.proposalDate || null,
      version: proposal.project.version || null,
      currency: proposal.project.currency || "RUB",
      totalPrice: selectedItems.reduce(
        (sum, item) =>
          sum +
          readNumberValue(item, "price") *
            Math.max(1, readNumberValue(item, "quantity") || 1),
        0,
      ),
      itemsCount: proposal.items.length,
    };
  }

  const packages = readArray(proposal, "packages");
  const selectedPackage =
    packages.find((item) => item.id === readField(proposal, "selectedPackageId")) ||
    packages.find((item) => Boolean(readField(item, "isRecommended"))) ||
    packages[0];

  return {
    title: readField(proposal, "title") || null,
    clientName: readField(proposal, "clientName") || null,
    clientCompany: readField(proposal, "clientCompany") || null,
    proposalDate: readField(proposal, "proposalDate") || null,
    version: readField(proposal, "version") || null,
    currency: readField(proposal, "currency") || "RUB",
    selectedPackageId: selectedPackage?.id || null,
    selectedPackageName: selectedPackage ? readField(selectedPackage, "name") : null,
    selectedPackagePrice: selectedPackage
      ? readNumberValue(selectedPackage, "price")
      : null,
    packagesCount: packages.length,
    deliverablesCount: readArray(proposal, "deliverables").length,
  };
}

function buildPurgedProposalRecord(proposal, details, config) {
  const createdAt = getCreatedAt(proposal);

  return {
    id: getProposalId(proposal),
    shareSlug: readField(proposal, "shareSlug") || null,
    title:
      readField(proposal, "title") ||
      readField(proposal.project || {}, "projectTitle") ||
      null,
    clientName:
      readField(proposal, "clientName") ||
      readField(proposal.project || {}, "clientName") ||
      null,
    clientCompany: readField(proposal, "clientCompany") || null,
    preparedBy:
      readField(proposal, "preparedBy") ||
      readField(proposal.project || {}, "preparedBy") ||
      null,
    proposalDate:
      readField(proposal, "proposalDate") ||
      readField(proposal.project || {}, "proposalDate") ||
      null,
    validUntil: readField(proposal, "validUntil") || null,
    version:
      readField(proposal, "version") ||
      readField(proposal.project || {}, "version") ||
      null,
    status: readField(proposal, "status") || "expired",
    currency:
      readField(proposal, "currency") ||
      readField(proposal.project || {}, "currency") ||
      "RUB",
    createdAt: createdAt.toISOString(),
    updatedAt: details.purgedAt,
    archiveState: "purged",
    archiveAfter: getArchiveAfter(proposal, config).toISOString(),
    purgeAfter: getPurgeAfter(proposal, config).toISOString(),
    archivedAt: readField(proposal, "archivedAt") || null,
    purgedAt: details.purgedAt,
    archiveTextSha256: readField(proposal, "archiveTextSha256") || null,
    telegramArchiveChatId: readField(proposal, "telegramArchiveChatId") || null,
    telegramArchiveMessageIds:
      readField(proposal, "telegramArchiveMessageIds") || [],
    archiveSummary: details.archiveSummary,
  };
}

function getArchiveState(proposal) {
  return readField(proposal, "archiveState") || "active";
}

function isStaleArchiveLock(proposal, now, config) {
  const lockedAt = readField(proposal, "archiveLockedAt");

  if (!lockedAt) {
    return true;
  }

  const lockedDate = new Date(lockedAt);

  if (Number.isNaN(lockedDate.getTime())) {
    return true;
  }

  return now.getTime() - lockedDate.getTime() > config.lockTimeoutMs;
}

function getArchiveCode(proposal) {
  const explicit =
    readField(proposal, "archiveCode") ||
    readField(proposal, "proposalNumber") ||
    readField(proposal, "shareSlug");

  if (explicit) {
    return String(explicit);
  }

  return `DPL-${String(getProposalId(proposal)).slice(0, 8)}`;
}

function getProposalId(proposal) {
  return String(proposal.id || proposal.proposalId || "unknown");
}

function getCreatedAt(proposal) {
  const value =
    readField(proposal, "createdAt") ||
    readField(proposal, "proposalDate") ||
    readField(proposal.project || {}, "proposalDate");
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
}

function getArchiveAfter(proposal, config) {
  const explicit = readField(proposal, "archiveAfter");

  if (explicit) {
    const date = new Date(explicit);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return addDays(getPurgeAfter(proposal, config), -config.archiveLeadDays);
}

function getPurgeAfter(proposal, config) {
  const explicit = readField(proposal, "purgeAfter");

  if (explicit) {
    const date = new Date(explicit);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return addMonthsUtc(getCreatedAt(proposal), config.retentionMonths);
}

function addMonthsUtc(date, months) {
  const source = new Date(date);
  const day = source.getUTCDate();
  const target = new Date(
    Date.UTC(
      source.getUTCFullYear(),
      source.getUTCMonth() + months,
      1,
      source.getUTCHours(),
      source.getUTCMinutes(),
      source.getUTCSeconds(),
      source.getUTCMilliseconds(),
    ),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function readField(source, camelName) {
  if (!source || typeof source !== "object") {
    return "";
  }

  const snakeName = toSnakeCase(camelName);
  return source[camelName] ?? source[snakeName] ?? "";
}

function readArray(source, camelName) {
  const value = readField(source, camelName);
  return Array.isArray(value) ? value : [];
}

function readNumberValue(source, camelName) {
  const value = readField(source, camelName);
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function readNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function readBoolean(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function readList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sortByOrder(items) {
  return [...items].sort(
    (left, right) =>
      readNumberValue(left, "sortOrder") - readNumberValue(right, "sortOrder"),
  );
}

function splitLines(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalLine(label, value) {
  const text = String(value || "").trim();
  return text ? `${label}: ${text}` : "";
}

function formatMoney(value, currency) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: currency || "RUB",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatIso(date) {
  return date instanceof Date && !Number.isNaN(date.getTime())
    ? date.toISOString()
    : "";
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function toSnakeCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toTelegramTag(value) {
  const normalized = String(value || "proposal")
    .replace(/[^\p{L}\p{N}_]+/gu, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "proposal";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function runSelfTest() {
  const proposal = {
    id: "self-test-proposal",
    shareSlug: "DPL-SELF-TEST",
    title: "Тестовое коммерческое предложение",
    clientName: "ACME Studio",
    preparedBy: "DOPLIST",
    proposalDate: "2026-05-31",
    version: "v1.0",
    currency: "RUB",
    shortIntro: "Проверяем рендер архива и нарезку сообщений.",
    paymentTerms: "50% предоплата, 50% после приемки.",
    nextStepText: "Подтвердить объем работ.",
    createdAt: "2026-05-31T00:00:00.000Z",
    assumptions: ["Материалы предоставлены до старта."],
    outOfScope: ["Новые интеграции."],
    deliverables: [
      {
        title: "Структура",
        description: "Карта страниц и логика блоков.",
        clientValue: "Меньше неопределенности.",
        sortOrder: 0,
      },
    ],
    packages: [
      {
        id: "standard",
        name: "Standard",
        price: 420000,
        duration: "5 недель",
        isRecommended: true,
        features: ["UX/UI", "Разработка", "QA"],
        sortOrder: 0,
      },
    ],
    selectedPackageId: "standard",
  };
  const text = renderProposalArchiveText(proposal, {
    includeInternalNotes: false,
  });
  const chunks = splitTelegramChunks(text, DEFAULT_CHUNK_LIMIT);

  if (!text.includes("#archive")) {
    throw new Error("self-test expected archive text marker");
  }

  if (!chunks.length || chunks.some((chunk) => chunk.length > DEFAULT_CHUNK_LIMIT)) {
    throw new Error("self-test chunking failed");
  }

  console.log("[archive-worker] self-test ok");
}

main().catch((error) => {
  console.error("[archive-worker] fatal", error);
  process.exitCode = 1;
});
