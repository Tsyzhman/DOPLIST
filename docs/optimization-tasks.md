# Optimization tasks (resource footprint)

Goal: уменьшить требования SCOPELIST к CPU, RAM и (особенно) диску — как в Docker-образе, так и в локальной dev-среде.

Документ написан как чек-лист для агентов/разработчиков. Каждая задача самодостаточна: что менять, в каких файлах, какие команды запускать, как проверить результат, и какие риски учесть.

Базовые цифры на момент аудита (2026-06-01, ветка main):

| Зона | Размер |
|---|---|
| `node_modules` | 446.6 МБ |
| `.next` | 22.6 МБ |
| `next` + `@next/swc-win32-x64-msvc` | 277.2 МБ (минимум, не трогаем) |
| `lucide-react` | 28.8 МБ |
| `typescript` (dev) | 23.2 МБ |
| `@img/sharp-*` | 19 МБ |
| `lightningcss-*` (dev) | 9.1 МБ |
| `@supabase/supabase-js` | 6.8 МБ |
| `bcryptjs` | ~0.5 МБ |

Все задачи можно делать независимо, но рекомендуемый порядок выполнения — снизу списка к верху сложности: **T1 → T3 → T5 → T8 → T2 → T7 → T4 → T9 → T6 → T10**. Это даёт максимум эффекта при минимуме риска ранними шагами.

---

## T1. Удалить мёртвую зависимость `bcryptjs`

**Зачем.** Объявлена в `package.json:16` в `dependencies`, но `grep` по `src/` и `scripts/` не находит ни одного импорта. Тянет транзитивные пакеты при `npm ci` и засоряет lockfile.

**Файлы:** `package.json`, `package-lock.json`.

**Шаги:**
1. Финальная проверка, что bcryptjs действительно нигде не используется:
   ```bash
   # из корня репо
   git grep -nE "from ['\"]bcryptjs['\"]|require\\(['\"]bcryptjs['\"]\\)" -- ':!package*.json' ':!node_modules'
   ```
   Должно вернуть пусто. Если что-то нашлось — задача отменяется, фиксируем находку в комменте PR.
2. Удалить из `package.json`:
   ```diff
   -    "bcryptjs": "^3.0.3",
   ```
3. Перегенерировать lockfile:
   ```bash
   npm install
   ```
   (не `npm ci` — нужен именно `install`, чтобы lockfile обновился).
4. Прогнать сборку и линт:
   ```bash
   npm run lint
   npm run build
   ```

**Acceptance:**
- `package.json` не содержит `bcryptjs`.
- `package-lock.json` обновлён и в нём нет узла `node_modules/bcryptjs`.
- `npm run build` зелёный.

**Риски:** теоретически bcryptjs мог быть запланирован под будущую фичу публичного доступа (`src/lib/server/public-access.ts` упоминает `passwordHash`). Если фича в работе у кого-то ещё — оставить и пометить TODO.

---

## T2. Не копировать полные `node_modules` в runtime-слой Docker

**Зачем.** В `Dockerfile:35` есть `COPY --from=deps /app/node_modules ./node_modules`. При этом в `deps` стейдже `npm ci` (строка 11) ставит **все** зависимости, включая dev (`typescript`, `eslint`, `tailwindcss`, `lightningcss`, `@types/*`). Всё это попадает в runtime-образ. А `next.config.ts` уже использует `output: "standalone"`, который трассирует только нужное.

**Файлы:** `Dockerfile`, `next.config.ts`, `compose.yaml`.

