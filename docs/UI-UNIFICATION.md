# Унификация UI DOPLIST с PRISMA — техническое задание

## Цель

Сделать так, чтобы конструктор DOPLIST (`/`, режим builder) визуально и
структурно был «очень похож» на конструктор PRISMA (`/proposal/[id]/edit`,
`/proposal/new`). Цель — облегчить онбординг сотрудников: посмотрел на одну
админку → понимает вторую без переобучения.

Палитра, шрифт (Onest), радиусы, тени и `data-theme` уже унифицированы
через `src/app/globals.css` в обоих репо. Этот документ описывает, что
осталось — перестройка хедера, единый набор UI-примитивов и обёртки
секций в стиле PRISMA.

## Контекст: что есть сейчас

### PRISMA (`C:\Users\Nik\Documents\kp-builder`)

- Шапка редактора КП: `src/components/proposal/ProposalEditor.tsx` строки 282–360.
  Структура одной строкой: `Назад ← | Бейдж статуса + "Новое КП" заголовок | ThemeToggle | Пример JSON | Импорт | Предпросмотр | Сохранить | Опубликовать`.
- Секции тела используют общий компонент `<SectionCard>` из
  `src/components/proposal/Ui.tsx` (см. строки 148–175).
- Общий набор примитивов в том же `Ui.tsx`: `Badge`, `Button` (варианты
  `primary | secondary | ghost | danger`), `TextInput`, `Textarea`,
  `Toggle`, `SectionCard`, `Toast`.

### DOPLIST (`C:\Users\Nik\Documents\price_presentation`)

- Шапка билдера: `src/components/AppShellClient.tsx` строки 293–365.
  Структура: верхняя строка — «DOPLIST» крупным текстом + расшифровка,
  средняя строка — 4 инпута (Проект/Клиент/Дата/Версия) + ThemeToggle +
  ModeButton-переключатель Редактор/Презентация, нижняя строка —
  `<ImportExportControls>` + статус-пилюля localStorage.
- Каждая секция в теле — отдельный компонент с собственной разметкой
  `<section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">`.
  Шаблон одинаковый, но повторяется руками в каждом файле:
  `ProjectSettingsForm.tsx`, `ChangeItemForm.tsx`, `ChangeItemList.tsx`,
  `SummaryCard.tsx`.
- Общих UI-примитивов нет. Кнопки везде написаны как
  `<button className="inline-flex h-10 …">` с разными вариациями.

## Что должно стать

### 1. Создать `src/components/Ui.tsx` в DOPLIST

Зеркалит PRISMA `src/components/proposal/Ui.tsx`. Скопировать оттуда
ровно те же компоненты и сигнатуры. **Без директивы `"use client"` —
в PRISMA её нет, файл шарится между client- и server-компонентами:**

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/cn"; // ← создать (см. ниже)

