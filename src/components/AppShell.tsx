import { createDemoProposalData } from "@/lib/proposal";
import { AppShellClient } from "./AppShellClient";

export function AppShell() {
  return <AppShellClient initialData={createDemoProposalData()} />;
}
