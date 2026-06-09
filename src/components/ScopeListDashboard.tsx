"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Eye,
  FilePenLine,
  Link2,
  LogOut,
  MoreHorizontal,
  Plus,
  Trash2,
} from "@/components/icons";
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

type DashboardFilter = "all" | ScopeListStatus;

const filters: Array<{ id: DashboardFilter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "draft", label: "Черновики" },
  { id: "published", label: "Опубликованные" },
];

const statusLabels: Record<ScopeListStatus, string> = {
  draft: "Черновик",
  published: "Опубликовано",
};

const statusTone: Record<ScopeListStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  published: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

export function ScopeListDashboard({ showLogout }: { showLogout: boolean }) {
  const [entries, setEntries] = useState<ScopeListIndexEntry[]>([]);
  const [filter, setFilter] = useState<DashboardFilter>("all");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [hydrated, setHydrated] = useState(false);

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

  const filterCounts = useMemo(() => {
    const counts: Partial<Record<DashboardFilter, number>> = {
      all: entries.length,
    };
    for (const entry of entries) {
      counts[entry.status] = (counts[entry.status] ?? 0) + 1;
    }
    return counts;
  }, [entries]);

  const filtered = useMemo(() => {
    if (filter === "all") {
      return entries;
    }
    return entries.filter((entry) => entry.status === filter);
  }, [filter, entries]);

  const shownFrom = filtered.length > 0 ? 1 : 0;
  const shownTo = filtered.length;
  const totalItems = entries.length;

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

  async function logout() {
    await fetch("/api/admin-auth", { method: "DELETE" }).catch(() => undefined);
    window.location.assign("/login");
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-6 py-3">
          <Link
            href="/"
            className="text-base font-semibold tracking-[0.18em] text-zinc-900"
          >
            SCOPELIST
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} onChange={setTheme} />
            {showLogout ? (
              <button
                type="button"
                onClick={logout}
                className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
              >
                <LogOut size={16} aria-hidden="true" />
                Выйти
              </button>
            ) : null}
            <Link
              href="/lists/new"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-900 px-3.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              <Plus size={16} aria-hidden="true" />
              Новое КП
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-6 py-10">
        <section className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            КП на допработы
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Создавайте предложения на дополнительные работы, публикуйте
            приватные клиентские ссылки и возвращайтесь к нужному объёму без
            поиска по вкладкам.
          </p>
        </section>

        <div className="mt-8 border-b border-zinc-200">
          <nav className="-mb-px flex flex-wrap gap-x-6 gap-y-1">
            {filters.map((item) => {
              const count = filterCounts[item.id] ?? 0;
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`group inline-flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition ${
                    active
                      ? "border-zinc-900 text-zinc-950"
                      : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800"
                  }`}
                >
                  {item.label}
                  {count > 0 ? (
                    <span
                      className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                        active
                          ? "bg-zinc-900 text-white"
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
        </div>

        <section className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {!hydrated ? (
            <div className="px-5 py-12 text-sm text-zinc-500">
              Загружаем список…
            </div>
          ) : filtered.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">КП</th>
                      <th className="px-5 py-3 font-semibold">Клиент</th>
                      <th className="px-5 py-3 font-semibold">Статус</th>
                      <th className="px-5 py-3 font-semibold">Обновлено</th>
                      <th className="px-5 py-3 font-semibold">Дата</th>
                      <th className="px-5 py-3 font-semibold">Позиции</th>
                      <th className="px-5 py-3 text-right font-semibold">Цена</th>
                      <th className="w-0 px-5 py-3 font-semibold">
                        <span className="sr-only">Действия</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filtered.map((entry) => (
                      <tr
                        key={entry.id}
                        className="align-middle transition hover:bg-zinc-50"
                      >
                        <td className="px-5 py-4">
                          <Link
                            href={`/lists/${entry.id}/edit`}
                            className="block font-semibold text-zinc-950 hover:underline"
                          >
                            {entry.title}
                          </Link>
                          <div className="mt-0.5 text-xs text-zinc-500">
                            {entry.version}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-medium text-zinc-800">
                            {entry.clientName || (
                              <span className="text-zinc-400">— не указан</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <StatusDot
                            tone={statusTone[entry.status]}
                            label={statusLabels[entry.status]}
                          />
                        </td>
                        <td className="px-5 py-4 text-zinc-600">
                          {formatDateTime(entry.updatedAt)}
                        </td>
                        <td className="px-5 py-4 text-zinc-600">
                          {formatDate(entry.proposalDate)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold tabular-nums text-zinc-900">
                            {entry.itemCount}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right font-medium tabular-nums text-zinc-800">
                          {formatMoney(entry.total)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <IconLink
                              href={`/lists/${entry.id}/edit`}
                              label="Редактировать"
                            >
                              <FilePenLine size={16} aria-hidden="true" />
                            </IconLink>
                            <IconButton
                              onClick={() => copyPublicUrl(entry)}
                              disabled={!entry.publicUrl}
                              label="Скопировать ссылку"
                            >
                              <Copy size={16} aria-hidden="true" />
                            </IconButton>
                            <RowMenu
                              entryId={entry.id}
                              onRemove={() => deleteEntry(entry)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col items-start justify-between gap-3 border-t border-zinc-200 px-5 py-3 text-xs text-zinc-500 md:flex-row md:items-center">
                <span>
                  Показано {shownFrom}–{shownTo} из {totalItems}
                </span>
              </div>
            </>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center px-4 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                <Link2 size={20} aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-zinc-950">
                КП нет
              </h2>
              <p className="mt-1 max-w-sm text-sm text-zinc-500">
                В выбранном фильтре пока нет КП на допработы.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatusDot({ tone, label }: { tone: string; label: string }) {
  const dotColor = resolveDotColor(tone);
  return (
    <span className="inline-flex items-center gap-2 text-sm text-zinc-700">
      <span
        aria-hidden="true"
        className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`}
      />
      {label}
    </span>
  );
}

function resolveDotColor(tone: string): string {
  if (tone.includes("emerald")) return "bg-emerald-500";
  if (tone.includes("amber")) return "bg-amber-500";
  if (tone.includes("rose")) return "bg-rose-500";
  return "bg-zinc-400";
}

function IconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
    >
      {children}
    </Link>
  );
}

function IconButton({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function RowMenu({
  entryId,
  onRemove,
}: {
  entryId: string;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handle(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", handle);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", handle);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Ещё"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg shadow-zinc-900/5"
        >
          <MenuLink
            href={`/lists/${entryId}/edit`}
            onSelect={() => setOpen(false)}
            icon={<Eye size={14} aria-hidden="true" />}
          >
            Открыть КП
          </MenuLink>
          <MenuButton
            onSelect={() => {
              setOpen(false);
              onRemove();
            }}
            icon={<Trash2 size={14} aria-hidden="true" />}
            danger
          >
            Удалить КП
          </MenuButton>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  onSelect,
  icon,
  children,
}: {
  href: string;
  onSelect: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onSelect}
      className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
    >
      {icon}
      {children}
    </Link>
  );
}

function MenuButton({
  onSelect,
  icon,
  children,
  danger,
  disabled,
}: {
  onSelect: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? "text-rose-700 hover:bg-rose-50"
          : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
      }`}
    >
      {icon}
      {children}
    </button>
  );
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
