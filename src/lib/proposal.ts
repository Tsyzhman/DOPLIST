import LZString from "lz-string";
import { asRecord } from "./shared/record.ts";
import type {
  Category,
  ChangeItem,
  ChangeItemType,
  ScopeListAiInputData,
  ScopeListJsonItem,
  ScopeListProposalJson,
  EstimateConfidence,
  EstimateSource,
  Priority,
  ProposalArchetype,
  ProposalData,
  ScopePhase,
  ScopeListIndexEntry,
  Status,
  Unit,
} from "./types";

const { compressToEncodedURIComponent, decompressFromEncodedURIComponent } =
  LZString;

export const SCOPELIST_INDEX_KEY = "scopelist-index-v1";
export const SHARE_HASH_PREFIX = "proposal=";

export function getScopeListDataStorageKey(listId: string) {
  const safeId = listId.trim() || "new";

  return `scopelist-list-${safeId}-v1`;
}

export const categories: Category[] = [
  "Design",
  "Development",
  "Content",
  "Integration",
  "QA",
  "Management",
  "Urgent",
  "Other",
];

export const priorities: Priority[] = ["low", "medium", "high"];
export const statuses: Status[] = ["draft", "proposed", "approved", "rejected"];
export const units: Unit[] = ["fixed", "hour", "day", "item"];
export const itemTypes: ChangeItemType[] = ["required", "optional"];
export const scopePhases: ScopePhase[] = ["launch", "roadmap"];
export const proposalArchetypes: ProposalArchetype[] = [
  "line_items",
  "packages",
  "comparison",
];
export const estimateSources: EstimateSource[] = [
  "ai_estimate",
  "user_confirmed",
  "system_calculated",
  "rate_card",
];
export const estimateConfidences: EstimateConfidence[] = [
  "low",
  "medium",
  "high",
];

export const categoryLabels: Record<Category, string> = {
  Design: "Дизайн",
  Development: "Разработка",
  Content: "Контент",
  Integration: "Интеграции",
  QA: "QA",
  Management: "Управление",
  Urgent: "Срочно",
  Other: "Другое",
};

export const priorityLabels: Record<Priority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
};

export const statusLabels: Record<Status, string> = {
  draft: "Черновик",
  proposed: "Предложено",
  approved: "Согласовано",
  rejected: "Отклонено",
};

export const scopePhaseLabels: Record<ScopePhase, string> = {
  launch: "Ближайшая итерация",
  roadmap: "Следующий этап",
};

export const proposalArchetypeLabels: Record<ProposalArchetype, string> = {
  line_items: "Смета по позициям",
  packages: "Пакеты / тарифы",
  comparison: "Сравнение вариантов",
};

export const unitLabels: Record<Unit, string> = {
  fixed: "Фикс",
  hour: "Час",
  day: "День",
  item: "Позиция",
};

export const scopeListProposalJsonSchema = createScopeListJsonSchema({
  includeSystemId: true,
});

export const scopeListAiInputJsonSchema = createScopeListJsonSchema({
  includeSystemId: false,
});

function createScopeListJsonSchema({
  includeSystemId,
}: {
  includeSystemId: boolean;
}) {
  const noteProperty = {
    anyOf: [{ type: "string" }, { type: "null" }],
  };
  const estimateMeta = {
    source: {
      anyOf: [{ enum: estimateSources }, { type: "null" }],
    },
    confidence: {
      anyOf: [{ enum: estimateConfidences }, { type: "null" }],
    },
  };

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: includeSystemId
      ? "SCOPELIST proposal JSON"
      : "SCOPELIST AI input JSON",
    type: "object",
    additionalProperties: false,
    required: ["project", "items"],
    properties: {
      project: {
        type: "object",
        additionalProperties: false,
        required: [
          "projectTitle",
          "clientName",
          "preparedBy",
          "proposalDate",
          "version",
          "currency",
          "proposalArchetype",
          "introSummary",
          "clientContext",
          "clientProblem",
          "businessGoal",
          "proposedSolutionSummary",
          "whyUs",
          "processSteps",
          "proofItems",
          "paymentTerms",
          "nextStepText",
          "approvalUrl",
          "discussionUrl",
          "openQuestions",
          "assumptions",
          "outOfScope",
          "notes",
        ],
        properties: {
          projectTitle: { type: "string" },
          clientName: { type: "string" },
          preparedBy: { type: "string" },
          proposalDate: { type: "string", format: "date" },
          version: { type: "string" },
          currency: { type: "string", minLength: 3, maxLength: 3 },
          proposalArchetype: { enum: proposalArchetypes },
          introSummary: { type: "string" },
          clientContext: { type: "string" },
          clientProblem: { type: "string" },
          businessGoal: { type: "string" },
          proposedSolutionSummary: { type: "string" },
          whyUs: { type: "string" },
          processSteps: {
            type: "array",
            items: { type: "string" },
          },
          proofItems: {
            type: "array",
            items: { type: "string" },
          },
          paymentTerms: { type: "string" },
          nextStepText: { type: "string" },
          approvalUrl: { type: "string" },
          discussionUrl: { type: "string" },
          openQuestions: {
            type: "array",
            items: { type: "string" },
          },
          assumptions: {
            type: "array",
            items: { type: "string" },
          },
          outOfScope: {
            type: "array",
            items: { type: "string" },
          },
          notes: { type: "string" },
        },
      },
      items: {
        type: "array",
        items: createScopeListItemJsonSchema(includeSystemId, noteProperty, estimateMeta),
      },
    },
  } as const;
}

