"use client";

import { Check, Copy, Plus, Trash2 } from "@/components/icons";
import { Button, SectionCard } from "@/components/Ui";
import { useState, type ReactNode } from "react";
import {
  calculateItemTotal,
  categories,
  categoryLabels,
  formatMoney,
  fromList,
  priorities,
  priorityLabels,
  scopePhaseLabels,
  scopePhases,
  statuses,
  statusLabels,
  toList,
  unitLabels,
  units,
} from "@/lib/proposal";
import type {
  Category,
  ChangeItem,
  Priority,
  ScopePhase,
  Status,
  Unit,
} from "@/lib/types";

type ChangeItemListProps = {
  items: ChangeItem[];
  currency: string;
  onUpdate: (id: string, patch: Partial<ChangeItem>) => void;
  onAdd: (patch?: Partial<ChangeItem>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSelected: (id: string, selected: boolean) => void;
};

export function ChangeItemList({
  items,
  currency,
  onUpdate,
  onAdd,
  onDuplicate,
  onDelete,
  onToggleSelected,
}: ChangeItemListProps) {
  const grouped = categories
    .map((category) => ({
      category,
      items: items.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <SectionCard
      title="Допработы по категориям"
      eyebrow="Состав предложения"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => onAdd()}>
            <Plus size={16} aria-hidden="true" />
            Обязательная
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              onAdd({
                required: false,
                optional: true,
                selected: false,
                scopePhase: "roadmap",
              })
            }
          >
            <Plus size={16} aria-hidden="true" />
            Опция
          </Button>
        </div>
      }
    >
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">
          Пока нет допработ. Добавьте обязательный контур или опцию для
          следующего этапа.
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => onAdd()}>
              <Plus size={16} aria-hidden="true" />
              Обязательная
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                onAdd({
                  required: false,
                  optional: true,
                  selected: false,
                  scopePhase: "roadmap",
                })
              }
            >
              <Plus size={16} aria-hidden="true" />
              Опция
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.category} className="space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  {categoryLabels[group.category]}
                </h3>
                <span className="text-xs text-zinc-500">
                  {group.items.length} поз.
                </span>
              </div>
              <div className="space-y-4">
                {group.items.map((item) => (
                  <ChangeItemEditCard
                    key={item.id}
                    item={item}
                    currency={currency}
                    onUpdate={(patch) => onUpdate(item.id, patch)}
                    onDuplicate={() => onDuplicate(item.id)}
                    onDelete={() => onDelete(item.id)}
                    onToggleSelected={(selected) =>
                      onToggleSelected(item.id, selected)
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function ChangeItemEditCard({
  item,
  currency,
  onUpdate,
  onDuplicate,
  onDelete,
  onToggleSelected,
}: {
  item: ChangeItem;
  currency: string;
  onUpdate: (patch: Partial<ChangeItem>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleSelected: (selected: boolean) => void;
}) {
  const [isOpen, setIsOpen] = useState(!item.title.trim());
  const itemTotal = calculateItemTotal(item);
  const titleError = item.title.trim() ? "" : "Название обязательно.";
  const priceError = item.price >= 0 ? "" : "Стоимость не может быть меньше 0.";
  const quantityError =
    item.quantity >= 1 ? "" : "Количество минимум 1.";
  const typeLabel = item.required
    ? "Обязательная"
    : item.selected
      ? "Опция выбрана"
      : "Опция";
  const visibleTitle = item.title.trim() || "Новая допработа";
  const visibleDescription =
    item.description.trim() || "Описание пока не заполнено.";

  return (
    <article className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          className="min-w-0 flex-1 rounded-md text-left outline-none transition focus:ring-4 focus:ring-emerald-100"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ${
                item.required
                  ? "bg-zinc-900 text-white ring-zinc-900"
                  : item.selected
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                    : "bg-zinc-100 text-zinc-600 ring-zinc-200"
              }`}
            >
              {typeLabel}
            </span>
            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-600 ring-1 ring-zinc-200">
              {categoryLabels[item.category]}
            </span>
            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-600 ring-1 ring-zinc-200">
              {scopePhaseLabels[item.scopePhase]}
            </span>
            {titleError ? (
              <span className="rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                Нужно название
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-zinc-950">
            {visibleTitle}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-500">
            {visibleDescription}
          </p>
        </button>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            title="Дублировать"
            aria-label="Дублировать"
            onClick={onDuplicate}
            className="h-9 w-9 px-0"
          >
            <Copy size={15} aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="danger"
            title="Удалить"
            aria-label="Удалить"
            onClick={onDelete}
            className="h-9 w-9 px-0"
          >
            <Trash2 size={15} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <CompactFact label="Бюджет" value={formatMoney(itemTotal, currency)} />
        <CompactFact label="Срок" value={`${item.estimatedDays} дн.`} />
        <CompactFact label="Статус" value={statusLabels[item.status]} />
        <CompactFact label="Приоритет" value={priorityLabels[item.priority]} />
      </div>

      {isOpen ? (
        <div className="mt-4 border-t border-zinc-200 pt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextInput
              label="Название"
              value={item.title}
              error={titleError}
              onChange={(title) => onUpdate({ title })}
            />
            <SelectInput
              label="Категория"
              value={item.category}
              options={categories}
              getLabel={(category) => categoryLabels[category as Category]}
              onChange={(category) =>
                onUpdate({ category: category as Category })
              }
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Textarea
              label="Описание"
              rows={3}
              value={item.description}
              onChange={(description) => onUpdate({ description })}
            />
            <Textarea
              label="Что даст клиенту"
              rows={3}
              value={item.clientValue}
              onChange={(clientValue) => onUpdate({ clientValue })}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Textarea
              label="Что входит"
              rows={4}
              helper="Каждый пункт с новой строки."
              value={fromList(item.deliverables)}
              onChange={(deliverables) =>
                onUpdate({ deliverables: toList(deliverables) })
              }
            />
            <Textarea
              label="Не входит в эту допработу"
              rows={4}
              helper="Каждый пункт с новой строки."
              value={fromList(item.outOfScope)}
              onChange={(outOfScope) =>
                onUpdate({ outOfScope: toList(outOfScope) })
              }
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            <NumberInput
              label="Стоимость"
              value={item.price}
              min={0}
              error={priceError}
              onChange={(price) => onUpdate({ price })}
            />
            <NumberInput
              label="Количество"
              value={item.quantity}
              min={1}
              error={quantityError}
              onChange={(quantity) => onUpdate({ quantity })}
            />
            <SelectInput
              label="Единица"
              value={item.unit}
              options={units}
              getLabel={(unit) => unitLabels[unit as Unit]}
              onChange={(unit) => onUpdate({ unit: unit as Unit })}
            />
            <NumberInput
              label="Оценка, дней"
              value={item.estimatedDays}
              min={0}
              step={0.5}
              onChange={(estimatedDays) => onUpdate({ estimatedDays })}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            <SelectInput
              label="Приоритет"
              value={item.priority}
              options={priorities}
              getLabel={(priority) => priorityLabels[priority as Priority]}
              onChange={(priority) =>
                onUpdate({ priority: priority as Priority })
              }
            />
            <SelectInput
              label="Этап"
              value={item.scopePhase}
              options={scopePhases}
              getLabel={(scopePhase) =>
                scopePhaseLabels[scopePhase as ScopePhase]
              }
              onChange={(scopePhase) =>
                onUpdate({ scopePhase: scopePhase as ScopePhase })
              }
            />
            <SelectInput
              label="Статус"
              value={item.status}
              options={statuses}
              getLabel={(status) => statusLabels[status as Status]}
              onChange={(status) => onUpdate({ status: status as Status })}
            />
            <div>
              <span className="text-sm font-medium text-zinc-700">Тип</span>
              <div className="mt-1 grid h-10 grid-cols-2 rounded-md border border-zinc-200 bg-zinc-50 p-1">
                <button
                  type="button"
                  onClick={() =>
                    onUpdate({ required: true, optional: false, selected: true })
                  }
                  className={`inline-flex items-center justify-center gap-1 rounded px-2 text-sm font-medium transition ${
                    item.required
                      ? "bg-paper text-zinc-950 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  {item.required ? <Check size={14} aria-hidden="true" /> : null}
                  Обязательная
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdate({
                      required: false,
                      optional: true,
                      selected: item.selected,
                    })
                  }
                  className={`inline-flex items-center justify-center gap-1 rounded px-2 text-sm font-medium transition ${
                    item.optional
                      ? "bg-paper text-zinc-950 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  {item.optional ? <Check size={14} aria-hidden="true" /> : null}
                  Опция
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex min-h-10 items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={item.optional ? item.selected : true}
                disabled={!item.optional}
                onChange={(event) => onToggleSelected(event.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-500"
              />
              Включить опцию в рекомендуемый сценарий
            </label>
            <TextInput
              label="Зависимости"
              value={item.dependencyNote}
              onChange={(dependencyNote) => onUpdate({ dependencyNote })}
            />
          </div>

          <div className="mt-4">
            <Textarea
              label="Внутренняя заметка"
              rows={3}
              helper="Показывается только в режиме редактирования."
              value={item.internalNote}
              onChange={(internalNote) => onUpdate({ internalNote })}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 pt-3">
            <div className="text-sm text-zinc-500">
              Итог по позиции:{" "}
              <span className="font-semibold text-zinc-900">
                {formatMoney(itemTotal, currency)}
              </span>
              <span className="mx-2 text-zinc-400">·</span>
              {item.estimatedDays} дн.
              <span className="mx-2 text-zinc-400">·</span>
              {statusLabels[item.status]}
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsOpen(false)}
            >
              Свернуть
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function CompactFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-zinc-900">
        {value}
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <input
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm text-zinc-950 outline-none transition focus:ring-4 ${
          error
            ? "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
            : "border-zinc-200 focus:border-emerald-500 focus:ring-emerald-100"
        }`}
      />
      {error ? (
        <span className="mt-1 block text-xs text-rose-600">{error}</span>
      ) : null}
    </label>
  );
}

function NumberInput({
  label,
  value,
  min,
  step = 1,
  error,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  step?: number;
  error?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <input
        aria-label={label}
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm text-zinc-950 outline-none transition focus:ring-4 ${
          error
            ? "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
            : "border-zinc-200 focus:border-emerald-500 focus:ring-emerald-100"
        }`}
      />
      {error ? (
        <span className="mt-1 block text-xs text-rose-600">{error}</span>
      ) : null}
    </label>
  );
}

function SelectInput({
  label,
  value,
  options,
  getLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  getLabel?: (value: string) => string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {getLabel ? getLabel(option) : option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  rows,
  helper,
}: {
  label: string;
  value: string;
  rows: number;
  helper?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <textarea
        aria-label={label}
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
      />
      {helper ? (
        <span className="mt-1 block text-xs text-zinc-500">{helper}</span>
      ) : null}
    </label>
  );
}

// Re-export ReactNode just to keep callers from breaking if anyone
// imports the previous named exports.
export type { ReactNode };
