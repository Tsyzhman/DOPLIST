"use client";

import { CheckCircle2, MessageSquareText } from "@/components/icons";
import { Button } from "@/components/Ui";
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
    <div className="scopelist-theme min-h-screen bg-main text-ink">
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="no-print mb-4 flex flex-wrap justify-end gap-2">
          <ThemeToggle theme={theme} onChange={setTheme} />
          <Button
            type="button"
            disabled={!approvalDestination}
            onClick={() => {
              handleCta("approve_scope", approvalDestination);
            }}
          >
            <CheckCircle2 size={16} aria-hidden="true" />
            Согласовать
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!discussionDestination}
            onClick={() => {
              handleCta("request_discussion", discussionDestination);
            }}
          >
            <MessageSquareText size={16} aria-hidden="true" />
            Обсудить
          </Button>
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
