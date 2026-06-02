import {
  calculateGrandTotal,
  calculateTotalDays,
  formatMoney,
} from "@/lib/proposal";
import type { ProposalData } from "@/lib/types";

type SummaryCardProps = {
  data: ProposalData;
  compact?: boolean;
};

export function SummaryCard({ data, compact = false }: SummaryCardProps) {
  const grandTotal = calculateGrandTotal(data.items);
  const totalDays = calculateTotalDays(data.items);
  const requiredCount = data.items.filter((item) => item.required).length;
  const selectedOptionalCount = data.items.filter(
    (item) => item.optional && item.selected,
  ).length;

  return (
    <div
      className={`builder-summary ${compact ? "" : "sticky top-24 z-20"}`}
    >
      <section className="rounded-lg border border-zinc-200 bg-white p-4 text-zinc-950 shadow-sm">
        <h2 className="text-lg font-semibold">Сводка</h2>
        <div className="mt-4 space-y-3 text-sm text-zinc-600">
          <SummaryRow label="Обязательные" value={String(requiredCount)} />
          <SummaryRow
            label="Выбранные опции"
            value={String(selectedOptionalCount)}
          />
          <SummaryRow label="Сроки" value={`${totalDays} дн.`} />
          <SummaryRow
            label="Итого"
            value={formatMoney(grandTotal, data.project.currency)}
          />
        </div>
      </section>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <span className="font-semibold text-zinc-950 tabular-nums">{value}</span>
    </div>
  );
}
