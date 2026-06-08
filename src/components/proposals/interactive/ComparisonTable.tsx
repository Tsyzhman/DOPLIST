import { formatMoney } from "@/lib/proposal";
import type { PackageOption } from "./packageOptions";

type ComparisonTableProps = {
  options: PackageOption[];
  currency: string;
  showPrices: boolean;
  showTimeline: boolean;
};

export function ComparisonTable({
  options,
  currency,
  showPrices,
  showTimeline,
}: ComparisonTableProps) {
  const rows = [
    {
      label: "Фокус",
      values: options.map((option) => option.focus),
    },
    ...(showPrices
      ? [
          {
            label: "Бюджет",
            values: options.map((option) => formatMoney(option.price, currency)),
          },
        ]
      : []),
    ...(showTimeline
      ? [
          {
            label: "Срок",
            values: options.map((option) => `${option.durationDays || 0} дн.`),
          },
        ]
      : []),
    {
      label: "Объем",
      values: options.map((option) => `${option.itemsCount} поз.`),
    },
    {
      label: "Контроль риска",
      values: options.map((option) => option.riskControl),
    },
  ];

  return (
    <div className="proposal-card mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h3 className="text-lg font-semibold text-zinc-950">
          Сравнение вариантов
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="w-44 px-4 py-3 text-left font-semibold text-zinc-700">
                Критерий
              </th>
              {options.map((option) => (
                <th
                  key={option.id}
                  className="px-4 py-3 text-left font-semibold text-zinc-950"
                >
                  <span className="block">{option.name}</span>
                  {option.isRecommended ? (
                    <span className="mt-1 inline-flex rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                      Рекомендуем
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {rows.map((row) => (
              <tr key={row.label}>
                <th className="px-4 py-4 text-left font-semibold text-zinc-700">
                  {row.label}
                </th>
                {row.values.map((value, index) => (
                  <td
                    key={`${row.label}-${options[index]?.id || index}`}
                    className="px-4 py-4 leading-6 text-zinc-700"
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
