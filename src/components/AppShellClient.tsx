"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  Eye,
  Hammer,
  Link2,
  Save,
} from "@/components/icons";
import { useEffect, useMemo, useState } from "react";
import { ChangeItemForm } from "./ChangeItemForm";
import { ChangeItemList } from "./ChangeItemList";
import { ImportExportControls } from "./ImportExportControls";
import { ProjectSettingsForm } from "./ProjectSettingsForm";
import { ProposalPreview } from "./ProposalPreview";
import { SummaryCard } from "./SummaryCard";
import {
  THEME_STORAGE_KEY,
  ThemeToggle,
  type ThemeMode,
} from "./ThemeToggle";
import { Badge, Button } from "./Ui";
import {
  createEmptyChangeItem,
  createId,
  createScopeListIndexEntry,
  getScopeListDataStorageKey,
  normalizeProposalData,
  SCOPELIST_INDEX_KEY,
} from "@/lib/proposal";
import type {
  ChangeItem,
  ProjectSettings,
  ProposalData,
  ProposalMode,
  ScopeListIndexEntry,
} from "@/lib/types";

type AppShellClientProps = {
  initialData: ProposalData;
  listId: string;
};

export function AppShellClient({ initialData, listId }: AppShellClientProps) {
  const [data, setData] = useState<ProposalData>(initialData);
  const [mode, setMode] = useState<ProposalMode>("builder");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [hydrated, setHydrated] = useState(false);
  const [serverProposalId, setServerProposalId] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState("");
  const [editingItem, setEditingItem] = useState<ChangeItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("Готово к работе");
  const listStorageKey = useMemo(
    () => getScopeListDataStorageKey(listId),
    [listId],
  );

  useEffect(() => {
    let nextData: ProposalData | null = null;
    let nextNotice = "Готово к работе";
    let nextServerProposalId: string | null = null;
    let nextPublishedUrl = "";
    let nextTheme: ThemeMode | null = null;

    try {
      const stored = window.localStorage.getItem(listStorageKey);
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      const indexEntry = readScopeListIndex().find((entry) => entry.id === listId);

      if (indexEntry?.recordId) {
        nextServerProposalId = indexEntry.recordId;
      }

      if (indexEntry?.publicUrl) {
        nextPublishedUrl = indexEntry.publicUrl;
      }

      if (storedTheme === "light" || storedTheme === "dark") {
        nextTheme = storedTheme;
      }

      if (stored) {
        const parsed = normalizeProposalData(JSON.parse(stored));
        if (parsed) {
          nextData = parsed;
          nextNotice = "Загружено из localStorage";
        }
      }
    } catch {
      nextNotice = "Готово к работе";
    }

    const timer = window.setTimeout(() => {
      if (nextData) {
        setData(nextData);
      }
      if (nextServerProposalId) {
        setServerProposalId(nextServerProposalId);
      }
      if (nextPublishedUrl) {
        setPublishedUrl(nextPublishedUrl);
      }
      if (nextTheme) {
        setTheme(nextTheme);
      }
      setNotice(nextNotice);
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialData, listId, listStorageKey]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    persistScopeList({
      data,
      listId,
      publicUrl: publishedUrl,
      recordId: serverProposalId || "",
      storageKey: listStorageKey,
    });
  }, [data, hydrated, listId, listStorageKey, publishedUrl, serverProposalId]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme, hydrated]);

  const activeId = editingId ?? editingItem?.id ?? null;
  const publicUrl = publishedUrl;
  const publicationLabel = publishedUrl ? "Опубликовано" : "Черновик";
  const publicationTone = publishedUrl
    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
    : "bg-zinc-100 text-zinc-700 ring-zinc-200";

  const sortedItems = useMemo(
    () =>
      [...data.items].sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }

        return a.title.localeCompare(b.title);
      }),
    [data.items],
  );

  function updateProject(patch: Partial<ProjectSettings>) {
    setData((current) => ({
      ...current,
      project: {
        ...current.project,
        ...patch,
      },
    }));
    setNotice("Сохранено локально");
  }

  function startAddItem() {
    setEditingId(null);
    setEditingItem(createEmptyChangeItem());
  }

  function startEditItem(item: ChangeItem) {
    setEditingId(item.id);
    setEditingItem({
      ...item,
      deliverables: [...item.deliverables],
      outOfScope: [...item.outOfScope],
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingItem(null);
  }

  function saveItem(item: ChangeItem) {
    const normalized = normalizeItem(item);

    if (!normalized.title.trim()) {
      return;
    }

    setData((current) => ({
      ...current,
      items: editingId
        ? current.items.map((existing) =>
            existing.id === editingId ? normalized : existing,
          )
        : [...current.items, normalized],
    }));
    setNotice("Сохранено локально");
    cancelEdit();
  }

  function duplicateItem(id: string) {
    setData((current) => {
      const index = current.items.findIndex((item) => item.id === id);
      if (index === -1) {
        return current;
      }

      const copy: ChangeItem = {
        ...current.items[index],
        id: createId(),
        title: `${current.items[index].title} (копия)`,
      };
      const nextItems = [...current.items];
      nextItems.splice(index + 1, 0, copy);

      return { ...current, items: nextItems };
    });
    setNotice("Сохранено локально");
  }

  function deleteItem(id: string) {
    setData((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id),
    }));
    setNotice("Сохранено локально");

    if (editingId === id || editingItem?.id === id) {
      cancelEdit();
    }
  }

  function toggleItemType(id: string, type: "required" | "optional") {
    setData((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id
          ? {
              ...item,
              required: type === "required",
              optional: type === "optional",
              selected: type === "required" ? true : item.selected,
            }
          : item,
      ),
    }));
    setNotice("Сохранено локально");
  }

  function toggleOptionalSelected(id: string, selected: boolean) {
    setData((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id && item.optional ? { ...item, selected } : item,
      ),
    }));
    setNotice("Сохранено локально");
  }

  function importData(value: unknown) {
    const parsed = normalizeProposalData(value);

    if (!parsed) {
      alert(
        "Не удалось импортировать JSON. Структура proposal не распознана.",
      );
      return;
    }

    setData(parsed);
    cancelEdit();
    setNotice("JSON импортирован");
  }

  async function copyShareLink() {
    const proposalId = serverProposalId || createId();

    if (!serverProposalId) {
      setServerProposalId(proposalId);
    }

    setNotice("Публикуем клиентскую ссылку");

    const response = await fetch(
      `/api/items/${encodeURIComponent(proposalId)}/share`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          proposal: data,
        }),
      },
    );
    const result = (await response.json().catch(() => ({}))) as {
      publicUrl?: string;
      error?: string;
    };

    if (!response.ok || !result.publicUrl) {
      setNotice("Не удалось опубликовать ссылку");
      alert(
        result.error ||
          "Не удалось опубликовать клиентскую ссылку.",
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(result.publicUrl);
      setPublishedUrl(result.publicUrl);
      setNotice("Публичная ссылка опубликована и скопирована");
    } catch {
      window.prompt("Скопируйте клиентскую ссылку", result.publicUrl);
      setPublishedUrl(result.publicUrl);
      setNotice("Публичная ссылка подготовлена");
    }
  }

  function saveCurrentData() {
    persistScopeList({
      data,
      listId,
      publicUrl: publishedUrl,
      recordId: serverProposalId || "",
      storageKey: listStorageKey,
    });
    setNotice("Сохранено локально");
  }

  async function copyPublishedLink() {
    if (!publicUrl) {
      await copyShareLink();
      return;
    }

    try {
      await navigator.clipboard.writeText(publicUrl);
      setNotice("Клиентская ссылка скопирована");
    } catch {
      window.prompt("Скопируйте клиентскую ссылку", publicUrl);
      setNotice("Клиентская ссылка подготовлена");
    }
  }

  function openPublicLink() {
    if (!publicUrl) {
      setNotice("Сначала опубликуйте клиентскую ссылку");
      return;
    }

    window.open(publicUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="scopelist-theme min-h-screen bg-main text-ink">
      <header className="top-controls sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur no-print">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Назад к списку"
              title="Назад к списку"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={publicationTone}>{publicationLabel}</Badge>
                <span className="text-sm text-zinc-500">
                  Версия {data.project.version || "v1.0"}
                </span>
              </div>
              <h1 className="mt-1 text-xl font-semibold text-zinc-950">
                {data.project.projectTitle || "Новый scope-лист"}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle theme={theme} onChange={setTheme} />
            <ImportExportControls data={data} onImport={importData} />
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMode(mode === "builder" ? "preview" : "builder")}
            >
              {mode === "builder" ? (
                <Eye size={16} aria-hidden="true" />
              ) : (
                <Hammer size={16} aria-hidden="true" />
              )}
              {mode === "builder" ? "Предпросмотр" : "Редактор"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!hydrated}
              onClick={saveCurrentData}
            >
              <Save size={16} aria-hidden="true" />
              Сохранить
            </Button>
            <Button type="button" onClick={copyShareLink}>
              <Link2 size={16} aria-hidden="true" />
              Опубликовать
            </Button>
          </div>
        </div>
      </header>

      {mode === "builder" ? (
        <main className="builder-grid relative z-10 mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 py-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="builder-panel space-y-5">
            <ProjectSettingsForm value={data.project} onChange={updateProject} />
            <ChangeItemForm
              item={editingItem}
              isNew={!editingId}
              onAdd={startAddItem}
              onChange={setEditingItem}
              onSave={saveItem}
              onCancel={cancelEdit}
            />
            <ChangeItemList
              items={sortedItems}
              currency={data.project.currency}
              activeId={activeId}
              onEdit={startEditItem}
              onDuplicate={duplicateItem}
              onDelete={deleteItem}
              onToggleType={toggleItemType}
              onToggleSelected={toggleOptionalSelected}
            />
          </div>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start no-print">
            <PublicationCard
              publicUrl={publicUrl}
              statusLabel={publicationLabel}
              statusTone={publicationTone}
              notice={notice}
              onPublish={copyShareLink}
              onCopy={copyPublishedLink}
              onOpen={openPublicLink}
            />
            <SummaryCard data={data} compact />
          </aside>
        </main>
      ) : (
        <main className="mx-auto max-w-5xl px-4 py-6">
          <ProposalPreview data={data} onToggleOptional={toggleOptionalSelected} />
        </main>
      )}
    </div>
  );
}

