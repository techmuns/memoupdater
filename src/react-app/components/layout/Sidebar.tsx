import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Inbox,
  Fingerprint,
  Hammer,
  FileOutput,
  Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "../../lib/cn";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/intake", label: "Intake", icon: Inbox },
  { to: "/memo-dna", label: "Memo DNA", icon: Fingerprint },
  { to: "/builder", label: "Builder", icon: Hammer },
  { to: "/output", label: "Output", icon: FileOutput },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col">
      <div className="px-6 h-16 flex items-center gap-2 border-b border-[var(--color-border)]">
        <div className="w-7 h-7 rounded-md bg-[var(--color-accent)] flex items-center justify-center text-white font-semibold text-sm">
          M
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">
            Memo Updater
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">
            Buy-side research
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-medium"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]",
              )
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-subtle)] leading-relaxed">
        Phase 1 · Demo data only. Real parsing and LLM generation arrive in
        Phase 2.
      </div>
    </aside>
  );
}