**Шаги:**
1. Перестроить Dockerfile в три prod-слоя + builder:

   ```dockerfile
   # syntax=docker/dockerfile:1.7
   ARG NODE_IMAGE=node:24.16.0-alpine3.23

   # --- 1. Полные deps для билда ---
   FROM ${NODE_IMAGE} AS deps
   WORKDIR /app
   ENV NEXT_TELEMETRY_DISABLED=1
   COPY package.json package-lock.json ./
   RUN npm ci --no-audit --no-fund

   # --- 2. Только prod deps для воркера ---
   FROM ${NODE_IMAGE} AS prod-deps
   WORKDIR /app
   ENV NEXT_TELEMETRY_DISABLED=1
   COPY package.json package-lock.json ./
   RUN npm ci --omit=dev --omit=optional --no-audit --no-fund --ignore-scripts

   # --- 3. Билд Next ---
   FROM ${NODE_IMAGE} AS builder
   WORKDIR /app
   ENV NEXT_TELEMETRY_DISABLED=1
   COPY --from=deps /app/node_modules ./node_modules
   COPY . .
   RUN npm run build

   # --- 4. Runtime для web (Next standalone) ---
   FROM ${NODE_IMAGE} AS runner
   WORKDIR /app
   ENV HOSTNAME=0.0.0.0 \
       NEXT_TELEMETRY_DISABLED=1 \
       NODE_ENV=production \
       PORT=3000
   RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
   COPY --from=builder --chown=nextjs:nodejs /app/public ./public
   COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
   COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
   USER nextjs
   EXPOSE 3000
   HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
     CMD node -e "const port=process.env.PORT||3000; fetch(\`http://127.0.0.1:\${port}\`).then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
   CMD ["node", "server.js"]

   # --- 5. Runtime для archive-worker ---
   FROM ${NODE_IMAGE} AS worker
   WORKDIR /app
   ENV NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
   RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
   COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
   COPY --from=prod-deps --chown=nextjs:nodejs /app/package.json ./package.json
   COPY --chown=nextjs:nodejs scripts ./scripts
   USER nextjs
   CMD ["node", "scripts/proposal-archive-worker.mjs"]
   ```

2. Поправить `compose.yaml`, указав `target` для каждого сервиса:
   ```yaml
   web:
     build:
       context: .
       dockerfile: Dockerfile
       target: runner
       args:
         NODE_IMAGE: node:24.16.0-alpine3.23
     image: scopelist-web:latest
     # ...
   archive-worker:
     build:
       context: .
       dockerfile: Dockerfile
       target: worker
       args:
         NODE_IMAGE: node:24.16.0-alpine3.23
     image: scopelist-archive-worker:latest
     command: ["node", "scripts/proposal-archive-worker.mjs"]
     # ...
   ```
   Сейчас оба сервиса указывают один `image: scopelist:latest` — это надо развести (см. выше).

3. Если после билда Next жалуется, что не трассирует что-то из `src/lib/server/public-access.ts` (использует `node:crypto`) — добавить в `next.config.ts`:
   ```ts
   const nextConfig: NextConfig = {
     output: "standalone",
     reactStrictMode: true,
     outputFileTracingRoot: process.cwd(),
   };
   ```
   Это уже есть по умолчанию в Next 16, но явное указание не помешает.

**Acceptance:**
- `docker images` показывает образ `scopelist-web` < 250 МБ (после очистки `npm ci` кеша и dev-deps должно быть ~150–200 МБ).
- `docker run --rm scopelist-web:latest node -e "console.log('ok')"` запускается.
- `curl http://localhost:3004` отдаёт страницу.
- Воркер запускается отдельно: `docker compose run --rm archive-worker node scripts/proposal-archive-worker.mjs --self-test` отдаёт OK.

**Риски:**
- Next может не трассировать модули, подключаемые динамически. Если `next build` упадёт или runtime даст `MODULE_NOT_FOUND`, добавить ручной список в `next.config.ts`:
  ```ts
  outputFileTracingIncludes: {
    "/": ["./node_modules/<pkg>/**/*"],
  },
  ```
- Воркер использует `@supabase/supabase-js` — его кладёт `prod-deps`, не Next. Проверить, что `node_modules/@supabase` присутствует в worker-образе:
  ```bash
  docker run --rm --entrypoint sh scopelist-archive-worker:latest -c "ls node_modules/@supabase"
  ```

---

## T3. Отключить image-оптимизатор Next и избавиться от `sharp`

**Зачем.** `@img/sharp-*` весит ~19 МБ + native binding. В `src/` нет ни одного `<Image>` из `next/image`, только `favicon.ico` в `src/app/`.

**Файлы:** `next.config.ts`, опционально `package.json`.

**Шаги:**
1. В `next.config.ts`:
   ```ts
   const nextConfig: NextConfig = {
     output: "standalone",
     reactStrictMode: true,
     images: { unoptimized: true },
   };
   ```
2. Проверить, что в проекте действительно нет использований `next/image`:
   ```bash
   git grep -nE "from ['\"]next/image['\"]" -- src
   ```
   Должно быть пусто.
3. Пересобрать:
   ```bash
   rm -rf .next
   npm run build
   ```
   После сборки убедиться, что в `.next/standalone/node_modules` отсутствует `@img/sharp-*` (либо его никто не подтягивает). На некоторых платформах sharp может всё ещё присутствовать как optional dep — в проде в Dockerfile (см. T2) `--omit=optional` уже его уберёт.
