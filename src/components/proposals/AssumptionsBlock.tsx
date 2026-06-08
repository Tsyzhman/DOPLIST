import { ShieldCheck } from "@/components/icons";
import type { ProposalData } from "@/lib/types";
import { ListBlock, SectionHeading } from "./shared";
import { splitLines } from "./utils";

export function AssumptionsBlock({ data }: { data: ProposalData }) {
  return (
    <section className="proposal-section border-t border-zinc-200 px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Допущения"
          title="Условия оценки"
          copy="Оценка действительна при сохранении этих условий."
        />
        <ListBlock
          icon={<ShieldCheck size={18} aria-hidden="true" />}
          items={splitLines(data.project.assumptions)}
          empty="Условия пока не заполнены."
        />
      </div>
    </section>
  );
}
