"use client";

import { Moon, Sun } from "@/components/icons";

export type ThemeMode = "light" | "dark";

type ThemeToggleProps = {
  theme: ThemeMode;
  onChange: (theme: ThemeMode) => void;
};

export const THEME_STORAGE_KEY = "scopelist-ui-theme-v1";

export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  const isDark = theme === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const label = isDark ? "Включить светлую тему" : "Включить тёмную тему";

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      onClick={() => onChange(nextTheme)}
      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-950 outline-none transition hover:bg-zinc-50 focus:ring-4 focus:ring-zinc-100"
    >
      {isDark ? (
        <Sun size={16} aria-hidden="true" />
      ) : (
        <Moon size={16} aria-hidden="true" />
      )}
    </button>
  );
}