4. На уровне разработки можно дополнительно добавить в `package.json`:
   ```json
   "overrides": {
     "sharp": "npm:dry-uninstall@*"
   }
   ```
   — **только если** Next не падает без sharp в dev (Next 16 + `images.unoptimized=true` должен работать без него). Если падает — этот шаг пропустить.

**Acceptance:**
- `npm run build` зелёный.
- В runtime-образе после T2 отсутствует каталог `node_modules/@img` (проверить `docker run --rm --entrypoint sh ... -c "ls node_modules" | grep -i img`).

**Риски:** если позже понадобится `next/image` (логотипы клиентов, превью пакетов, OG-картинки), нужно будет либо вернуть `sharp`, либо использовать external loader (Cloudinary/etc).

---

## T4. Точечные импорты `lucide-react`

**Зачем.** Сейчас все компоненты делают `import { X } from "lucide-react"`. Production-сборка Next делает tree-shaking, но dev-режим импортирует целый barrel-файл, что замедляет HMR и увеличивает RAM dev-сервера. Также после T2 пакет всё ещё попадёт в builder-стейдж, но не в runner — для рантайма это не критично, а вот dev страдает.

**Файлы:** все `src/components/*.tsx`, использующие `lucide-react`. По `grep` это 9 файлов:
- `AppShell.tsx`
- `ChangeItemForm.tsx`
- `ChangeItemList.tsx`
- `ImportExportControls.tsx`
- `PricingBreakdown.tsx`
- `ProjectSettingsForm.tsx`
- `ProposalPreview.tsx`
- `SummaryCard.tsx`
- `TimelineImpact.tsx`

**Шаги:**
1. Создать обёртку `src/components/icons.tsx`:
   ```tsx
   // Единая точка реэкспорта только тех иконок, что реально используем.
   // Это резко ускоряет dev-сервер (Next не парсит весь barrel lucide-react).
   export { default as AlertTriangle } from "lucide-react/dist/esm/icons/alert-triangle";
   export { default as ArrowRight } from "lucide-react/dist/esm/icons/arrow-right";
   export { default as BadgeCheck } from "lucide-react/dist/esm/icons/badge-check";
   export { default as CalendarClock } from "lucide-react/dist/esm/icons/calendar-clock";
   export { default as CalendarDays } from "lucide-react/dist/esm/icons/calendar-days";
   export { default as Check } from "lucide-react/dist/esm/icons/check";
   export { default as CheckCircle2 } from "lucide-react/dist/esm/icons/check-circle-2";
   export { default as CheckSquare } from "lucide-react/dist/esm/icons/check-square";
   export { default as CircleDollarSign } from "lucide-react/dist/esm/icons/circle-dollar-sign";
   export { default as ClipboardCheck } from "lucide-react/dist/esm/icons/clipboard-check";
   export { default as ClipboardList } from "lucide-react/dist/esm/icons/clipboard-list";
   export { default as Download } from "lucide-react/dist/esm/icons/download";
   export { default as Eye } from "lucide-react/dist/esm/icons/eye";
   export { default as FileSignature } from "lucide-react/dist/esm/icons/file-signature";
   export { default as FileText } from "lucide-react/dist/esm/icons/file-text";
   export { default as FileUp } from "lucide-react/dist/esm/icons/file-up";
   export { default as Hammer } from "lucide-react/dist/esm/icons/hammer";
   export { default as Layers3 } from "lucide-react/dist/esm/icons/layers-3";
   export { default as Link2 } from "lucide-react/dist/esm/icons/link-2";
   export { default as MessageSquareText } from "lucide-react/dist/esm/icons/message-square-text";
   export { default as Plus } from "lucide-react/dist/esm/icons/plus";
   export { default as Printer } from "lucide-react/dist/esm/icons/printer";
   export { default as RotateCcw } from "lucide-react/dist/esm/icons/rotate-ccw";
   export { default as Save } from "lucide-react/dist/esm/icons/save";
   export { default as ShieldCheck } from "lucide-react/dist/esm/icons/shield-ccheck";
   export { default as Square } from "lucide-react/dist/esm/icons/square";
   export { default as X } from "lucide-react/dist/esm/icons/x";
   ```
   ВАЖНО: точный список иконок собрать командой:
   ```bash
   git grep -hoE "(^|[^A-Za-z])(Alert[A-Za-z]+|Arrow[A-Za-z]+|Badge[A-Za-z]+|Calendar[A-Za-z]+|Check[A-Za-z0-9]*|Circle[A-Za-z]+|Clipboard[A-Za-z]+|Download|Eye|File[A-Za-z]+|Hammer|Layers[0-9]|Link[0-9]?|Message[A-Za-z]+|Plus|Printer|RotateCcw|Save|Shield[A-Za-z]+|Square|X)" -- src/components | sort -u
   ```
   и сравнить с `node_modules/lucide-react/dist/esm/icons/` (если иконки нет — путь с дефисами; есть конвертер CamelCase → kebab-case).

