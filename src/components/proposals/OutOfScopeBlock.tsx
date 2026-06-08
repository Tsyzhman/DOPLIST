import { Layers3 } from "@/components/icons";
import type { ProposalData } from "@/lib/types";
import { ListBlock, SectionHeading } from "./shared";
import { splitLines } from "./utils";

export function OutOfScopeBlock({ data }: { data: ProposalData }) {
  return (
    <section className="proposal-section border-t border-zinc-200 px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Не входит в объем"
          title="Что не входит"
          copy="Этот блок помогает избежать неучтенных ожиданий и разрастания объема до старта работ."
        />
        <ListBlock
          icon={<Layers3 size={18} aria-hidden="true" />}
          items={splitLines(data.project.outOfScope)}
          empty="Исключения пока не заполнены."
        />
      </div>
    </section>
  );
}
