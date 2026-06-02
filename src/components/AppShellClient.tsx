"use client";

import { Eye, Hammer, Layers3 } from "@/components/icons";
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
import { Badge } from "./Ui";
import {
  createDemoProposalData,
  createEmptyChangeItem,
  createId,
  normalizeProposalData,
  PROPOSAL_RECORD_ID_KEY,
  STORAGE_KEY,
} from "@/lib/proposal";
import type {
  ChangeItem,
  ProjectSettings,
  ProposalData,
  ProposalMode,
} from "@/lib/types";

type AppShellClientProps = {
  initialData: ProposalData;
};

export function AppShellClient({ initialData }: AppShellClientProps) {
  const [data, setData] = useState<ProposalData>(initialData);
  const [mode, setMode] = useState<ProposalMode>("builder");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [hydrated, setHydrated] = useState(false);
  const [serverProposalId, setServerProposalId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ChangeItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("Загружены демо-данные");

  useEffect(() => {
    let nextData: ProposalData | null = null;
    let nextNotice = "Загружены демо-данные";
    let nextServerProposalId: string | null = null;
    let nextTheme: ThemeMode | null = null;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const storedRecordId = window.localStorage.getItem(PROPOSAL_RECORD_ID_KEY);
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

      if (storedRecordId) {
        nextServerProposalId = storedRecordId;
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
      nextNotice = "Загружены демо-данные";
    }

    const timer = window.setTimeout(() => {
      if (nextData) {
        setData(nextData);
      }
      if (nextServerProposalId) {
        setServerProposalId(nextServerProposalId);
      }
      if (nextTheme) {
        setTheme(nextTheme);
      }
      setNotice(nextNotice);
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme, hydrated]);

  const activeId = editingId ?? editingItem?.id ?? null;

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
      alert("Не удалось импортировать JSON. Структура proposal не распознана.");
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
      window.localStorage.setItem(PROPOSAL_RECORD_ID_KEY, proposalId);
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
      alert(result.error || "Не удалось опубликовать клиентскую ссылку.");
      return;
    }

    try {
      await navigator.clipboard.writeText(result.publicUrl);
      setNotice("Публичная ссылка опубликована и скопирована");
    } catch {
      window.prompt("Скопируйте клиентскую ссылку", result.publicUrl);
      setNotice("Публичная ссылка подготовлена");
    }
  }

  function resetDemoData() {
    setData(createDemoProposalData());
    cancelEdit();
    setNotice("Демо-данные восстановлены");
  }

  return (
    <div className="doplist-theme min-h-screen bg-main text-ink">
      <header className="top-controls sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur no-print">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
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
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle theme={theme} onChange={setTheme} />
            <ImportExportControls
              data={data}
              onImport={importData}
              onCopyShareLink={copyShareLink}
              onReset={resetDemoData}
            />
            <div className="grid h-10 w-full grid-cols-2 rounded-md border border-zinc-200 bg-zinc-50 p-1 sm:w-auto">
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

      {mode === "builder" ? (
        <main className="builder-grid mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 py-6 xl:grid-cols-[minmax(0,760px)_minmax(520px,1fr)]">
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

          <div className="space-y-4">
            <SummaryCard data={data} />
            <ProposalPreview
              data={data}
              onToggleOptional={toggleOptionalSelected}
            />
          </div>
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
