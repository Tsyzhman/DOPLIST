"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function NewScopeListClient() {
  const router = useRouter();

  useEffect(() => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `list-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    router.replace(`/lists/${id}/edit`);
  }, [router]);

  return (
    <main className="scopelist-theme flex min-h-screen items-center justify-center bg-main px-4 text-ink">
      <p className="text-sm font-semibold text-zinc-600">
        Создаём новое КП на доработки
      </p>
    </main>
  );
}
