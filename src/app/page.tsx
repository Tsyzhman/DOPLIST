import { ScopeListDashboard } from "@/components/ScopeListDashboard";
import { isAdminAuthConfigured } from "@/lib/server/admin-auth";
import { requireAdminAccess } from "@/lib/server/admin-page-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireAdminAccess("/");

  return <ScopeListDashboard showLogout={isAdminAuthConfigured()} />;
}
