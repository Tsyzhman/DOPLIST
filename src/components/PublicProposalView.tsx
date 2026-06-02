"use client";

import { CheckCircle2, MessageSquareText } from "@/components/icons";
import { useEffect, useState } from "react";
import type { ProposalData, ProposalEventType } from "@/lib/types";
import { ProposalPreview } from "./ProposalPreview";
import {
  THEME_STORAGE_KEY,
  ThemeToggle,
  type ThemeMode,
} from "./ThemeToggle";

type PublicProposalViewProps = {
  data: ProposalData;
  shareSlug: string;
  allowPackageSelection: boolean;
};

export function PublicProposalView({
  data: initialData,
  shareSlug,
  allowPackageSelection,
}: PublicProposalViewProps) {
  const [data, setData] = useState(initialData);
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [themeHydrated, setThemeHydrated] = useState(false);
  const approvalDestination = normalizeCtaUrl(data.project.approvalUrl);
  const discussionDestination = normalizeCtaUrl(data.project.discussionUrl);

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
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme, themeHydrated]);

  function toggleOptional(id: string, selected: boolean) {
    if (!allowPackageSelection) {
      return;
    }

    setData((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id && item.optional ? { ...item, selected } : item,
      ),
    }));

    postPublicEvent(shareSlug, "package_selected", {
      packageId: id,
      metadata: { selected },
    });
  }

  function handleCta(action: string, destination: string) {
    postPublicEvent(shareSlug, "cta_clicked", {
      metadata: { action, destination: destination || null },
    });

    if (destination) {
      window.location.assign(destination);
    }
  }

  return (
    <div className="doplist-theme min-h-screen bg-main text-ink">
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="no-print mb-4 flex flex-wrap justify-end gap-2">
          <ThemeToggle theme={theme} onChange={setTheme} />
          <button
            type="button"
            disabled={!approvalDestination}
            onClick={() => {
              handleCta("approve_scope", approvalDestination);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 size={16} aria-hidden="true" />
            Согласовать
          </button>
          <button
            type="button"
            disabled={!discussionDestination}
            onClick={() => {
              handleCta("request_discussion", discussionDestination);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageSquareText size={16} aria-hidden="true" />
            Обсудить
          </button>
        </div>

        <ProposalPreview
          data={data}
          onToggleOptional={toggleOptional}
          readOnly={!allowPackageSelection}
        />
      </main>
    </div>
  );
}

function postPublicEvent(
  shareSlug: string,
  eventType: ProposalEventType,
  payload: {
    packageId?: string;
    metadata?: Record<string, unknown>;
  } = {},
) {
  const body = JSON.stringify({
    shareSlug,
    eventType,
    packageId: payload.packageId,
    metadata: payload.metadata,
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });

    if (navigator.sendBeacon("/api/public-events", blob)) {
      return;
    }
  }

  fetch("/api/public-events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

function normalizeCtaUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed);

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    const allowedProtocols = ["http:", "https:", "mailto:", "tel:"];

    return allowedProtocols.includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
