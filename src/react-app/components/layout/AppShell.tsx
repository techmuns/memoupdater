import type { ReactNode } from "react";
import { CommandBar } from "./CommandBar";

interface AppShellProps {
  children: ReactNode;
}

// Munshot 3-zone shell: sticky 48px header (CommandBar), a single scrollable
// main (the ONLY scroll area), no footer. The shell fills the iframe with
// height:100vh and never lets the page itself scroll. Content stays centered
// and capped so it doesn't stretch awkwardly on wide monitors.
export function AppShell({ children }: AppShellProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background:
          "linear-gradient(to bottom, rgba(249,250,251,0.8), #ffffff)",
      }}
    >
      <CommandBar />
      <main style={{ flex: 1, overflow: "auto", padding: "28px 40px" }}>
        <div className="max-w-[1320px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