2. Заменить в каждом из 9 компонентов:
   ```diff
   -import { Eye, Hammer, Save } from "lucide-react";
   +import { Eye, Hammer, Save } from "@/components/icons";
   ```

3. Проверить:
   ```bash
   npm run lint
   npm run build
   ```

**Acceptance:**
- `git grep "from ['\"]lucide-react['\"]" -- src` возвращает только `src/components/icons.tsx`.
- Прод-сборка работает, страница рендерится с теми же иконками визуально.
- Время `next dev` от запуска до готового HMR заметно меньше (субъективно).

**Риски:**
- Пути `lucide-react/dist/esm/icons/<kebab>` — это **внутренний** layout пакета. При мажорном апдейте `lucide-react` могут сломаться. На каждый bump надо проверить, что эти пути живы. Альтернатива: оставить `import { Foo } from "lucide-react"`, положившись на tree-shaking — тогда выигрыш только в prod-bundle, dev не ускорится.
- Если в `lucide-react` версии 1.17.x внутренняя структура другая (нет каталога `dist/esm/icons/`), проверить через `ls node_modules/lucide-react/dist/esm` перед началом задачи и подстроить пути.

---

## T5. Локальные шрифты вместо `next/font/google`

**Зачем.** `src/app/layout.tsx` тянет Geist и Geist Mono с Google Fonts при каждом `next build`. Это (а) делает сборку зависимой от сети, (б) у нас в Docker нет HTTP-доступа во время билда по умолчанию — CI может падать, (в) лишний кеш `.next/cache/fonts`.

**Файлы:** `src/app/layout.tsx`, `src/app/globals.css`, новый каталог `public/fonts/`.

**Шаги:**
1. Скачать вручную (или приложить в репо) `.woff2` файлы Geist:
   - `Geist-Regular.woff2`, `Geist-Medium.woff2`, `Geist-SemiBold.woff2` (subset latin).
   - `GeistMono-Regular.woff2`.
   Источник: https://github.com/vercel/geist-font/releases (лицензия SIL OFL 1.1 — коммерческое использование разрешено).
   Положить в `public/fonts/`.
2. Заменить импорт в `src/app/layout.tsx`:
   ```tsx
   import type { Metadata } from "next";
   import localFont from "next/font/local";
   import "./globals.css";

   const geistSans = localFont({
     src: [
       { path: "../../public/fonts/Geist-Regular.woff2", weight: "400", style: "normal" },
       { path: "../../public/fonts/Geist-Medium.woff2", weight: "500", style: "normal" },
       { path: "../../public/fonts/Geist-SemiBold.woff2", weight: "600", style: "normal" },
     ],
     variable: "--font-geist-sans",
     display: "swap",
   });

   const geistMono = localFont({
     src: "../../public/fonts/GeistMono-Regular.woff2",
     variable: "--font-geist-mono",
     display: "swap",
   });

   export const metadata: Metadata = {
     title: "SCOPELIST",
     description: "Digital Offer & Proposal List for Interactive Scope Tracking",
   };

   export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
     return (
       <html lang="ru" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
         <body className="min-h-full flex flex-col">{children}</body>
       </html>
     );
   }
   ```
3. Проверить, что `globals.css` (использует `var(--font-geist-sans)`) не сломан — синтаксис переменных тот же.
4. Добавить файлы шрифтов в LICENSE-комментарий или `public/fonts/LICENSE.txt`, чтобы не потерять атрибуцию.
5. Сборка:
   ```bash
   rm -rf .next
   npm run build
   ```

**Acceptance:**
- `git grep "next/font/google" -- src` пусто.
- `npm run build` зелёный без доступа в интернет (можно проверить временно отключив сеть или указав `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=...`).
- Визуально страница не отличается.

