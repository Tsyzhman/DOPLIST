import { MessageSquareText } from "@/components/icons";
import type { ProposalData } from "@/lib/types";
import { ListBlock, SectionHeading } from "./shared";
import { splitLines } from "./utils";

export function OpenQuestionsBlock({ data }: { data: ProposalData }) {
  return (
    <section className="proposal-section border-t border-zinc-200 px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Открытые вопросы"
          title="Что нужно уточнить"
          copy="Неопределенность вынесена отдельно: эти вопросы не превращаются в обещания и не скрываются внутри оценки."
        />
        <ListBlock
          icon={<MessageSquareText size={18} aria-hidden="true" />}
          items={splitLines(data.project.openQuestions)}
          empty="Открытые вопросы пока не заполнены."
        />
      </div>
    </section>
  );
}
