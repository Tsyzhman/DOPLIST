import type { ProposalData } from "@/lib/types";
import { NumberedListBlock, SectionHeading } from "./shared";
import { splitLines } from "./utils";

export function ProcessBlock({ data }: { data: ProposalData }) {
  return (
    <section className="proposal-section border-t border-zinc-200 px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Процесс"
          title="Как запускаем допработы"
          copy="Этапы показывают порядок движения от согласования дополнительного объема к передаче результата."
        />
        <NumberedListBlock
          items={splitLines(data.project.processSteps)}
          empty="Процесс пока не заполнен."
        />
      </div>
    </section>
  );
}