**Риски:**
- Файлы шрифтов ~80–150 КБ каждый, всего +0.3–0.6 МБ в репо. Это допустимо.
- Если требуется кириллица — добавить subset `cyrillic` (отдельные .woff2 или один с диапазоном `unicode-range`).

---

## T6. Объединить web и archive-worker (вариант A: host-cron)

**Зачем.** Воркер 99% времени спит (`DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000` в `scripts/proposal-archive-worker.mjs:14`), но держит резидентный Node-процесс (~60–100 МБ RSS). На shared-сервере (8 CPU / 12 GB) это ощутимо в соседстве с `fantasy-scout` и `sharovik`.

**Файлы:** `compose.yaml`, новый файл `scripts/install-archive-cron.sh`, `README.md` (раздел Resource profile).

**Шаги:**
1. Убрать сервис `archive-worker` из `compose.yaml` (или оставить с `profiles: ["worker"]`, чтобы поднимать только при ручном `docker compose --profile worker up`):
   ```yaml
   archive-worker:
     profiles: ["worker"]
     # ... остальное без изменений ...
   ```
2. Создать `scripts/install-archive-cron.sh`:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   # Устанавливает суточный cron, который дергает archive-worker один раз.
   # Запускать на хосте (не в контейнере).

   COMPOSE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
   CRON_LINE="17 3 * * * cd ${COMPOSE_DIR} && /usr/bin/docker compose --profile worker run --rm archive-worker node scripts/proposal-archive-worker.mjs --once >> ${COMPOSE_DIR}/.data/archive-cron.log 2>&1"

   ( crontab -l 2>/dev/null | grep -v "proposal-archive-worker" ; echo "${CRON_LINE}" ) | crontab -
   echo "Installed cron line:"
   echo "${CRON_LINE}"
   ```
   Сделать `chmod +x scripts/install-archive-cron.sh`.
3. Обновить раздел Resource profile в `README.md`:
   ```md
   ## Resource profile

   Current Docker shape:

   - `web`: Next.js app on `APP_PORT` (`3004` by default).
   - `.data`: local file fallback bind mount when Supabase is not used.

   Archive worker запускается по host-cron'у раз в сутки, не как резидентный сервис.
   Установка: `bash scripts/install-archive-cron.sh` на сервере.

   Sizing guidance:
   - CPU: `0.5 vCPU` (web), пиково 0.7 во время `next start` ramp-up.
   - RAM: `0.4-0.8 GB` (web; раньше с воркером было 0.8-1.5 GB).
   - Disk: `2-5 GB` для образа web + `.data` для архивов.
   ```
4. Документировать ручной запуск воркера:
   ```bash
   docker compose --profile worker run --rm archive-worker \
     node scripts/proposal-archive-worker.mjs --once
   ```

**Acceptance:**
- `docker compose up -d` поднимает только `web`.
- `docker compose --profile worker run --rm archive-worker ... --once` отрабатывает и завершается (нет процесса в `docker ps`).
- `crontab -l` на сервере содержит строку с `proposal-archive-worker`.
- `README.md` обновлён в части Resource profile (см. AGENTS.md правило про синхронизацию).

**Риски:**
- Если host-cron не отрабатывает (cron-служба выключена, сервер перезагружен), архивация не пройдёт молча. Митигация: ENV-флаг алерта в Telegram, который шлёт пинг каждый запуск. Или systemd timer вместо cron — надёжнее (см. `man systemd.timer`).
- Воркер теряет автоматический рестарт при крэше. Текущая реализация (`while (true) { try ... }`) уже идемпотентна, но при OOM скрипт умрёт — host-cron подхватит на следующий день. Если это критично, использовать вариант B (см. T6b ниже).

### T6b (опциональный fallback). Объединение в один Node-процесс через `instrumentation.ts`

Если ОПС не разрешают host-cron — встроить воркер в Next-процесс.

**Шаги:**
1. Создать `src/instrumentation.ts`:
   ```ts
   export async function register() {
     if (process.env.NEXT_RUNTIME !== "nodejs") return;
     if (process.env.ENABLE_INLINE_ARCHIVE_WORKER !== "1") return;

     // Динамический import, чтобы dev-сервер не дергал воркер при HMR.
     const mod = await import("../scripts/proposal-archive-worker.mjs");
     // Воркер сам стартует в main(); если он экспортирует runOnce — лучше так:
     setInterval(() => {
       mod.runOnce?.().catch((e: unknown) => console.error("[inline-archive]", e));
     }, Number(process.env.ARCHIVE_INTERVAL_MS ?? 24 * 60 * 60 * 1000));
   }
   ```
2. В `next.config.ts`:
   ```ts
   experimental: { instrumentationHook: true }, // если Next 16 требует флаг — проверить по docs
   ```
3. Воркер сейчас написан как `main()` с `while (true)`. Чтобы embed-вариант работал, надо экспортировать `runOnce(config, store, telegram)` и обвязку конфига отдельно. Это рефакторинг скрипта — заложить в задачу 1–2 часа.

**Риски варианта B:** ошибка воркера может уронить web. Использовать только если вариант A невозможен.

---

## T7. `npm ci --omit=dev` для prod-deps стейджа

Эта задача — часть T2 (см. секцию `prod-deps` в Dockerfile). Выделена отдельно для случая, если T2 откладывается, а быстро ужать диск всё равно хочется.

**Шаги (если делается без T2):**
1. В существующем Dockerfile (до рефакторинга по T2) поменять только `deps` стейдж:
   ```dockerfile
   FROM ${NODE_IMAGE} AS deps
   WORKDIR /app
   ENV NEXT_TELEMETRY_DISABLED=1
   COPY package.json package-lock.json ./
   RUN npm ci --omit=dev --no-audit --no-fund
   ```
2. **Но!** `builder` стейдж после этого упадёт, т.к. ему нужны `typescript`, `tailwindcss`, `eslint-config-next` и т.п. Поэтому одновременно нужно добавить отдельный `build-deps`:
   ```dockerfile
   FROM ${NODE_IMAGE} AS build-deps
   WORKDIR /app
   COPY package.json package-lock.json ./
   RUN npm ci --no-audit --no-fund

   FROM ${NODE_IMAGE} AS builder
   WORKDIR /app
   COPY --from=build-deps /app/node_modules ./node_modules
   COPY . .
   RUN npm run build
   ```
   В runner копировать `node_modules` из `deps` (теперь prod-only).

**Acceptance:** runtime-образ не содержит `node_modules/typescript`, `node_modules/eslint`, `node_modules/@tailwindcss`. Проверка:
```bash
docker run --rm --entrypoint sh scopelist:latest -c "ls node_modules | grep -E 'typescript|eslint|tailwind' || echo OK"
```
Должно быть `OK`.

**Риски:** дубль базовых deps в двух стейджах (`deps` + `build-deps`) — это нормально, BuildKit кеширует слои.

---

## T8. Очистка локальных артефактов и обновление `.gitignore`

**Зачем.** Локально лежат:
- `screenshots/` — 2.3 МБ (уже в `.gitignore`, но не вычищен).
- `output/` — 1.3 МБ (`*.png`, `proposal-print-check.pdf`).
- `dev-server*.log`, `dev-server-3001.*.log` — текущие лог-файлы.
- `.playwright-cli/` — артефакты Playwright.
- `tsconfig.tsbuildinfo` — 118 КБ.

В Docker они уже исключены (`.dockerignore`), но на машине разработчика и в git могут просочиться.

**Файлы:** `.gitignore`, `package.json` (новый скрипт `clean`).

**Шаги:**
1. Расширить `.gitignore`:
   ```diff
   /coverage
   +/output/
   +/.playwright-cli/
   +/.data/

   # debug
   npm-debug.log*
   yarn-debug.log*
   yarn-error.log*
   .pnpm-debug.log*
   -dev-server.log
   +dev-server*.log
   +dev-server*.err.log

   # local verification artifacts
   screenshots/
   ```
2. Удалить уже закоммиченные артефакты из индекса (если они там):
   ```bash
   git rm -r --cached output .playwright-cli .data 2>/dev/null || true
   git rm --cached dev-server.log dev-server-3001.log dev-server.err.log dev-server-3001.err.log 2>/dev/null || true
   ```
3. Добавить скрипт в `package.json`:
   ```json
   "clean": "rimraf .next .next-cache output/* screenshots/* .playwright-cli .data/proposals.json dev-server*.log dev-server*.err.log tsconfig.tsbuildinfo"
   ```
   (`rimraf` уже в transitive deps Next, либо использовать `node -e "fs.rmSync(...)"` для нулевых зависимостей).
4. Обновить README раздел «Очистка локальных артефактов»:
   ```md
   ## Локальные артефакты

   `output/`, `screenshots/`, `.playwright-cli/`, `.data/proposals.json`,
   `dev-server*.log` — это локальные артефакты разработки и проверки.
   Они исключены из git и Docker, но на диске разработчика могут
   расти. Чистить командой:

       npm run clean
   ```

**Acceptance:**
- `git status` после `npm run clean` — чистый рабочий tree (для исключённых файлов).
- `git ls-files | grep -E "^output/|^screenshots/|^\.playwright-cli/"` пусто.

**Риски:** если кто-то использовал `screenshots/` как «галерею референсов для дизайна» — предупредить в PR. Файлы там сейчас (`offerist-*`, `isty-reference.png` и т.п.) выглядят как референсы — **перед удалением спросить владельца репо**, нужно ли перенести их в отдельный каталог `references/` (если да — этот каталог тоже добавить в `.gitignore`, либо наоборот закоммитить намеренно).

---

## T9. Лимиты CPU/RAM в `compose.yaml`

**Зачем.** Сейчас лимитов нет. На shared 8 CPU / 12 ГБ сервере Next может съесть V8 heap до 1.5+ ГБ при долгой работе. Соседи (`fantasy-scout`, `sharovik`) пострадают.

**Файлы:** `compose.yaml`, опционально `.env.production`.

**Шаги:**
1. Добавить ресурс-лимиты в `web`:
   ```yaml
   web:
     # ... остальное ...
     environment:
       HOSTNAME: 0.0.0.0
       NEXT_TELEMETRY_DISABLED: "1"
       NODE_ENV: production
       PORT: "3000"
       NODE_OPTIONS: "--max-old-space-size=384"
     deploy:
       resources:
         limits:
           cpus: "0.5"
           memory: "512M"
         reservations:
           cpus: "0.1"
           memory: "128M"
   ```
   Важно: `deploy.resources` в standalone `docker compose up` уважается только при использовании Swarm-режима или Compose v2 c флагом `--compatibility`. Для гарантии работают альтернативные ключи:
   ```yaml
   mem_limit: 512m
   mem_reservation: 128m
   cpus: 0.5
   ```
   Использовать оба варианта одновременно (deploy + top-level) — Compose возьмёт top-level.

2. Для `archive-worker` (если оставлен резидентным, не T6):
   ```yaml
   archive-worker:
     mem_limit: 192m
     cpus: 0.2
     environment:
       NODE_OPTIONS: "--max-old-space-size=128"
   ```

3. Документировать в README:
   ```md
   ## Resource limits

   Контейнеры намеренно ограничены, чтобы безопасно сосуществовать на
   shared-сервере. Если приложение будет получать высокий production-трафик,
   поднять `mem_limit` web до 1g и убрать
   `NODE_OPTIONS=--max-old-space-size`.
   ```

**Acceptance:**
- `docker stats scopelist-web` показывает MEM USAGE / LIMIT с указанным потолком.
- Под нагрузкой `ab -n 200 -c 5 http://localhost:3004/` контейнер не OOM-ит (если OOM-ит — поднять лимит).