function normalizeItem(item: ChangeItem): ChangeItem {
  const required = item.required || !item.optional;

  return {
    ...item,
    title: item.title.trim(),
    price: Math.max(0, Number(item.price) || 0),
    quantity: Math.max(1, Number(item.quantity) || 1),
    estimatedDays: Math.max(0, Number(item.estimatedDays) || 0),
    required,
    optional: !required,
    selected: required ? true : item.selected,
  };
}

function PublicationCard({
  publicUrl,
  statusLabel,
  statusTone,
  notice,
  onPublish,
  onCopy,
  onOpen,
}: {
  publicUrl: string;
  statusLabel: string;
  statusTone: string;
  notice: string;
  onPublish: () => void;
  onCopy: () => void;
  onOpen: () => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 text-zinc-950 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Публикация
          </p>
          <h2 className="mt-1 text-lg font-semibold">Клиентская ссылка</h2>
        </div>
        <Badge className={statusTone}>{statusLabel}</Badge>
      </div>

      <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">
        {publicUrl ||
          "Ссылка появится после публикации scope-листа."}
      </div>

      <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">
        {notice}
      </div>

      <div className="mt-4 grid gap-2">
        <Button type="button" onClick={onPublish}>
          <Link2 size={16} aria-hidden="true" />
          Опубликовать
        </Button>
        <Button type="button" variant="secondary" onClick={onCopy}>
          <Copy size={16} aria-hidden="true" />
          Скопировать ссылку
        </Button>
        <Button type="button" variant="secondary" onClick={onOpen}>
          <Eye size={16} aria-hidden="true" />
          Открыть клиентскую версию
        </Button>
      </div>
    </section>
  );
}

