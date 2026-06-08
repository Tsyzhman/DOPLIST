import { BadgeCheck } from "@/components/icons";
import {
  calculateGrandTotal,
  calculateTotalDays,
  formatMoney,
} from "@/lib/proposal";
import type { ProposalData } from "@/lib/types";
import { formatPreviewDate, getProposalPromise } from "./utils";

type HeroBlockProps = {
  data: ProposalData;
  showPrices: boolean;
  showTimeline: boolean;
};

export function HeroBlock({ data, showPrices, showTimeline }: HeroBlockProps) {
  const metrics = [
    { label: "Клиент", value: data.project.clientName || "Не указан" },
    { label: "Дата", value: formatPreviewDate(data.project.proposalDate) },
    showPrices
      ? {
          label: "Бюджет",
          value: formatMoney(calculateGrandTotal(data.items), data.project.currency),
        }
      : null,
    showTimeline
      ? { label: "Сроки", value: `${calculateTotalDays(data.items)} дн.` }
      : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return (
    <section className="relative overflow-hidden border-b border-zinc-200 bg-white text-zinc-950">
      <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[1fr_320px] lg:py-20">
        <div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
            <span className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-1.5 font-semibold text-white">
              <BadgeCheck size={16} aria-hidden="true" />
              SCOPELIST
            </span>
            <span>{data.project.version}</span>
            <span>{formatPreviewDate(data.project.proposalDate)}</span>
          </div>
          <p className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Подготовлено для {data.project.clientName || "клиента"}
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">
            {data.project.projectTitle || "Scope-лист корректировок"}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600">
            {getProposalPromise(data)}
          </p>
          <p className="mt-5 inline-flex max-w-full flex-wrap gap-x-3 gap-y-1 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
            <span>Фиксируем объем</span>
            <span>Прозрачные сроки</span>
            <span>Без скрытых работ</span>
          </p>
        </div>
        <div className="self-end rounded-lg border border-zinc-200 bg-zinc-50 p-5">
          {metrics.map((metric) => (
            <CoverMetricRow
              key={metric.label}
              label={metric.label}
              value={metric.value}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function CoverMetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-zinc-200 py-2 last:border-b-0">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </span>
      <span className="text-sm font-semibold text-zinc-950">{value}</span>
    </div>
  );
}
