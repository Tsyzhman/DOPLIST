import type { ProposalArchetype, ProposalData } from "@/lib/types";
import { SectionHeading } from "./shared";
import { ComparisonTable } from "./interactive/ComparisonTable";
import { derivePackageOptions } from "./interactive/packageOptions";
import { VariantPicker } from "./interactive/VariantPicker";

type ArchetypeBlockProps = {
  data: ProposalData;
  archetype: ProposalArchetype;
  showPrices: boolean;
  showTimeline: boolean;
  showComparisonTable: boolean;
  readOnly: boolean;
  onPackageSelect?: (packageId: string) => void;
};

export function ArchetypeBlock({
  data,
  archetype,
  showPrices,
  showTimeline,
  showComparisonTable,
  readOnly,
  onPackageSelect,
}: ArchetypeBlockProps) {
  if (archetype === "line_items") {
    return null;
  }

  const options = derivePackageOptions(data);
  const isComparison = archetype === "comparison";

  return (
    <section className="proposal-section border-t border-zinc-200 px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow={isComparison ? "Варианты решения" : "Пакеты допработ"}
          title={isComparison ? "Сравните сценарии до выбора" : "Выберите пакет"}
          copy={
            isComparison
              ? "Один и тот же набор допработ показан как несколько управляемых сценариев: от ближайшей итерации до расширенной дорожной карты."
              : "Пакеты собираются из текущих позиций и помогают выбрать понятный сценарий вместо ручного перебора строк."
          }
        />

        <div className="mt-7">
          <VariantPicker
            options={options}
            currency={data.project.currency}
            showPrices={showPrices}
            showTimeline={showTimeline}
            readOnly={readOnly}
            onSelectPackage={onPackageSelect}
          />
        </div>

        {isComparison && showComparisonTable ? (
          <ComparisonTable
            options={options}
            currency={data.project.currency}
            showPrices={showPrices}
            showTimeline={showTimeline}
          />
        ) : null}
      </div>
    </section>
  );
}