**Риски:** при росте функциональности (импорт больших JSON, серверные роуты с расчётами) лимит 512M может стать тесным. Митигация — мониторинг и поднятие лимита по факту.

---

## T10. Перевод части UI на серверный рендер

**Зачем.** Сейчас `src/app/page.tsx` рендерит `AppShell`, у которого `"use client"` в первой строке. Весь UI вместе с формами, превью, импортом/экспортом — клиентский. Это (а) увеличивает client JS bundle (~150–300 КБ gzipped после Tailwind v4 + lucide), (б) грузит CPU клиента, (в) теряем SSR для SEO/OG-карточек.

**Файлы:** `src/app/page.tsx`, `src/components/AppShell.tsx` + разделение на server/client куски.

**Шаги:**
1. Аудит — какие компоненты реально нуждаются в `"use client"`:
   - `AppShell` — да (держит `useState`, читает `localStorage`, `window.location.hash`).
   - `ChangeItemForm` — да (контролируемые инпуты).
   - `ChangeItemList` — да (drag-n-drop? проверить; если только рендер — может стать server).
   - `ImportExportControls` — да (clipboard, file upload).
   - `PricingBreakdown`, `SummaryCard`, `TimelineImpact` — **скорее всего server**, чисто декларативные.
   - `ProposalPreview` — гибрид: вычисления чистые, но получает `onToggleOptional` колбэк → должен остаться client или быть разрезан на `ProposalPreview.server.tsx` (числа + список) и `OptionalToggle.client.tsx`.

