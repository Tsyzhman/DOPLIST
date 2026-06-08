import type { ProposalData } from "@/lib/types";
import { NarrativeCard, SectionHeading } from "./shared";

export function SolutionBlock({ data }: { data: ProposalData }) {
  return (
    <section className="proposal-section border-t border-zinc-200 px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Цель и решение"
          title="Куда ведем проект"
          copy="Сначала целевой результат, затем состав работ. Так бюджет и сроки привязаны к смыслу, а не только к списку задач."
        />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <NarrativeCard
            title="Бизнес-цель"
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
