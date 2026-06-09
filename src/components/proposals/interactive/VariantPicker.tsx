"use client";

import { Check, WalletCards } from "@/components/icons";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/proposal";
import { useState } from "react";
import type { PackageOption } from "./packageOptions";

type VariantPickerProps = {
  options: PackageOption[];
  currency: string;
  showPrices: boolean;
  showTimeline: boolean;
  readOnly: boolean;
  onSelectPackage?: (packageId: string) => void;
};

export function VariantPicker({
  options,
  currency,
  showPrices,
  showTimeline,
  readOnly,
  onSelectPackage,
}: VariantPickerProps) {
  const recommended = options.find((option) => option.isRecommended) || options[0];
  const [selectedId, setSelectedId] = useState(recommended?.id || "");

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {options.map((option) => {
        const isSelected = option.id === selectedId;

        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={isSelected}
            disabled={readOnly}
            onClick={() => {
              setSelectedId(option.id);
              onSelectPackage?.(option.id);
            }}
            className={cn(
              "proposal-card group flex h-full min-h-[360px] flex-col rounded-lg border bg-white p-5 text-left transition",
              "focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-default",
              isSelected
                ? "border-emerald-300 shadow-lg shadow-emerald-900/10"
                : "border-zinc-200 hover:border-emerald-200 hover:shadow-md",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  {option.eyebrow}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-zinc-950">
                  {option.name}
                </h3>
              </div>
              <span
                className={cn(
                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
                  isSelected
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-zinc-200 bg-zinc-50 text-zinc-500",
                )}
              >
                {isSelected ? (
                  <Check size={18} aria-hidden="true" />
                ) : (
                  <WalletCards size={18} aria-hidden="true" />
                )}
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-zinc-600">
              {option.description}
            </p>

            <dl className="mt-5 grid grid-cols-2 gap-3">
              {showPrices ? (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Бюджет
                  </dt>
                  <dd className="mt-1 text-base font-semibold text-zinc-950">
                    {formatMoney(option.price, currency)}
                  </dd>
                </div>
              ) : null}
              {showTimeline ? (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Срок
                  </dt>
                  <dd className="mt-1 text-base font-semibold text-zinc-950">
                    {option.durationDays || 0} дн.
                  </dd>
                </div>
              ) : null}
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Объем
                </dt>
                <dd className="mt-1 text-base font-semibold text-zinc-950">
                  {option.itemsCount} поз.
                </dd>
              </div>
            </dl>

            <div className="mt-5 grow">
              <p className="text-sm font-semibold text-zinc-900">
                Что входит
              </p>
              {option.featureTitles.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-700">
                  {option.featureTitles.map((title) => (
                    <li key={title} className="flex gap-2">
                      <Check
                        size={15}
                        className="mt-1 shrink-0 text-emerald-700"
                        aria-hidden="true"
                      />
                      <span>{title}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm leading-6 text-zinc-500">
                  Позиции появятся после заполнения допработ.
                </p>
              )}
            </div>

            <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-600">
              {isSelected ? "Выбрано клиентом" : "Можно выбрать как сценарий"}
            </div>
          </button>
        );
      })}
    </div>
  );
}
