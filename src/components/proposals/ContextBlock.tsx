import type { ProposalData } from "@/lib/types";
import { NarrativeCard, SectionHeading } from "./shared";

export function ContextBlock({ data }: { data: ProposalData }) {
  return (
    <section className="proposal-section border-t border-zinc-200 px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Контекст"
          title="Почему это важно сейчас"
          copy="Фиксируем только проверяемые вводные: что уже известно, где есть риск и зачем нужна ближайшая итерация."
        />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <NarrativeCard
            title="Контекст клиента"
            copy={data.project.clientContext}
            empty="Контекст клиента пока не заполнен."
          />
          <NarrativeCard
            title="Боль / риск"
            copy={data.project.clientProblem}
            empty="Проблема или причина срочности пока не заполнена."
          />
        </div>
      </div>
    </section>
  );
}
