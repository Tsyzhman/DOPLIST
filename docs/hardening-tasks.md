# Hardening tasks (security, reliability, quality)

Goal: закрыть находки технического аудита от **2026-06-09** (ветка `main`) — безопасность, надёжность, качество кода, тесты и эксплуатация. Документ — чек-лист для агентов/разработчиков. Каждая задача самодостаточна: что менять, в каких файлах, как проверить, какие риски.

По каждому открытому вопросу аудита решение уже выбрано (строка **Решение**) — менять только при явном указании владельца репо.

Базовый контекст на момент аудита:

- Билдер/дашборд (`/`, `/lists/[id]/edit`) — клиентский, состояние в `localStorage`, серверной аутентификации нет.
- Запись на сервер идёт только через `POST /api/items/[id]/share`; публичный просмотр — `/p/[shareSlug]` + `/api/public/[shareSlug]/password` + `/api/public-events`.
- Хранилище: Supabase (при заданном service-role key) или файловый fallback `.data/proposals.json`.
- Caddy проксирует весь домен без авторизации (`docs/server-sharing-with-caddy.md`).

Рекомендуемый порядок: **H2 → H7 → H5 → H10 → H13 → H4 → H3 → H8 → H1 → H11 → H6 → H9 → H12**. Сначала дешёвые низкорисковые фиксы безопасности и надёжности, затем auth/тесты, в конце — рефакторинг.

Сводка по приоритету:

| Приоритет | Задачи |
|---|---|
| Критично (до публичного запуска) | H1 (auth записи), H2 (обязательный секрет) |
| Высокий | H3 (rate-limit/scrypt), H11 (тесты санитизации) |
| Средний | H4, H5, H6, H9 |
| Низкий / быстрый | H7, H8, H10, H12, H13 |

---

## H1. Аутентификация на запись (`/api/items/[id]/share`) и админ-поверхность

**Категория:** безопасность · **Серьёзность:** высокая (критично до публичного запуска)

**Зачем.** `POST /api/items/[id]/share` (`publish`/`unpublish`/`regenerate`) не требует авторизации, а Caddy проксирует весь домен. Любой из интернета может публиковать произвольный публичный контент на домене и бесконечно создавать записи → переполнение `proposals.json`/таблицы Supabase, размещение чужого контента, storage-DoS.

**Файлы:** `src/app/api/items/[id]/share/route.ts`, новый `src/lib/server/admin-auth.ts`, `docs/server-sharing-with-caddy.md`, `README.md` (Public sharing env), `.env.example`, `src/components/AppShellClient.tsx` (передача токена — только для варианта app-level, см. ниже).

**Решение (выбрано).** Двухслойная защита:
1. **Основной слой — Caddy basic_auth** на всей админ-поверхности (всё, кроме `/p/**`, `/api/public/**`, `/api/public-events`). Это закрывает и билдер, и `/api/items/**` на уровне прокси без изменения клиентского кода.
2. **Defense-in-depth в приложении** — необязательный `ADMIN_ACCESS_TOKEN`: если переменная задана, `route.ts` требует совпадающий заголовок `x-scopelist-admin-token` (constant-time сравнение). Если не задана — слой пропускается (чтобы не ломать локальную разработку), но в проде задаётся всегда.

Полноценный логин/сессии **не вводим** — это изменение архитектуры, для текущего single-admin сценария избыточно.

**Шаги:**
1. `docs/server-sharing-with-caddy.md` — заменить минимальный Caddyfile на вариант с basic_auth для админ-путей:
   ```caddyfile
   domain.ru {
     encode gzip zstd

     # Публичные пути — без авторизации
     @public path /p/* /api/public/* /api/public-events
     handle @public {
       reverse_proxy 127.0.0.1:3004
     }

     # Всё остальное (билдер, /api/items/*) — под basic_auth
     handle {
       basic_auth {
         # сгенерировать: caddy hash-password --plaintext '...'
         admin <bcrypt-hash>
       }
       reverse_proxy 127.0.0.1:3004
     }
   }
   ```
