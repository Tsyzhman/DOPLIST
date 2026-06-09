import { AppShell } from "@/components/AppShell";
import { isAdminAuthConfigured } from "@/lib/server/admin-auth";
import { requireAdminAccess } from "@/lib/server/admin-page-auth";

type EditScopeListPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function EditScopeListPage({
  params,
}: EditScopeListPageProps) {
  const { id } = await params;

  await requireAdminAccess(`/lists/${id}/edit`);

  return <AppShell listId={id} showLogout={isAdminAuthConfigured()} />;
}
