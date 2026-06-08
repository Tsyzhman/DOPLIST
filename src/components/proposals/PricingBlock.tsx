import type { ProposalData } from "@/lib/types";
import { PricingBreakdown } from "../PricingBreakdown";

type PricingBlockProps = {
  data: ProposalData;
  onToggleOptional?: (id: string, selected: boolean) => void;
  readOnly: boolean;
};

export function PricingBlock({
  data,
  onToggleOptional,
  readOnly,
}: PricingBlockProps) {
  return (
    <PricingBreakdown
      data={data}
      onToggleOptional={onToggleOptional}
      readOnly={readOnly}
    />
  );
}