2. Шаги рефакторинга (последовательно, по одному компоненту за раз, каждый — отдельный коммит):
   - Убрать `"use client"` из чистых компонентов.
   - Перенести состояние и эффекты в один root client-компонент (`<AppShellClient>`), а server-обёртка `<AppShell>` рендерит initial state и встраивает client-айленды для интерактивных частей.
   - Для каждого client-компонента — обернуть в `dynamic(() => import(...), { ssr: false })` только если он реально SSR-несовместим (например, использует `window` на верхнем уровне). Иначе оставить обычный импорт.

3. Перенести `createDefaultProposalData()` вызов из `useState(() => createDefaultProposalData())` на server-side render — `AppShell` будет server component и пробрасывать `initialData` в `<AppShellClient initialData={...}>`. Это убирает дорогостоящий вычисляемый initial state с клиента.

4. Прогнать `npm run build` и сравнить `First Load JS` в выводе:
   ```
   Route (app)              Size  First Load JS
   ┌ ○ /                    XXX kB    YYY kB
   ```
   Цель: уменьшить `First Load JS` на 20–40%.

**Acceptance:**
- `grep -l "use client" src/components/*.tsx` содержит **меньше** файлов, чем сейчас (сейчас все 9).
- `npm run build` зелёный.
- Визуально и функционально приложение работает идентично (включая: загрузка из URL hash, сохранение в localStorage, импорт/экспорт JSON, переключение mode).
- `First Load JS` уменьшен (зафиксировать «до/после» в PR description).

