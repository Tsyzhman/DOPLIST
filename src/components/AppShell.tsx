import { createDefaultProposalData } from "@/lib/proposal";
import { AppShellClient } from "./AppShellClient";

export function AppShell({
  listId,
  showLogout,
}: {
  listId: string;
  showLogout: boolean;
}) {
  return (
    <AppShellClient
      initialData={createDefaultProposalData()}
      listId={listId}
      showLogout={showLogout}
    />
  );
}
