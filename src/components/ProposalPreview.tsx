import type { ProposalData, ShareSettings } from "@/lib/types";
import { ArchetypeBlock } from "./proposals/ArchetypeBlock";
import { AssumptionsBlock } from "./proposals/AssumptionsBlock";
import { ContextBlock } from "./proposals/ContextBlock";
import { HeroBlock } from "./proposals/HeroBlock";
import { OpenQuestionsBlock } from "./proposals/OpenQuestionsBlock";
import { OutOfScopeBlock } from "./proposals/OutOfScopeBlock";
import { PricingBlock } from "./proposals/PricingBlock";
import { ProcessBlock } from "./proposals/ProcessBlock";
import { ScopeBlock } from "./proposals/ScopeBlock";
import { SnapshotBlock } from "./proposals/SnapshotBlock";
import { SolutionBlock } from "./proposals/SolutionBlock";
import { TimelineBlock } from "./proposals/TimelineBlock";
import { TrustBlock } from "./proposals/TrustBlock";

type ProposalVisibilitySettings = Pick<
  ShareSettings,
  "showPrices" | "showTimeline" | "showComparisonTable"
>;

type ProposalPreviewProps = {
  data: ProposalData;
  onToggleOptional?: (id: string, selected: boolean) => void;
  onPackageSelect?: (packageId: string) => void;
  readOnly?: boolean;
  shareSettings?: Partial<ProposalVisibilitySettings>;
  /**
   * When `true` (default) the document is rendered inside a rounded
   * card with a subtle border — used in the builder preview tab and
   * the right column. Set to `false` for the public client view so
   * sections stretch edge-to-edge on top of the page background,
   * matching PRISMA's layout.
   */
  boxed?: boolean;
};

export function ProposalPreview({
  data,
  onToggleOptional,
  onPackageSelect,
  readOnly = false,
  shareSettings,
  boxed = true,
}: ProposalPreviewProps) {
  const showPrices = shareSettings?.showPrices ?? true;
  const showTimeline = shareSettings?.showTimeline ?? true;
  const showComparisonTable = shareSettings?.showComparisonTable ?? true;

  return (
    <article
      className={
        boxed
          ? "proposal-preview overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm shadow-zinc-200/70"
          : "proposal-preview"
      }
    >
      <HeroBlock
        data={data}
        showPrices={showPrices}
        showTimeline={showTimeline}
      />
      <SnapshotBlock
        data={data}
        showPrices={showPrices}
        showTimeline={showTimeline}
      />
      <ContextBlock data={data} />
      <SolutionBlock data={data} />
      <ScopeBlock data={data} />
      <ArchetypeBlock
        data={data}
        archetype={data.project.proposalArchetype}
        showPrices={showPrices}
        showTimeline={showTimeline}
        showComparisonTable={showComparisonTable}
        readOnly={readOnly}
        onPackageSelect={onPackageSelect}
      />
      {showPrices ? (
        <PricingBlock
          data={data}
          onToggleOptional={onToggleOptional}
          readOnly={readOnly}
        />
      ) : null}
      {showTimeline ? <TimelineBlock data={data} /> : null}
      <ProcessBlock data={data} />
      <TrustBlock data={data} />
      <AssumptionsBlock data={data} />
      <OpenQuestionsBlock data={data} />
      <OutOfScopeBlock data={data} />
    </article>
  );
}
