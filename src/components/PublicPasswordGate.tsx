"use client";

import { ShieldCheck } from "@/components/icons";
import { FormEvent, useEffect, useState } from "react";
import {
  THEME_STORAGE_KEY,
  ThemeToggle,
  type ThemeMode,
} from "./ThemeToggle";

type PublicPasswordGateProps = {
  shareSlug: string;
  title: string;
};

export function PublicPasswordGate({ shareSlug, title }: PublicPasswordGateProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [themeHydrated, setThemeHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

      if (storedTheme === "light" || storedTheme === "dark") {
        setTheme(storedTheme);
      }
      setThemeHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!themeHydrated) {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, themeHydrated]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const response = await fetch(`/api/public/${shareSlug}/password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setPending(false);

    if (!response.ok) {
      setError("Пароль не подошел");
      return;
    }

    window.location.assign(`/p/${shareSlug}`);
  }

  return (
    <div
      className={`scopelist-theme scopelist-theme-${theme} relative flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-10 text-zinc-950`}
    >
      <div className="no-print absolute right-4 top-4">
        <ThemeToggle theme={theme} onChange={setTheme} />
      </div>
      <main className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
          <ShieldCheck size={22} aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-zinc-950">{title}</h1>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Пароль
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              autoComplete="current-password"
              autoFocus
            />
          </label>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-70"
          >
            {pending ? "Проверяем" : "Открыть"}
          </button>
        </form>
      </main>
    </div>
  );
}
