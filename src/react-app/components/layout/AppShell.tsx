import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { CommandBar } from "./CommandBar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <CommandBar />
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1320px] mx-auto px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
