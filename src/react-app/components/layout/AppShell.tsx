import type { ReactNode } from "react";
import { CommandBar } from "./CommandBar";

interface AppShellProps {
  children: ReactNode;
}

// Dark "engine world" shell: a slim translucent command strip (CommandBar)
// that blends into the same dark ground as the content below it — no separate
// white top bar. A single scrollable main is the ONLY scroll area, no footer.
// The shell fills the iframe with height:100vh and never lets the page itself
// scroll. Content stays centered and capped so it doesn't stretch on wide
// monitors. The ambient radial glows echo the research engine's backdrop.
export function AppShell({ children }: AppShellProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: "var(--app-bg)",
      }}
    >
      <CommandBar />
      <main style={{ flex: 1, overflow: "auto", padding: "28px 40px" }}>
        <div className="max-w-[1320px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
