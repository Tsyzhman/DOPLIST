import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import {
  getAdminAuthStatus,
  sanitizeAdminNextPath,
} from "@/lib/server/admin-auth";
import { hasAdminCookieAccess } from "@/lib/server/admin-page-auth";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Вход | SCOPELIST",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeAdminNextPath(readSearchParam(params.next));

  if (await hasAdminCookieAccess()) {
    redirect(nextPath);
  }

  return (
    <AdminLoginForm
      authConfigured={getAdminAuthStatus() === "enabled"}
      nextPath={nextPath}
    />
  );
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
