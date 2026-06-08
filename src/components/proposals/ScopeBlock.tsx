import {
  calculateItemTotal,
  categoryLabels,
  formatMoney,
  priorityLabels,
  scopePhaseLabels,
  statusLabels,
  unitLabels,
} from "@/lib/proposal";
import type { ChangeItem, ProposalData } from "@/lib/types";
import { Badge, DetailList, SectionHeading } from "./shared";
import { groupItemsByCategory } from "./utils";

export function ScopeBlock({ data }: { data: ProposalData }) {
  const launchItems = data.items.filter((item) => item.scopePhase === "launch");
  const roadmapItems = data.items.filter((item) => item.scopePhase === "roadmap");
  const grouped = groupItemsByCategory(data.items);

  return (
    <section className="proposal-section border-t border-zinc-200 px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Обзор корректировок"
          title="Состав корректировок"
          copy="Позиции сгруппированы по категории. В каждой карточке показаны ценность для клиента, бюджет, сроки и детали объема."
        />

        <ScopeBoundary
          launchCount={launchItems.length}
          roadmapCount={roadmapItems.length}
        />

        <div className="mt-8 space-y-8">
          {grouped.map((group) => (
            <div key={group.category}>
              <div className="mb-3 flex items-center justify-between border-b border-zinc-100 pb-2">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  {categoryLabels[group.category]}
                </h3>
                <span className="text-xs text-zinc-500">
                  {group.items.length} поз.
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {group.items.map((item) => (
                  <ChangePreviewCard
                    key={item.id}
                    item={item}
                    currency={data.project.currency}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ChangePreviewCard({
  item,
  currency,
}: {
  item: ChangeItem;
  currency: string;
}) {
  const included = item.required || item.selected;

  return (
    <article
      className={`proposal-card rounded-lg border p-5 ${
        included
          ? "border-zinc-200 bg-white"
          : "border-zinc-200 bg-zinc-50 text-zinc-500"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={item.required ? "dark" : "light"}>
              {item.required
                ? "Обязательная"
                : item.selected
                  ? "Опция выбрана"
                  : "Опция"}
            </Badge>
            <Badge tone={item.priority === "high" ? "warning" : "neutral"}>
              {priorityLabels[item.priority]}
            </Badge>
            <Badge tone={item.scopePhase === "roadmap" ? "roadmap" : "success"}>
              {scopePhaseLabels[item.scopePhase]}
            </Badge>
          </div>
          <h3 className="mt-3 text-xl font-semibold text-zinc-950">
            {item.title}
          </h3>
        </div>
        <div className="text-right">
          <div className="text-base font-semibold text-zinc-950">
            {formatMoney(calculateItemTotal(item), currency)}
          </div>
          <div className="text-xs text-zinc-500">
            {item.quantity} x {unitLabels[item.unit]}
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-zinc-600">{item.description}</p>
      <div className="mt-4 rounded-md border border-emerald-100 bg-emerald-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
          Ценность для клиента
        </div>
        <p className="mt-1 text-sm leading-6 text-emerald-950">
          {item.clientValue || "Ценность для клиента пока не заполнена."}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
        <span>{item.estimatedDays} дн.</span>
        <span className="h-1 w-1 rounded-full bg-zinc-300" />
        <span>{statusLabels[item.status]}</span>
      </div>

      <details className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3" open>
        <summary className="cursor-pointer text-sm font-semibold text-zinc-800">
          Детали
        </summary>
        <div className="mt-3 grid gap-4 text-sm leading-6 text-zinc-600 sm:grid-cols-2">
          <DetailList title="Что входит" items={item.deliverables} />
          <DetailList title="Не входит" items={item.outOfScope} />
        </div>
        {item.dependencyNote ? (
          <div className="mt-3 rounded-md bg-white p-3 text-sm leading-6 text-zinc-600">
            <span className="font-semibold text-zinc-900">Зависимости: </span>
            {item.dependencyNote}
          </div>
        ) : null}
      </details>
    </article>
  );
}

function ScopeBoundary({
  launchCount,
  roadmapCount,
}: {
  launchCount: number;
  roadmapCount: number;
}) {
  return (
    <div className="mt-6 grid gap-3 md:grid-cols-2">
      <div className="proposal-card rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
          Первый запуск
        </div>
        <p className="mt-2 text-sm leading-6 text-emerald-950">
          В ближайший контур входит {launchCount} поз.
        </p>
      </div>
      <div className="proposal-card rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
          Дорожная карта
        </div>
        <p className="mt-2 text-sm leading-6 text-amber-950">
          На следующий этап вынесено {roadmapCount} поз.
        </p>
      </div>
    </div>
  );
}