2. Создать `src/lib/server/admin-auth.ts`:
   ```ts
   import { timingSafeEqual } from "crypto";

   export function isAdminRequestAuthorized(request: Request): boolean {
     const expected = process.env.ADMIN_ACCESS_TOKEN;
     // Если токен не настроен — app-level слой выключен (полагаемся на Caddy).
     if (!expected) {
       return true;
     }
     const provided = request.headers.get("x-scopelist-admin-token") || "";
     const a = Buffer.from(provided);
     const b = Buffer.from(expected);
     return a.length === b.length && timingSafeEqual(a, b);
   }
   ```
3. В `src/app/api/items/[id]/share/route.ts` в начале `POST`:
   ```ts
   if (!isAdminRequestAuthorized(request)) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   }
   ```
4. Если используется app-level токен: в `src/components/AppShellClient.tsx` (функция `copyShareLink`) добавлять заголовок `x-scopelist-admin-token` из публично безопасного источника **нельзя** (он попадёт в client bundle). Поэтому app-level токен предназначен для серверных/CLI вызовов и как страховка; основной UX-доступ закрывается basic_auth Caddy (браузер сам шлёт креды). Зафиксировать это в README.
5. `.env.example` и README — добавить `ADMIN_ACCESS_TOKEN=` с комментарием «optional defense-in-depth для /api/items/*; основная защита — basic_auth в Caddy».

**Acceptance:**
- Запрос `POST /api/items/<uuid>/share` без basic_auth (через Caddy) → `401` от прокси.
- При заданном `ADMIN_ACCESS_TOKEN` прямой запрос к приложению без заголовка → `401`; с корректным заголовком → работает.
- `/p/<slug>` и `/api/public-events` остаются доступны без авторизации.
- `npm run build` зелёный.

**Риски:** basic_auth ломает прямые `fetch` из браузерного билдера, если креды не сохранены — но браузер кэширует basic-auth на домен, поэтому после первого ввода всё работает. Если в будущем нужен публичный self-service билдер — потребуется полноценная auth (отдельная задача).

---

## H2. Обязательный `PROPOSAL_ACCESS_SECRET` в продакшене

**Категория:** безопасность · **Серьёзность:** высокая (критично)

**Зачем.** `src/lib/server/public-access.ts:14` падает на хардкод `"scopelist-dev-secret"`, если переменная не задана. В проде это делает HMAC-токен доступа к запароленным КП подделываемым → обход пароля.

**Файлы:** `src/lib/server/public-access.ts`.

**Решение (выбрано).** В продакшене (`NODE_ENV === "production"`) при отсутствии секрета — **бросать ошибку** (fail-fast). Dev-дефолт оставить только вне прода.

**Шаги:**
1. В `public-access.ts` вынести получение секрета в функцию:
   ```ts
   function getAccessSecret() {
     const secret = process.env.PROPOSAL_ACCESS_SECRET;
     if (secret) {
       return secret;
     }
     if (process.env.NODE_ENV === "production") {
       throw new Error(
         "PROPOSAL_ACCESS_SECRET is required in production for proposal access tokens",
       );
     }
     return "scopelist-dev-secret";
   }
   ```
2. Заменить инлайн-дефолт в `createProposalAccessToken` на `getAccessSecret()`.

**Acceptance:**
- В dev (без переменной) — пароль-гейт работает как раньше.
- В проде без `PROPOSAL_ACCESS_SECRET` запрос к password-protected КП даёт серверную ошибку (а не молчаливый дефолт). Проверить: `NODE_ENV=production node -e "require(...)"` либо ручной прогон роутов.
- `npm run build` зелёный.

**Риски:** если в текущем проде переменная не задана — после деплоя запароленные КП перестанут открываться, пока не выставят секрет. Это и есть цель (раньше «работало» небезопасно). Предупредить в release-notes: задать `PROPOSAL_ACCESS_SECRET` до деплоя.

---

## H3. Rate-limit + асинхронный scrypt на проверке пароля

**Категория:** надёжность / безопасность · **Серьёзность:** высокая

**Зачем.** `src/app/api/public/[shareSlug]/password/route.ts` не ограничивает попытки; `verifyProposalPassword` (`proposal-store.ts:428`) использует блокирующий `scryptSync`. Это позволяет (1) брутфорсить пароль, (2) ддосить веб-процесс серией запросов (scrypt блокирует event-loop), (3) раздувать таблицу событиями `password_failed`.

**Файлы:** `src/lib/server/proposal-store.ts` (verify), `src/app/api/public/[shareSlug]/password/route.ts`, новый `src/lib/server/rate-limit.ts`.

**Решение (выбрано).** In-memory rate-limit по ключу `shareSlug` (достаточно для single-process деплоя; при масштабировании — заменить на Supabase/Redis, зафиксировать как TODO). Перейти на асинхронный `scrypt`. Троттлить запись `password_failed`.

**Шаги:**
1. Создать `src/lib/server/rate-limit.ts` — простой sliding-window счётчик:
   ```ts
   type Bucket = { count: number; resetAt: number };
   const buckets = new Map<string, Bucket>();

   export function checkRateLimit(key: string, limit: number, windowMs: number) {
     const now = Date.now();
     const bucket = buckets.get(key);
     if (!bucket || bucket.resetAt < now) {
       buckets.set(key, { count: 1, resetAt: now + windowMs });
       return { allowed: true, retryAfterMs: 0 };
     }
     if (bucket.count >= limit) {
       return { allowed: false, retryAfterMs: bucket.resetAt - now };
     }
     bucket.count += 1;
     return { allowed: true, retryAfterMs: 0 };
   }
   ```
   (опционально — периодическая чистка устаревших бакетов, чтобы Map не рос; не критично при низком трафике.)
2. Перевести `verifyProposalPassword` на асинхронный scrypt:
   ```ts
   import { scrypt as scryptCb, timingSafeEqual } from "crypto";
   import { promisify } from "util";
   const scrypt = promisify(scryptCb);

   export async function verifyProposalPassword(passwordHash: string | undefined, password: string) {
     if (!passwordHash || !password) return false;
     const [scheme, salt, expected] = passwordHash.split(":");
     if (scheme !== "scrypt" || !salt || !expected) return false;
     const actualBuffer = (await scrypt(password, salt, 32)) as Buffer;
     const expectedBuffer = Buffer.from(expected, "base64url");
     return (
       actualBuffer.length === expectedBuffer.length &&
       timingSafeEqual(actualBuffer, expectedBuffer)
     );
   }
   ```
   Учесть: вызов теперь `await verifyProposalPassword(...)` в роуте.
3. В password-роуте перед проверкой:
   ```ts
   const limit = checkRateLimit(`pwd:${shareSlug}`, 10, 60_000);
   if (!limit.allowed) {
     return NextResponse.json(
       { error: "Too many attempts" },
       { status: 429, headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) } },
     );
   }
   ```
   Записывать `password_failed` только если лимит не превышен (уже выполняется этим порядком).

**Acceptance:**
- 11-й подряд неверный пароль за минуту по одному slug → `429`.
- `verifyProposalPassword` вызывается через `await`, сборка типов проходит.
- Под `ab -n 100 -c 10` на password-роут веб-процесс не зависает (event-loop не блокируется).

**Риски:** in-memory лимит не работает между репликами/перезапусками — для текущего single-instance деплоя достаточно; при горизонтальном масштабировании заменить на общий стор (TODO в коде).

---

## H4. Лимиты на размер `metadata`/`userAgent`/`referrer` в событиях

**Категория:** безопасность / надёжность · **Серьёзность:** средняя

**Зачем.** `src/app/api/public-events/route.ts` принимает произвольный `metadata` и заголовки и пишет их в стор без ограничений; эндпоинт открыт и без лимита. Можно слать гигантские payload'ы и спамить → переполнение стора, инфляция `views_count`. Файловый стор читает/пишет весь JSON на каждое событие.

**Файлы:** `src/app/api/public-events/route.ts`, `src/lib/server/proposal-store.ts` (recordEvent / FileProposalStore).

**Решение (выбрано).** Жёсткие лимиты: `metadata` — максимум ~4 КБ после сериализации (иначе отбрасывается), `userAgent` ≤ 512 символов, `referrer` ≤ 1024. Для файлового стора — кап последних `MAX_STORED_EVENTS = 5000` событий. Плюс rate-limit на эндпоинт (переиспользовать H3).

**Шаги:**
1. В `public-events/route.ts` добавить санитизацию входа:
   ```ts
   function clampString(value: string | undefined, max: number) {
     return value ? value.slice(0, max) : undefined;
   }
   function clampMetadata(meta: Record<string, unknown> | undefined) {
     if (!meta) return undefined;
     try {
       const json = JSON.stringify(meta);
       return json.length <= 4096 ? meta : undefined;
     } catch {
       return undefined;
     }
   }
   ```
   Применить к `metadata`, `request.headers.get("user-agent")`, `referer`.
2. Добавить rate-limit (`checkRateLimit(`evt:${body.shareSlug}`, 60, 60_000)` → `429`).
3. В `FileProposalStore.recordEvent` после `data.events.unshift(event)` обрезать массив:
   ```ts
   const MAX_STORED_EVENTS = 5000;
   if (data.events.length > MAX_STORED_EVENTS) {
     data.events.length = MAX_STORED_EVENTS;
   }
   ```

**Acceptance:**
- Событие с `metadata` > 4 КБ сохраняется без `metadata` (или отклоняется), сервис не падает.
- `userAgent`/`referrer` усечены до лимита.
- В файловом сторе число событий не превышает `MAX_STORED_EVENTS`.

**Риски:** усечение `metadata` может потерять часть аналитики — приемлемо, т.к. metadata сейчас не используется для критичной логики.

---

## H5. Атомарный инкремент `views_count` в Supabase

**Категория:** надёжность · **Серьёзность:** средняя

**Зачем.** `proposal-store.ts:723-732` — `views_count: Number(proposal.viewsCount || 0) + 1` считается от значения в памяти и пишется отдельным `update` (read-modify-write). Параллельные просмотры теряют инкременты.

**Файлы:** `src/lib/server/proposal-store.ts`, новая SQL-функция в `supabase/migrations/`.

**Решение (выбрано).** Инкремент на стороне БД через RPC (атомарно), с fallback на текущий путь, если RPC недоступна (по аналогии с `purge_proposal_content`).

**Шаги:**
1. Добавить миграцию `supabase/migrations/<timestamp>_increment_views.sql`:
   ```sql
   create or replace function public.increment_proposal_views(
     target_proposal_id uuid,
     viewed_at_value timestamptz default now()
   )
   returns void
   language sql
   security definer
   set search_path = public
   as $$
     update public.proposals
     set views_count = coalesce(views_count, 0) + 1,
         last_viewed_at = viewed_at_value,
         updated_at = viewed_at_value
     where id = target_proposal_id;
   $$;
   ```
2. В `SupabaseProposalStore.recordEvent` для `view`:
   ```ts
   if (eventType === "view") {
     const { error: rpcError } = await this.client.rpc("increment_proposal_views", {
       target_proposal_id: proposal.id,
       viewed_at_value: now,
     });
     if (rpcError) {
       // fallback: прежний неатомарный путь
       await this.client.from(this.proposalsTable).update({
         views_count: Number(proposal.viewsCount || 0) + 1,
         last_viewed_at: now,
         updated_at: now,
       }).eq("id", proposal.id);
     }
   }
   ```
3. Обновить `README.md` (раздел про применение миграций) и Resource profile при необходимости — согласно правилу `AGENTS.md`.

**Acceptance:**
- Параллельные просмотры одного КП корректно увеличивают `views_count` (проверить N одновременных запросов → `views_count` вырос на N).
- При отсутствии функции (старая БД) код не падает — срабатывает fallback.

**Риски:** требует применения миграции на проде до деплоя кода (иначе всегда fallback — не страшно, но без атомарности).

---

## H6. Кросс-процессная гонка файлового стора (web ↔ archive-worker)

**Категория:** надёжность · **Серьёзность:** средняя

**Зачем.** `withWriteLock` (`proposal-store.ts:616`) сериализует записи только в пределах одного процесса. Web и archive-worker — разные процессы, оба читают весь `proposals.json` и перезаписывают через temp+rename. Атомарен только rename, но не цикл read-modify-write между процессами → lost updates.

**Файлы:** `README.md` (Resource profile), `docs/hardening-tasks.md` (эта задача), опционально `src/lib/server/proposal-store.ts` / `scripts/proposal-archive-worker.mjs` (lockfile).

**Решение (выбрано).** Не вводить межпроцессную блокировку (избыточно для текущей модели), а **документировать ограничение**: файловый стор поддерживается только в single-process режиме; при включённом archive-worker использовать Supabase. Воркер уже задокументирован как one-shot host-cron, что снижает окно гонки. Lockfile оставить как опциональный пункт на будущее.

**Шаги:**
1. В `README.md` (Resource Profile / file-store раздел) добавить явное предупреждение:
   ```md
   > File-store (`/app/.data/proposals.json`) рассчитан на single-process использование.
   > Запись из web и archive-worker одновременно может приводить к потере обновлений
   > (cross-process race). При включённом archive-worker используйте Supabase
   > (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`). Host-cron one-shot воркер
   > минимизирует окно гонки, но не устраняет его полностью.
   ```
2. (Опционально, не сейчас) — lockfile на уровне `.data/proposals.json.lock` с `fs.open(..., "wx")` и ретраями. Завести отдельной задачей, если потребуется prod на файловом сторе с резидентным воркером.

**Acceptance:**
- README содержит предупреждение о single-process ограничении файлового стора.

**Риски:** документация не устраняет техническую возможность гонки — но для целевого деплоя (Supabase + one-shot cron) риск близок к нулю.

---

## H7. Не отдавать детали внутренних ошибок клиенту

**Категория:** безопасность · **Серьёзность:** низкая (быстрый фикс)

**Зачем.** `src/app/api/items/[id]/share/route.ts:58-63` возвращает `String(error.message)` — в ответ могут попасть ошибки Supabase, пути, детали схемы (например, при невалидном UUID в `id`).

**Файлы:** `src/app/api/items/[id]/share/route.ts`.

**Решение (выбрано).** Логировать полную ошибку на сервере (`console.error`), клиенту отдавать обобщённое сообщение.

**Шаги:**
1. Заменить catch-блок:
   ```ts
   } catch (error) {
     console.error("[share] action failed", error);
     return NextResponse.json(
       { error: "Не удалось обработать запрос на публикацию" },
       { status: 500 },
     );
   }
   ```

**Acceptance:**
- При искусственной ошибке (например, невалидный `id`) клиент получает обобщённый текст, в логах сервера — полная ошибка.
- UX публикации в билдере не изменился (сообщение всё ещё показывается через `alert`).

**Риски:** нет.

---

## H8. Security-заголовки (CSP / X-Frame-Options / Referrer-Policy)

**Категория:** безопасность · **Серьёзность:** низкая–средняя

**Зачем.** `next.config.ts` не задаёт security-заголовки. Публичные `/p/*` помечены `noindex`, но не защищены от встраивания в iframe (clickjacking); нет CSP.

**Файлы:** `next.config.ts`.

**Решение (выбрано).** Задавать заголовки в `next.config.ts` (а не в Caddy) — чтобы защита ехала вместе с приложением независимо от прокси. CSP — умеренная (разрешает inline-стили, нужные Tailwind/Next), `frame-ancestors 'none'`.

**Шаги:**
1. Добавить в `next.config.ts`:
   ```ts
   const nextConfig: NextConfig = {
     // ...существующее...
     async headers() {
       return [
         {
           source: "/:path*",
           headers: [
             { key: "X-Frame-Options", value: "DENY" },
             { key: "X-Content-Type-Options", value: "nosniff" },
             { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
             {
               key: "Content-Security-Policy",
               value: [
                 "default-src 'self'",
                 "img-src 'self' data:",
                 "style-src 'self' 'unsafe-inline'",
                 "script-src 'self' 'unsafe-inline'",
                 "connect-src 'self'",
                 "font-src 'self'",
                 "frame-ancestors 'none'",
                 "base-uri 'self'",
                 "form-action 'self'",
               ].join("; "),
             },
           ],
         },
       ];
     },
   };
   ```
2. Прогнать прод-сборку и вручную проверить, что страницы рендерятся (стили/иконки/шрифты не блокируются CSP).

**Acceptance:**
- `curl -I https://domain.ru/` показывает заголовки CSP, X-Frame-Options, Referrer-Policy.
- Билдер и публичная страница визуально не сломаны (нет CSP-ошибок в консоли браузера).

**Риски:** CSP с `script-src 'self' 'unsafe-inline'` — компромисс (Next/Tailwind используют inline). Если позже добавятся внешние ресурсы (аналитика, CDN), CSP надо расширять. `'unsafe-inline'` ослабляет защиту от XSS — для следующего шага можно перейти на nonce-based CSP (отдельная задача).

---

## H9. Дедупликация низкоуровневых хелперов

**Категория:** качество кода · **Серьёзность:** средняя

**Зачем.** `readString/readNumber/readArray/asRecord/toSnakeCase` дублированы в `proposal-store.ts` (1065-1097) и `proposal.ts` (1229+); `readField/readArray/readNumberValue/toSnakeCase/formatMoney/addDays/sortByOrder` повторно в `archive-worker.mjs`; `formatMoney` дублирован. Расхождения (`readField` в воркере → `""`, `readValue` в сторе → `undefined`) уже есть.

**Файлы:** новый `src/lib/shared/record.ts`, `src/lib/proposal.ts`, `src/lib/server/proposal-store.ts`; новый `scripts/lib/record.mjs`, `scripts/proposal-archive-worker.mjs`.

**Решение (выбрано).** Дедуплицировать **TS-сторону** (proposal.ts + proposal-store.ts) через общий модуль `src/lib/shared/record.ts`. Воркер (`.mjs`, вне сборки Next) — вынести его утилиты в `scripts/lib/record.mjs` и импортировать оттуда, **не** связывая с TS-слоем (осознанная изоляция скрипта, чтобы воркер оставался самостоятельным Node-скриптом без сборки). Делать **после H11** (тесты), чтобы поймать регрессии.

**Шаги:**
1. Создать `src/lib/shared/record.ts` с каноничными `asRecord`, `readValue`, `readString`, `readNumber`, `readArray`, `toSnakeCase` (взять версию из `proposal-store.ts` как опорную, она snake/camel-aware).
2. Заменить локальные определения в `proposal.ts` и `proposal-store.ts` импортами. Сверить поведение (особенно `asRecord` в `proposal.ts` сейчас не читает snake_case — проверить, что переход на snake-aware версию не ломает нормализацию импортируемого JSON).
3. Создать `scripts/lib/record.mjs` с `readField`, `readArray`, `readNumberValue`, `readNumber`, `readBoolean`, `readList`, `toSnakeCase`, `sortByOrder`, `formatMoney`, `addDays`, `addMonthsUtc` и импортировать в `proposal-archive-worker.mjs`.
4. Прогнать `npm run lint`, `npm run build`, `npm run archive:self-test` и тесты из H11.

**Acceptance:**
- `git grep "function readString" src` → одно определение (в `shared/record.ts`).
- `npm run build` зелёный, `npm run archive:self-test` → OK.
- Тесты H11 зелёные (нормализация/санитизация не изменились).

**Риски:** объединение `asRecord`-версий может неуловимо изменить нормализацию (snake vs camel). Поэтому строго после тестов; разносить TS и воркер.

---

## H10. Убрать псевдо-условие `normalizeCurrency`

**Категория:** качество кода · **Серьёзность:** низкая (быстрый фикс)

**Зачем.** `proposal-store.ts:1061-1063` — `return value === "RUB" ? "RUB" : "RUB";` всегда возвращает `"RUB"`, параметр игнорируется. Скрытое допущение «только RUB», размазанное по коду.

**Файлы:** `src/lib/server/proposal-store.ts`.

**Решение (выбрано).** Зафиксировать «только RUB» одной константой, убрать мёртвое условие. Мультивалютность сейчас **не вводим** (нет требования; UI и расчёты завязаны на RUB).

**Шаги:**
1. Заменить функцию:
   ```ts
   // Проект работает только в рублях. Если появится мультивалютность —
   // расширить здесь и в normalizeProjectSettings/formatMoney.
   const SUPPORTED_CURRENCY = "RUB" as const;
   function normalizeCurrency(): typeof SUPPORTED_CURRENCY {
     return SUPPORTED_CURRENCY;
   }
   ```
   Вызовы `normalizeCurrency(readString(row, "currency"))` → `normalizeCurrency()` (либо оставить сигнатуру с игнорируемым аргументом и комментарием — но чище убрать аргумент).

**Acceptance:**
- `npm run build` зелёный.
- Поведение не изменилось (валюта по-прежнему RUB).

**Риски:** нет.

---

## H11. Unit-тесты на критичную логику (санитизация, расчёты, нормализация)

**Категория:** тесты · **Серьёзность:** высокая (для поддерживаемости)

**Зачем.** Тестов нет вообще (в `package.json` нет раннера, нет `*.test.*`). Не покрыты: санитизация публичных данных (`sanitizeProposalForPublic`, `stripInternalProposalData`), расчёты (`calculateGrandTotal`, `calculateItemTotal`, `calculateTotalDays`), нормализация (`normalizeProposalData`), верификация пароля, нарезка Telegram-чанков (`splitTelegramChunks`). Главный риск — тихая утечка `internalNote`/`notes` в публичный payload при будущих правках.

**Файлы:** `package.json` (скрипт `test`), новые `src/lib/**/*.test.ts` / `scripts/*.test.mjs`.

**Решение (выбрано).** Использовать встроенный **`node:test`** + `tsx`/`node --import` для TS — без тяжёлых новых зависимостей (Vitest не вводим, чтобы не раздувать `node_modules`, см. `docs/optimization-tasks.md`). Если запуск TS через node окажется проблемным в текущей конфигурации — допускается минимальный `tsx` как devDependency, но сначала пробуем `node --test` с `--experimental-strip-types` (Node 24 в Docker это умеет).

**Шаги:**
1. Добавить в `package.json`:
   ```json
   "test": "node --test --experimental-strip-types"
   ```
   (Node 24 поддерживает strip-types; проверить локальную версию `node -v`.)
2. Приоритетные тесты (минимальный, но ценный набор):
   - `src/lib/server/sanitize.test.ts` — `sanitizeProposalForPublic`/`stripInternalProposalData`: убедиться, что `passwordHash`, `internalNotes`, `project.notes`, `item.internalNote` **отсутствуют/пусты** в выходе. Это защита данных клиента.
   - `src/lib/proposal.test.ts` — `calculateItemTotal` (clamp price≥0, qty≥1), `calculateGrandTotal` (required + selected optional), `calculateTotalDays`; `normalizeProposalData` на мусорном вводе (null/массивы/чужие поля) не падает и даёт дефолты.
   - `src/lib/server/password.test.ts` — `hashProposalPassword`→`verifyProposalPassword` round-trip true; неверный пароль → false; битый hash → false.
   - `scripts/archive-worker.test.mjs` — `splitTelegramChunks`: ни один чанк не превышает лимит; длинная строка режется; пустой ввод → `[""]`.
3. Прогнать `npm test`.

**Acceptance:**
- `npm test` зелёный, покрывает перечисленные функции.
- Тест санитизации явно проверяет отсутствие чувствительных полей в публичном выходе.

**Риски:** если `node --test --experimental-strip-types` нестабилен в текущем Node — fallback на `tsx` (одна devDependency). Зафиксировать выбранный путь в PR.

---

## H12. Декомпозиция крупных функций

**Категория:** качество кода · **Серьёзность:** низкая

**Зачем.** Длинные функции с ручным маппингом полей: `proposalToProposalData` (`proposal-store.ts:288-401`), `publishProposal` (130+ строк), `renderProposalArchiveText` (воркер), `validateScopeListJsonData` (`proposal.ts`). Легко пропустить поле при изменении схемы (рассинхрон `toSupabaseProposal` ↔ `normalizeStoredProposal`).

**Файлы:** `src/lib/server/proposal-store.ts`, `scripts/proposal-archive-worker.mjs`, `src/lib/proposal.ts`.

**Решение (выбрано).** Делать **после H11 и H9**. Точечная декомпозиция без смены поведения: выделить из `publishProposal` сборку записи (`buildPublishedRecord`), из `proposalToProposalData` — ветки packages/deliverables в отдельные функции. Маппинг полей camel↔snake свести к одной таблице в рамках H9, что само уменьшит `toSupabaseProposal`/`normalizeStoredProposal`.

**Шаги:**
1. Выделить чистые подфункции, сохранив сигнатуры публичных функций.
2. Каждую — отдельным коммитом, прогоняя тесты H11 между шагами.

**Acceptance:**
- Поведение идентично (тесты H11 зелёные).
- Целевые функции заметно короче; маппинг полей в одном месте.

**Риски:** средний — рефакторинг логики маппинга. Строго после тестов; маленькими коммитами.

---

## H13. Закоммитить `.env.example`

**Категория:** DevOps / документация · **Серьёзность:** низкая (быстрый фикс)

**Зачем.** `.env.example` существует на диске, но `.gitignore:42` (`.env*`) исключает его из git — `git ls-files` его не показывает. Шаблон переменных не версионируется; легко забыть `PROPOSAL_ACCESS_SECRET` (см. H2) и новый `ADMIN_ACCESS_TOKEN` (H1). В `.dockerignore` исключение `!.env.example` уже есть, в `.gitignore` — нет.

**Файлы:** `.gitignore`, `.env.example`.

**Решение (выбрано).** Добавить исключение в `.gitignore` и закоммитить `.env.example` (значения в нём пустые/неконфиденциальные — проверено).

**Шаги:**
1. В `.gitignore` после `.env*` добавить:
   ```diff
    # env files (can opt-in for committing if needed)
    .env*
   +!.env.example
   ```
2. Дополнить `.env.example` новыми переменными из H1/H2/H4:
   ```env
   PROPOSAL_ACCESS_SECRET=
   ADMIN_ACCESS_TOKEN=
   ```
   (если ещё не присутствуют; `PROPOSAL_ACCESS_SECRET` уже есть).
3. `git add -f .env.example` (или после правки .gitignore — обычный `git add`).
4. Финальная проверка, что в файле нет реальных секретов.

**Acceptance:**
- `git ls-files | grep .env.example` показывает файл.
- В файле только пустые значения / небоевые дефолты.

**Риски:** нельзя коммитить реальные секреты — перед коммитом убедиться, что значения пусты (сейчас так).

---

## Чек-лист готовности

- [ ] H1 — запись/админ-поверхность под basic_auth (Caddy) + опциональный `ADMIN_ACCESS_TOKEN`.
- [ ] H2 — `PROPOSAL_ACCESS_SECRET` обязателен в проде (fail-fast).
- [ ] H3 — rate-limit на password-роут + асинхронный scrypt.
- [ ] H4 — лимиты `metadata`/`userAgent`/`referrer` + кап событий file-стора.
- [ ] H5 — атомарный инкремент `views_count` через RPC + миграция.
- [ ] H6 — документировано single-process ограничение file-стора.
- [ ] H7 — обобщённые ошибки клиенту, полные — в лог.
- [ ] H8 — security-заголовки в `next.config.ts`.
- [ ] H9 — дедупликация хелперов (TS-слой + `scripts/lib/record.mjs`).
- [ ] H10 — убрано псевдо-условие `normalizeCurrency`.
- [ ] H11 — unit-тесты (`node:test`) на санитизацию/расчёты/пароль/чанки.
- [ ] H12 — декомпозиция крупных функций.
- [ ] H13 — `.env.example` в git.

После задач, затрагивающих Docker/Supabase/env/cron/build (H1, H2, H5, H6), — обновить раздел **Resource Profile** в `README.md` согласно правилу в `AGENTS.md`.
