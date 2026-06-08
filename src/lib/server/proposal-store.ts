import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import fs from "fs/promises";
import path from "path";
import {
  buildPublicProposalUrl,
  calculateItemTotal,
  createDefaultProposalData,
  normalizeProposalData,
  toList,
} from "@/lib/proposal";
import type {
  ChangeItem,
  ProcessStep,
  Proposal,
  ProposalData,
  ProposalEvent,
  ProposalEventType,
  ProposalPackage,
  ProposalStatus,
  ProofItem,
  ShareAccessMode,
  ShareSettings,
} from "@/lib/types";

export type StoredProposal = Partial<Proposal> & {
  id: string;
  shareSlug: string;
  status: ProposalStatus;
  proposalData?: ProposalData;
  project?: ProposalData["project"];
  items?: ChangeItem[];
};

export type PublicProposal = Omit<
  StoredProposal,
  "passwordHash" | "internalNotes"
>;

export type ShareActionResult = {
  proposal: PublicProposal;
  publicUrl: string;
};

export type PublishProposalInput = {
  proposal: ProposalData;
  origin: string;
  accessMode?: ShareAccessMode;
  password?: string;
  expiresAt?: string;
};

export type ProposalEventInput = {
  metadata?: Record<string, unknown>;
  packageId?: string;
  userAgent?: string;
  referrer?: string;
};

type ProposalStoreData = {
  proposals: StoredProposal[];
  events: ProposalEvent[];
};

type ProposalStore = {
  getById(id: string): Promise<StoredProposal | null>;
  getByShareSlug(shareSlug: string): Promise<StoredProposal | null>;
  upsert(proposal: StoredProposal): Promise<StoredProposal>;
  recordEvent(
    proposal: StoredProposal,
    eventType: ProposalEventType,
    input?: ProposalEventInput,
  ): Promise<ProposalEvent>;
};

const DEFAULT_PUBLIC_DAYS = 30;
const EVENT_TYPES: ProposalEventType[] = [
  "view",
  "package_selected",
  "cta_clicked",
  "password_success",
  "password_failed",
];

const DEFAULT_SHARE_SETTINGS: ShareSettings = {
  isPublished: false,
  shareSlug: "",
  accessMode: "public_link",
  expiresAt: "",
  allowPackageSelection: true,
  allowClientComment: false,
  showPrices: true,
  showTimeline: true,
  showComparisonTable: true,
  noIndex: true,
};

export function isProposalEventType(value: unknown): value is ProposalEventType {
  return EVENT_TYPES.includes(value as ProposalEventType);
}

