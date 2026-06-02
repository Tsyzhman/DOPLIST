export type ProposalStatus =
  | "draft"
  | "published"
  | "hidden"
  | "expired"
  | "approved"
  | "rejected";

export type ProposalLanguage = "ru";

export type ProposalCurrency = "RUB";

export type ProposalArchiveState =
  | "active"
  | "archive_due"
  | "archiving"
  | "archived"
  | "purged"
  | "archive_failed";

export type ShareAccessMode = "public_link" | "password";

export type ProposalEventType =
  | "view"
  | "package_selected"
  | "cta_clicked"
  | "password_success"
  | "password_failed";

export type ShareSettings = {
  isPublished: boolean;
  shareSlug: string;
  accessMode: ShareAccessMode;
  expiresAt: string;
  allowPackageSelection: boolean;
  allowClientComment: boolean;
  showPrices: boolean;
  showTimeline: boolean;
  showComparisonTable: boolean;
  noIndex: boolean;
};

export type ProposalDeliverable = {
  id: string;
  proposalId?: string;
  title: string;
  description: string;
  clientValue: string;
  sortOrder: number;
};

export type ProposalPackage = {
  id: string;
  proposalId?: string;
  name: string;
  description: string;
  price: number;
  duration: string;
  isRecommended: boolean;
  features: string[];
  sortOrder: number;
};

export type ProcessStep = {
  id: string;
  proposalId?: string;
  title: string;
  description: string;
  duration: string;
  sortOrder: number;
};

export type ProofItem = {
  id: string;
  proposalId?: string;
  title: string;
  description: string;
  result: string;
  sortOrder: number;
};

export type ProposalEvent = {
  id: string;
  proposalId: string;
  eventType: ProposalEventType;
  packageId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  userAgent?: string;
  referrer?: string;
};

export type Proposal = {
  id: string;
  shareSlug: string;
  title: string;
  clientName: string;
  clientCompany: string;
  preparedBy: string;
  preparedByRole: string;
  proposalDate: string;
  validUntil: string;
  version: string;
  status: ProposalStatus;
  language: ProposalLanguage;
  currency: ProposalCurrency;
  shortIntro: string;
  clientContext: string;
  clientProblem: string;
  businessGoal: string;
  proposedSolutionSummary: string;
  whyUs: string;
  paymentTerms: string;
  legalNotes: string;
  nextStepText: string;
  selectedPackageId?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  lastViewedAt?: string;
  viewsCount: number;
  expiresAt: string;
  isPasswordProtected: boolean;
  passwordHash?: string;
  publicNotes?: string;
  internalNotes?: string;
  archiveState?: ProposalArchiveState;
  archiveAfter?: string;
  purgeAfter?: string;
  archivedAt?: string;
  purgedAt?: string;
  archiveTextSha256?: string;
  archiveAttempts?: number;
  archiveLastError?: string;
  archiveLockedAt?: string;
  telegramArchiveChatId?: string;
  telegramArchiveMessageIds?: number[];
  archiveSummary?: Record<string, unknown>;
  shareSettings: ShareSettings;
  assumptions: string[];
  outOfScope: string[];
  deliverables: ProposalDeliverable[];
  packages: ProposalPackage[];
  processSteps: ProcessStep[];
  proofItems: ProofItem[];
};

export type ProposalSavePayload = {
  proposal: Proposal;
  password?: string;
};

export type ProposalListFilter =
  | "all"
  | "draft"
  | "published"
  | "hidden"
  | "expired"
  | "approved"
  | "rejected";

export type ToastState = {
  tone: "success" | "warning" | "error";
  message: string;
} | null;

// Legacy local editor types kept so older components in the repo still type-check.
export type Category =
  | "Design"
  | "Development"
  | "Content"
  | "Integration"
  | "QA"
  | "Management"
  | "Urgent"
  | "Other";

export type Priority = "low" | "medium" | "high";

export type Status = "draft" | "proposed" | "approved" | "rejected";

export type Unit = "fixed" | "hour" | "day" | "item";

export type ChangeItemType = "required" | "optional";

export type EstimateConfidence = "low" | "medium" | "high";

export type EstimateSource =
  | "ai_estimate"
  | "user_confirmed"
  | "system_calculated"
  | "rate_card";

export type ProjectSettings = {
  projectTitle: string;
  clientName: string;
  preparedBy: string;
  proposalDate: string;
  version: string;
  currency: string;
  introSummary: string;
  paymentTerms: string;
  approvalUrl: string;
  discussionUrl: string;
  assumptions: string;
  outOfScope: string;
  notes: string;
};

export type ChangeItem = {
  id: string;
  title: string;
  category: Category;
  description: string;
  clientValue: string;
  deliverables: string[];
  outOfScope: string[];
  price: number;
  quantity: number;
  unit: Unit;
  estimatedDays: number;
  priority: Priority;
  required: boolean;
  optional: boolean;
  selected: boolean;
  status: Status;
  dependencyNote: string;
  internalNote: string;
};

export type ProposalData = {
  project: ProjectSettings;
  items: ChangeItem[];
};

export type DoplistJsonProject = Omit<
  ProjectSettings,
  "assumptions" | "outOfScope"
> & {
  assumptions: string[];
  outOfScope: string[];
};

export type DoplistJsonPricing = {
  quantity: number;
  unit: Unit;
  price: number;
  currency: string;
  source?: EstimateSource | null;
  confidence?: EstimateConfidence | null;
};

export type DoplistJsonTimeline = {
  estimatedDays: number;
  source?: EstimateSource | null;
  confidence?: EstimateConfidence | null;
};

export type DoplistJsonSelection = {
  selected: boolean;
};

export type DoplistJsonNotes = {
  dependencyNote: string | null;
  internalNote: string | null;
};

export type DoplistJsonItem = {
  id?: string;
  title: string;
  category: Category;
  type: ChangeItemType;
  status: Status;
  priority: Priority;
  description: string;
  clientValue: string;
  deliverables: string[];
  outOfScope: string[];
  pricing: DoplistJsonPricing;
  timeline: DoplistJsonTimeline;
  selection: DoplistJsonSelection;
  notes: DoplistJsonNotes;
};

export type DoplistProposalJson = {
  project: DoplistJsonProject;
  items: DoplistJsonItem[];
};

export type DoplistAiInputItem = Omit<DoplistJsonItem, "id">;

export type DoplistAiInputData = {
  project: DoplistJsonProject;
  items: DoplistAiInputItem[];
};

export type ProposalMode = "builder" | "preview";
