import { ArrowRight } from "@/components/icons";
import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
        {title}
      </h2>
      <p className="mt-3 text-base leading-7 text-zinc-600">{copy}</p>
    </div>
  );
}

export function SnapshotCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="proposal-card rounded-lg border border-zinc-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-zinc-950">{value}</div>
    </div>
  );
}

export function NarrativeCard({
  title,
  copy,
  empty,
}: {
  title: string;
  copy: string;
  empty: string;
}) {
  const text = copy.trim();

  return (
    <div className="proposal-card rounded-lg border border-zinc-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-zinc-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-zinc-700">{text || empty}</p>
    </div>
  );
}

export function NumberedListBlock({
  items,
  empty,
}: {
  items: string[];
  empty: string;
}) {
  return (
    <div className="mt-6 grid gap-3 md:grid-cols-2">
      {items.length > 0 ? (
        items.map((item, index) => (
          <div
            key={`${index}-${item}`}
            className="proposal-card flex gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-700"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-sm font-semibold text-emerald-800">
              {index + 1}
            </span>
            <span className="pt-1">{item}</span>
          </div>
        ))
      ) : (
        <div className="proposal-card rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
          {empty}
        </div>
      )}
    </div>
  );
}

export function ListBlock({
  icon,
  items,
  empty,
  className = "mt-6 grid gap-3 md:grid-cols-2",
}: {
  icon: ReactNode;
  items: string[];
  empty: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {items.length > 0 ? (
        items.map((item) => (
          <div
            key={item}
            className="proposal-card flex gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-700"
          >
            <span className="mt-0.5 text-emerald-700">{icon}</span>
            {item}
          </div>
        ))
      ) : (
        <div className="proposal-card rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
          {empty}
        </div>
      )}
    </div>
  );
}

export function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="font-semibold text-zinc-900">{title}</h4>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <ArrowRight
                size={14}
                className="mt-1 shrink-0 text-emerald-700"
                aria-hidden="true"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-zinc-500">Не заполнено.</p>
      )}
    </div>
  );
}

export function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "dark" | "light" | "warning" | "neutral" | "success" | "roadmap";
}) {
  const tones = {
    dark: "bg-zinc-950 text-white",
    light: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
    warning: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
    neutral: "bg-zinc-100 text-zinc-700",
    success: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
    roadmap: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