export function Badge({ children, className }: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const variants = {
    primary:
      "bg-zinc-900 text-white hover:bg-zinc-800 focus:ring-zinc-200 disabled:bg-zinc-300",
    secondary:
      "border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50 focus:ring-zinc-100",
    ghost: "text-zinc-700 hover:bg-zinc-100 focus:ring-zinc-100",
    danger:
      "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 focus:ring-rose-200",
  };

  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold outline-none transition focus:ring-4 disabled:cursor-not-allowed disabled:opacity-70",
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TextInput({ label, value, onChange, type = "text", placeholder, helper }: {
  label: string; value: string; type?: string;
  placeholder?: string; helper?: string;
  onChange: (value: string) => void;
}) { /* same as PRISMA Ui.tsx lines 55–84 */ }

export function Textarea({ label, value, onChange, rows = 4, helper, placeholder }: {
  label: string; value: string; rows?: number;
  helper?: string; placeholder?: string;
  onChange: (value: string) => void;
}) { /* same as PRISMA Ui.tsx lines 86–115 */ }

export function Toggle({ label, checked, onChange, helper }: {
  label: string; checked: boolean; helper?: string;
  onChange: (value: boolean) => void;
}) { /* same as PRISMA Ui.tsx lines 117–146 */ }

export function SectionCard({ title, eyebrow, children, action }: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-paper p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 text-xl font-semibold text-zinc-950">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Toast({ message, tone }: { message: string; tone: string }) {
  /* same as PRISMA Ui.tsx lines 177–194 */
}
```

ВАЖНО: брать копию строго из `kp-builder/src/components/proposal/Ui.tsx`,
не «переписывать по памяти». Любое отклонение в классах = расхождение в
дизайне.

### 2. Создать `src/lib/cn.ts` в DOPLIST

Зеркалит PRISMA `src/lib/cn.ts` **дословно** (никаких clsx/tailwind-merge,
в PRISMA их нет):

```ts
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
```

Никаких новых зависимостей в `package.json` добавлять не нужно.

### 3. Перестроить хедер `AppShellClient.tsx`

Текущая верстка (строки 293–365) делится на три ряда: бренд, поля+тогглы,
ImportExportControls+статус. **Свернуть в один ряд** как у PRISMA.

#### Новая структура хедера

```tsx
<header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur no-print">
  <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
    {/* Левый кластер: бренд + статус localStorage */}
    <div className="flex items-center gap-3">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
        <Layers3 size={18} aria-hidden="true" />
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-200">
            {hydrated ? notice : "Готовим localStorage"}
          </Badge>
        </div>
        <h1 className="mt-1 text-base font-semibold tracking-[0.18em] text-zinc-950">
          DOPLIST
        </h1>
      </div>
    </div>

    {/* Правый кластер: тогглы + переключатель Builder/Preview */}
    <div className="flex flex-wrap items-center gap-2">
      <ThemeToggle theme={theme} onChange={setTheme} />
      <ImportExportControls
        data={data}
        onImport={importData}
        onCopyShareLink={copyShareLink}
        onReset={resetDemoData}
      />
      <div className="grid h-10 grid-cols-2 rounded-md border border-zinc-200 bg-zinc-50 p-1">
        <button
          type="button"
          onClick={() => setMode("builder")}
          aria-pressed={mode === "builder"}
          className={`inline-flex items-center justify-center gap-2 rounded px-3 text-sm font-semibold transition ${
            mode === "builder"
              ? "bg-paper text-zinc-950 shadow-sm"
              : "text-zinc-500 hover:text-zinc-900"
          }`}
        >
          <Hammer size={16} aria-hidden="true" />
          Редактор
        </button>
        <button
          type="button"
          onClick={() => setMode("preview")}
          aria-pressed={mode === "preview"}
          className={`inline-flex items-center justify-center gap-2 rounded px-3 text-sm font-semibold transition ${
            mode === "preview"
              ? "bg-paper text-zinc-950 shadow-sm"
              : "text-zinc-500 hover:text-zinc-900"
          }`}
        >
          <Eye size={16} aria-hidden="true" />
          Презентация
        </button>
      </div>
    </div>
  </div>
</header>
```

Ключевые изменения по сравнению с тем что было:
- Бренд «DOPLIST» из `text-2xl` уменьшается до `text-base` — как
  «PRISMA» на дашборде PRISMA (`DashboardClient.tsx:159`).
- Подзаголовок «Digital Offer & Proposal List …» **убирается** из шапки
  (можно добавить как `<meta name="description">` в `layout.tsx`, если
  ещё не там).
- Иконка-плашка слева как у PRISMA back-button (40×40, `bg-zinc-100`).
- Фон `bg-white/90` (было `/95`) — как у PRISMA.
- ImportExportControls и Mode-toggle переносятся в правый кластер
  одной строкой.
- 4 инпута «Проект/Клиент/Дата/Версия» **переезжают вниз** в первый
  SectionCard (см. шаг 4).

### 4. Перенести project-поля в SectionCard

`ProjectSettingsForm.tsx` уже хранит большую часть. Расширить его (или
обернуть в `AppShellClient.tsx` поверх формы) так, чтобы 4 поля
«Проект/Клиент/Дата/Версия» были видны как первая секция:

```tsx
<SectionCard title="Основные параметры" eyebrow="Настройки проекта">
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
    <TextInput
      label="Проект"
      value={data.project.projectTitle}
      onChange={(projectTitle) => updateProject({ projectTitle })}
    />
    <TextInput
      label="Клиент"
      value={data.project.clientName}
      onChange={(clientName) => updateProject({ clientName })}
    />
    <TextInput
      label="Дата"
      type="date"
      value={data.project.proposalDate}
      onChange={(proposalDate) => updateProject({ proposalDate })}
    />
    <TextInput
      label="Версия"
      value={data.project.version}
      onChange={(version) => updateProject({ version })}
    />
  </div>

  {/* Дальше — остальные настройки, которые уже были в ProjectSettingsForm */}
</SectionCard>
```

Удалить функцию `HeaderField` (строки 423–448) — она больше не нужна.

### 5. Конвертировать остальные секции на SectionCard

Затрагиваемые файлы:
- `src/components/ProjectSettingsForm.tsx`
- `src/components/ChangeItemForm.tsx`
- `src/components/ChangeItemList.tsx`
- `src/components/SummaryCard.tsx`
- `src/components/PricingBreakdown.tsx`

В каждом заменить руками собранную обёртку

```tsx
<section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
  <div className="flex items-start justify-between gap-4">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
        {ОТДЕЛЬНЫЙ ТЕКСТ В КАЖДОМ}
      </p>
      <h2 className="mt-1 text-xl font-semibold text-zinc-950">…</h2>
    </div>
    <div className="rounded-md bg-zinc-100 p-2 text-zinc-700">{icon}</div>
  </div>
  …
</section>
```

на использование общего `SectionCard`:

```tsx
<SectionCard
  title="Основные параметры"
  eyebrow="Настройки проекта"
  action={
    <div className="rounded-md bg-zinc-100 p-2 text-zinc-700">
      <ClipboardList size={20} aria-hidden="true" />
    </div>
  }
>
  …
</SectionCard>
```

Это применяется ко всем перечисленным файлам. В PRISMA
`SectionCard` использует `bg-paper p-5` — DOPLIST после миграции
получит тот же отступ и фон, что выровняет визуал.

ВНИМАНИЕ: цвет eyebrow в DOPLIST сейчас `text-emerald-700` (после моего
маппинга в темах это фиолет). В PRISMA `SectionCard` eyebrow — `text-zinc-500`
(приглушённый). После миграции eyebrow будет приглушённым в обоих, что
правильнее. Если хочется акцент — оставить как есть, но это будет
отличаться от PRISMA. По умолчанию используем PRISMA-вариант (`zinc-500`).

### 6. Заменить кнопки на `<Button>`

Места, где сейчас прямо в JSX написан `<button className="inline-flex h-10 …">`:

- `src/components/AppShellClient.tsx` — ModeButton (строки 450–475) можно
  оставить как локальный хелпер, но стилизовать через `Button variant="ghost"`.
- `src/components/ChangeItemForm.tsx` — кнопки Save/Cancel/Add.
- `src/components/ChangeItemList.tsx` — кнопки Edit/Duplicate/Delete на
  карточке item.
- `src/components/ImportExportControls.tsx` — там тоже raw `<button>`.

Заменить так:
- «сохранить/добавить» → `<Button>` (primary)
- «отменить/redact secondary» → `<Button variant="secondary">`
- мелкие toolbar-кнопки → `<Button variant="ghost">`
- удалить/сбросить → `<Button variant="danger">`

### 7. Мелочи

- В `AppShellClient.tsx` строка 467: `bg-white text-zinc-950 shadow-sm`
  заменить на `bg-paper text-zinc-950 shadow-sm` — то же поведение в
  light, но в dark `bg-paper` даёт solid `#07131f`, а `bg-white` —
  прозрачный фон 5%.
- `border-zinc-200` остаётся как есть. Светлая граница уже усилена через
  токен в `globals.css` (`--color-zinc-200: #d6dde6`).
- Иконка-плашка слева в хедере DOPLIST — взять `Layers3`. У PRISMA там
  back-arrow `ArrowLeft`, но в DOPLIST некуда возвращаться (one-page
  приложение), так что просто бренд-иконка.

## Что НЕ трогать

- Структура данных (`ChangeItem`, `ProposalData`, лог-events) — не наш
  слой.
- localStorage / Supabase API.
- Логику ImportExportControls (Экспорт/Импорт/Пример/Опубликовать ссылку
  /Сбросить) — только визуал кнопок.
- `ProposalPreview.tsx` — это публичная презентация клиенту, она уже
  выровнена в светлой/тёмной темах. Не трогать.
- `globals.css` — все токены уже едины с PRISMA.
- `data-theme` инфраструктуру — она уже работает.

## Acceptance criteria

1. Открыть в двух окнах:
   `http://localhost:3000` (DOPLIST builder) и
   `http://localhost:3001/proposal/new` (PRISMA editor).
   Чек: левый верхний угол выглядит «как родной брат»: маленький бренд,
   иконка слева, бейдж рядом.
   Правый верхний угол: одинаковый набор кнопок одной высоты, одного
   стиля, ThemeToggle справа.
2. Все секции в теле имеют одинаковую визуальную обёртку: `rounded-lg`,
   единая граница `border-zinc-200`, фон `bg-paper`, паддинг `p-5`,
   eyebrow слева сверху приглушённого цвета, заголовок `text-xl`.
3. Кнопки везде — `<Button variant=…>`. Никаких raw `<button className="inline-flex h-10 …">`
   в JSX (кроме внутренних toggle/segmented controls).
4. `npm run build` чистый.
5. Светлая и тёмная темы работают в обоих режимах (builder и preview):
   нет белого по белому, нет невидимых границ.

## Верификация

```bash
cd C:\Users\Nik\Documents\price_presentation
npm run build
```

Затем визуально:
1. Открыть `/` в светлой теме → переключить на тёмную через ThemeToggle.
2. Перейти в режим Презентация → ThemeToggle всё ещё работает.
3. Открыть `/proposal/new` в PRISMA рядом — два хедера должны выглядеть
   симметрично.

## Файлы, которые будут изменены

| Файл | Что |
|---|---|
| `src/components/Ui.tsx` | создать (копия PRISMA Ui.tsx) |
| `src/lib/cn.ts` | создать (копия PRISMA cn.ts, без зависимостей) |
| `src/components/AppShellClient.tsx` | перестроить header, удалить HeaderField |
| `src/components/ProjectSettingsForm.tsx` | использовать SectionCard, расширить поля |
| `src/components/ChangeItemForm.tsx` | SectionCard + Button |
| `src/components/ChangeItemList.tsx` | SectionCard + Button |
| `src/components/SummaryCard.tsx` | SectionCard |
| `src/components/PricingBreakdown.tsx` | SectionCard где применимо |
| `src/components/ImportExportControls.tsx` | заменить raw кнопки на `<Button>` |

## Контекст палитры (справочно)

Тёмная тема (`isty.ist`): фон `#020b14`, акцент `#8e44ad` (фиолет),
вторичный `#e67e22` (оранж), текст `#ecf0f1`.

Светлая тема («iceberg block» с `sales.isty.ist`): фон `#f7f9fc`,
панели `#ffffff` / `#f6f8fb`, текст `#0f1923`, бордеры `#d6dde6`,
акценты те же фиолет + оранж.

Шрифт: **Onest** (Google Fonts), подключён в `layout.tsx` через
`next/font/google`.

Полный набор токенов — `src/app/globals.css`. Любые новые поверхности
должны использовать `bg-paper`, `bg-main`, `bg-panel-soft`, а не
hard-coded `bg-white`.
