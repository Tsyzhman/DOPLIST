import type { ProposalData } from "@/lib/types";
import { TimelineImpact } from "../TimelineImpact";

export function TimelineBlock({ data }: { data: ProposalData }) {
  return <TimelineImpact data={data} />;
}
