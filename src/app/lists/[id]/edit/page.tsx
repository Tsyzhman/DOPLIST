import { AppShell } from "@/components/AppShell";

type EditScopeListPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditScopeListPage({
  params,
}: EditScopeListPageProps) {
  const { id } = await params;

  return <AppShell listId={id} />;
}
