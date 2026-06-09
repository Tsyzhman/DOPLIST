import type { ProposalData } from "@/lib/types";
import { NarrativeCard, SectionHeading } from "./shared";

export function SolutionBlock({ data }: { data: ProposalData }) {
  return (
    <section className="proposal-section border-t border-zinc-200 px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Цель и решение"
          title="Что даст решение"
          copy="Сначала показываем целевой эффект для текущего проекта, затем состав допработ. Так бюджет и сроки привязаны к результату, а не только к списку задач."
        />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <NarrativeCard
            title="Ожидаемый эффект"
            copy={data.project.businessGoal}
            empty="Бизнес-цель пока не заполнена."
          />
          <NarrativeCard
            title="Предлагаемое решение"
            copy={data.project.proposedSolutionSummary}
            empty="Описание решения пока не заполнено."
          />
        </div>
      </div>
    </section>
  );
}
