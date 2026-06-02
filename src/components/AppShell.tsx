import { createDefaultProposalData } from "@/lib/proposal";
import { AppShellClient } from "./AppShellClient";

export function AppShell({ listId }: { listId: string }) {
  return (
    <AppShellClient
      initialData={createDefaultProposalData()}
      listId={listId}
    />
  );
}