export async function publishProposal(
  id: string,
  input: PublishProposalInput,
): Promise<ShareActionResult> {
  const store = createProposalStore();
  const existing = await store.getById(id);
  const now = new Date().toISOString();
  const shareSlug =
    existing?.shareSlug || (await createUniqueShareSlug(store, id));
  const expiresAt =
    input.expiresAt ||
    existing?.expiresAt ||
    addDaysIso(new Date(), DEFAULT_PUBLIC_DAYS);
  const accessMode =
    input.accessMode ||
    existing?.shareSettings?.accessMode ||
    (input.password ? "password" : "public_link");
  const passwordHash = input.password
    ? hashProposalPassword(input.password)
    : accessMode === "password"
      ? existing?.passwordHash
      : undefined;

  const record = normalizeStoredProposal({
    ...existing,
    id,
    shareSlug,
    title: input.proposal.project.projectTitle,
    clientName: input.proposal.project.clientName,
    clientCompany: input.proposal.project.clientName,
    preparedBy: input.proposal.project.preparedBy,
    preparedByRole: existing?.preparedByRole || "",
    proposalDate: input.proposal.project.proposalDate,
    validUntil: expiresAt,
    version: input.proposal.project.version,
    status: "published",
    language: "ru",
    currency: input.proposal.project.currency || "RUB",
    shortIntro: input.proposal.project.introSummary,
    clientContext: input.proposal.project.clientContext,
    clientProblem: input.proposal.project.clientProblem,
    businessGoal: input.proposal.project.businessGoal,
    proposedSolutionSummary: input.proposal.project.proposedSolutionSummary,
    whyUs: input.proposal.project.whyUs,
    paymentTerms: input.proposal.project.paymentTerms,
    nextStepText: input.proposal.project.nextStepText,
    internalNotes: input.proposal.project.notes,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    publishedAt: now,
    viewsCount: existing?.viewsCount || 0,
    expiresAt,
    isPasswordProtected: accessMode === "password",
    passwordHash,
    shareSettings: {
      ...DEFAULT_SHARE_SETTINGS,
      ...existing?.shareSettings,
      isPublished: true,
      shareSlug,
      accessMode,
      expiresAt,
      noIndex: true,
    },
    assumptions: toList(input.proposal.project.assumptions),
    outOfScope: toList(input.proposal.project.outOfScope),
    packages: proposalDataToPackages(input.proposal),
    processSteps: listToProcessSteps(toList(input.proposal.project.processSteps)),
    proofItems: listToProofItems(toList(input.proposal.project.proofItems)),
    proposalData: input.proposal,
  });

  const saved = await store.upsert(record);

  return {
    proposal: sanitizeProposalForPublic(saved),
    publicUrl: buildPublicProposalUrl(input.origin, saved.shareSlug),
  };
}

export async function unpublishProposal(
  id: string,
  origin: string,
): Promise<ShareActionResult> {
  const store = createProposalStore();
  const existing = await store.getById(id);

  if (!existing) {
    throw new Error(`Proposal not found: ${id}`);
  }

  const saved = await store.upsert(
    normalizeStoredProposal({
      ...existing,
      status: "hidden",
      updatedAt: new Date().toISOString(),
      shareSettings: {
        ...DEFAULT_SHARE_SETTINGS,
        ...existing.shareSettings,
        isPublished: false,
        shareSlug: existing.shareSlug,
      },
    }),
  );

  return {
    proposal: sanitizeProposalForPublic(saved),
    publicUrl: buildPublicProposalUrl(origin, saved.shareSlug),
  };
}

export async function regenerateProposalSlug(
  id: string,
  origin: string,
): Promise<ShareActionResult> {
  const store = createProposalStore();
  const existing = await store.getById(id);

  if (!existing) {
    throw new Error(`Proposal not found: ${id}`);
  }

  const shareSlug = await createUniqueShareSlug(store, id);
  const saved = await store.upsert(
    normalizeStoredProposal({
      ...existing,
      shareSlug,
      updatedAt: new Date().toISOString(),
      shareSettings: {
        ...DEFAULT_SHARE_SETTINGS,
        ...existing.shareSettings,
        shareSlug,
      },
    }),
  );

  return {
    proposal: sanitizeProposalForPublic(saved),
    publicUrl: buildPublicProposalUrl(origin, saved.shareSlug),
  };
}

export async function getPublishedProposalByShareSlug(shareSlug: string) {
  const store = createProposalStore();
  const proposal = await store.getByShareSlug(shareSlug);

  if (!proposal || !isProposalPublished(proposal) || isProposalExpired(proposal)) {
    return null;
  }

  return proposal;
}

export async function getPublicProposalByShareSlug(shareSlug: string) {
  const proposal = await getPublishedProposalByShareSlug(shareSlug);

  return proposal ? sanitizeProposalForPublic(proposal) : null;
}

export async function recordProposalEvent(
  proposal: StoredProposal,
  eventType: ProposalEventType,
  input?: ProposalEventInput,
) {
  const store = createProposalStore();
  return store.recordEvent(proposal, eventType, input);
}