**Риски (большие, в отличие от остальных задач):**
- Состояние сейчас живёт в одном клиентском `AppShell` с `localStorage`. Разрезание требует аккуратной работы с border'ом server↔client.
- Hydration mismatch — если server рендерит initial state, а client при mount подгружает из localStorage, на первом рендере будет flicker. Митигировать через `suppressHydrationWarning` на корне или явно пометить, что initial render временный до первого `useEffect`.
- Это самый трудоёмкий из всех пунктов (1–2 дня вдумчивой работы). Делать **последним**, и только если есть запрос на уменьшение client JS / улучшение Lighthouse-скоров. Для серверных требований (CPU/RAM/диск) эффект минимальный — основной выигрыш на стороне клиента.

---

## Проверка эффекта (после всех или части задач)

1. Размер runtime-образа:
   ```bash
   docker images scopelist-web:latest --format "{{.Size}}"
   docker images scopelist-archive-worker:latest --format "{{.Size}}"
   ```
   Целевые цифры: web < 250 МБ (сейчас ~500–700 МБ при наличии dev-deps), worker < 200 МБ.

2. RSS работающих контейнеров:
   ```bash
   docker stats --no-stream scopelist-web
   ```
   Цель: < 400 МБ в idle.

3. Время холодного билда:
   ```bash
   time docker compose build --no-cache
   ```
   Цель: не выросло относительно baseline (а лучше — упало за счёт раздельных стейджей и кеша слоёв).

4. Локальный диск:
   ```bash
   du -sh node_modules .next  # на хосте разработчика
   ```
   Цель: `node_modules` < 400 МБ (за счёт удаления bcryptjs и --omit=optional где можно).

---

## Чек-лист готовности к закрытию задач

- [x] T1 — bcryptjs удалён, lockfile обновлён.
- [x] T2 — Dockerfile разбит на `deps`/`prod-deps`/`builder`/`runner`/`worker`, compose использует `target:`.
- [x] T3 — `images.unoptimized = true`, sharp не попадает в runtime-образ.
- [x] T4 — все импорты `lucide-react` идут через `src/components/icons.tsx`.
- [x] T5 — `next/font/local` с файлами из `public/fonts/`.
- [x] T6 — `archive-worker` под `profiles: ["worker"]`, скрипт host-cron добавлен, README обновлён.
- [x] T7 — учтено внутри T2.
- [x] T8 — `.gitignore` расширен, `npm run clean` работает.
- [x] T9 — `mem_limit` и `cpus` выставлены, README дополнен.
- [x] T10 — часть `AppShell` перенесена в server-render, initial state создаётся на сервере.

После завершения каждой задачи — обновить раздел **Resource profile** в `README.md` согласно правилу в `AGENTS.md`.