type PersistScopeListOptions = {
  data: ProposalData;
  listId: string;
  publicUrl: string;
  recordId: string;
  storageKey: string;
};

function persistScopeList({
  data,
  listId,
  publicUrl,
  recordId,
  storageKey,
}: PersistScopeListOptions) {
  window.localStorage.setItem(storageKey, JSON.stringify(data));

  const entries = readScopeListIndex();
  const existing = entries.find((entry) => entry.id === listId);
  const nextEntry = createScopeListIndexEntry(listId, data, {
    ...existing,
    publicUrl,
    recordId,
    status: publicUrl ? "published" : "draft",
    updatedAt: new Date().toISOString(),
  });

  writeScopeListIndex(upsertScopeListIndexEntry(entries, nextEntry));
}

function readScopeListIndex(): ScopeListIndexEntry[] {
  try {
    const raw = window.localStorage.getItem(SCOPELIST_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed.filter(isScopeListIndexEntry)
      : [];
  } catch {
    return [];
  }
}

function writeScopeListIndex(entries: ScopeListIndexEntry[]) {
  window.localStorage.setItem(SCOPELIST_INDEX_KEY, JSON.stringify(entries));
}

function upsertScopeListIndexEntry(
  entries: ScopeListIndexEntry[],
  nextEntry: ScopeListIndexEntry,
) {
  const nextEntries = entries.filter((entry) => entry.id !== nextEntry.id);
  nextEntries.unshift(nextEntry);

  return nextEntries.sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function isScopeListIndexEntry(value: unknown): value is ScopeListIndexEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<ScopeListIndexEntry>;

  return typeof entry.id === "string" && typeof entry.title === "string";
}