export function sanitizeProposalForPublic(proposal: StoredProposal): PublicProposal {
  const publicProposal: Partial<StoredProposal> = {
    ...proposal,
    proposalData: proposal.proposalData
      ? stripInternalProposalData(proposal.proposalData)
      : undefined,
  };

  delete publicProposal.passwordHash;
  delete publicProposal.internalNotes;

  return publicProposal as PublicProposal;
}

export function proposalToProposalData(proposal: PublicProposal): ProposalData {
  if (proposal.proposalData) {
    return stripInternalProposalData(proposal.proposalData);
  }

  if (proposal.project && Array.isArray(proposal.items)) {
    const normalized = normalizeProposalData({
      project: proposal.project,
      items: proposal.items,
    });

    if (normalized) {
      return stripInternalProposalData(normalized);
    }
  }

  const packages = sortByOrder(readArray<StoredPackage>(proposal, "packages"));
  const deliverables = sortByOrder(
    readArray<StoredDeliverable>(proposal, "deliverables"),
  );
  const selectedPackageId = readString(proposal, "selectedPackageId");
  const base = createDefaultProposalData();
  const items: ChangeItem[] = packages.length
    ? packages.map((item, index) => {
        const selected = selectedPackageId
          ? item.id === selectedPackageId
          : Boolean(item.isRecommended) || index === 0;

        return {
          id: item.id || randomUUID(),
          title: item.name || "Package",
          category: "Other",
          description: item.description || "",
          clientValue: item.features?.join("\n") || "",
          deliverables: item.features || [],
          outOfScope: [],
          price: Math.max(0, Number(item.price) || 0),
          quantity: 1,
          unit: "fixed",
          estimatedDays: parseDurationDays(item.duration),
          priority: item.isRecommended ? "high" : "medium",
          scopePhase: "launch",
          required: false,
          optional: true,
          selected,
          status: "proposed",
          dependencyNote: "",
          internalNote: "",
        };
      })
    : deliverables.map((item) => ({
        id: item.id || randomUUID(),
        title: item.title || "Deliverable",
        category: "Other",
        description: item.description || "",
        clientValue: item.clientValue || "",
        deliverables: [item.description, item.clientValue].filter(
          (value): value is string => Boolean(value),
        ),
        outOfScope: [],
        price: 0,
        quantity: 1,
        unit: "fixed",
        estimatedDays: 0,
        priority: "medium",
        scopePhase: "launch",
        required: true,
        optional: false,
        selected: true,
        status: "proposed",
        dependencyNote: "",
        internalNote: "",
      }));

  return {
    project: {
      ...base.project,
      projectTitle: proposal.title || base.project.projectTitle,
      clientName: proposal.clientName || base.project.clientName,
      preparedBy: proposal.preparedBy || base.project.preparedBy,
      proposalDate: proposal.proposalDate || base.project.proposalDate,
      version: proposal.version || base.project.version,
      currency: proposal.currency || "RUB",
      proposalArchetype: packages.length
        ? "packages"
        : base.project.proposalArchetype,
      introSummary:
        proposal.shortIntro ||
        proposal.proposedSolutionSummary ||
        base.project.introSummary,
      clientContext: proposal.clientContext || base.project.clientContext,
      clientProblem: proposal.clientProblem || base.project.clientProblem,
      businessGoal: proposal.businessGoal || base.project.businessGoal,
      proposedSolutionSummary:
        proposal.proposedSolutionSummary ||
        proposal.shortIntro ||
        base.project.proposedSolutionSummary,
      whyUs: proposal.whyUs || base.project.whyUs,
      processSteps: processStepsToList(
        readArray<ProcessStep>(proposal, "processSteps"),
      ).join("\n"),
      proofItems: proofItemsToList(
        readArray<ProofItem>(proposal, "proofItems"),
      ).join("\n"),
      paymentTerms: proposal.paymentTerms || "",
      nextStepText: proposal.nextStepText || base.project.nextStepText,
      openQuestions: base.project.openQuestions,
      assumptions: readArray<string>(proposal, "assumptions").join("\n"),
      outOfScope: readArray<string>(proposal, "outOfScope").join("\n"),
      notes: "",
    },
    items,
  };
}

