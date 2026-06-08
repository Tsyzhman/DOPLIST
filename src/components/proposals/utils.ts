import { categories } from "@/lib/proposal";
import type { ChangeItem, ProposalData } from "@/lib/types";

export function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatPreviewDate(value: string) {
  if (!value) {
    return "Не указана";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function groupItemsByCategory(items: ChangeItem[]) {
  return categories
    .map((category) => ({
      category,
      items: items.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length > 0);
}

export function getProposalPromise(data: ProposalData) {
  return (
    data.project.proposedSolutionSummary ||
    data.project.introSummary ||
    "Фиксируем понятный объем работ, бюджет, сроки и границы до старта."
  );
}

export function getProposalHeroCopy(data: ProposalData) {
  return (
    data.project.businessGoal ||
    data.project.introSummary ||
    "SCOPELIST помогает отделить обязательный контур от опций и быстрее согласовать ближайшую итерацию."
  );
}
