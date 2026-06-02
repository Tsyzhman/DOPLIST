import { Download, FileUp, Sparkles } from "@/components/icons";
import { Button } from "@/components/Ui";
import { useRef } from "react";
import {
  createScopeListAiInputExampleData,
  exportProposalDataForJson,
} from "@/lib/proposal";
import type { ProposalData } from "@/lib/types";

type ImportExportControlsProps = {
  data: ProposalData;
  onImport: (data: unknown) => void;
};

function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportExportControls({
  data,
  onImport,
}: ImportExportControlsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  function exportJson() {
    const safeTitle =
      data.project.projectTitle
        .toLowerCase()
        .replace(/[^a-zа-я0-9]+/gi, "-")
        .replace(/^-|-$/g, "") || "scopelist";

    downloadJson(exportProposalDataForJson(data), `${safeTitle}.json`);
  }

  function downloadExample() {
    downloadJson(createScopeListAiInputExampleData(), "scopelist-example.json");
  }

  async function importJson(file: File | undefined) {
    if (!file) {
      return;
    }

    const text = await file.text();
    const parsed = JSON.parse(text);
    onImport(parsed);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="top-controls flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={downloadExample}
        title="Скачать пример структуры, чтобы заполнить с помощью AI"
      >
        <Sparkles size={16} aria-hidden="true" />
        Пример JSON
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => inputRef.current?.click()}
      >
        <FileUp size={16} aria-hidden="true" />
        Импорт
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          importJson(event.target.files?.[0]).catch(() => {
            alert(
              "Не удалось импортировать JSON. Проверьте структуру файла.",
            );
          });
        }}
      />
      <Button type="button" variant="ghost" onClick={exportJson}>
        <Download size={16} aria-hidden="true" />
        Экспорт JSON
      </Button>
    </div>
  );
}