export function isProposalPublished(proposal: StoredProposal) {
  return (
    proposal.status === "published" &&
    proposal.shareSettings?.isPublished === true
  );
}

export function isProposalExpired(proposal: StoredProposal) {
  const value = proposal.expiresAt || proposal.shareSettings?.expiresAt;

  if (!value) {
    return false;
  }

  const expiresAt = parseExpiryDate(value);
  return expiresAt ? expiresAt.getTime() < Date.now() : false;
}

export function hashProposalPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 32).toString("base64url");

  return `scrypt:${salt}:${hash}`;
}

export function verifyProposalPassword(passwordHash: string | undefined, password: string) {
  if (!passwordHash || !password) {
    return false;
  }

  const [scheme, salt, expected] = passwordHash.split(":");

  if (scheme !== "scrypt" || !salt || !expected) {
    return false;
  }

  const actualBuffer = scryptSync(password, salt, 32);
  const expectedBuffer = Buffer.from(expected, "base64url");

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function getRequestPublicOrigin(request: Request) {
  return (
    process.env.PROPOSAL_PUBLIC_ORIGIN ||
    new URL(request.url).origin
  );
}

function createProposalStore(): ProposalStore {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new SupabaseProposalStore();
  }

  return new FileProposalStore();
}

function resolveStoreFilePath() {
  const configuredPath =
    process.env.PROPOSAL_STORE_FILE || process.env.ARCHIVE_FILE_PATH;

  if (configuredPath) {
    return path.resolve(
      /* turbopackIgnore: true */ process.cwd(),
      configuredPath,
    );
  }

  return path.join(process.cwd(), ".data", "proposals.json");
}

// Matches PRISMA: 14 chars from alphanumeric alphabet only, no -/_,
// so links read as kp.tsyzhman.ru/p/39GNQa1qlQRKlf rather than the
// 24-char base64url that base64 of 18 random bytes produces.
const SHARE_SLUG_ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SHARE_SLUG_LENGTH = 14;
const fileStoreWriteQueues = new Map<string, Promise<void>>();

function generateShareSlug() {
  const bytes = randomBytes(SHARE_SLUG_LENGTH);
  let out = "";
  for (let index = 0; index < bytes.length; index += 1) {
    out += SHARE_SLUG_ALPHABET[bytes[index] % SHARE_SLUG_ALPHABET.length];
  }
  return out;
}

async function createUniqueShareSlug(store: ProposalStore, proposalId: string) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const shareSlug = generateShareSlug();
    const existing = await store.getByShareSlug(shareSlug);

    if (!existing || existing.id === proposalId) {
      return shareSlug;
    }
  }

  throw new Error("Could not generate unique share slug");
}

class FileProposalStore implements ProposalStore {
  private filePath = resolveStoreFilePath();

  async getById(id: string) {
    const data = await this.load();
    const proposal = data.proposals.find((item) => item.id === id);

    return proposal ? normalizeStoredProposal(proposal) : null;
  }

  async getByShareSlug(shareSlug: string) {
    const data = await this.load();
    const proposal = data.proposals.find((item) => item.shareSlug === shareSlug);

    return proposal ? normalizeStoredProposal(proposal) : null;
  }

  async upsert(proposal: StoredProposal) {
    return this.withWriteLock(async () => {
      const data = await this.load();
      const normalized = normalizeStoredProposal(proposal);
      const index = data.proposals.findIndex((item) => item.id === normalized.id);

      if (index === -1) {
        data.proposals.unshift(normalized);
      } else {
        data.proposals[index] = normalized;
      }

      await this.save(data);
      return normalized;
    });
  }

