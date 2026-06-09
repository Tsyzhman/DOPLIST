import { calculateItemTotal } from "@/lib/proposal";
import type { ChangeItem, ProposalData } from "@/lib/types";

export type PackageOption = {
  id: string;
  eyebrow: string;
  name: string;
  description: string;
  focus: string;
  riskControl: string;
  price: number;
  durationDays: number;
  itemsCount: number;
  featureTitles: string[];
  isRecommended: boolean;
};

export function derivePackageOptions(data: ProposalData): PackageOption[] {
  const requiredItems = data.items.filter((item) => item.required);
  const launchRequiredItems = requiredItems.filter(
    (item) => item.scopePhase === "launch",
  );
  const optionalItems = data.items.filter((item) => item.optional);
  const selectedOptionalItems = optionalItems.filter((item) => item.selected);
  const launchOptionalItems = optionalItems.filter(
    (item) => item.scopePhase === "launch",
  );

  const coreItems = launchRequiredItems.length
    ? launchRequiredItems
    : requiredItems;
  const recommendedOptionalItems = selectedOptionalItems.length
    ? selectedOptionalItems
    : launchOptionalItems;
  const recommendedItems = uniqueItems([...requiredItems, ...recommendedOptionalItems]);
  const fullItems = uniqueItems([...requiredItems, ...optionalItems]);

  return [
    buildOption({
      id: "launch-core",
      eyebrow: "Ближайшая итерация",
      name: "Базовые допработы",
      description:
        "Фиксируем минимальный дополнительный контур, который можно встроить в текущий проектный план.",
      focus: "Быстрый запуск и контроль границ",
      riskControl: "Опции и дорожная карта не смешиваются с ближайшей итерацией",
      items: coreItems,
      isRecommended: false,
    }),
    buildOption({
      id: "recommended-scope",
      eyebrow: "Рекомендуемый сценарий",
      name: "Оптимальный объем",
      description:
        "Берем обязательную часть и выбранные опции, которые дают заметный эффект в текущем проекте.",
      focus: "Баланс пользы, бюджета и сроков",
      riskControl: "Клиент видит, какие опции включены сверх ближайшего контура",
      items: recommendedItems.length ? recommendedItems : coreItems,
      isRecommended: true,
    }),
    buildOption({
      id: "full-roadmap",
      eyebrow: "Расширенный сценарий",
      name: "Допработы + дорожная карта",
      description:
        "Показываем полный потенциальный объем, включая опции и будущие улучшения текущего проекта.",
      focus: "Максимальная полнота решения",
      riskControl: "Дорожная карта явно отделена от ближайшей итерации",
      items: fullItems.length ? fullItems : recommendedItems,
      isRecommended: false,
    }),
  ];
}

function buildOption({
  id,
  eyebrow,
  name,
  description,
  focus,
  riskControl,
  items,
  isRecommended,
}: {
  id: string;
  eyebrow: string;
  name: string;
  description: string;
  focus: string;
  riskControl: string;
  items: ChangeItem[];
  isRecommended: boolean;
}): PackageOption {
  return {
    id,
    eyebrow,
    name,
    description,
    focus,
    riskControl,
    price: items.reduce((sum, item) => sum + calculateItemTotal(item), 0),
    durationDays: items.reduce(
      (sum, item) => sum + Math.max(0, item.estimatedDays),
      0,
    ),
    itemsCount: items.length,
    featureTitles: items
      .map((item) => item.title.trim())
      .filter(Boolean)
      .slice(0, 5),
    isRecommended,
  };
}

function uniqueItems(items: ChangeItem[]) {
  const seen = new Set<string>();
  const result: ChangeItem[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }

    seen.add(item.id);
    result.push(item);
  }

  return result;
}
