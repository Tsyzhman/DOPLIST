import { BadgeCheck } from "@/components/icons";
import type { ProposalData } from "@/lib/types";
import { ListBlock, NarrativeCard, SectionHeading } from "./shared";
import { splitLines } from "./utils";

export function TrustBlock({ data }: { data: ProposalData }) {
  return (
    <section className="proposal-section border-t border-zinc-200 px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Доверие"
          title="Почему этот план можно защищать"
          copy="В этом блоке остаются только проверяемые основания: опыт, правила работы и подтверждения из данных предложения."
        />
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <NarrativeCard
            title="Почему мы"
            copy={data.project.whyUs}
            empty="Аргументация «почему мы» пока не заполнена."
          />
          <ListBlock
            icon={<BadgeCheck size={18} aria-hidden="true" />}
            items={splitLines(data.project.proofItems)}
            empty="Доказательства пока не заполнены."
            className="grid gap-3"
          />
        </div>
      </div>
    </section>
  );
}
