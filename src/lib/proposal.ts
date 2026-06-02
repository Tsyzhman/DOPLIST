import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import type {
  Category,
  ChangeItem,
  Priority,
  ProposalData,
  Status,
  Unit,
} from "./types";

export const STORAGE_KEY = "change-proposal-builder-v1";
export const PROPOSAL_RECORD_ID_KEY = "change-proposal-record-id-v1";
export const SHARE_HASH_PREFIX = "proposal=";

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
export const statuses: Status[] = ["proposed", "approved", "rejected", "postponed"];
export const units: Unit[] = ["fixed", "hour", "day", "item"];

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
  proposed: "Предложено",
  approved: "Согласовано",
  rejected: "Отклонено",
  postponed: "Отложено",
};

export const unitLabels: Record<Unit, string> = {
  fixed: "Фикс",
  hour: "Час",
  day: "День",
  item: "Позиция",
};

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
    required: true,
    optional: false,
    selected: true,
    status: "proposed",
    dependencyNote: "",
    internalNote: "",
  };
}

export function createDemoProposalData(): ProposalData {
  return {
    project: {
      projectTitle: "Корректировки сайта после клиентского ревью",
      clientName: "ACME Studio",
      preparedBy: "Nikita",
      proposalDate: new Date().toISOString().slice(0, 10),
      version: "v1.0",
      currency: "RUB",
      introSummary:
        "Ниже собран понятный пакет корректировок после ревью: обязательные работы для сохранения качества релиза и опциональные улучшения, которые можно подключить к текущей итерации.",
      paymentTerms:
        "50% предоплата перед стартом работ, 50% после приемки. Срочные итерации оплачиваются до начала выполнения.",
      approvalUrl: "",
      discussionUrl: "",
      assumptions:
        "Клиент предоставляет финальные тексты и материалы до старта итерации.\nСостав страниц и ключевые сценарии не меняются без отдельной оценки.\nДоступы к CRM и тестовым окружениям предоставляются в течение 1 рабочего дня.\nОдна consolidated-волна комментариев входит в указанную оценку.",
      outOfScope:
        "Полный редизайн сайта.\nНовая контент-стратегия или копирайтинг с нуля.\nИнтеграции, не указанные в этом proposal.\nПоддержка после релиза сверх согласованного QA-прогона.",
      notes:
        "Внутренняя заметка: при согласовании срочной итерации заранее забронировать слот разработки и QA.",
    },
    items: [
      makeDemoItem({
        id: "demo-hero",
        title: "Правка главного экрана",
        category: "Design",
        description:
          "Обновление композиции первого экрана, акцентов CTA и визуального баланса согласно замечаниям клиента.",
        clientValue:
          "Первый экран быстрее объясняет оффер и помогает пользователю перейти к целевому действию без лишнего трения.",
        deliverables: [
          "Обновленный desktop-макет hero-секции",
          "Правки CTA и supporting copy",
          "Передача обновлений в разработку",
        ],
        outOfScope: ["Полная смена визуальной концепции", "Новые иллюстрации"],
        price: 45000,
        estimatedDays: 2,
        priority: "high",
        required: true,
        optional: false,
        selected: true,
        dependencyNote: "Нужны финальные формулировки CTA от клиента.",
        internalNote: "Проверить, не ломает ли новая композиция mobile hero.",
      }),
      makeDemoItem({
        id: "demo-tablet",
        title: "Дополнительный адаптив для планшета",
        category: "Development",
        description:
          "Точная настройка промежуточных брейкпоинтов для планшетов и небольших ноутбуков.",
        clientValue:
          "Сайт выглядит аккуратно на устройствах, где стандартные mobile/desktop правила дают компромиссный результат.",
        deliverables: [
          "Проверка ключевых страниц на tablet viewport",
          "CSS-правки сеток и отступов",
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
      makeDemoItem({
        id: "demo-crm",
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
      makeDemoItem({
        id: "demo-animations",
        title: "Доработка анимаций",
        category: "Design",
        description:
          "Уточнение микровзаимодействий, появления блоков и hover-состояний на ключевых элементах.",
        clientValue:
          "Интерфейс воспринимается более современным и собранным, при этом не мешает скорости чтения.",
        deliverables: [
          "Правки easing/duration",
          "Hover/focus states для интерактивных элементов",
          "Проверка reduced motion",
        ],
        outOfScope: ["Сложные 3D-анимации", "Новые видео-ассеты"],
        price: 28000,
        estimatedDays: 1.5,
        required: false,
        optional: true,
        selected: false,
        internalNote: "Не переборщить с motion на слабых устройствах.",
      }),
      makeDemoItem({
        id: "demo-qa",
        title: "Дополнительный QA прогон",
        category: "QA",
        description:
          "Расширенная проверка после внесения корректировок: основные сценарии, формы, адаптив и критичные браузеры.",
        clientValue:
          "Снижает риск регрессий перед демонстрацией стейкхолдерам или публикацией.",
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
        dependencyNote: "QA стартует после заморозки списка корректировок.",
        internalNote: "Отдельно пройти Safari.",
      }),
      makeDemoItem({
        id: "demo-urgent",
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
        dependencyNote:
          "Работает только при быстром согласовании и доступности материалов.",
        internalNote: "Перед включением проверить загрузку команды.",
      }),
      makeDemoItem({
        id: "demo-pdf-guide",
        title: "Подготовка PDF-инструкции для команды клиента",
        category: "Content",
        description:
          "Краткая инструкция по обновлению контента, заявкам и базовой поддержке после передачи сайта.",
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
        dependencyNote: "Нужна финальная структура админки после релиза.",
        internalNote: "Можно собрать из existing support notes.",
      }),
      makeDemoItem({
        id: "demo-case-page",
        title: "Дополнительная страница кейса",
        category: "Development",
        description:
          "Создание новой страницы кейса на базе существующих компонентов с адаптацией структуры под материал клиента.",
        clientValue:
          "У клиента появляется дополнительный продающий материал для демонстрации экспертизы и результатов.",
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
        dependencyNote:
          "Нужны тексты, изображения и подтвержденные цифры результата.",
        internalNote: "Проверить, есть ли лимит на CMS entries.",
      }),
    ],
  };
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

export function normalizeProposalData(value: unknown): ProposalData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as ProposalData;

  if (!candidate.project || !Array.isArray(candidate.items)) {
    return null;
  }

  return {
    project: {
      ...createDemoProposalData().project,
      ...candidate.project,
      currency: candidate.project.currency || "RUB",
    },
    items: candidate.items.map((item) => ({
      ...createEmptyChangeItem(),
      ...item,
      id: item.id || createId(),
      price: Math.max(0, Number(item.price) || 0),
      quantity: Math.max(1, Number(item.quantity) || 1),
      estimatedDays: Math.max(0, Number(item.estimatedDays) || 0),
      required: Boolean(item.required),
      optional: Boolean(item.optional),
      selected: Boolean(item.selected),
      deliverables: Array.isArray(item.deliverables) ? item.deliverables : [],
      outOfScope: Array.isArray(item.outOfScope) ? item.outOfScope : [],
    })),
  };
}

function makeDemoItem(
  item: Omit<
    ChangeItem,
    "quantity" | "unit" | "status" | "priority" | "dependencyNote" | "internalNote"
  > &
    Partial<
      Pick<
        ChangeItem,
        "quantity" | "unit" | "status" | "priority" | "dependencyNote" | "internalNote"
      >
    >,
): ChangeItem {
  return {
    quantity: 1,
    unit: "fixed",
    status: "proposed",
    priority: "medium",
    dependencyNote: "",
    internalNote: "",
    ...item,
  };
}
