"use client";

import { FileText } from "@/components/icons";
import { SectionCard, TextInput, Textarea } from "@/components/Ui";
import { proposalArchetypeLabels, proposalArchetypes } from "@/lib/proposal";
import type { ProjectSettings } from "@/lib/types";
import { useState, type ReactNode } from "react";

type ProjectSettingsFormProps = {
  value: ProjectSettings;
  onChange: (patch: Partial<ProjectSettings>) => void;
};

export function ProjectSettingsForm({
  value,
  onChange,
}: ProjectSettingsFormProps) {
  return (
    <SectionCard title="КП на допработы" eyebrow="Настройки предложения">
      <div className="space-y-3">
        <FormSection title="Шапка КП" defaultOpen>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextInput
              label="Название КП"
              value={value.projectTitle}
              placeholder="Дополнительные работы по текущему проекту"
              onChange={(projectTitle) => onChange({ projectTitle })}
            />
            <TextInput
              label="Клиент"
              value={value.clientName}
              onChange={(clientName) => onChange({ clientName })}
            />
            <TextInput
              label="Подготовил"
              value={value.preparedBy}
              placeholder="Команда проекта"
              onChange={(preparedBy) => onChange({ preparedBy })}
            />
            <TextInput
              label="Дата"
              type="date"
              value={value.proposalDate}
              onChange={(proposalDate) => onChange({ proposalDate })}
            />
            <TextInput
              label="Версия"
              value={value.version}
              onChange={(version) => onChange({ version })}
            />
            <TextInput
              label="Валюта"
              value={value.currency}
              onChange={(currency) => onChange({ currency: currency.toUpperCase() })}
            />
            <SelectInput
              label="Формат КП"
              value={value.proposalArchetype}
              options={proposalArchetypes.map((archetype) => ({
                value: archetype,
                label: proposalArchetypeLabels[archetype],
              }))}
              onChange={(proposalArchetype) =>
                onChange({
                  proposalArchetype:
                    proposalArchetype as ProjectSettings["proposalArchetype"],
                })
              }
            />
          </div>
        </FormSection>

        <FormSection title="Контекст и эффект" defaultOpen>
          <Textarea
            label="Краткое резюме"
            value={value.introSummary}
            rows={4}
            onChange={(introSummary) => onChange({ introSummary })}
          />
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Textarea
              label="Текущий проект и вводные"
              value={value.clientContext}
              rows={4}
              onChange={(clientContext) => onChange({ clientContext })}
            />
            <Textarea
              label="Зачем допработы сейчас"
              value={value.clientProblem}
              rows={4}
              onChange={(clientProblem) => onChange({ clientProblem })}
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Textarea
              label="Что должно измениться"
              value={value.businessGoal}
              rows={4}
              onChange={(businessGoal) => onChange({ businessGoal })}
            />
            <Textarea
              label="Предлагаемое решение"
              value={value.proposedSolutionSummary}
              rows={4}
              onChange={(proposedSolutionSummary) =>
                onChange({ proposedSolutionSummary })
              }
            />
          </div>
        </FormSection>

        <FormSection title="Запуск и аргументация">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Textarea
              label="Порядок запуска"
              value={value.processSteps}
              rows={5}
              helper="Каждый этап с новой строки."
              onChange={(processSteps) => onChange({ processSteps })}
            />
            <Textarea
              label="Доказательства / эффект"
              value={value.proofItems}
              rows={5}
              helper="Каждый факт или доказательство с новой строки."
              onChange={(proofItems) => onChange({ proofItems })}
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Textarea
              label="Почему мы"
              value={value.whyUs}
              rows={4}
              onChange={(whyUs) => onChange({ whyUs })}
            />
            <Textarea
              label="Следующий шаг"
              value={value.nextStepText}
              rows={4}
              onChange={(nextStepText) => onChange({ nextStepText })}
            />
          </div>
          <div className="mt-4">
            <Textarea
              label="Условия оплаты"
              value={value.paymentTerms}
              rows={3}
              onChange={(paymentTerms) => onChange({ paymentTerms })}
            />
          </div>
        </FormSection>

        <FormSection title="Границы и вопросы">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Textarea
              label="Допущения"
              value={value.assumptions}
              rows={5}
              helper="Каждое условие с новой строки."
              onChange={(assumptions) => onChange({ assumptions })}
            />
            <Textarea
              label="Не входит в допработы"
              value={value.outOfScope}
              rows={5}
              helper="Каждый пункт с новой строки."
              onChange={(outOfScope) => onChange({ outOfScope })}
            />
          </div>
          <div className="mt-4">
            <Textarea
              label="Открытые вопросы"
              value={value.openQuestions}
              rows={4}
              helper="Каждый вопрос с новой строки. Используйте для неопределенности, которую нельзя честно закрыть без клиента."
              onChange={(openQuestions) => onChange({ openQuestions })}
            />
          </div>
          <div className="mt-4">
            <Textarea
              label="Заметки"
              value={value.notes}
              rows={3}
              helper="Внутреннее поле редактора, в клиентской презентации не выводится."
              onChange={(notes) => onChange({ notes })}
            />
          </div>
        </FormSection>

        <FormSection title="Ссылки для клиента">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextInput
              label="Ссылка для согласования"
              type="url"
              value={value.approvalUrl}
              placeholder="https://calendly.com/your-team/30min"
              helper="Откроется при клике клиента по «Согласовать». Примеры: https://calendly.com/…, https://t.me/your_team, https://wa.me/79991234567, mailto:hello@isty.ist, tel:+74951234567."
              onChange={(approvalUrl) => onChange({ approvalUrl })}
            />
            <TextInput
              label="Ссылка для обсуждения"
              type="url"
              value={value.discussionUrl}
              placeholder="https://t.me/your_team"
              helper="Откроется при клике по «Обсудить». Удобно вести в Telegram, на встречу в Calendly или в групповой чат."
              onChange={(discussionUrl) => onChange({ discussionUrl })}
            />
          </div>
        </FormSection>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        <FileText size={16} aria-hidden="true" />
        Все изменения сохраняются в localStorage этого браузера.
      </div>
    </SectionCard>
  );
}

function FormSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-md px-1 text-left outline-none transition focus:ring-4 focus:ring-emerald-100"
      >
        <span className="text-sm font-semibold text-zinc-950">{title}</span>
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
          {open ? "Скрыть" : "Открыть"}
        </span>
      </button>
      {open ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
