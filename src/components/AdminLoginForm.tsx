"use client";

import { FormEvent, useState } from "react";
import { ShieldCheck } from "@/components/icons";
import { Button } from "./Ui";

type AdminLoginFormProps = {
  authConfigured: boolean;
  nextPath: string;
};

export function AdminLoginForm({
  authConfigured,
  nextPath,
}: AdminLoginFormProps) {
  const [secret, setSecret] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!authConfigured) {
      return;
    }

    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret, nextPath }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        nextPath?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(
          response.status === 401
            ? "Неверный ключ доступа"
            : result.error || "Не удалось выполнить вход",
        );
        return;
      }

      window.location.assign(result.nextPath || nextPath || "/");
    } catch {
      setError("Не удалось выполнить вход");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <section className="w-full rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-900 text-white">
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                SCOPELIST
              </p>
              <h1 className="mt-1 text-xl font-semibold text-zinc-950">
                Вход по ключу
              </h1>
            </div>
          </div>

          {!authConfigured ? (
            <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
              В production нужно задать ADMIN_ACCESS_TOKEN. Без него рабочий
              интерфейс закрыт.
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={submit}>
              <label className="block">
                <span className="text-sm font-medium text-zinc-700">
                  Ключ доступа
                </span>
                <input
                  autoFocus
                  autoComplete="current-password"
                  className="mt-1 h-11 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
                  placeholder="Введите секрет"
                  type="password"
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                />
              </label>

              {error ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  {error}
                </div>
              ) : null}

              <Button
                className="w-full"
                disabled={pending || !secret.trim()}
                type="submit"
              >
                <ShieldCheck size={16} aria-hidden="true" />
                {pending ? "Проверяем" : "Войти"}
              </Button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
