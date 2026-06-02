import { FileText } from "@/components/icons";
import { SectionCard, TextInput, Textarea } from "@/components/Ui";
import type { ProjectSettings } from "@/lib/types";

type ProjectSettingsFormProps = {
  value: ProjectSettings;
  onChange: (patch: Partial<ProjectSettings>) => void;
};

export function ProjectSettingsForm({
  value,
  onChange,
}: ProjectSettingsFormProps) {
  return (
    <SectionCard title="Основные параметры" eyebrow="Настройки проекта">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextInput
          label="Проект"
          value={value.projectTitle}
          onChange={(projectTitle) => onChange({ projectTitle })}
        />
        <TextInput
          label="Клиент"
          value={value.clientName}
          onChange={(clientName) => onChange({ clientName })}
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
      </div>

      <div className="mt-4">
        <Textarea
          label="Краткое резюме"
          value={value.introSummary}
          rows={4}
          onChange={(introSummary) => onChange({ introSummary })}
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

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Textarea
          label="Допущения"
          value={value.assumptions}
          rows={5}
          helper="Каждое условие с новой строки."
          onChange={(assumptions) => onChange({ assumptions })}
        />
        <Textarea
          label="Не входит в объем"
          value={value.outOfScope}
          rows={5}
          helper="Каждый пункт с новой строки."
          onChange={(outOfScope) => onChange({ outOfScope })}
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

      <div className="mt-4 flex items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        <FileText size={16} aria-hidden="true" />
        Все изменения сохраняются в localStorage этого браузера.
      </div>
    </SectionCard>
  );
}
