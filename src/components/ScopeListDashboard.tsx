"use client";

import Link from "next/link";
import { Copy, Pencil, Plus, Trash2 } from "@/components/icons";
import { useEffect, useMemo, useState } from "react";
import {
  formatMoney,
  getScopeListDataStorageKey,
  SCOPELIST_INDEX_KEY,
} from "@/lib/proposal";
import type { ScopeListIndexEntry, ScopeListStatus } from "@/lib/types";
import {
  THEME_STORAGE_KEY,
  ThemeToggle,
  type ThemeMode,
} from "./ThemeToggle";
import { Badge, Button } from "./Ui";

type DashboardFilter = "all" | ScopeListStatus;

const filters: Array<{ label: string; value: DashboardFilter }> = [
  { label: "Все", value: "all" },
  { label: "Черновики", value: "draft" },
  { label: "Опубликованные", value: "published" },
];

export function ScopeListDashboard() {
  const [entries, setEntries] = useState<ScopeListIndexEntry[]>([]);
  const [filter, setFilter] = useState<DashboardFilter>("all");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [hydrated, setHydrated] = useState(false);
  const filteredEntries = useMemo(
    () =>
      filter === "all"
        ? entries
        : entries.filter((entry) => entry.status === filter),
    [entries, filter],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

      if (storedTheme === "light" || storedTheme === "dark") {
        setTheme(storedTheme);
      }

      setEntries(readScopeListIndex());
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme, hydrated]);

  function deleteEntry(entry: ScopeListIndexEntry) {
    if (!window.confirm(`Удалить «${entry.title}»?`)) {
      return;
    }

    const nextEntries = entries.filter((item) => item.id !== entry.id);
    window.localStorage.removeItem(getScopeListDataStorageKey(entry.id));
    writeScopeListIndex(nextEntries);
    setEntries(nextEntries);
  }

  async function copyPublicUrl(entry: ScopeListIndexEntry) {
    if (!entry.publicUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(entry.publicUrl);
    } catch {
      window.prompt("Скопируйте клиентскую ссылку", entry.publicUrl);
    }
  }

  return (
    <main className="scopelist-theme min-h-screen bg-main text-ink">
      <div className="mx-auto max-w-[1400px] px-4 py-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="inline-flex text-lg font-bold tracking-[0.08em] text-zinc-950"
          >
            SCOPELIST
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle theme={theme} onChange={setTheme} />
            <Link
              href="/lists/new"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white outline-none transition hover:bg-zinc-800 focus:ring-4 focus:ring-zinc-200"
            >
              <Plus size={16} aria-hidden="true" />
              Новый лист
            </Link>
          </div>
        </header>

        <section className="mt-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Scope-листы
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600">
              Создавайте листы работ, публикуйте приватные клиентские ссылки и
              возвращайтесь к нужному объёму без поиска по вкладкам.
            </p>
          </div>

          <nav className="mt-6 flex flex-wrap gap-2" aria-label="Фильтр листов">
            {filters.map((item) => {
              const count = countEntries(entries, item.value);
              const isActive = filter === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${
                    isActive
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {item.label}
                  {count > 0 ? (
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        isActive
                          ? "bg-white/15 text-white"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </section>

        <section className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Лист</th>
                  <th className="px-4 py-3">Клиент</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Обновлено</th>
                  <th className="px-4 py-3">Срок</th>
                  <th className="px-4 py-3">Позиции</th>
                  <th className="px-4 py-3">Цена</th>
                  <th className="px-4 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {!hydrated ? (
                  <tr>
                    <td className="px-4 py-8 text-zinc-500" colSpan={8}>
                      Загружаем список
                    </td>
                  </tr>
                ) : filteredEntries.length > 0 ? (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id} className="align-top hover:bg-zinc-50">
                      <td className="px-4 py-4">
                        <Link
                          href={`/lists/${entry.id}/edit`}
                          className="font-semibold text-zinc-950 hover:underline"
                        >
                          {entry.title}
                        </Link>
                        <div className="mt-1 text-xs text-zinc-500">
                          {entry.version}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-zinc-700">
                        {entry.clientName || "— не указан"}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={entry.status} />
                      </td>
                      <td className="px-4 py-4 text-zinc-600">
                        {formatDateTime(entry.updatedAt)}
                      </td>
                      <td className="px-4 py-4 text-zinc-600">
                        {formatDate(entry.proposalDate)}
                      </td>
                      <td className="px-4 py-4 text-zinc-700">
                        {entry.itemCount}
                      </td>
                      <td className="px-4 py-4 font-semibold text-zinc-950">
                        {formatMoney(entry.total)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/lists/${entry.id}/edit`}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-50"
                          >
                            <Pencil size={15} aria-hidden="true" />
                            Редактировать
                          </Link>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-9 px-3"
                            disabled={!entry.publicUrl}
                            onClick={() => {
                              copyPublicUrl(entry);
                            }}
                          >
                            <Copy size={15} aria-hidden="true" />
                            Ссылка
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            className="h-9 px-3"
                            onClick={() => {
                              deleteEntry(entry);
                            }}
                            title="Удалить"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-10 text-center" colSpan={8}>
                      <div className="mx-auto max-w-md">
                        <p className="text-base font-semibold text-zinc-950">
                          Листов пока нет
                        </p>
                        <p className="mt-2 text-sm leading-6 text-zinc-500">
                          Создайте первый scope-лист, заполните состав работ и
                          он появится в этой таблице.
                        </p>
                        <Link
                          href="/lists/new"
                          className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
                        >
                          <Plus size={16} aria-hidden="true" />
                          Новый лист
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-4 text-sm text-zinc-500">
          Показано {filteredEntries.length} из {entries.length}
        </div>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: ScopeListStatus }) {
  if (status === "published") {
    return (
      <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-200">
        Опубликовано
      </Badge>
    );
  }

  return (
    <Badge className="bg-zinc-100 text-zinc-700 ring-zinc-200">
      Черновик
    </Badge>
  );
}

function countEntries(
  entries: ScopeListIndexEntry[],
  filter: DashboardFilter,
) {
  if (filter === "all") {
    return entries.length;
  }

  return entries.filter((entry) => entry.status === filter).length;
}

function readScopeListIndex(): ScopeListIndexEntry[] {
  try {
    const raw = window.localStorage.getItem(SCOPELIST_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed.filter(isScopeListIndexEntry).sort(sortByUpdatedAt)
      : [];
  } catch {
    return [];
  }
}

function writeScopeListIndex(entries: ScopeListIndexEntry[]) {
  window.localStorage.setItem(
    SCOPELIST_INDEX_KEY,
    JSON.stringify([...entries].sort(sortByUpdatedAt)),
  );
}

function isScopeListIndexEntry(value: unknown): value is ScopeListIndexEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<ScopeListIndexEntry>;

  return typeof entry.id === "string" && typeof entry.title === "string";
}

function sortByUpdatedAt(left: ScopeListIndexEntry, right: ScopeListIndexEntry) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}