function createScopeListItemJsonSchema(
  includeSystemId: boolean,
  noteProperty: Record<string, unknown>,
  estimateMeta: Record<string, unknown>,
) {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      ...(includeSystemId ? ["id"] : []),
      "title",
      "category",
      "type",
      "status",
      "priority",
      "scopePhase",
      "description",
      "clientValue",
      "deliverables",
      "outOfScope",
      "pricing",
      "timeline",
      "selection",
      "notes",
    ],
    properties: {
      ...(includeSystemId ? { id: { type: "string" } } : {}),
      title: { type: "string" },
      category: { enum: categories },
      type: { enum: itemTypes },
      status: { enum: statuses },
      priority: { enum: priorities },
      scopePhase: { enum: scopePhases },
      description: { type: "string" },
      clientValue: { type: "string" },
      deliverables: {
        type: "array",
        items: { type: "string" },
      },
      outOfScope: {
        type: "array",
        items: { type: "string" },
      },
      pricing: {
        type: "object",
        additionalProperties: false,
        required: ["quantity", "unit", "price", "currency"],
        properties: {
          quantity: { type: "number", minimum: 1 },
          unit: { enum: units },
          price: { type: "number", minimum: 0 },
          currency: { type: "string", minLength: 3, maxLength: 3 },
          ...estimateMeta,
        },
      },
      timeline: {
        type: "object",
        additionalProperties: false,
        required: ["estimatedDays"],
        properties: {
          estimatedDays: { type: "number", minimum: 0 },
          ...estimateMeta,
        },
      },
      selection: {
        type: "object",
        additionalProperties: false,
        required: ["selected"],
        properties: {
          selected: { type: "boolean" },
        },
      },
      notes: {
        type: "object",
        additionalProperties: false,
        required: ["dependencyNote", "internalNote"],
        properties: {
          dependencyNote: noteProperty,
          internalNote: noteProperty,
        },
      },
    },
  } as const;
}

export function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function calculateItemTotal(item: ChangeItem) {
  return Math.max(0, item.price) * Math.max(1, item.quantity);
}

export function calculateRequiredSubtotal(items: ChangeItem[]) {
  return items
    .filter((item) => item.required)
    .reduce((sum, item) => sum + calculateItemTotal(item), 0);
}

export function calculateOptionalSubtotal(items: ChangeItem[]) {
  return items
    .filter((item) => item.optional && item.selected)
    .reduce((sum, item) => sum + calculateItemTotal(item), 0);
}

export function calculateGrandTotal(items: ChangeItem[]) {
  return calculateRequiredSubtotal(items) + calculateOptionalSubtotal(items);
}

export function createScopeListIndexEntry(
  id: string,
  data: ProposalData,
  patch: Partial<ScopeListIndexEntry> = {},
): ScopeListIndexEntry {
  const now = new Date().toISOString();
  const publicUrl = patch.publicUrl || "";
  const recordId = patch.recordId || "";

  return {
    id,
    title: data.project.projectTitle || "КП на допработы",
    clientName: data.project.clientName,
    version: data.project.version || "v1.0",
    proposalDate: data.project.proposalDate,
    createdAt: patch.createdAt || now,
    updatedAt: patch.updatedAt || now,
    status: patch.status || (publicUrl ? "published" : "draft"),
    total: calculateGrandTotal(data.items),
    itemCount: data.items.length,
    ...(publicUrl ? { publicUrl } : {}),
    ...(recordId ? { recordId } : {}),
  };
}

export function calculateTotalDays(items: ChangeItem[]) {
  return items
    .filter((item) => item.required || (item.optional && item.selected))
    .reduce((sum, item) => sum + Math.max(0, item.estimatedDays), 0);
}

