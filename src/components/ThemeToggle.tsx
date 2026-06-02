"use client";

import { Moon, Sun } from "@/components/icons";

export type ThemeMode = "light" | "dark";

type ThemeToggleProps = {
  theme: ThemeMode;
  onChange: (theme: ThemeMode) => void;
};

export const THEME_STORAGE_KEY = "doplist-ui-theme-v1";

export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  const isDark = theme === "dark";

  return (
    <div className="grid h-10 grid-cols-2 rounded-md border border-zinc-200 bg-zinc-50 p-1">
      <button
        type="button"
        aria-label="Светлая тема"
        aria-pressed={!isDark}
        onClick={() => onChange("light")}
        className={`inline-flex items-center justify-center rounded px-3 text-sm font-semibold transition ${
          !isDark
            ? "bg-white text-zinc-950 shadow-sm"
            : "text-zinc-500 hover:text-zinc-900"
        }`}
      >
        <Sun size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Темная тема"
        aria-pressed={isDark}
        onClick={() => onChange("dark")}
        className={`inline-flex items-center justify-center rounded px-3 text-sm font-semibold transition ${
          isDark
            ? "bg-white text-zinc-950 shadow-sm"
            : "text-zinc-500 hover:text-zinc-900"
        }`}
      >
        <Moon size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