  async recordEvent(
    proposal: StoredProposal,
    eventType: ProposalEventType,
    input?: ProposalEventInput,
  ) {
    return this.withWriteLock(async () => {
      const data = await this.load();
      const now = new Date().toISOString();
      const event: ProposalEvent = {
        id: randomUUID(),
        proposalId: proposal.id,
        eventType,
        packageId: input?.packageId,
        metadata: input?.metadata,
        userAgent: input?.userAgent,
        referrer: input?.referrer,
        createdAt: now,
      };

      data.events.unshift(event);

      if (eventType === "view") {
        const index = data.proposals.findIndex((item) => item.id === proposal.id);

        if (index !== -1) {
          const current = normalizeStoredProposal(data.proposals[index]);
          data.proposals[index] = {
            ...current,
            viewsCount: Number(current.viewsCount || 0) + 1,
            lastViewedAt: now,
            updatedAt: now,
          };
        }
      }

      await this.save(data);
      return event;
    });
  }

  private async load(): Promise<ProposalStoreData> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(stripJsonBom(raw)) as Partial<ProposalStoreData>;

      return {
        proposals: Array.isArray(parsed.proposals)
          ? parsed.proposals.map(normalizeStoredProposal)
          : [],
        events: Array.isArray(parsed.events)
          ? parsed.events.map(normalizeProposalEvent)
          : [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { proposals: [], events: [] };
      }

      throw error;
    }
  }

  private async save(data: ProposalStoreData) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;

    try {
      await fs.writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`);
      await fs.rename(temporaryPath, this.filePath);
    } catch (error) {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  private async withWriteLock<T>(operation: () => Promise<T>) {
    const previous = fileStoreWriteQueues.get(this.filePath) || Promise.resolve();
    let release: () => void = () => undefined;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.catch(() => undefined).then(() => next);

    fileStoreWriteQueues.set(this.filePath, queued);
    await previous.catch(() => undefined);

    try {
      return await operation();
    } finally {
      release();
      queued
        .finally(() => {
          if (fileStoreWriteQueues.get(this.filePath) === queued) {
            fileStoreWriteQueues.delete(this.filePath);
          }
        })
        .catch(() => undefined);
    }
  }
}

class SupabaseProposalStore implements ProposalStore {
  private client: SupabaseClient;
  private proposalsTable = process.env.SUPABASE_PROPOSALS_TABLE || "proposals";
  private eventsTable = process.env.SUPABASE_EVENTS_TABLE || "proposal_events";

  constructor() {
    this.client = createClient(
      process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      { auth: { persistSession: false } },
    );
  }

  async getById(id: string) {
    const { data, error } = await this.client
      .from(this.proposalsTable)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? normalizeStoredProposal(data) : null;
  }

  async getByShareSlug(shareSlug: string) {
    const { data, error } = await this.client
      .from(this.proposalsTable)
      .select("*")
      .eq("share_slug", shareSlug)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? normalizeStoredProposal(data) : null;
  }

  async upsert(proposal: StoredProposal) {
    const { data, error } = await this.client
      .from(this.proposalsTable)
      .upsert(toSupabaseProposal(proposal), { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return normalizeStoredProposal(data);
  }

  async recordEvent(
    proposal: StoredProposal,
    eventType: ProposalEventType,
    input?: ProposalEventInput,
  ) {
    const now = new Date().toISOString();
    const event = {
      id: randomUUID(),
      proposal_id: proposal.id,
      event_type: eventType,
      package_id: input?.packageId || null,
      metadata: input?.metadata || null,
      user_agent: input?.userAgent || null,
      referrer: input?.referrer || null,
      created_at: now,
    };
    const { data, error } = await this.client
      .from(this.eventsTable)
      .insert(event)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    if (eventType === "view") {
      await this.client
        .from(this.proposalsTable)
        .update({
          views_count: Number(proposal.viewsCount || 0) + 1,
          last_viewed_at: now,
          updated_at: now,
        })
        .eq("id", proposal.id);
    }

    return normalizeProposalEvent(data);
  }
}

function normalizeStoredProposal(source: unknown): StoredProposal {
  const row = asRecord(source);
  const shareSettings = {
    ...DEFAULT_SHARE_SETTINGS,
    ...asRecord(readValue(row, "shareSettings")),
  };
  const shareSlug =
    readString(row, "shareSlug") ||
    readString(row, "publicSlug") ||
    shareSettings.shareSlug;
  const accessMode =
    (readString(row, "accessMode") as ShareAccessMode) ||
    shareSettings.accessMode ||
    "public_link";
  const proposalData = readValue(row, "proposalData");

  return {
    ...row,
    id: readString(row, "id") || randomUUID(),
    shareSlug,
    title: readString(row, "title"),
    clientName: readString(row, "clientName"),
    clientCompany: readString(row, "clientCompany"),
    preparedBy: readString(row, "preparedBy"),
    preparedByRole: readString(row, "preparedByRole"),
    proposalDate: readString(row, "proposalDate"),
    validUntil: readString(row, "validUntil"),
    version: readString(row, "version") || "v1.0",
    status: normalizeStatus(readString(row, "status")),
    language: "ru",
    currency: normalizeCurrency(readString(row, "currency")),
    shortIntro: readString(row, "shortIntro"),
    clientContext: readString(row, "clientContext"),
    clientProblem: readString(row, "clientProblem"),
    businessGoal: readString(row, "businessGoal"),
    proposedSolutionSummary: readString(row, "proposedSolutionSummary"),
    whyUs: readString(row, "whyUs"),
    paymentTerms: readString(row, "paymentTerms"),
    legalNotes: readString(row, "legalNotes"),
    nextStepText: readString(row, "nextStepText"),
    selectedPackageId: readString(row, "selectedPackageId") || undefined,
    createdAt: readString(row, "createdAt") || new Date().toISOString(),
    updatedAt: readString(row, "updatedAt") || new Date().toISOString(),
    publishedAt: readString(row, "publishedAt") || undefined,
    lastViewedAt: readString(row, "lastViewedAt") || undefined,
    viewsCount: readNumber(row, "viewsCount"),
    expiresAt:
      readString(row, "expiresAt") ||
      shareSettings.expiresAt ||
      addDaysIso(new Date(), DEFAULT_PUBLIC_DAYS),
    isPasswordProtected:
      Boolean(readValue(row, "isPasswordProtected")) || accessMode === "password",
    passwordHash: readString(row, "passwordHash") || undefined,
    publicNotes: readString(row, "publicNotes") || undefined,
    internalNotes: readString(row, "internalNotes") || undefined,
    shareSettings: {
      ...shareSettings,
      shareSlug,
      accessMode,
      expiresAt:
        readString(row, "expiresAt") ||
        shareSettings.expiresAt ||
        addDaysIso(new Date(), DEFAULT_PUBLIC_DAYS),
    },
    assumptions: readArray<string>(row, "assumptions"),
    outOfScope: readArray<string>(row, "outOfScope"),
    deliverables: readArray(row, "deliverables"),
    packages: readArray(row, "packages"),
    processSteps: readArray(row, "processSteps"),
    proofItems: readArray(row, "proofItems"),
    proposalData: normalizeProposalData(proposalData) || undefined,
  };
}

function normalizeProposalEvent(source: unknown): ProposalEvent {
  const row = asRecord(source);

  return {
    id: readString(row, "id") || randomUUID(),
    proposalId: readString(row, "proposalId"),
    eventType: isProposalEventType(readString(row, "eventType"))
      ? (readString(row, "eventType") as ProposalEventType)
      : "view",
    packageId: readString(row, "packageId") || undefined,
    metadata: asRecord(readValue(row, "metadata")),
    userAgent: readString(row, "userAgent") || undefined,
    referrer: readString(row, "referrer") || undefined,
    createdAt: readString(row, "createdAt") || new Date().toISOString(),
  };
}

function toSupabaseProposal(proposal: StoredProposal) {
  return {
    id: proposal.id,
    share_slug: proposal.shareSlug,
    title: proposal.title || "",
    client_name: proposal.clientName || "",
    client_company: proposal.clientCompany || "",
    prepared_by: proposal.preparedBy || "",
    prepared_by_role: proposal.preparedByRole || "",
    proposal_date: proposal.proposalDate || null,
    valid_until: proposal.validUntil || null,
    version: proposal.version || "v1.0",
    status: proposal.status,
    language: proposal.language || "ru",
    currency: proposal.currency || "RUB",
    short_intro: proposal.shortIntro || "",
    client_context: proposal.clientContext || "",
    client_problem: proposal.clientProblem || "",
    business_goal: proposal.businessGoal || "",
    proposed_solution_summary: proposal.proposedSolutionSummary || "",
    why_us: proposal.whyUs || "",
    payment_terms: proposal.paymentTerms || "",
    legal_notes: proposal.legalNotes || "",
    next_step_text: proposal.nextStepText || "",
    selected_package_id: proposal.selectedPackageId || null,
    created_at: proposal.createdAt || new Date().toISOString(),
    updated_at: proposal.updatedAt || new Date().toISOString(),
    published_at: proposal.publishedAt || null,
    last_viewed_at: proposal.lastViewedAt || null,
    views_count: proposal.viewsCount || 0,
    expires_at: proposal.expiresAt || null,
    access_mode: proposal.shareSettings?.accessMode || "public_link",
    is_password_protected: Boolean(proposal.isPasswordProtected),
    password_hash: proposal.passwordHash || null,
    public_notes: proposal.publicNotes || null,
    internal_notes: proposal.internalNotes || null,
    share_settings: proposal.shareSettings || DEFAULT_SHARE_SETTINGS,
    assumptions: proposal.assumptions || [],
    out_of_scope: proposal.outOfScope || [],
    deliverables: proposal.deliverables || [],
    packages: proposal.packages || [],
    process_steps: proposal.processSteps || [],
    proof_items: proposal.proofItems || [],
    proposal_data: proposal.proposalData || null,
  };
}

function stripInternalProposalData(data: ProposalData): ProposalData {
  const normalized = normalizeProposalData(data) || createDefaultProposalData();

  return {
    project: {
      ...normalized.project,
      notes: "",
    },
    items: normalized.items.map((item) => ({
      ...item,
      internalNote: "",
    })),
  };
}

function listToProcessSteps(items: string[]): ProcessStep[] {
  return items.map((item, index) => ({
    id: `process-${index + 1}`,
    title: item,
    description: "",
    duration: "",
    sortOrder: index,
  }));
}

function listToProofItems(items: string[]): ProofItem[] {
  return items.map((item, index) => ({
    id: `proof-${index + 1}`,
    title: item,
    description: "",
    result: "",
    sortOrder: index,
  }));
}

function proposalDataToPackages(data: ProposalData): ProposalPackage[] {
  if (data.project.proposalArchetype === "line_items") {
    return [];
  }

  const requiredItems = data.items.filter((item) => item.required);
  const launchRequiredItems = requiredItems.filter(
    (item) => item.scopePhase === "launch",
  );
  const optionalItems = data.items.filter((item) => item.optional);
  const selectedOptionalItems = optionalItems.filter((item) => item.selected);
  const launchOptionalItems = optionalItems.filter(
    (item) => item.scopePhase === "launch",
  );
  const coreItems = launchRequiredItems.length
    ? launchRequiredItems
    : requiredItems;
  const recommendedOptionalItems = selectedOptionalItems.length
    ? selectedOptionalItems
    : launchOptionalItems;
  const recommendedItems = uniqueChangeItems([
    ...requiredItems,
    ...recommendedOptionalItems,
  ]);
  const fullItems = uniqueChangeItems([...requiredItems, ...optionalItems]);

  return [
    buildPackage("launch-core", "Первый запуск", coreItems, false, 0),
    buildPackage(
      "recommended-scope",
      "Оптимальный запуск",
      recommendedItems.length ? recommendedItems : coreItems,
      true,
      1,
    ),
    buildPackage(
      "full-roadmap",
      "Запуск + дорожная карта",
      fullItems.length ? fullItems : recommendedItems,
      false,
      2,
    ),
  ];
}

function buildPackage(
  id: string,
  name: string,
  items: ChangeItem[],
  isRecommended: boolean,
  sortOrder: number,
): ProposalPackage {
  const durationDays = items.reduce(
    (sum, item) => sum + Math.max(0, item.estimatedDays),
    0,
  );
  const features = items
    .map((item) => item.title.trim())
    .filter(Boolean)
    .slice(0, 8);

  return {
    id,
    name,
    description: isRecommended
      ? "Обязательный объем и выбранные опции для ближайшей итерации."
      : "Сценарий собран из текущих позиций scope-листа.",
    price: items.reduce((sum, item) => sum + calculateItemTotal(item), 0),
    duration: durationDays ? `${durationDays} раб. дн.` : "",
    isRecommended,
    features,
    sortOrder,
  };
}

function uniqueChangeItems(items: ChangeItem[]) {
  const seen = new Set<string>();
  const result: ChangeItem[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }

    seen.add(item.id);
    result.push(item);
  }

  return result;
}

function processStepsToList(items: ProcessStep[]) {
  return sortByOrder(items)
    .map((item) => [item.title, item.description, item.duration].filter(Boolean).join(" — "))
    .filter(Boolean);
}

function proofItemsToList(items: ProofItem[]) {
  return sortByOrder(items)
    .map((item) => [item.title, item.description, item.result].filter(Boolean).join(" — "))
    .filter(Boolean);
}

function parseExpiryDate(value: string) {
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value,
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function addDaysIso(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString().slice(0, 10);
}

function sortByOrder<T extends { sortOrder?: number }>(items: T[]) {
  return [...items].sort(
    (left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0),
  );
}

function parseDurationDays(value: string | undefined) {
  const text = String(value || "");
  const match = text.match(/\d+(?:[.,]\d+)?/);
  const number = match ? Number(match[0].replace(",", ".")) : 0;

  if (!Number.isFinite(number)) {
    return 0;
  }

  return /week|нед/i.test(text) ? number * 5 : number;
}

function normalizeStatus(value: string): ProposalStatus {
  const statuses: ProposalStatus[] = [
    "draft",
    "published",
    "hidden",
    "expired",
    "approved",
    "rejected",
  ];

  return statuses.includes(value as ProposalStatus)
    ? (value as ProposalStatus)
    : "draft";
}

function normalizeCurrency(value: string): "RUB" {
  return value === "RUB" ? "RUB" : "RUB";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readValue(source: Record<string, unknown>, camelName: string) {
  return source[camelName] ?? source[toSnakeCase(camelName)];
}

function readString(source: unknown, camelName: string) {
  const value = readValue(asRecord(source), camelName);
  return typeof value === "string" ? value : "";
}

function readNumber(source: unknown, camelName: string) {
  const value = readValue(asRecord(source), camelName);
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function readArray<T>(source: unknown, camelName: string): T[] {
  const value = readValue(asRecord(source), camelName);
  return Array.isArray(value) ? (value as T[]) : [];
}

function toSnakeCase(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function stripJsonBom(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

type StoredPackage = {
  id?: string;
  name?: string;
  description?: string;
  price?: number;
  duration?: string;
  isRecommended?: boolean;
  features?: string[];
  sortOrder?: number;
};

type StoredDeliverable = {
  id?: string;
  title?: string;
  description?: string;
  clientValue?: string;
  sortOrder?: number;
};