export function formatMoney(value: number, currency = "RUB") {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: currency || "RUB",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function toList(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function fromList(value: string[]) {
  return value.join("\n");
}

export function createEmptyChangeItem(): ChangeItem {
  return {
    id: createId(),
    title: "",
    category: "Other",
    description: "",
    clientValue: "",
    deliverables: [],
    outOfScope: [],
    price: 0,
    quantity: 1,
    unit: "fixed",
    estimatedDays: 0,
    priority: "medium",
    scopePhase: "launch",
    required: true,
    optional: false,
    selected: true,
    status: "proposed",
    dependencyNote: "",
    internalNote: "",
  };
}

export function createDefaultProposalData(): ProposalData {
  return {
    project: {
      projectTitle: "КП на дополнительные работы по текущему проекту",
      clientName: "",
      preparedBy: "Команда проекта",
      proposalDate: new Date().toISOString().slice(0, 10),
      version: "v1.0",
      currency: "RUB",
      proposalArchetype: "comparison",
      introSummary:
        "Это предложение фиксирует дополнительные работы к уже идущему проекту: что именно дорабатываем, какой эффект это даст, сколько времени займет и где проходят границы объема.",
      clientContext:
        "Мы уже работаем в контексте проекта и понимаем текущую логику, ограничения, материалы и техническую базу.",
      clientProblem:
        "Дополнительные идеи и новые требования важно оформить отдельно, чтобы они не растворились в основном объеме и не сдвинули текущий план без прозрачного решения.",
      businessGoal:
        "Показать, какие допработы дадут измеримый эффект для текущего проекта, и согласовать понятный сценарий запуска.",
      proposedSolutionSummary:
        "Предлагаем выделить допработы в отдельный управляемый контур: базовый набор для ближайшей итерации, опции по приоритету и прозрачные сроки.",
      whyUs:
        "Мы уже знаем проект, поэтому можем быстрее оценить влияние изменений, аккуратно встроить их в текущую архитектуру и заранее обозначить риски.",
      processSteps:
        "Подтверждаем состав допработ и зависимости\nФиксируем выбранный сценарий и стартовый слот\nВыполняем работы внутри текущего проектного контура\nПроводим QA и передаем результат",
      proofItems:
        "Команда уже погружена в проект и не тратит время на старт с нуля\nКаждая допработа привязана к эффекту, сроку и бюджету\nОпции отделены от обязательного контура и не размывают основной объем",
      paymentTerms:
        "Оплата допработ производится по согласованному сценарию перед стартом итерации или по действующим условиям текущего проекта.",
      nextStepText:
        "Выберите сценарий допработ, который хотите включить в ближайшую итерацию. После подтверждения мы закрепим объем, сроки и стартовый слот команды.",
      approvalUrl: "",
      discussionUrl: "",
      openQuestions:
        "Какие допработы нужно включить в ближайшую итерацию, а какие можно вынести в следующий этап?\nЕсть ли внешний дедлайн, под который нужно зафиксировать старт работ?",
      assumptions:
        "Основной проектный объем остается без изменений.\nМатериалы, доступы и решения по спорным вопросам предоставляются до старта допработ.\nНовые требования вне этого КП оцениваются отдельно.",
      outOfScope:
        "Работы, не указанные в составе допработ.\nПолная смена концепции текущего проекта.\nПоддержка после передачи результата сверх согласованного QA.",
      notes: "",
    },
    items: [],
  };
}

export function createExampleProposalData(): ProposalData {
  return {
    project: {
      projectTitle: "Дополнительные работы по текущему проекту",
      clientName: "Клиент",
      preparedBy: "Команда проекта",
      proposalDate: new Date().toISOString().slice(0, 10),
      version: "v1.0",
      currency: "RUB",
      proposalArchetype: "comparison",
      introSummary:
        "Ниже собран отдельный контур допработ к текущему проекту. Мы показываем, какое решение предлагаем, какой эффект оно даст клиенту, сколько займет по срокам и какие опции можно подключить к ближайшей итерации.",
      clientContext:
        "Проект уже в работе: команда погружена в текущую архитектуру, материалы, ограничения и цели клиента. Поэтому допработы можно запускать как управляемое расширение, а не как новый проект с нуля.",
      clientProblem:
        "Новые идеи и запросы появляются по ходу проекта. Если не выделить их отдельно, они начинают смешиваться с базовым объемом, влиять на сроки и создавать спорные ожидания по бюджету.",
      businessGoal:
        "Согласовать дополнительный объем так, чтобы клиент видел не просто список задач, а понятный результат: что улучшится в продукте, процессе или пользовательском опыте после внедрения.",
      proposedSolutionSummary:
        "Выделяем допработы в отдельный сценарий: обязательный контур для ближайшей итерации, рекомендуемые улучшения с быстрым эффектом и дорожную карту того, что можно отложить на следующий этап.",
      whyUs:
        "Мы уже знаем проект изнутри, поэтому можем быстрее оценить влияние изменений, не ломать текущий план и заранее показать зависимости, риски и ожидаемый эффект каждой допработы.",
      processSteps:
        "Фиксация выбранного сценария допработ и зависимостей\nРезервирование слота команды в текущем проектном плане\nВыполнение обязательного контура и выбранных опций\nQA-прогон, демонстрация результата и передача в работу",
      proofItems:
        "Команда уже погружена в проект и не тратит время на старт с нуля\nКаждая допработа привязана к клиентской пользе, сроку, бюджету и границам\nСценарии помогают выбрать объем по эффекту, а не вручную перебирать строки сметы",
      paymentTerms:
        "Допработы оплачиваются перед стартом выбранной итерации или по действующим условиям текущего проекта. Срочный слот фиксируется после подтверждения объема.",
      nextStepText:
        "Выберите сценарий, который хотите подключить к текущему проекту. После подтверждения мы закрепим объем, сроки, зависимости и стартовый слот команды.",
      approvalUrl: "",
      discussionUrl: "",
      openQuestions:
        "Какие допработы должны попасть в ближайшую итерацию, а какие можно вынести в следующий этап?\nЕсть ли внешний дедлайн или презентация, под которую нужно зарезервировать срочный слот?",
      assumptions:
        "Основной объем текущего проекта остается без изменений.\nКлиент предоставляет материалы, доступы и решения по спорным вопросам до старта допработ.\nСостав сценариев и интеграций не меняется без отдельной оценки.\nОдна consolidated-волна комментариев входит в указанную оценку.",
      outOfScope:
        "Полная смена концепции текущего проекта.\nНовая контент-стратегия или копирайтинг с нуля.\nИнтеграции, не указанные в этом КП.\nПоддержка после передачи результата сверх согласованного QA-прогона.",
      notes:
        "Внутренняя заметка: при согласовании срочного сценария заранее забронировать слот разработки и QA.",
    },
    items: [
      makeExampleItem({
        id: "example-hero",
        title: "Усиление ключевого сценария на сайте",
        category: "Design",
        description:
          "Доработка текущего интерфейсного сценария: структура, CTA и визуальные акценты под уже согласованный продуктовый фокус.",
        clientValue:
          "Пользователь быстрее понимает, что делать дальше, а текущий проект получает более сильный вход в целевое действие.",
        deliverables: [
          "Обновленная структура ключевого блока",
          "Уточненные CTA и supporting copy",
          "Передача решения в разработку",
        ],
        outOfScope: ["Полная смена визуальной концепции", "Новые иллюстрации"],
        price: 45000,
        estimatedDays: 2,
        priority: "high",
        required: true,
        optional: false,
        selected: true,
        dependencyNote: "Нужно подтвердить целевое действие и финальные формулировки CTA.",
        internalNote: "Проверить влияние новой структуры на мобильный сценарий.",
      }),
      makeExampleItem({
        id: "example-tablet",
        title: "Дополнительный адаптив для планшета",
        category: "Development",
        description:
          "Точная настройка промежуточных брейкпоинтов для планшетов и небольших ноутбуков.",
        clientValue:
          "Сайт выглядит аккуратно на устройствах, где стандартные mobile/desktop правила дают компромиссный результат.",
        deliverables: [
          "Проверка ключевых страниц на tablet viewport",
          "Настройка сеток и отступов",
          "Мини-регрессия после адаптива",
        ],
        outOfScope: ["Отдельный дизайн для каждого устройства"],
        price: 32000,
        estimatedDays: 2,
        required: false,
        optional: true,
        selected: true,
        internalNote: "Особенно проверить карточки кейсов.",
      }),
      makeExampleItem({
        id: "example-crm",
        title: "Интеграция формы с CRM",
        category: "Integration",
        description:
          "Подключение заявки с сайта к CRM клиента с передачей базовых полей и источника лида.",
        clientValue:
          "Команда продаж получает заявки без ручного переноса и быстрее реагирует на входящие обращения.",
        deliverables: [
          "Подключение endpoint/API CRM",
          "Маппинг полей формы",
          "Тестовая отправка и обработка ошибок",
        ],
        outOfScope: ["Сложная логика распределения лидов", "BI-отчеты"],
        price: 68000,
        estimatedDays: 3,
        priority: "high",
        required: true,
        optional: false,
        selected: true,
        dependencyNote: "Нужны API-доступы и тестовый пользователь CRM.",
        internalNote: "Заложить буфер на CORS и rate limits.",
      }),
      makeExampleItem({
        id: "example-animations",
        title: "Доработка анимаций",
        category: "Design",
        description:
          "Уточнение микровзаимодействий, появления блоков и hover-состояний на ключевых элементах.",
        clientValue:
          "Интерфейс воспринимается более современным и собранным, при этом не мешает скорости чтения.",
        deliverables: [
          "Настройка easing/duration",
          "Hover/focus states для интерактивных элементов",
          "Проверка reduced motion",
        ],
        outOfScope: ["Сложные 3D-анимации", "Новые видео-ассеты"],
        price: 28000,
        estimatedDays: 1.5,
        required: false,
        optional: true,
        selected: false,
        scopePhase: "roadmap",
        internalNote: "Не переборщить с motion на слабых устройствах.",
      }),
      makeExampleItem({
        id: "example-qa",
        title: "Дополнительный QA прогон",
        category: "QA",
        description:
          "Расширенная проверка после внедрения допработ: основные сценарии, формы, адаптив и критичные браузеры.",
        clientValue:
          "Снижает риск регрессий перед презентацией стейкхолдерам или публикацией.",
        deliverables: [
          "QA checklist по ключевым сценариям",
          "Список найденных дефектов",
          "Повторная проверка после исправлений",
        ],
        outOfScope: ["Нагрузочное тестирование", "Автотесты"],
        price: 24000,
        estimatedDays: 1,
        priority: "high",
        required: true,
        optional: false,
        selected: true,
        dependencyNote: "QA стартует после заморозки списка допработ.",
        internalNote: "Отдельно пройти Safari.",
      }),
      makeExampleItem({
        id: "example-urgent",
        title: "Срочная итерация за 48 часов",
        category: "Urgent",
        description:
          "Приоритетное выполнение согласованного набора задач в ускоренном режиме с выделенным слотом команды.",
        clientValue:
          "Позволяет успеть к презентации или внутреннему дедлайну без ожидания стандартного production-окна.",
        deliverables: [
          "Выделенный production slot",
          "Ежедневный короткий статус",
          "Фокус на согласованном списке задач",
        ],
        outOfScope: [
          "Расширение объема без переоценки",
          "Работы вне 48-часового окна",
        ],
        price: 52000,
        estimatedDays: 0,
        priority: "high",
        required: false,
        optional: true,
        selected: false,
        scopePhase: "roadmap",
        dependencyNote:
          "Работает только при быстром согласовании и доступности материалов.",
        internalNote: "Перед включением проверить загрузку команды.",
      }),
      makeExampleItem({
        id: "example-pdf-guide",
        title: "Подготовка PDF-инструкции для команды клиента",
        category: "Content",
        description:
          "Краткая инструкция по обновлению контента, заявкам и базовой поддержке после передачи текущей итерации.",
        clientValue:
          "Команда клиента сможет выполнять типовые операции без постоянных уточнений у подрядчика.",
        deliverables: [
          "PDF до 8 страниц",
          "Скриншоты ключевых действий",
          "Рекомендации по частым ошибкам",
        ],
        outOfScope: ["Видео-инструкция", "Очное обучение команды"],
        price: 30000,
        estimatedDays: 2,
        priority: "low",
        required: false,
        optional: true,
        selected: true,
        dependencyNote: "Нужна финальная структура админки после передачи текущей итерации.",
        internalNote: "Можно собрать из existing support notes.",
      }),
      makeExampleItem({
        id: "example-case-page",
        title: "Дополнительная страница кейса",
        category: "Development",
        description:
          "Создание новой страницы кейса на базе существующих компонентов с адаптацией структуры под материал клиента.",
        clientValue:
          "У клиента появляется дополнительный продающий материал для презентации экспертизы и результатов.",
        deliverables: [
          "Страница кейса в существующем стиле",
          "Адаптация блоков под контент",
          "Базовая SEO-разметка",
        ],
        outOfScope: ["Фотосъемка", "Копирайтинг кейса с нуля"],
        price: 58000,
        estimatedDays: 3,
        required: false,
        optional: true,
        selected: false,
        scopePhase: "roadmap",
        dependencyNote:
          "Нужны тексты, изображения и подтвержденные цифры результата.",
        internalNote: "Проверить, есть ли лимит на CMS entries.",
      }),
    ],
  };
}

export function createScopeListAiInputExampleData(): ScopeListAiInputData {
  return toScopeListProposalJson(createExampleProposalData(), {
    includeSystemIds: false,
    estimateConfidence: "medium",
    estimateSource: "ai_estimate",
  }) as ScopeListAiInputData;
}

export function exportProposalDataForJson(data: ProposalData): ScopeListProposalJson {
  return toScopeListProposalJson(normalizeProposalData(data) || data, {
    includeSystemIds: true,
    estimateConfidence: "high",
    estimateSource: "user_confirmed",
  }) as ScopeListProposalJson;
}

function toScopeListProposalJson(
  data: ProposalData,
  {
    estimateConfidence,
    estimateSource,
    includeSystemIds,
  }: {
    estimateConfidence: EstimateConfidence;
    estimateSource: EstimateSource;
    includeSystemIds: boolean;
  },
): ScopeListProposalJson | ScopeListAiInputData {
  return {
    project: {
      projectTitle: data.project.projectTitle,
      clientName: data.project.clientName,
      preparedBy: data.project.preparedBy,
      proposalDate: data.project.proposalDate,
      version: data.project.version,
      currency: data.project.currency || "RUB",
      proposalArchetype: data.project.proposalArchetype || "line_items",
      introSummary: data.project.introSummary,
      clientContext: data.project.clientContext,
      clientProblem: data.project.clientProblem,
      businessGoal: data.project.businessGoal,
      proposedSolutionSummary: data.project.proposedSolutionSummary,
      whyUs: data.project.whyUs,
      processSteps: toList(data.project.processSteps),
      proofItems: toList(data.project.proofItems),
      paymentTerms: data.project.paymentTerms,
      nextStepText: data.project.nextStepText,
      approvalUrl: data.project.approvalUrl,
      discussionUrl: data.project.discussionUrl,
      openQuestions: toList(data.project.openQuestions),
      assumptions: toList(data.project.assumptions),
      outOfScope: toList(data.project.outOfScope),
      notes: data.project.notes,
    },
    items: data.items.map((item) =>
      toScopeListItemJson(item, data.project.currency || "RUB", {
        estimateConfidence,
        estimateSource,
        includeSystemId: includeSystemIds,
      }),
    ),
  };
}

function toScopeListItemJson(
  item: ChangeItem,
  currency: string,
  {
    estimateConfidence,
    estimateSource,
    includeSystemId,
  }: {
    estimateConfidence: EstimateConfidence;
    estimateSource: EstimateSource;
    includeSystemId: boolean;
  },
): ScopeListJsonItem {
  const type: ChangeItemType = item.required ? "required" : "optional";
  const baseItem: Omit<ScopeListJsonItem, "id"> = {
    title: item.title,
    category: item.category,
    type,
    status: item.status,
    priority: item.priority,
    scopePhase: item.scopePhase,
    description: item.description,
    clientValue: item.clientValue,
    deliverables: item.deliverables,
    outOfScope: item.outOfScope,
    pricing: {
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      currency,
      source: estimateSource,
      confidence: estimateConfidence,
    },
    timeline: {
      estimatedDays: item.estimatedDays,
      source: estimateSource,
      confidence: estimateConfidence,
    },
    selection: {
      selected: type === "required" ? true : item.selected,
    },
    notes: {
      dependencyNote: emptyToNull(item.dependencyNote),
      internalNote: emptyToNull(item.internalNote),
    },
  };

  return includeSystemId
    ? {
        id: item.id || createId(),
        ...baseItem,
      }
    : baseItem;
}

export function encodeProposalForShare(data: ProposalData) {
  return compressToEncodedURIComponent(JSON.stringify(data));
}

export function decodeProposalFromShare(value: string) {
  const raw = value.startsWith(SHARE_HASH_PREFIX)
    ? value.slice(SHARE_HASH_PREFIX.length)
    : value;
  const decompressed = decompressFromEncodedURIComponent(raw);

  if (!decompressed) {
    return null;
  }

  return normalizeProposalData(JSON.parse(decompressed));
}

export function buildPublicProposalUrl(origin: string, shareSlug: string) {
  const baseUrl = origin || "http://localhost:3000";
  const url = new URL(baseUrl);

  url.pathname = `/p/${shareSlug}`;
  url.search = "";
  url.hash = "";

  return url.toString();
}

export function validateScopeListAiInputData(value: unknown) {
  return validateScopeListJsonData(value, {
    allowSystemIds: false,
    requireSystemIds: false,
  });
}

export function validateScopeListProposalJsonData(value: unknown) {
  return validateScopeListJsonData(value, {
    allowSystemIds: true,
    requireSystemIds: true,
  });
}

function validateScopeListJsonData(
  value: unknown,
  {
    allowSystemIds,
    requireSystemIds,
  }: {
    allowSystemIds: boolean;
    requireSystemIds: boolean;
  },
) {
  const errors: string[] = [];

  if (!isRecordValue(value)) {
    return { valid: false, errors: ["root must be an object"] };
  }

  validateAllowedKeys(value, "root", ["project", "items"], errors);

  if (!isRecordValue(value.project)) {
    errors.push("project must be an object");
  } else {
    validateAllowedKeys(
      value.project,
      "project",
      [
        "projectTitle",
        "clientName",
        "preparedBy",
        "proposalDate",
        "version",
        "currency",
        "proposalArchetype",
        "introSummary",
        "clientContext",
        "clientProblem",
        "businessGoal",
        "proposedSolutionSummary",
        "whyUs",
        "processSteps",
        "proofItems",
        "paymentTerms",
        "nextStepText",
        "approvalUrl",
        "discussionUrl",
        "openQuestions",
        "assumptions",
        "outOfScope",
        "notes",
      ],
      errors,
    );
    validateRequiredKeys(
      value.project,
      "project",
      [
        "projectTitle",
        "clientName",
        "preparedBy",
        "proposalDate",
        "version",
        "currency",
        "proposalArchetype",
        "introSummary",
        "clientContext",
        "clientProblem",
        "businessGoal",
        "proposedSolutionSummary",
        "whyUs",
        "processSteps",
        "proofItems",
        "paymentTerms",
        "nextStepText",
        "approvalUrl",
        "discussionUrl",
        "openQuestions",
        "assumptions",
        "outOfScope",
        "notes",
      ],
      errors,
    );
    validateStringList(value.project.assumptions, "project.assumptions", errors);
    validateStringList(value.project.outOfScope, "project.outOfScope", errors);
    validateStringList(value.project.processSteps, "project.processSteps", errors);
    validateStringList(value.project.proofItems, "project.proofItems", errors);
    validateStringList(value.project.openQuestions, "project.openQuestions", errors);
    validateEnum(
      value.project.proposalArchetype,
      proposalArchetypes,
      "project.proposalArchetype",
      errors,
    );
  }

  if (!Array.isArray(value.items)) {
    errors.push("items must be an array");
  } else {
    value.items.forEach((item, index) =>
      validateScopeListJsonItem(item, `items[${index}]`, {
        allowSystemIds,
        requireSystemIds,
        errors,
      }),
    );
  }

  return { valid: errors.length === 0, errors };
}

function validateScopeListJsonItem(
  item: unknown,
  path: string,
  {
    allowSystemIds,
    requireSystemIds,
    errors,
  }: {
    allowSystemIds: boolean;
    requireSystemIds: boolean;
    errors: string[];
  },
) {
  if (!isRecordValue(item)) {
    errors.push(`${path} must be an object`);
    return;
  }

  const itemKeys = [
    ...(allowSystemIds ? ["id"] : []),
    "title",
    "category",
    "type",
    "status",
    "priority",
    "scopePhase",
    "description",
    "clientValue",
    "deliverables",
    "outOfScope",
    "pricing",
    "timeline",
    "selection",
    "notes",
  ];
  validateAllowedKeys(item, path, itemKeys, errors);
  validateRequiredKeys(
    item,
    path,
    [
      ...(requireSystemIds ? ["id"] : []),
      "title",
      "category",
      "type",
      "status",
      "priority",
      "scopePhase",
      "description",
      "clientValue",
      "deliverables",
      "outOfScope",
      "pricing",
      "timeline",
      "selection",
      "notes",
    ],
    errors,
  );
  validateEnum(item.category, categories, `${path}.category`, errors);
  validateEnum(item.type, itemTypes, `${path}.type`, errors);
  validateEnum(item.status, statuses, `${path}.status`, errors);
  validateEnum(item.priority, priorities, `${path}.priority`, errors);
  validateEnum(item.scopePhase, scopePhases, `${path}.scopePhase`, errors);
  validateStringList(item.deliverables, `${path}.deliverables`, errors);
  validateStringList(item.outOfScope, `${path}.outOfScope`, errors);
  validatePricing(item.pricing, `${path}.pricing`, errors);
  validateTimeline(item.timeline, `${path}.timeline`, errors);
  validateSelection(item.selection, `${path}.selection`, errors);
  validateNotes(item.notes, `${path}.notes`, errors);
}

function validatePricing(value: unknown, path: string, errors: string[]) {
  if (!isRecordValue(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  validateAllowedKeys(
    value,
    path,
    ["quantity", "unit", "price", "currency", "source", "confidence"],
    errors,
  );
  validateRequiredKeys(value, path, ["quantity", "unit", "price", "currency"], errors);
  validateEnum(value.unit, units, `${path}.unit`, errors);
  validateNullableEnum(value.source, estimateSources, `${path}.source`, errors);
  validateNullableEnum(
    value.confidence,
    estimateConfidences,
    `${path}.confidence`,
    errors,
  );
}

function validateTimeline(value: unknown, path: string, errors: string[]) {
  if (!isRecordValue(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  validateAllowedKeys(
    value,
    path,
    ["estimatedDays", "source", "confidence"],
    errors,
  );
  validateRequiredKeys(value, path, ["estimatedDays"], errors);
  validateNullableEnum(value.source, estimateSources, `${path}.source`, errors);
  validateNullableEnum(
    value.confidence,
    estimateConfidences,
    `${path}.confidence`,
    errors,
  );
}

function validateSelection(value: unknown, path: string, errors: string[]) {
  if (!isRecordValue(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  validateAllowedKeys(value, path, ["selected"], errors);
  validateRequiredKeys(value, path, ["selected"], errors);

  if (typeof value.selected !== "boolean") {
    errors.push(`${path}.selected must be a boolean`);
  }
}

function validateNotes(value: unknown, path: string, errors: string[]) {
  if (!isRecordValue(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  validateAllowedKeys(value, path, ["dependencyNote", "internalNote"], errors);
  validateRequiredKeys(value, path, ["dependencyNote", "internalNote"], errors);

  for (const key of ["dependencyNote", "internalNote"]) {
    if (typeof value[key] !== "string" && value[key] !== null) {
      errors.push(`${path}.${key} must be a string or null`);
    }
  }
}

export function normalizeProposalData(value: unknown): ProposalData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<ProposalData>;

  if (!candidate.project || !Array.isArray(candidate.items)) {
    return null;
  }

  return {
    project: normalizeProjectSettings(candidate.project),
    items: candidate.items.map(normalizeChangeItem),
  };
}

function normalizeProjectSettings(value: unknown): ProposalData["project"] {
  const base = createDefaultProposalData().project;
  const source = asRecord(value);

  return {
    projectTitle: readStringValue(source.projectTitle, base.projectTitle),
    clientName: readStringValue(source.clientName, base.clientName),
    preparedBy: readStringValue(source.preparedBy, base.preparedBy),
    proposalDate: readStringValue(source.proposalDate, base.proposalDate),
    version: readStringValue(source.version, base.version),
    currency: readStringValue(source.currency, base.currency).toUpperCase() || "RUB",
    proposalArchetype: normalizeEnum(
      source.proposalArchetype,
      proposalArchetypes,
      base.proposalArchetype,
    ),
    introSummary: readStringValue(source.introSummary, base.introSummary),
    clientContext: readStringValue(source.clientContext, base.clientContext),
    clientProblem: readStringValue(source.clientProblem, base.clientProblem),
    businessGoal: readStringValue(source.businessGoal, base.businessGoal),
    proposedSolutionSummary: readStringValue(
      source.proposedSolutionSummary,
      base.proposedSolutionSummary,
    ),
    whyUs: readStringValue(source.whyUs, base.whyUs),
    processSteps: fromList(
      readStringList(source.processSteps, toList(base.processSteps)),
    ),
    proofItems: fromList(
      readStringList(source.proofItems, toList(base.proofItems)),
    ),
    paymentTerms: readStringValue(source.paymentTerms, base.paymentTerms),
    nextStepText: readStringValue(source.nextStepText, base.nextStepText),
    approvalUrl: readStringValue(source.approvalUrl, base.approvalUrl),
    discussionUrl: readStringValue(source.discussionUrl, base.discussionUrl),
    openQuestions: fromList(
      readStringList(source.openQuestions, toList(base.openQuestions)),
    ),
    assumptions: fromList(readStringList(source.assumptions, toList(base.assumptions))),
    outOfScope: fromList(readStringList(source.outOfScope, toList(base.outOfScope))),
    notes: readStringValue(source.notes, base.notes),
  };
}

function normalizeChangeItem(value: unknown): ChangeItem {
  const source = asRecord(value);
  const pricing = asRecord(source.pricing);
  const timeline = asRecord(source.timeline);
  const selection = asRecord(source.selection);
  const notes = asRecord(source.notes);
  const type = normalizeItemType(source);
  const required = type === "required";
  const selected = required
    ? true
    : readBooleanValue(selection.selected, readBooleanValue(source.selected, false));

  return {
    ...createEmptyChangeItem(),
    id: readStringValue(source.id, createId()),
    title: readStringValue(source.title, ""),
    category: normalizeEnum(source.category, categories, "Other"),
    description: readStringValue(source.description, ""),
    clientValue: readStringValue(source.clientValue, ""),
    deliverables: readStringList(source.deliverables),
    outOfScope: readStringList(source.outOfScope),
    price: Math.max(
      0,
      readNumberValue(pricing.price, readNumberValue(source.price, 0)),
    ),
    quantity: Math.max(
      1,
      readNumberValue(pricing.quantity, readNumberValue(source.quantity, 1)),
    ),
    unit: normalizeEnum(pricing.unit ?? source.unit, units, "fixed"),
    estimatedDays: Math.max(
      0,
      readNumberValue(
        timeline.estimatedDays,
        readNumberValue(source.estimatedDays, 0),
      ),
    ),
    priority: normalizeEnum(source.priority, priorities, "medium"),
    scopePhase: normalizeEnum(source.scopePhase, scopePhases, "launch"),
    required,
    optional: type === "optional",
    selected,
    status: normalizeEnum(source.status, statuses, "proposed"),
    dependencyNote: readStringValue(
      notes.dependencyNote,
      readStringValue(source.dependencyNote, ""),
    ),
    internalNote: readStringValue(
      notes.internalNote,
      readStringValue(source.internalNote, ""),
    ),
  };
}

function normalizeItemType(source: Record<string, unknown>): ChangeItemType {
  if (itemTypes.includes(source.type as ChangeItemType)) {
    return source.type as ChangeItemType;
  }

  if (readBooleanValue(source.required, false)) {
    return "required";
  }

  if (readBooleanValue(source.optional, false)) {
    return "optional";
  }

  return "required";
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateAllowedKeys(
  value: Record<string, unknown>,
  path: string,
  allowedKeys: string[],
  errors: string[],
) {
  const allowed = new Set(allowedKeys);

  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push(`${path}.${key} is not allowed`);
    }
  }
}

function validateRequiredKeys(
  value: Record<string, unknown>,
  path: string,
  requiredKeys: string[],
  errors: string[],
) {
  for (const key of requiredKeys) {
    if (!(key in value)) {
      errors.push(`${path}.${key} is required`);
    }
  }
}

function validateStringList(value: unknown, path: string, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return;
  }

  value.forEach((item, index) => {
    if (typeof item !== "string") {
      errors.push(`${path}[${index}] must be a string`);
    }
  });
}

function validateEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  errors: string[],
) {
  if (!allowed.includes(value as T)) {
    errors.push(`${path} must be one of: ${allowed.join(", ")}`);
  }
}

function validateNullableEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  errors: string[],
) {
  if (value !== undefined && value !== null && !allowed.includes(value as T)) {
    errors.push(`${path} must be null or one of: ${allowed.join(", ")}`);
  }
}

function readStringValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function readNumberValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function readBooleanValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  }

  return fallback;
}

function readStringList(value: unknown, fallback: string[] = []) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return toList(value);
  }

  return fallback;
}

function normalizeEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
) {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function emptyToNull(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function makeExampleItem(
  item: Omit<
    ChangeItem,
    | "quantity"
    | "unit"
    | "status"
    | "priority"
    | "scopePhase"
    | "dependencyNote"
    | "internalNote"
  > &
    Partial<
      Pick<
        ChangeItem,
        | "quantity"
        | "unit"
        | "status"
        | "priority"
        | "scopePhase"
        | "dependencyNote"
        | "internalNote"
      >
    >,
): ChangeItem {
  return {
    quantity: 1,
    unit: "fixed",
    status: "proposed",
    priority: "medium",
    scopePhase: "launch",
    dependencyNote: "",
    internalNote: "",
    ...item,
  };
}
