import { NewScopeListClient } from "@/components/NewScopeListClient";
import { requireAdminAccess } from "@/lib/server/admin-page-auth";

export const dynamic = "force-dynamic";

export default async function NewScopeListPage() {
  await requireAdminAccess("/lists/new");

  return <NewScopeListClient />;
}
