import {
  calculateGrandTotal,
  calculateTotalDays,
  formatMoney,
} from "@/lib/proposal";
import type { ProposalData } from "@/lib/types";
import { SectionHeading, SnapshotCard } from "./shared";
import { getProposalHeroCopy } from "./utils";

type SnapshotBlockProps = {
  data: ProposalData;
  showPrices: boolean;
  showTimeline: boolean;
};

export function SnapshotBlock({
  data,
  showPrices,
  showTimeline,
}: SnapshotBlockProps) {
  const requiredItems = data.items.filter((item) => item.required);
  const optionalItems = data.items.filter((item) => item.optional);

  return (
    <section className="proposal-section border-t border-zinc-200 px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Быстрые факты"
          title="Что фиксируем перед допработами"
          copy={getProposalHeroCopy(data)}
        />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SnapshotCard
            label="Ближайший контур"
            value={`${requiredItems.length} поз.`}
          />
          <SnapshotCard label="Опции" value={`${optionalItems.length} поз.`} />
          {showPrices ? (
            <SnapshotCard
              label="Выбранный бюджет"
              value={formatMoney(calculateGrandTotal(data.items), data.project.currency)}
            />
          ) : null}
          {showTimeline ? (
            <SnapshotCard
              label="Сроки"
              value={`${calculateTotalDays(data.items)} дн.`}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
